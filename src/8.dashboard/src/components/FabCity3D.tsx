import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { StatusBadge } from "./StatusBadge";
import { Eye, RotateCw, Compass, Maximize2, Package, AlertOctagon, Activity, Radio, Sparkles, X, Minimize2 } from "lucide-react";

/* ── Interfaces ── */
interface MachineState {
  machine_id: string;
  stage: string;
  health: string;
  drift_pattern: string;
  drift_severity: number;
  records_processed: number;
  hybrid_score: number;
  parameters: Record<string, number>;
  root_causes?: string[];
  interlocked?: boolean;
}

interface FabCity3DProps {
  machines: MachineState[];
  selectedMachineId?: string;
  onSelectMachine?: (id: string) => void;
  height?: number | string;
}

interface WaferPod {
  id: number;
  path: string[];
  currentStep: number;
  progress: number;
  speed: number;
  group: THREE.Group;
  glowMesh: THREE.Mesh;
  status: "healthy" | "warning" | "critical";
}

/* ── Cleanroom Bay Stage Metadata ── */
const TOWER_COORDS: Record<
  string,
  { x: number; z: number; color: number; label: string; stage: string; bay: string }
> = {
  "INTAKE": { x: -28, z: -4, color: 0x38BDF8, label: "DATA INTAKE", stage: "Ingestion Hub", bay: "BAY-00" },
  "DEP-01": { x: -18, z: -4, color: 0x10B981, label: "DEP-01", stage: "CVD Deposition", bay: "BAY-01" },
  "LITHO-01": { x: -8, z: -4, color: 0x818CF8, label: "LITHO-01", stage: "EUV Photolithography", bay: "BAY-02" },
  "ETCH-01": { x: 3, z: -9, color: 0xF43F5E, label: "ETCH-01", stage: "Plasma Etch Chamber A", bay: "BAY-03A" },
  "ETCH-02": { x: 3, z: 1, color: 0xFB7185, label: "ETCH-02", stage: "Plasma Etch Chamber B", bay: "BAY-03B" },
  "CMP-01": { x: 14, z: -4, color: 0xA78BFA, label: "CMP-01", stage: "Chemical Planarization", bay: "BAY-04" },
  "CLEAN-01": { x: 24, z: -4, color: 0x06B6D4, label: "CLEAN-01", stage: "Wet Clean & Scrub", bay: "BAY-05" },
  "AI-CORE": { x: 3, z: 14, color: 0xFBBF24, label: "ARGUS CORE", stage: "Digital Twin Brain", bay: "AI-HUB" },
};

const VALID_TOOLS = ["DEP-01", "LITHO-01", "ETCH-01", "ETCH-02", "CMP-01", "CLEAN-01"];

const OHT_ROUTES = [
  ["INTAKE", "DEP-01"],
  ["DEP-01", "LITHO-01"],
  ["LITHO-01", "ETCH-01"],
  ["LITHO-01", "ETCH-02"],
  ["ETCH-01", "CMP-01"],
  ["ETCH-02", "CMP-01"],
  ["CMP-01", "CLEAN-01"],
  ["CLEAN-01", "AI-CORE"],
];

export function FabCity3D({
  machines,
  selectedMachineId = "ETCH-01",
  onSelectMachine,
  height = 540,
}: FabCity3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const autoRotateRef = useRef(false);
  const [inTransit, setInTransit] = useState(0);
  const [flagged, setFlagged] = useState(0);

  const machinesRef = useRef(machines);
  machinesRef.current = machines;
  const onSelRef = useRef(onSelectMachine);
  onSelRef.current = onSelectMachine;
  const selIdRef = useRef(selectedMachineId);
  selIdRef.current = selectedMachineId;

  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  const toolGroups = useRef<Map<string, THREE.Group>>(new Map());
  const radarRings = useRef<Map<string, THREE.Group>>(new Map());
  const plasmaViewports = useRef<Map<string, THREE.Mesh>>(new Map());
  const andonTowers = useRef<Map<string, { red: THREE.Mesh; amber: THREE.Mesh; green: THREE.Mesh }>>(new Map());
  const flashMap = useRef<Map<string, number>>(new Map());
  const ohtCurves = useRef<Map<string, THREE.CatmullRomCurve3>>(new Map());
  const waferPods = useRef<WaferPod[]>([]);
  const shockwaves = useRef<{ mesh: THREE.Mesh; progress: number }[]>([]);
  const selReticleRef = useRef<THREE.Group | null>(null);
  const targetCamPos = useRef<THREE.Vector3 | null>(null);
  const targetCamLook = useRef<THREE.Vector3 | null>(null);
  const prevRecordCount = useRef(0);
  const podSerial = useRef(1001);

  const focusOn = (x: number, z: number) => {
    targetCamLook.current = new THREE.Vector3(x, 3.5, z);
    targetCamPos.current = new THREE.Vector3(x + 10, 16, z + 18);
  };

  /* ── Initialize Three.js Scene ── */
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const W = el.clientWidth;
    const H = typeof height === "number" ? height : el.clientHeight || 540;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060913);
    scene.fog = new THREE.FogExp2(0x060913, 0.010);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, W / H, 0.5, 1000);
    camera.position.set(0, 36, 52);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    el.replaceChildren(renderer.domElement);

    const ctrl = new OrbitControls(camera, renderer.domElement);
    ctrl.enableDamping = true;
    ctrl.dampingFactor = 0.06;
    ctrl.maxPolarAngle = Math.PI / 2.05;
    ctrl.minDistance = 12;
    ctrl.maxDistance = 130;
    ctrl.target.set(0, 3.5, 0);
    controlsRef.current = ctrl;

    /* ── High-Tech Lighting ── */
    scene.add(new THREE.AmbientLight(0x94A3B8, 0.45));

    const keySun = new THREE.DirectionalLight(0xF8FAFC, 1.8);
    keySun.position.set(25, 55, 35);
    keySun.castShadow = true;
    keySun.shadow.mapSize.set(2048, 2048);
    keySun.shadow.camera.near = 10;
    keySun.shadow.camera.far = 150;
    keySun.shadow.camera.left = -45;
    keySun.shadow.camera.right = 45;
    keySun.shadow.camera.top = 45;
    keySun.shadow.camera.bottom = -45;
    keySun.shadow.bias = -0.0005;
    scene.add(keySun);

    const rimLightBlue = new THREE.DirectionalLight(0x38BDF8, 0.85);
    rimLightBlue.position.set(-45, 22, -25);
    scene.add(rimLightBlue);

    const rimLightViolet = new THREE.DirectionalLight(0xC084FC, 0.55);
    rimLightViolet.position.set(45, 18, 30);
    scene.add(rimLightViolet);

    /* ── High-Gloss Cleanroom Floor with Tile Matrix & Bay Guides ── */
    const floorGeo = new THREE.PlaneGeometry(170, 170);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x080E1A,
      roughness: 0.28,
      metalness: 0.65,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.05;
    floor.receiveShadow = true;
    scene.add(floor);

    // Fine cleanroom grid
    const mainGrid = new THREE.GridHelper(140, 70, 0x1E3A5F, 0x0D1F35);
    mainGrid.position.y = 0.01;
    scene.add(mainGrid);

    // Cleanroom Yellow Safety Corridor lines
    const laneMat = new THREE.MeshBasicMaterial({ color: 0xF59E0B, transparent: true, opacity: 0.22 });
    const laneGeo = new THREE.PlaneGeometry(68, 0.25);
    const lane1 = new THREE.Mesh(laneGeo, laneMat);
    lane1.rotation.x = -Math.PI / 2;
    lane1.position.set(-2, 0.03, -13);
    scene.add(lane1);

    const lane2 = new THREE.Mesh(laneGeo, laneMat);
    lane2.rotation.x = -Math.PI / 2;
    lane2.position.set(-2, 0.03, 6);
    scene.add(lane2);

    /* ── Ambient Airborne Cleanroom Particles (Laminar Flow) ── */
    const particleCount = 280;
    const pPositions = new Float32Array(particleCount * 3);
    const pVelocities = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      pPositions[i * 3] = (Math.random() - 0.5) * 80;
      pPositions[i * 3 + 1] = Math.random() * 26 + 1;
      pPositions[i * 3 + 2] = (Math.random() - 0.5) * 45;
      pVelocities[i] = 0.015 + Math.random() * 0.02;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPositions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x93C5FD,
      size: 0.45,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
    });
    const particleSystem = new THREE.Points(pGeo, pMat);
    scene.add(particleSystem);

    /* ── Selection Reticle ── */
    const selReticle = new THREE.Group();
    const selHex = new THREE.Mesh(
      new THREE.RingGeometry(4.3, 4.8, 6),
      new THREE.MeshBasicMaterial({ color: 0x38BDF8, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    );
    selHex.rotation.x = -Math.PI / 2;
    selReticle.add(selHex);

    const selCornerGeo = new THREE.RingGeometry(5.2, 5.5, 32, 1, 0, Math.PI / 3);
    for (let i = 0; i < 4; i++) {
      const corner = new THREE.Mesh(selCornerGeo, new THREE.MeshBasicMaterial({ color: 0x38BDF8, side: THREE.DoubleSide }));
      corner.rotation.x = -Math.PI / 2;
      corner.rotation.z = (i * Math.PI) / 2;
      selReticle.add(corner);
    }
    selReticle.position.set(3, 0.1, 1);
    scene.add(selReticle);
    selReticleRef.current = selReticle;

    /* ── Build Cleanroom Machine Assemblies ── */
    const machinesContainer = new THREE.Group();
    scene.add(machinesContainer);
    toolGroups.current.clear();
    radarRings.current.clear();
    plasmaViewports.current.clear();
    andonTowers.current.clear();

    const makeLabelSprite = (label: string, stage: string, bay: string, accentColor: number) => {
      const canvas = document.createElement("canvas");
      canvas.width = 440;
      canvas.height = 110;
      const ctx = canvas.getContext("2d")!;

      // Glass pill background
      ctx.fillStyle = "rgba(10, 16, 28, 0.88)";
      ctx.beginPath();
      ctx.roundRect(6, 6, 428, 98, 20);
      ctx.fill();

      // Glowing border
      const hex = "#" + accentColor.toString(16).padStart(6, "0");
      ctx.strokeStyle = hex;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(6, 6, 428, 98, 20);
      ctx.stroke();

      // Bay badge
      ctx.fillStyle = hex;
      ctx.font = "bold 20px 'JetBrains Mono', monospace";
      ctx.fillText(bay, 24, 42);

      // Tool Title
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 34px 'Space Grotesk', sans-serif";
      ctx.fillText(label, 24, 82);

      // Stage description
      ctx.fillStyle = "#94A3B8";
      ctx.font = "500 20px 'Space Grotesk', sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(stage, 410, 64);

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(7.5, 1.88, 1);
      return sprite;
    };

    Object.entries(TOWER_COORDS).forEach(([id, meta]) => {
      const toolGroup = new THREE.Group();
      toolGroup.position.set(meta.x, 0, meta.z);
      toolGroup.name = id;
      const col = meta.color;
      const isCore = id === "AI-CORE";
      const isIntake = id === "INTAKE";

      /* 1. Holographic Floor Radar Ring */
      const radarGroup = new THREE.Group();
      radarGroup.position.y = 0.08;

      const radarBase = new THREE.Mesh(
        new THREE.RingGeometry(3.6, 3.85, 48),
        new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, transparent: true, opacity: 0.65 })
      );
      radarBase.rotation.x = -Math.PI / 2;
      radarGroup.add(radarBase);

      const radarTick = new THREE.Mesh(
        new THREE.RingGeometry(3.0, 3.4, 48, 1, 0, Math.PI * 0.4),
        new THREE.MeshBasicMaterial({ color: 0xF8FAFC, side: THREE.DoubleSide, transparent: true, opacity: 0.75 })
      );
      radarTick.rotation.x = -Math.PI / 2;
      radarGroup.add(radarTick);

      toolGroup.add(radarGroup);
      radarRings.current.set(id, radarGroup);

      /* 2. Main Equipment Body (Heavy Cleanroom Chassis) */
      const baseWidth = isCore ? 6.2 : 5.2;
      const baseHeight = isCore ? 4.5 : 3.4;
      const baseDepth = isCore ? 6.2 : 4.8;

      const bodyGeo = new THREE.BoxGeometry(baseWidth, baseHeight, baseDepth);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x111827,
        metalness: 0.85,
        roughness: 0.22,
        emissive: 0x080D1A,
        emissiveIntensity: 0.4,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = baseHeight / 2 + 0.15;
      body.castShadow = true;
      body.receiveShadow = true;
      body.name = `${id}_BODY`;
      toolGroup.add(body);

      // Aluminum Bevel Skirt
      const skirtGeo = new THREE.BoxGeometry(baseWidth + 0.35, 0.3, baseDepth + 0.35);
      const skirtMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.2 });
      const skirt = new THREE.Mesh(skirtGeo, skirtMat);
      skirt.position.y = 0.15;
      toolGroup.add(skirt);

      // Front FOUP Wafer Load Port
      if (!isCore && !isIntake) {
        const foupGeo = new THREE.BoxGeometry(1.9, 1.3, 1.1);
        const foupMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, metalness: 0.7, roughness: 0.3 });
        const foup = new THREE.Mesh(foupGeo, foupMat);
        foup.position.set(0, 1.4, baseDepth / 2 + 0.45);
        foup.castShadow = true;
        toolGroup.add(foup);

        // Wafer slot glowing line
        const slotGeo = new THREE.BoxGeometry(1.4, 0.12, 0.05);
        const slotMat = new THREE.MeshBasicMaterial({ color: 0x38BDF8 });
        const slot = new THREE.Mesh(slotGeo, slotMat);
        slot.position.set(0, 1.4, baseDepth / 2 + 1.02);
        toolGroup.add(slot);
      }

      /* 3. Vacuum Process Chamber & Inspection Viewport */
      let chamberTopY = baseHeight + 0.15;
      if (!isCore) {
        // Cylindrical High-Vacuum Reaction Chamber
        const chamberRadius = 1.9;
        const chamberH = isIntake ? 2.5 : 3.8;
        const chamberGeo = new THREE.CylinderGeometry(chamberRadius, chamberRadius, chamberH, 28);
        const chamberMat = new THREE.MeshStandardMaterial({
          color: 0x64748B,
          metalness: 0.92,
          roughness: 0.18,
        });
        const chamber = new THREE.Mesh(chamberGeo, chamberMat);
        chamber.position.y = chamberTopY + chamberH / 2;
        chamber.castShadow = true;
        toolGroup.add(chamber);

        // Circular Glass Inspection Viewport
        const viewportRim = new THREE.Mesh(
          new THREE.CylinderGeometry(0.85, 0.85, 0.35, 20),
          new THREE.MeshStandardMaterial({ color: 0x0F172A, metalness: 0.95, roughness: 0.1 })
        );
        viewportRim.rotation.x = Math.PI / 2;
        viewportRim.position.set(0, chamberTopY + chamberH / 2, chamberRadius + 0.12);
        toolGroup.add(viewportRim);

        // Internal Glowing Plasma Core
        const plasmaCore = new THREE.Mesh(
          new THREE.SphereGeometry(0.65, 16, 16),
          new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85 })
        );
        plasmaCore.position.set(0, chamberTopY + chamberH / 2, chamberRadius - 0.05);
        toolGroup.add(plasmaCore);
        plasmaViewports.current.set(id, plasmaCore);

        chamberTopY += chamberH;
      } else {
        // ARGUS AI CITADEL Quantum Core Architecture
        const coreChamber = new THREE.Mesh(
          new THREE.CylinderGeometry(2.4, 2.8, 9.5, 6),
          new THREE.MeshStandardMaterial({ color: 0x0B132B, metalness: 0.95, roughness: 0.1, emissive: col, emissiveIntensity: 0.18 })
        );
        coreChamber.position.y = chamberTopY + 4.75;
        coreChamber.castShadow = true;
        toolGroup.add(coreChamber);

        const ringFloat1 = new THREE.Mesh(
          new THREE.TorusGeometry(3.6, 0.12, 12, 48),
          new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8 })
        );
        ringFloat1.rotation.x = Math.PI / 2;
        ringFloat1.position.y = chamberTopY + 4.8;
        toolGroup.add(ringFloat1);

        chamberTopY += 9.5;
      }

      /* 4. Machine Subsystem Variations */
      if (id === "LITHO-01") {
        // DUV/EUV Lens Column & Stepper Turret
        const opticsCol = new THREE.Mesh(
          new THREE.CylinderGeometry(0.9, 1.4, 3.6, 24),
          new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.92, roughness: 0.12 })
        );
        opticsCol.position.y = chamberTopY + 1.8;
        toolGroup.add(opticsCol);

        const lensGlow = new THREE.Mesh(
          new THREE.TorusGeometry(1.2, 0.12, 12, 32),
          new THREE.MeshBasicMaterial({ color: 0x818CF8 })
        );
        lensGlow.rotation.x = Math.PI / 2;
        lensGlow.position.y = chamberTopY + 3.2;
        toolGroup.add(lensGlow);
        chamberTopY += 3.6;
      } else if (id.startsWith("ETCH")) {
        // RF Generator Matching Box & Coils
        const rfBox = new THREE.Mesh(
          new THREE.BoxGeometry(2.4, 1.4, 2.4),
          new THREE.MeshStandardMaterial({ color: 0x1E293B, metalness: 0.85, roughness: 0.25 })
        );
        rfBox.position.y = chamberTopY + 0.7;
        toolGroup.add(rfBox);

        const rfCoil = new THREE.Mesh(
          new THREE.TorusGeometry(1.4, 0.09, 12, 32),
          new THREE.MeshBasicMaterial({ color: col })
        );
        rfCoil.rotation.x = Math.PI / 2;
        rfCoil.position.y = chamberTopY + 1.4;
        toolGroup.add(rfCoil);
        chamberTopY += 1.6;
      }

      /* 5. Cleanroom Andon Signal Tower (Physical 3-stage status pole) */
      const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.5, 12);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, metalness: 0.9, roughness: 0.15 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(baseWidth / 2 - 0.45, baseHeight + 0.8, -baseDepth / 2 + 0.45);
      toolGroup.add(pole);

      const lampGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.22, 16);
      const redLamp = new THREE.Mesh(lampGeo, new THREE.MeshBasicMaterial({ color: 0x2A0B0E }));
      redLamp.position.set(baseWidth / 2 - 0.45, baseHeight + 1.7, -baseDepth / 2 + 0.45);
      toolGroup.add(redLamp);

      const amberLamp = new THREE.Mesh(lampGeo, new THREE.MeshBasicMaterial({ color: 0x2A1C08 }));
      amberLamp.position.set(baseWidth / 2 - 0.45, baseHeight + 1.44, -baseDepth / 2 + 0.45);
      toolGroup.add(amberLamp);

      const greenLamp = new THREE.Mesh(lampGeo, new THREE.MeshBasicMaterial({ color: 0x10B981 }));
      greenLamp.position.set(baseWidth / 2 - 0.45, baseHeight + 1.18, -baseDepth / 2 + 0.45);
      toolGroup.add(greenLamp);

      andonTowers.current.set(id, { red: redLamp, amber: amberLamp, green: greenLamp });

      /* 6. Machine Sprite Label */
      const sprite = makeLabelSprite(meta.label, meta.stage, meta.bay, col);
      sprite.position.y = chamberTopY + 2.2;
      toolGroup.add(sprite);

      machinesContainer.add(toolGroup);
      toolGroups.current.set(id, toolGroup);
    });

    /* ── Overhead Hoist Transport (OHT) Monorail System ── */
    const ohtHeight = 8.5;
    const ohtRailGroup = new THREE.Group();
    scene.add(ohtRailGroup);
    ohtCurves.current.clear();

    OHT_ROUTES.forEach(([fId, tId]) => {
      const fc = TOWER_COORDS[fId], tc = TOWER_COORDS[tId];
      if (!fc || !tc) return;

      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(fc.x, ohtHeight, fc.z),
        new THREE.Vector3((fc.x + tc.x) / 2, ohtHeight + 0.6, (fc.z + tc.z) / 2),
        new THREE.Vector3(tc.x, ohtHeight, tc.z),
      ]);
      ohtCurves.current.set(`${fId}->${tId}`, curve);

      // Heavy rail spine
      const railGeo = new THREE.TubeGeometry(curve, 32, 0.16, 8, false);
      const railMat = new THREE.MeshStandardMaterial({
        color: 0x1E293B,
        metalness: 0.9,
        roughness: 0.2,
      });
      ohtRailGroup.add(new THREE.Mesh(railGeo, railMat));

      // Luminous blue monorail guide beam
      const glowGeo = new THREE.TubeGeometry(curve, 32, 0.05, 6, false);
      const glowMat = new THREE.MeshBasicMaterial({ color: 0x38BDF8, transparent: true, opacity: 0.75 });
      ohtRailGroup.add(new THREE.Mesh(glowGeo, glowMat));

      // Support drop trusses to ground
      const trussGeo = new THREE.CylinderGeometry(0.08, 0.08, ohtHeight, 8);
      const trussMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
      const tMesh = new THREE.Mesh(trussGeo, trussMat);
      tMesh.position.set(fc.x, ohtHeight / 2, fc.z);
      ohtRailGroup.add(tMesh);
    });

    /* ── Wafer Carrier Pod Spawner ── */
    const spawnPod = (initProgress = 0) => {
      const n = podSerial.current++;
      const path = ["INTAKE", "DEP-01", "LITHO-01", n % 2 === 0 ? "ETCH-02" : "ETCH-01", "CMP-01", "CLEAN-01", "AI-CORE"];

      const podGroup = new THREE.Group();

      // Aerodynamic Cleanroom Carrier Pod
      const podBody = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.6, 0.9),
        new THREE.MeshStandardMaterial({ color: 0xF8FAFC, metalness: 0.3, roughness: 0.2 })
      );
      podGroup.add(podBody);

      // Top Monorail Glider Claw
      const claw = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x0F172A, metalness: 0.9, roughness: 0.1 })
      );
      claw.position.y = 0.45;
      podGroup.add(claw);

      // Silicon Wafer Disc (300mm Mirror Silicon)
      const wafer = new THREE.Mesh(
        new THREE.CylinderGeometry(0.48, 0.48, 0.04, 32),
        new THREE.MeshStandardMaterial({ color: 0x38BDF8, metalness: 0.95, roughness: 0.05 })
      );
      wafer.position.y = -0.42;
      podGroup.add(wafer);

      // Carrier Glow Aura
      const aura = new THREE.Mesh(
        new THREE.SphereGeometry(0.85, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0x38BDF8, transparent: true, opacity: 0.28 })
      );
      podGroup.add(aura);

      scene.add(podGroup);
      waferPods.current.push({
        id: n,
        path,
        currentStep: 0,
        progress: initProgress,
        speed: 0.0035 + Math.random() * 0.0015,
        group: podGroup,
        glowMesh: aura,
        status: "healthy",
      });
    };

    waferPods.current = [];
    for (let i = 0; i < 4; i++) {
      spawnPod(i * 0.24);
    }

    /* ── Raycasting & Mouse Interaction ── */
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let downPos = { x: 0, y: 0 };
    let downTime = 0;

    const onPointerMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster.intersectObjects(machinesContainer.children, true);
      if (intersects.length > 0) {
        let obj: THREE.Object3D | null = intersects[0].object;
        while (obj && obj.parent !== machinesContainer) obj = obj.parent;
        if (obj?.name && TOWER_COORDS[obj.name]) {
          el.style.cursor = "pointer";
          setHoveredNode(obj.name);
          return;
        }
      }
      el.style.cursor = "default";
      setHoveredNode(null);
    };

    const onPointerDown = (e: MouseEvent) => {
      downPos = { x: e.clientX, y: e.clientY };
      downTime = performance.now();
    };

    const onPointerUp = (e: MouseEvent) => {
      if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 6 || performance.now() - downTime > 400) return;
      const rect = el.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster.intersectObjects(machinesContainer.children, true);
      if (intersects.length > 0) {
        let obj: THREE.Object3D | null = intersects[0].object;
        while (obj && obj.parent !== machinesContainer) obj = obj.parent;
        if (obj?.name && VALID_TOOLS.includes(obj.name)) {
          const cid = obj.name;
          triggerShockwave(scene, TOWER_COORDS[cid]?.x ?? 0, TOWER_COORDS[cid]?.z ?? 0, TOWER_COORDS[cid]?.color ?? 0xFFFFFF);
          if (selIdRef.current === cid) {
            // Clicked already-selected tool: deselect & reset to overview
            onSelRef.current?.("");
            targetCamPos.current = new THREE.Vector3(0, 34, 48);
            targetCamLook.current = new THREE.Vector3(0, 3.8, 0);
          } else {
            onSelRef.current?.(cid);
            focusOn(TOWER_COORDS[cid]?.x ?? 0, TOWER_COORDS[cid]?.z ?? 0);
          }
          return;
        }
      } else {
        // Clicked outside / cleanroom floor: reset to factory overview!
        if (selIdRef.current) {
          onSelRef.current?.("");
          targetCamPos.current = new THREE.Vector3(0, 34, 48);
          targetCamLook.current = new THREE.Vector3(0, 3.8, 0);
        }
      }
    };

    el.addEventListener("mousemove", onPointerMove);
    el.addEventListener("mousedown", onPointerDown);
    el.addEventListener("mouseup", onPointerUp);

    /* ── Render Loop ── */
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Camera Smooth Orbit / Lerp Focus
      ctrl.autoRotate = autoRotateRef.current;
      ctrl.autoRotateSpeed = 0.55;

      if (targetCamPos.current && targetCamLook.current) {
        camera.position.lerp(targetCamPos.current, 0.08);
        ctrl.target.lerp(targetCamLook.current, 0.08);
        if (camera.position.distanceTo(targetCamPos.current) < 0.2) {
          targetCamPos.current = null;
          targetCamLook.current = null;
        }
      }
      ctrl.update();

      // Laminar Particle Drift
      const pAttr = particleSystem.geometry.attributes.position as THREE.BufferAttribute;
      const posArr = pAttr.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        posArr[i * 3 + 1] -= pVelocities[i];
        if (posArr[i * 3 + 1] <= 0.2) {
          posArr[i * 3 + 1] = 26;
        }
      }
      pAttr.needsUpdate = true;

      // Animate Floor Radars & Plasma Viewports
      radarRings.current.forEach((rg, id) => {
        rg.rotation.y += 0.018;
      });

      plasmaViewports.current.forEach((pv, id) => {
        const pulse = 1.0 + Math.sin(t * 6.0 + id.charCodeAt(0)) * 0.18;
        pv.scale.set(pulse, pulse, pulse);
      });

      // Selection Reticle Spin & Position
      if (selReticleRef.current && selIdRef.current) {
        const curMeta = TOWER_COORDS[selIdRef.current];
        if (curMeta) {
          selReticleRef.current.position.set(curMeta.x, 0.1, curMeta.z);
          selReticleRef.current.rotation.y += 0.015;
        }
      }

      // Wafer Pods Overhead Monorail Traversal
      const survivingPods: WaferPod[] = [];
      let flaggedPods = 0;

      waferPods.current.forEach((pod) => {
        const fromNode = pod.path[pod.currentStep];
        const toNode = pod.path[pod.currentStep + 1];
        const curve = ohtCurves.current.get(`${fromNode}->${toNode}`);

        if (!curve) {
          scene.remove(pod.group);
          return;
        }

        pod.progress += pod.speed;
        if (pod.progress >= 1.0) {
          pod.currentStep++;
          pod.progress = 0.0;

          // Check machine health at arrival station
          const arrivalMachine = machinesRef.current.find((m) => m.machine_id === toNode);
          if (arrivalMachine?.health === "critical" || arrivalMachine?.health === "interlocked") {
            pod.status = "critical";
            (pod.glowMesh.material as THREE.MeshBasicMaterial).color.setHex(0xEF4444);
          } else if (arrivalMachine?.health === "warning" && pod.status !== "critical") {
            pod.status = "warning";
            (pod.glowMesh.material as THREE.MeshBasicMaterial).color.setHex(0xF59E0B);
          }

          if (pod.currentStep >= pod.path.length - 1) {
            scene.remove(pod.group);
            return;
          }
        }

        const point = curve.getPointAt(Math.min(pod.progress, 0.999));
        pod.group.position.copy(point);

        if (pod.progress < 0.995) {
          const nextPoint = curve.getPointAt(Math.min(pod.progress + 0.02, 0.999));
          pod.group.lookAt(nextPoint);
        }

        if (pod.status !== "healthy") flaggedPods++;
        survivingPods.push(pod);
      });

      waferPods.current = survivingPods;
      setInTransit(survivingPods.length);
      setFlagged(flaggedPods);

      // Shockwaves
      const aliveShockwaves: { mesh: THREE.Mesh; progress: number }[] = [];
      shockwaves.current.forEach((sw) => {
        sw.progress += 0.035;
        const scale = 1 + sw.progress * 8.5;
        sw.mesh.scale.set(scale, 1, scale);
        (sw.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - sw.progress) * 0.85);
        if (sw.progress < 1.0) {
          aliveShockwaves.push(sw);
        } else {
          scene.remove(sw.mesh);
        }
      });
      shockwaves.current = aliveShockwaves;

      // Dynamic spawn on new processed wafers
      const totalProcessed = machinesRef.current.reduce((acc, m) => acc + (m.records_processed || 0), 0);
      if (totalProcessed > prevRecordCount.current) {
        const delta = Math.min(2, Math.max(1, totalProcessed - prevRecordCount.current));
        for (let i = 0; i < delta; i++) spawnPod(0);
        prevRecordCount.current = totalProcessed;
      }

      renderer.render(scene, camera);
    };
    animate();

    const resizeObserver = new ResizeObserver(() => {
      const nw = el.clientWidth;
      const nh = typeof height === "number" ? height : el.clientHeight || 540;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    });
    resizeObserver.observe(el);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      el.removeEventListener("mousemove", onPointerMove);
      el.removeEventListener("mousedown", onPointerDown);
      el.removeEventListener("mouseup", onPointerUp);
      waferPods.current.forEach((p) => scene.remove(p.group));
      renderer.dispose();
      scene.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  /* ── Sync Machine Telemetry with Andon Towers & Viewports ── */
  useEffect(() => {
    machines.forEach((m) => {
      const andon = andonTowers.current.get(m.machine_id);
      const isCritical = m.health === "critical" || m.health === "interlocked";
      const isWarning = m.health === "warning";
      const isNominal = !isCritical && !isWarning;

      if (andon) {
        (andon.red.material as THREE.MeshBasicMaterial).color.setHex(isCritical ? 0xEF4444 : 0x2A0B0E);
        (andon.amber.material as THREE.MeshBasicMaterial).color.setHex(isWarning ? 0xF59E0B : 0x2A1C08);
        (andon.green.material as THREE.MeshBasicMaterial).color.setHex(isNominal ? 0x10B981 : 0x063B28);
      }

      const viewport = plasmaViewports.current.get(m.machine_id);
      if (viewport) {
        const plasmaCol = isCritical ? 0xEF4444 : isWarning ? 0xF59E0B : TOWER_COORDS[m.machine_id]?.color ?? 0x10B981;
        (viewport.material as THREE.MeshBasicMaterial).color.setHex(plasmaCol);
      }
    });
  }, [machines]);

  const resetToOverview = () => {
    onSelectMachine?.("");
    targetCamPos.current = new THREE.Vector3(0, 34, 48);
    targetCamLook.current = new THREE.Vector3(0, 3.8, 0);
  };

  /* ── Keyboard Esc Listener to Reset View ── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        resetToOverview();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  /* ── Selection Change ── */
  useEffect(() => {
    if (!selectedMachineId) {
      if (selReticleRef.current) selReticleRef.current.visible = false;
      targetCamPos.current = new THREE.Vector3(0, 34, 48);
      targetCamLook.current = new THREE.Vector3(0, 3.8, 0);
      return;
    }
    if (selReticleRef.current) selReticleRef.current.visible = true;
    const meta = TOWER_COORDS[selectedMachineId];
    if (meta) {
      focusOn(meta.x, meta.z);
    }
  }, [selectedMachineId]);

  const setCameraPreset = (type: "iso" | "top" | "focus") => {
    if (!cameraRef.current || !controlsRef.current) return;
    if (type === "iso") {
      resetToOverview();
    } else if (type === "top") {
      targetCamPos.current = new THREE.Vector3(0, 68, 2);
      targetCamLook.current = new THREE.Vector3(0, 0, 0);
    } else if (type === "focus" && selectedMachineId) {
      const meta = TOWER_COORDS[selectedMachineId];
      if (meta) focusOn(meta.x, meta.z);
    }
  };

  const handleSelectTool = (id: string) => {
    if (selectedMachineId === id) {
      // Toggle off when clicking the active tool chip
      resetToOverview();
      return;
    }
    onSelectMachine?.(id);
    const meta = TOWER_COORDS[id];
    if (meta) focusOn(meta.x, meta.z);
  };

  const selectedMachine = machines.find((m) => m.machine_id === selectedMachineId) ?? null;
  const statusColorHex =
    selectedMachine?.health === "critical" || selectedMachine?.health === "interlocked"
      ? "#EF4444"
      : selectedMachine?.health === "warning"
        ? "#F59E0B"
        : "#10B981";

  const triggerShockwave = (scene: THREE.Scene, x: number, z: number, color: number) => {
    const shockMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
    const shockMesh = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.2, 32), shockMat);
    shockMesh.rotation.x = -Math.PI / 2;
    shockMesh.position.set(x, 0.12, z);
    scene.add(shockMesh);
    shockwaves.current.push({ mesh: shockMesh, progress: 0 });
  };

  return (
    <div style={{ position: "relative", width: "100%", height, borderRadius: 28, overflow: "hidden", background: "#060913" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* ── TIER 1: TOP NAVIGATION ROW (STATUS ON LEFT, CAMERA ON RIGHT) ── */}
      <div
        style={{
          position: "absolute",
          top: 14,
          left: 14,
          right: 14,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 10,
          pointerEvents: "none",
        }}
      >
        {/* TOP LEFT: COMPACT FAB STATUS PILL */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(10, 16, 28, 0.88)",
            backdropFilter: "blur(20px)",
            padding: "6px 14px",
            borderRadius: 9999,
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            pointerEvents: "auto",
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 10px #10B981" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#F8FAFC", fontFamily: "'Space Grotesk', sans-serif", letterSpacing: "0.04em" }}>
            ARGUS 3D TWIN
          </span>
          <div style={{ width: 1, height: 12, background: "rgba(255,255,255,0.15)", margin: "0 2px" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "#94A3B8" }}>
            <Package size={12} style={{ color: "#38BDF8" }} />
            <span><strong style={{ color: "#FFF" }}>{inTransit}</strong> Pods</span>
          </div>
          <div style={{ width: 1, height: 12, background: "rgba(255,255,255,0.15)", margin: "0 2px" }} />
          <span style={{ fontSize: 10, color: flagged > 0 ? "#F59E0B" : "#10B981", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
            {flagged > 0 ? `${flagged} Flagged` : "All Nominal"}
          </span>
        </div>

        {/* TOP RIGHT: CAMERA CONTROLS */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "rgba(10, 16, 28, 0.88)",
            backdropFilter: "blur(20px)",
            padding: "4px 8px",
            borderRadius: 9999,
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
            pointerEvents: "auto",
          }}
        >
          {[
            { t: "iso" as const, I: Compass, l: "ISO" },
            { t: "top" as const, I: Eye, l: "TOP" },
            { t: "focus" as const, I: Maximize2, l: "FOCUS" },
          ].map(({ t, I, l }) => (
            <button
              key={t}
              onClick={() => setCameraPreset(t)}
              style={{
                padding: "4px 10px",
                fontSize: 11,
                borderRadius: 9999,
                background: "transparent",
                color: "#CBD5E1",
                border: "none",
                cursor: "pointer",
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 5,
                transition: "all 0.15s ease",
              }}
            >
              <I size={12} /> {l}
            </button>
          ))}

          <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.15)", margin: "0 2px" }} />

          <button
            onClick={() => {
              setAutoRotate((prev) => {
                autoRotateRef.current = !prev;
                return !prev;
              });
            }}
            style={{
              padding: "4px 11px",
              fontSize: 11,
              borderRadius: 9999,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 600,
              background: autoRotate ? "rgba(56, 189, 248, 0.22)" : "transparent",
              color: autoRotate ? "#38BDF8" : "#CBD5E1",
              border: autoRotate ? "1px solid #38BDF8" : "1px solid transparent",
              transition: "all 0.18s ease",
            }}
          >
            <RotateCw size={11} /> ORBIT
          </button>
        </div>
      </div>

      {/* ── TIER 2: CLEANROOM STATIONS DOCK (DEDICATED ROW, ZERO OVERLAP) ── */}
      <div
        style={{
          position: "absolute",
          top: 56,
          left: 14,
          display: "flex",
          alignItems: "center",
          gap: 5,
          background: "rgba(10, 16, 28, 0.88)",
          backdropFilter: "blur(20px)",
          padding: "4px 8px",
          borderRadius: 9999,
          border: "1px solid rgba(255,255,255,0.1)",
          zIndex: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          maxWidth: "calc(100% - 28px)",
          overflowX: "auto",
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: "#64748B",
            fontFamily: "'JetBrains Mono', monospace",
            padding: "0 6px 0 4px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          BAYS
        </span>
        {VALID_TOOLS.map((id) => {
          const m = machines.find((x) => x.machine_id === id);
          const isSel = selectedMachineId === id;
          const sc =
            m?.health === "critical" || m?.health === "interlocked"
              ? "#EF4444"
              : m?.health === "warning"
              ? "#F59E0B"
              : "#10B981";

          return (
            <button
              key={id}
              onClick={() => handleSelectTool(id)}
              style={{
                padding: "3px 10px",
                fontSize: 11,
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: isSel ? 700 : 500,
                borderRadius: 9999,
                cursor: "pointer",
                border: isSel ? `1px solid ${sc}` : "1px solid transparent",
                background: isSel ? "rgba(255,255,255,0.12)" : "transparent",
                color: isSel ? "#FFF" : "#94A3B8",
                display: "flex",
                alignItems: "center",
                gap: 5,
                transition: "all 0.18s ease",
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc, boxShadow: `0 0 6px ${sc}` }} />
              <span>{id}</span>
            </button>
          );
        })}

        {/* RESET VIEW / ZOOM OUT BUTTON */}
        {selectedMachineId && (
          <button
            onClick={resetToOverview}
            style={{
              padding: "3px 9px",
              fontSize: 10,
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              borderRadius: 9999,
              cursor: "pointer",
              border: "1px solid rgba(239, 68, 68, 0.5)",
              background: "rgba(239, 68, 68, 0.2)",
              color: "#FCA5A5",
              display: "flex",
              alignItems: "center",
              gap: 4,
              transition: "all 0.18s ease",
              marginLeft: 4,
              whiteSpace: "nowrap",
            }}
            title="Deselect tool & zoom out to whole factory (Esc)"
          >
            <X size={11} />
            <span>EXIT (ESC)</span>
          </button>
        )}
      </div>

      {/* HOVER TOOLTIP */}
      {hoveredNode && TOWER_COORDS[hoveredNode] && (
        <div style={{ position: "absolute", bottom: 16, left: 16, background: "rgba(10, 16, 28, 0.94)", backdropFilter: "blur(20px)", border: "1px solid rgba(56, 189, 248, 0.5)", padding: "9px 16px", borderRadius: 16, color: "#F8FAFC", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", display: "flex", alignItems: "center", gap: 9, zIndex: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
          <Sparkles size={14} style={{ color: "#38BDF8" }} />
          <span>
            <strong style={{ color: "#FFF" }}>{TOWER_COORDS[hoveredNode].label}</strong>
            <span style={{ color: "#94A3B8", marginLeft: 7 }}>— {TOWER_COORDS[hoveredNode].stage}</span>
          </span>
          <span style={{ fontSize: 10, color: "#64748B", marginLeft: 4 }}>• Click to focus</span>
        </div>
      )}

      {/* SELECTED MACHINE HUD CARD */}
      {selectedMachine && selectedMachine.machine_id && (
        <div
          style={{
            position: "absolute",
            bottom: 16,
            right: 16,
            width: 330,
            background: "rgba(10, 16, 28, 0.90)",
            backdropFilter: "blur(24px)",
            border: `1px solid ${selectedMachine.health === "critical" || selectedMachine.health === "interlocked"
                ? "rgba(239,68,68,0.5)"
                : selectedMachine.health === "warning"
                  ? "rgba(245,158,11,0.5)"
                  : "rgba(255,255,255,0.12)"
              }`,
            borderRadius: 24,
            padding: "16px 20px",
            color: "#F8FAFC",
            boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                {selectedMachine.stage}
              </div>
              <div style={{ fontSize: 21, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", color: "#FFFFFF", marginTop: 1 }}>
                {selectedMachine.machine_id}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StatusBadge status={selectedMachine.health} />
              <button
                onClick={resetToOverview}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#CBD5E1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                title="Close inspector & zoom out to whole factory (Esc)"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 10, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
              <span>CUSUM DRIFT SEVERITY</span>
              <span style={{ color: statusColorHex, fontWeight: 700 }}>{(selectedMachine.drift_severity * 100).toFixed(1)}%</span>
            </div>
            <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 9999, height: 6, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  borderRadius: 9999,
                  width: `${Math.min(100, selectedMachine.drift_severity * 100).toFixed(1)}%`,
                  background: `linear-gradient(90deg, ${statusColorHex}88, ${statusColorHex})`,
                  transition: "width 0.5s ease",
                }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            {[
              { label: "Wafers Processed", value: (selectedMachine.records_processed || 0).toLocaleString() },
              { label: "Anomaly Index", value: (selectedMachine.hybrid_score || 0).toFixed(3) },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: "rgba(255,255,255,0.05)", padding: "8px 12px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "#94A3B8", fontFamily: "'Space Grotesk', sans-serif", textTransform: "uppercase", marginBottom: 2 }}>
                  <Activity size={10} /> {label}
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 14, color: "#FFF" }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10 }}>
            <div style={{ fontSize: 9, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 7 }}>
              Live Cleanroom Sensors
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {Object.entries(selectedMachine.parameters || {}).slice(0, 4).map(([k, v]) => {
                const isRoot = selectedMachine.root_causes?.includes(k);
                const barPercent = Math.min(100, Math.abs(v) * 30);
                return (
                  <div key={k}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: "'JetBrains Mono', monospace", marginBottom: 2 }}>
                      <span style={{ color: isRoot ? "#FCD34D" : "#CBD5E1", textTransform: "capitalize", display: "flex", alignItems: "center", gap: 4 }}>
                        {isRoot && <span style={{ color: "#F59E0B", fontSize: 8 }}>⚠</span>}
                        {k.replace(/_/g, " ")}
                      </span>
                      <span style={{ color: isRoot ? "#FDE68A" : "#FFFFFF", fontWeight: 600 }}>
                        {typeof v === "number" ? v.toFixed(3) : v}
                      </span>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 9999, height: 3, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          borderRadius: 9999,
                          width: `${barPercent}%`,
                          background: isRoot ? "#F59E0B" : "#38BDF8",
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Zoom-Out Footer Button */}
          <button
            onClick={resetToOverview}
            style={{
              width: "100%",
              marginTop: 12,
              padding: "7px 0",
              borderRadius: 12,
              background: "rgba(255, 255, 255, 0.06)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#CBD5E1",
              fontSize: 11,
              fontWeight: 600,
              fontFamily: "'Space Grotesk', sans-serif",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              transition: "all 0.15s ease",
            }}
            title="Exit machine view & zoom out to whole factory overview (Esc)"
          >
            <Minimize2 size={12} />
            <span>Zoom Out / Whole Factory (Esc)</span>
          </button>
        </div>
      )}
    </div>
  );
}
