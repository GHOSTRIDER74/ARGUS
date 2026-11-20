import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { StatusBadge } from "./StatusBadge";
import { Eye, RotateCw, Compass, Maximize2, Package, Users, Activity, Sparkles, X, Minimize2, CheckCircle2, Play, Navigation } from "lucide-react";

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

interface WorkerWaypoint {
  x: number;
  z: number;
  action?: "pickup" | "drop" | "inspect" | "walk";
  targetMachine?: string;
  dwellTime?: number;
}

interface CleanroomWorker {
  id: string;
  name: string;
  role: string;
  group: THREE.Group;
  torsoGroup: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  carriedFoup: THREE.Group;
  tabletMesh?: THREE.Mesh;
  waypoints: WorkerWaypoint[];
  currentWaypointIdx: number;
  walkCycle: number;
  state: "walking" | "interacting";
  stateTimer: number;
  hasFoup: boolean;
  speed: number;
}

interface CleanroomAMR {
  group: THREE.Group;
  beacon: THREE.Mesh;
  waypoints: { x: number; z: number }[];
  currentWaypointIdx: number;
  speed: number;
}

/* ── Cleanroom Bay Stage Metadata ── */
const TOWER_COORDS: Record<
  string,
  { x: number; z: number; color: number; label: string; stage: string; bay: string }
> = {
  "INTAKE": { x: -28, z: -4, color: 0x0284C7, label: "DATA INTAKE", stage: "Ingestion Hub", bay: "BAY-00" },
  "DEP-01": { x: -18, z: -4, color: 0x059669, label: "DEP-01", stage: "CVD Deposition", bay: "BAY-01" },
  "LITHO-01": { x: -8, z: -4, color: 0x6366F1, label: "LITHO-01", stage: "EUV Photolithography", bay: "BAY-02" },
  "ETCH-01": { x: 3, z: -9, color: 0xE11D48, label: "ETCH-01", stage: "Plasma Etch Chamber A", bay: "BAY-03A" },
  "ETCH-02": { x: 3, z: 1, color: 0xF43F5E, label: "ETCH-02", stage: "Plasma Etch Chamber B", bay: "BAY-03B" },
  "CMP-01": { x: 14, z: -4, color: 0x8B5CF6, label: "CMP-01", stage: "Chemical Planarization", bay: "BAY-04" },
  "CLEAN-01": { x: 24, z: -4, color: 0x0891B2, label: "CLEAN-01", stage: "Wet Clean & Scrub", bay: "BAY-05" },
  "AI-CORE": { x: 34, z: -4, color: 0x06B6D4, label: "ARGUS CORE", stage: "Digital Twin Brain", bay: "AI-HUB" },
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

/* ── 3D Asset Creators for Cleanroom Personnel & Robots ── */
function createCleanroomWorker(suitColor = 0xFFFFFF, stripeColor = 0x0284C7, hasTablet = false) {
  const group = new THREE.Group();

  const torsoGroup = new THREE.Group();
  torsoGroup.position.y = 1.35;
  group.add(torsoGroup);

  const suitMat = new THREE.MeshStandardMaterial({
    color: suitColor,
    roughness: 0.35,
    metalness: 0.1,
  });

  const stripeMat = new THREE.MeshStandardMaterial({
    color: stripeColor,
    roughness: 0.3,
    metalness: 0.2,
  });

  // Torso (bunny suit body)
  const torsoGeo = new THREE.BoxGeometry(0.72, 0.9, 0.44);
  const torso = new THREE.Mesh(torsoGeo, suitMat);
  torso.castShadow = true;
  torsoGroup.add(torso);

  // Cleanroom badge stripe
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.16, 0.46), stripeMat);
  stripe.position.y = 0.16;
  torsoGroup.add(stripe);

  // Helmet / Hood
  const headGeo = new THREE.SphereGeometry(0.32, 16, 16);
  const head = new THREE.Mesh(headGeo, suitMat);
  head.position.y = 0.72;
  head.castShadow = true;
  torsoGroup.add(head);

  // Tinted reflective cleanroom face shield / visor
  const visorGeo = new THREE.SphereGeometry(0.24, 16, 16, 0, Math.PI, 0, Math.PI * 0.65);
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x0284C7,
    roughness: 0.08,
    metalness: 0.92,
    emissive: 0x0369A1,
    emissiveIntensity: 0.25,
  });
  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.rotation.x = -Math.PI / 8;
  visor.position.set(0, 0.72, 0.15);
  torsoGroup.add(visor);

  // PAPR Respirator / Air Pack on back
  const packGeo = new THREE.BoxGeometry(0.44, 0.52, 0.22);
  const packMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.6 });
  const pack = new THREE.Mesh(packGeo, packMat);
  pack.position.set(0, 0.08, -0.32);
  pack.castShadow = true;
  torsoGroup.add(pack);

  // Green status LED on air pack
  const led = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x10B981 })
  );
  led.position.set(0.12, 0.26, -0.44);
  torsoGroup.add(led);

  // Left Leg
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.2, 0.9, 0);
  group.add(leftLeg);

  const legGeo = new THREE.BoxGeometry(0.26, 0.85, 0.26);
  const lLegMesh = new THREE.Mesh(legGeo, suitMat);
  lLegMesh.position.y = -0.42;
  lLegMesh.castShadow = true;
  leftLeg.add(lLegMesh);

  const bootGeo = new THREE.BoxGeometry(0.28, 0.18, 0.38);
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x0F172A, roughness: 0.6 });
  const lBoot = new THREE.Mesh(bootGeo, bootMat);
  lBoot.position.set(0, -0.82, 0.05);
  lBoot.castShadow = true;
  leftLeg.add(lBoot);

  // Right Leg
  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.2, 0.9, 0);
  group.add(rightLeg);

  const rLegMesh = new THREE.Mesh(legGeo, suitMat);
  rLegMesh.position.y = -0.42;
  rLegMesh.castShadow = true;
  rightLeg.add(rLegMesh);

  const rBoot = new THREE.Mesh(bootGeo, bootMat);
  rBoot.position.set(0, -0.82, 0.05);
  rBoot.castShadow = true;
  rightLeg.add(rBoot);

  // Left Arm
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.48, 0.35, 0);
  torsoGroup.add(leftArm);

  const armGeo = new THREE.BoxGeometry(0.18, 0.72, 0.2);
  const lArmMesh = new THREE.Mesh(armGeo, suitMat);
  lArmMesh.position.y = -0.32;
  lArmMesh.castShadow = true;
  leftArm.add(lArmMesh);

  // Right Arm
  const rightArm = new THREE.Group();
  rightArm.position.set(0.48, 0.35, 0);
  torsoGroup.add(rightArm);

  const rArmMesh = new THREE.Mesh(armGeo, suitMat);
  rArmMesh.position.y = -0.32;
  rArmMesh.castShadow = true;
  rightArm.add(rArmMesh);

  // Carried Item: Wafer FOUP Pod (front opening unified pod)
  const carriedFoup = new THREE.Group();
  carriedFoup.position.set(0, -0.05, 0.44);

  const foupShell = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.42, 0.44),
    new THREE.MeshStandardMaterial({
      color: 0xE0F2FE,
      roughness: 0.15,
      metalness: 0.3,
      transparent: true,
      opacity: 0.9,
    })
  );
  foupShell.castShadow = true;
  carriedFoup.add(foupShell);

  // Inner Silicon Wafer Stack
  for (let w = -2; w <= 2; w++) {
    const waferDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.17, 0.015, 16),
      new THREE.MeshBasicMaterial({ color: 0x38BDF8 })
    );
    waferDisc.rotation.x = Math.PI / 2;
    waferDisc.position.y = w * 0.06;
    carriedFoup.add(waferDisc);
  }

  // Handle
  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.06, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x0284C7 })
  );
  handle.position.set(0, 0.23, 0);
  carriedFoup.add(handle);

  torsoGroup.add(carriedFoup);

  // Optional Diagnostic Tablet for Inspector
  let tabletMesh: THREE.Mesh | undefined;
  if (hasTablet) {
    carriedFoup.visible = false;
    const tabGeo = new THREE.BoxGeometry(0.42, 0.03, 0.32);
    const tabMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, metalness: 0.8, roughness: 0.2 });
    tabletMesh = new THREE.Mesh(tabGeo, tabMat);
    tabletMesh.position.set(0, -0.05, 0.35);

    const screenGeo = new THREE.PlaneGeometry(0.38, 0.28);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x38BDF8 });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.rotation.x = -Math.PI / 2;
    screen.position.y = 0.02;
    tabletMesh.add(screen);

    torsoGroup.add(tabletMesh);
  }

  return { group, torsoGroup, leftLeg, rightLeg, leftArm, rightArm, carriedFoup, tabletMesh };
}

function createCleanroomAMR() {
  const group = new THREE.Group();

  // Heavy AGV Chassis
  const chassisGeo = new THREE.BoxGeometry(1.8, 0.44, 1.2);
  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0x1E293B,
    metalness: 0.85,
    roughness: 0.25,
  });
  const chassis = new THREE.Mesh(chassisGeo, chassisMat);
  chassis.position.y = 0.32;
  chassis.castShadow = true;
  group.add(chassis);

  // Safety Bumper Yellow Trims
  const bumperGeo = new THREE.BoxGeometry(1.86, 0.14, 1.26);
  const bumperMat = new THREE.MeshStandardMaterial({ color: 0xF59E0B, roughness: 0.4 });
  const bumper = new THREE.Mesh(bumperGeo, bumperMat);
  bumper.position.y = 0.18;
  group.add(bumper);

  // Wheels
  for (const [wx, wz] of [[-0.65, -0.6], [-0.65, 0.6], [0.65, -0.6], [0.65, 0.6]]) {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, 0.12, 16),
      new THREE.MeshStandardMaterial({ color: 0x0F172A, roughness: 0.8 })
    );
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.16, wz);
    group.add(wheel);
  }

  // Dual Wafer FOUP pods on cargo bed
  for (const fx of [-0.4, 0.4]) {
    const pod = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.45, 0.56),
      new THREE.MeshStandardMaterial({
        color: 0xE0F2FE,
        roughness: 0.2,
        metalness: 0.3,
        transparent: true,
        opacity: 0.9,
      })
    );
    pod.position.set(fx, 0.78, 0);
    pod.castShadow = true;
    group.add(pod);

    const podDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.02, 16),
      new THREE.MeshBasicMaterial({ color: 0x38BDF8 })
    );
    podDisc.position.set(fx, 0.78, 0);
    group.add(podDisc);
  }

  // LiDAR Optical Scanner Puck
  const lidar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.16, 16),
    new THREE.MeshStandardMaterial({ color: 0x0284C7, metalness: 0.9 })
  );
  lidar.position.set(0.75, 0.62, 0);
  group.add(lidar);

  // Amber Safety Beacon
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 0.16, 12),
    new THREE.MeshBasicMaterial({ color: 0xF59E0B })
  );
  beacon.position.set(-0.7, 0.62, 0);
  group.add(beacon);

  return { group, beacon };
}

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
  const [activeCamMode, setActiveCamMode] = useState<"iso" | "top" | "focus" | "tour" | "tech">("iso");
  const camModeRef = useRef<"iso" | "top" | "focus" | "tour" | "tech">("iso");
  const tourStepRef = useRef(0);
  const tourTimerRef = useRef(0);
  const TOUR_SEQUENCE = ["DEP-01", "LITHO-01", "ETCH-01", "ETCH-02", "CMP-01", "CLEAN-01", "AI-CORE"];

  // Clickable entity tooltip state (workers, pods, AMR)
  const [entityTooltip, setEntityTooltip] = useState<{
    name: string;
    role: string;
    task: string;
    type: "worker" | "pod" | "amr";
    pos: { x: number; y: number };
  } | null>(null);

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
  const ohtCurves = useRef<Map<string, THREE.CatmullRomCurve3>>(new Map());
  const waferPods = useRef<WaferPod[]>([]);
  const workersRef = useRef<CleanroomWorker[]>([]);
  const amrRef = useRef<CleanroomAMR | null>(null);
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

  const zoomCamera = (direction: "in" | "out") => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const ctrl = controlsRef.current;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const step = direction === "in" ? 8 : -8;
    const newPos = camera.position.clone().addScaledVector(forward, step);
    // Clamp to distance limits
    const dist = newPos.distanceTo(ctrl.target);
    if (dist >= 5 && dist <= 200) {
      targetCamPos.current = newPos;
      targetCamLook.current = ctrl.target.clone();
    }
  };

  /* ── Initialize Three.js Scene ── */
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const W = el.clientWidth;
    const H = typeof height === "number" ? height : el.clientHeight || 540;

    const scene = new THREE.Scene();
    // Bright, pristine semiconductor cleanroom environment
    scene.background = new THREE.Color(0xF0F4F8);
    scene.fog = new THREE.FogExp2(0xF0F4F8, 0.007);
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
    renderer.toneMappingExposure = 1.15;
    el.replaceChildren(renderer.domElement);

    const ctrl = new OrbitControls(camera, renderer.domElement);
    ctrl.enableDamping = true;
    ctrl.dampingFactor = 0.08;
    ctrl.maxPolarAngle = Math.PI / 2.05;
    ctrl.minPolarAngle = 0.1;
    ctrl.minDistance = 5;
    ctrl.maxDistance = 200;
    ctrl.enablePan = true;
    ctrl.panSpeed = 1.2;
    ctrl.screenSpacePanning = true;
    ctrl.zoomSpeed = 1.4;
    ctrl.rotateSpeed = 0.7;
    ctrl.enableZoom = true;
    ctrl.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    ctrl.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    ctrl.target.set(0, 3.5, 0);
    controlsRef.current = ctrl;

    /* ── Bright High-Spec Cleanroom Illumination ── */
    scene.add(new THREE.AmbientLight(0xFFFFFF, 1.25));

    const keySun = new THREE.DirectionalLight(0xF8FAFC, 1.55);
    keySun.position.set(30, 60, 40);
    keySun.castShadow = true;
    keySun.shadow.mapSize.set(2048, 2048);
    keySun.shadow.camera.near = 10;
    keySun.shadow.camera.far = 160;
    keySun.shadow.camera.left = -50;
    keySun.shadow.camera.right = 50;
    keySun.shadow.camera.top = 50;
    keySun.shadow.camera.bottom = -50;
    keySun.shadow.bias = -0.0005;
    scene.add(keySun);

    // Cyan & soft violet cleanroom luminaire fills
    const fillLight1 = new THREE.DirectionalLight(0xBAE6FD, 0.55);
    fillLight1.position.set(-45, 25, -25);
    scene.add(fillLight1);

    const fillLight2 = new THREE.DirectionalLight(0xDDD6FE, 0.45);
    fillLight2.position.set(45, 20, 30);
    scene.add(fillLight2);

    const topFill = new THREE.DirectionalLight(0xFFFFFF, 0.4);
    topFill.position.set(0, 50, 0);
    scene.add(topFill);

    /* ── Photolithography UV-Safe Amber Lighting Zone (LITHO-01) ── */
    const lithoAmberLight = new THREE.PointLight(0xF59E0B, 3.2, 18);
    lithoAmberLight.position.set(-8, 9, -4);
    scene.add(lithoAmberLight);

    const lithoFloorGlow = new THREE.Mesh(
      new THREE.RingGeometry(0.1, 7.2, 48),
      new THREE.MeshBasicMaterial({ color: 0xF59E0B, transparent: true, opacity: 0.14, side: THREE.DoubleSide })
    );
    lithoFloorGlow.rotation.x = -Math.PI / 2;
    lithoFloorGlow.position.set(-8, 0.02, -4);
    scene.add(lithoFloorGlow);

    /* ── High-Gloss Anti-Static Cleanroom Epoxy Floor ── */
    const floorGeo = new THREE.PlaneGeometry(180, 180);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xF8FAFC,
      roughness: 0.2,
      metalness: 0.18,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.05;
    floor.receiveShadow = true;
    scene.add(floor);

    // Cleanroom fine grid (silver/slate on bright floor)
    const mainGrid = new THREE.GridHelper(160, 80, 0x94A3B8, 0xE2E8F0);
    mainGrid.position.y = 0.01;
    scene.add(mainGrid);

    // Cleanroom Safety Corridor Lanes (High Visibility Yellow)
    const laneMat = new THREE.MeshStandardMaterial({ color: 0xF59E0B, roughness: 0.4 });
    const laneGeo = new THREE.PlaneGeometry(74, 0.35);

    const lane1 = new THREE.Mesh(laneGeo, laneMat);
    lane1.rotation.x = -Math.PI / 2;
    lane1.position.set(-1, 0.03, -13);
    scene.add(lane1);

    const lane2 = new THREE.Mesh(laneGeo, laneMat);
    lane2.rotation.x = -Math.PI / 2;
    lane2.position.set(-1, 0.03, 6);
    scene.add(lane2);

    // Central Pedestrian Crosswalk Stripe Hashes
    const crossGeo = new THREE.PlaneGeometry(0.4, 3.5);
    const crossMat = new THREE.MeshBasicMaterial({ color: 0xFBBF24, transparent: true, opacity: 0.55 });
    for (let cx = -26; cx <= 24; cx += 5) {
      const cross = new THREE.Mesh(crossGeo, crossMat);
      cross.rotation.x = -Math.PI / 2;
      cross.position.set(cx, 0.035, 6);
      scene.add(cross);
    }

    /* ── Cleanroom Air Flow Particles (HEPA Downflow) ── */
    const particleCount = 200;
    const pPositions = new Float32Array(particleCount * 3);
    const pVelocities = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      pPositions[i * 3] = (Math.random() - 0.5) * 80;
      pPositions[i * 3 + 1] = Math.random() * 26 + 1;
      pPositions[i * 3 + 2] = (Math.random() - 0.5) * 45;
      pVelocities[i] = 0.02 + Math.random() * 0.025;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPositions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x38BDF8,
      size: 0.35,
      transparent: true,
      opacity: 0.4,
    });
    const particleSystem = new THREE.Points(pGeo, pMat);
    scene.add(particleSystem);

    /* ── Selection Reticle ── */
    const selReticle = new THREE.Group();
    const selHex = new THREE.Mesh(
      new THREE.RingGeometry(4.3, 4.8, 6),
      new THREE.MeshBasicMaterial({ color: 0x0284C7, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
    );
    selHex.rotation.x = -Math.PI / 2;
    selReticle.add(selHex);

    const selCornerGeo = new THREE.RingGeometry(5.2, 5.5, 32, 1, 0, Math.PI / 3);
    for (let i = 0; i < 4; i++) {
      const corner = new THREE.Mesh(selCornerGeo, new THREE.MeshBasicMaterial({ color: 0x0284C7, side: THREE.DoubleSide }));
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

      // Glass pill background with deep slate contrast
      ctx.fillStyle = "rgba(15, 23, 42, 0.94)";
      ctx.beginPath();
      ctx.roundRect(6, 6, 428, 98, 22);
      ctx.fill();

      // Glowing border
      const hex = "#" + accentColor.toString(16).padStart(6, "0");
      ctx.strokeStyle = hex;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.roundRect(6, 6, 428, 98, 22);
      ctx.stroke();

      // Bay badge
      ctx.fillStyle = hex;
      ctx.font = "bold 20px 'JetBrains Mono', monospace";
      ctx.fillText(bay, 26, 42);

      // Tool Title
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 34px 'Space Grotesk', sans-serif";
      ctx.fillText(label, 26, 82);

      // Stage description
      ctx.fillStyle = "#94A3B8";
      ctx.font = "600 20px 'Space Grotesk', sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(stage, 410, 64);

      const texture = new THREE.CanvasTexture(canvas);
      // depthTest: true keeps labels in true 3D spatial order without wild foreground overlap
      const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: true, transparent: true });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(5.8, 1.45, 1);
      return sprite;
    };

    Object.entries(TOWER_COORDS).forEach(([id, meta]) => {
      const toolGroup = new THREE.Group();
      toolGroup.position.set(meta.x, 0, meta.z);
      toolGroup.name = id;
      const col = meta.color;
      const isCore = id === "AI-CORE";
      const isIntake = id === "INTAKE";

      /* 1. Floor Radar Ring */
      const radarGroup = new THREE.Group();
      radarGroup.position.y = 0.08;

      const radarBase = new THREE.Mesh(
        new THREE.RingGeometry(3.6, 3.85, 48),
        new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, transparent: true, opacity: 0.75 })
      );
      radarBase.rotation.x = -Math.PI / 2;
      radarGroup.add(radarBase);

      const radarTick = new THREE.Mesh(
        new THREE.RingGeometry(3.0, 3.4, 48, 1, 0, Math.PI * 0.4),
        new THREE.MeshBasicMaterial({ color: 0x0284C7, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
      );
      radarTick.rotation.x = -Math.PI / 2;
      radarGroup.add(radarTick);

      toolGroup.add(radarGroup);
      radarRings.current.set(id, radarGroup);

      /* 2. Main Equipment Body (Sleek Cleanroom Slate/Titanium Chassis) */
      const baseWidth = isCore ? 6.2 : 5.2;
      const baseHeight = isCore ? 4.5 : 3.4;
      const baseDepth = isCore ? 6.2 : 4.8;

      const bodyGeo = new THREE.BoxGeometry(baseWidth, baseHeight, baseDepth);
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x1E293B,
        metalness: 0.82,
        roughness: 0.22,
        emissive: 0x0F172A,
        emissiveIntensity: 0.2,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = baseHeight / 2 + 0.15;
      body.castShadow = true;
      body.receiveShadow = true;
      body.name = `${id}_BODY`;
      toolGroup.add(body);

      // Aluminum Bevel Skirt
      const skirtGeo = new THREE.BoxGeometry(baseWidth + 0.35, 0.3, baseDepth + 0.35);
      const skirtMat = new THREE.MeshStandardMaterial({ color: 0x64748B, metalness: 0.88, roughness: 0.2 });
      const skirt = new THREE.Mesh(skirtGeo, skirtMat);
      skirt.position.y = 0.15;
      toolGroup.add(skirt);

      // Front FOUP Wafer Load Port (where workers & AMRs drop/pick up wafer pods!)
      if (!isCore && !isIntake) {
        const foupGeo = new THREE.BoxGeometry(2.0, 1.3, 1.2);
        const foupMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.75, roughness: 0.25 });
        const foup = new THREE.Mesh(foupGeo, foupMat);
        foup.position.set(0, 1.4, baseDepth / 2 + 0.45);
        foup.castShadow = true;
        toolGroup.add(foup);

        // Wafer slot glowing entrance line
        const slotGeo = new THREE.BoxGeometry(1.4, 0.14, 0.06);
        const slotMat = new THREE.MeshBasicMaterial({ color: 0x38BDF8 });
        const slot = new THREE.Mesh(slotGeo, slotMat);
        slot.position.set(0, 1.4, baseDepth / 2 + 1.05);
        toolGroup.add(slot);
      }

      /* 3. Vacuum Process Chamber & Inspection Viewport */
      let chamberTopY = baseHeight + 0.15;
      if (!isCore) {
        // Polished Stainless Steel Reaction Chamber
        const chamberRadius = 1.9;
        const chamberH = isIntake ? 2.5 : 3.8;
        const chamberGeo = new THREE.CylinderGeometry(chamberRadius, chamberRadius, chamberH, 28);
        const chamberMat = new THREE.MeshStandardMaterial({
          color: 0xCBD5E1,
          metalness: 0.94,
          roughness: 0.15,
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

        // Glowing Plasma Core
        const plasmaCore = new THREE.Mesh(
          new THREE.SphereGeometry(0.65, 16, 16),
          new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.88 })
        );
        plasmaCore.position.set(0, chamberTopY + chamberH / 2, chamberRadius - 0.05);
        toolGroup.add(plasmaCore);
        plasmaViewports.current.set(id, plasmaCore);

        chamberTopY += chamberH;
      } else {
        // ARGUS AI Neural Core Server Cluster
        const coreChamber = new THREE.Mesh(
          new THREE.CylinderGeometry(2.3, 2.7, 8.5, 6),
          new THREE.MeshStandardMaterial({
            color: 0x0F172A,
            metalness: 0.94,
            roughness: 0.15,
            emissive: 0x0891B2,
            emissiveIntensity: 0.35,
          })
        );
        coreChamber.position.y = chamberTopY + 4.25;
        coreChamber.castShadow = true;
        toolGroup.add(coreChamber);

        // Holographic Glowing Floating Data Rings
        for (let ri = 0; ri < 3; ri++) {
          const ringRadius = 3.3 - ri * 0.45;
          const ringFloat = new THREE.Mesh(
            new THREE.TorusGeometry(ringRadius, 0.08, 12, 48),
            new THREE.MeshBasicMaterial({ color: 0x06B6D4, transparent: true, opacity: 0.85 - ri * 0.15 })
          );
          ringFloat.rotation.x = Math.PI / 2;
          ringFloat.position.y = chamberTopY + 2.2 + ri * 2.2;
          toolGroup.add(ringFloat);
        }

        // Inner glowing neural core orb
        const coreOrb = new THREE.Mesh(
          new THREE.SphereGeometry(1.2, 24, 24),
          new THREE.MeshBasicMaterial({ color: 0x38BDF8, transparent: true, opacity: 0.9 })
        );
        coreOrb.position.y = chamberTopY + 4.25;
        toolGroup.add(coreOrb);

        chamberTopY += 8.5;
      }

      /* 4. Machine Subsystem Variations */
      if (id === "LITHO-01") {
        const opticsCol = new THREE.Mesh(
          new THREE.CylinderGeometry(0.9, 1.4, 3.6, 24),
          new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.92, roughness: 0.12 })
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
        const rfBox = new THREE.Mesh(
          new THREE.BoxGeometry(2.4, 1.4, 2.4),
          new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.25 })
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

      /* 6. Machine Sprite Label with Staggered Elevation & Laser Leader Line */
      const staggeredElevation: Record<string, number> = {
        "INTAKE": 2.2,
        "DEP-01": 2.6,
        "LITHO-01": 4.6,
        "ETCH-01": 2.6,
        "ETCH-02": 4.8,
        "CMP-01": 2.8,
        "CLEAN-01": 4.6,
        "AI-CORE": 2.8,
      };
      const labelYOffset = staggeredElevation[id] ?? 2.8;

      // Laser leader pin from tool top to label
      const leaderGeo = new THREE.CylinderGeometry(0.025, 0.025, labelYOffset, 6);
      const leaderMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55 });
      const leader = new THREE.Mesh(leaderGeo, leaderMat);
      leader.position.y = chamberTopY + labelYOffset / 2;
      toolGroup.add(leader);

      const sprite = makeLabelSprite(meta.label, meta.stage, meta.bay, col);
      sprite.position.y = chamberTopY + labelYOffset;
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
        color: 0x334155,
        metalness: 0.85,
        roughness: 0.2,
      });
      ohtRailGroup.add(new THREE.Mesh(railGeo, railMat));

      // Luminous blue monorail guide beam
      const glowGeo = new THREE.TubeGeometry(curve, 32, 0.05, 6, false);
      const glowMat = new THREE.MeshBasicMaterial({ color: 0x0284C7, transparent: true, opacity: 0.85 });
      ohtRailGroup.add(new THREE.Mesh(glowGeo, glowMat));

      // Support drop trusses to ground
      const trussGeo = new THREE.CylinderGeometry(0.08, 0.08, ohtHeight, 8);
      const trussMat = new THREE.MeshStandardMaterial({ color: 0x64748B, metalness: 0.8, roughness: 0.3 });
      const tMesh = new THREE.Mesh(trussGeo, trussMat);
      tMesh.position.set(fc.x, ohtHeight / 2, fc.z);
      ohtRailGroup.add(tMesh);
    });

    /* ── Wafer Carrier Pod Spawner ── */
    const spawnPod = (initProgress = 0) => {
      const n = podSerial.current++;
      const path = ["INTAKE", "DEP-01", "LITHO-01", n % 2 === 0 ? "ETCH-02" : "ETCH-01", "CMP-01", "CLEAN-01", "AI-CORE"];

      const podGroup = new THREE.Group();

      // Translucent high-tech cleanroom FOUP enclosure revealing the silicon wafer
      const podBody = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.6, 0.9),
        new THREE.MeshStandardMaterial({
          color: 0xE0F2FE,
          metalness: 0.15,
          roughness: 0.12,
          transparent: true,
          opacity: 0.82,
        })
      );
      podGroup.add(podBody);

      const claw = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x0F172A, metalness: 0.9, roughness: 0.1 })
      );
      claw.position.y = 0.45;
      podGroup.add(claw);

      const wafer = new THREE.Mesh(
        new THREE.CylinderGeometry(0.48, 0.48, 0.04, 32),
        new THREE.MeshStandardMaterial({ color: 0x38BDF8, metalness: 0.95, roughness: 0.05 })
      );
      wafer.position.y = -0.42;
      podGroup.add(wafer);

      const aura = new THREE.Mesh(
        new THREE.SphereGeometry(0.85, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0x38BDF8, transparent: true, opacity: 0.32 })
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

    /* ── Cleanroom Personnel & Mobile Transport Workers ── */
    workersRef.current.forEach((w) => scene.remove(w.group));
    workersRef.current = [];

    // Worker 1: Chen (CVD to Litho to Etch Material Transfer)
    const w1 = createCleanroomWorker(0xFAFAFA, 0x0284C7, false);
    const worker1Waypoints: WorkerWaypoint[] = [
      { x: -18, z: -1.5, action: "pickup", targetMachine: "DEP-01", dwellTime: 2.0 },
      { x: -18, z: 5, action: "walk" },
      { x: -8, z: 5, action: "walk" },
      { x: -8, z: -1.5, action: "drop", targetMachine: "LITHO-01", dwellTime: 2.0 },
      { x: -8, z: -1.5, action: "pickup", targetMachine: "LITHO-01", dwellTime: 1.8 },
      { x: -8, z: 5, action: "walk" },
      { x: 3, z: 5, action: "walk" },
      { x: 3, z: -6.5, action: "drop", targetMachine: "ETCH-01", dwellTime: 2.0 },
      { x: 3, z: 5, action: "walk" },
      { x: -18, z: 5, action: "walk" },
    ];
    w1.group.position.set(-18, 0, -1.5);
    scene.add(w1.group);
    workersRef.current.push({
      id: "TECH-01",
      name: "Chen L.",
      role: "Litho/Etch Transfer Specialist",
      ...w1,
      waypoints: worker1Waypoints,
      currentWaypointIdx: 0,
      walkCycle: 0,
      state: "walking",
      stateTimer: 0,
      hasFoup: false,
      speed: 0.065,
    });

    // Worker 2: Maya (Etch to Planarization to Wet Clean Runner)
    const w2 = createCleanroomWorker(0xFAFAFA, 0xF59E0B, false);
    const worker2Waypoints: WorkerWaypoint[] = [
      { x: 3, z: 3.5, action: "pickup", targetMachine: "ETCH-02", dwellTime: 2.0 },
      { x: 3, z: 6, action: "walk" },
      { x: 14, z: 6, action: "walk" },
      { x: 14, z: -1.5, action: "drop", targetMachine: "CMP-01", dwellTime: 2.0 },
      { x: 14, z: -1.5, action: "pickup", targetMachine: "CMP-01", dwellTime: 1.8 },
      { x: 14, z: 6, action: "walk" },
      { x: 24, z: 6, action: "walk" },
      { x: 24, z: -1.5, action: "drop", targetMachine: "CLEAN-01", dwellTime: 2.0 },
      { x: 24, z: 6, action: "walk" },
      { x: 3, z: 6, action: "walk" },
    ];
    w2.group.position.set(3, 0, 3.5);
    scene.add(w2.group);
    workersRef.current.push({
      id: "TECH-02",
      name: "Maya S.",
      role: "CMP/Clean Bay Technician",
      ...w2,
      waypoints: worker2Waypoints,
      currentWaypointIdx: 0,
      walkCycle: 0,
      state: "walking",
      stateTimer: 0,
      hasFoup: true,
      speed: 0.062,
    });

    // Worker 3: Vance (Process QC Inspector with Diagnostic Tablet)
    const w3 = createCleanroomWorker(0xFAFAFA, 0x10B981, true);
    const worker3Waypoints: WorkerWaypoint[] = [
      { x: -28, z: -1.5, action: "inspect", targetMachine: "INTAKE", dwellTime: 2.5 },
      { x: -28, z: 5, action: "walk" },
      { x: -18, z: 5, action: "walk" },
      { x: -18, z: -1.5, action: "inspect", targetMachine: "DEP-01", dwellTime: 2.5 },
      { x: -18, z: 5, action: "walk" },
      { x: 3, z: 6, action: "walk" },
      { x: 34, z: 2, action: "inspect", targetMachine: "AI-CORE", dwellTime: 3.0 },
      { x: 3, z: 6, action: "walk" },
      { x: 24, z: 6, action: "walk" },
      { x: 24, z: -1.5, action: "inspect", targetMachine: "CLEAN-01", dwellTime: 2.5 },
      { x: 24, z: 6, action: "walk" },
      { x: -28, z: 5, action: "walk" },
    ];
    w3.group.position.set(-28, 0, -1.5);
    scene.add(w3.group);
    workersRef.current.push({
      id: "TECH-03",
      name: "Dr. Vance",
      role: "Lead Metrology & Quality Inspector",
      ...w3,
      waypoints: worker3Waypoints,
      currentWaypointIdx: 0,
      walkCycle: 0,
      state: "walking",
      stateTimer: 0,
      hasFoup: false,
      speed: 0.058,
    });

    // Autonomous Mobile Robot (AMR-09 Wafer Transporter)
    if (amrRef.current) scene.remove(amrRef.current.group);
    const amr = createCleanroomAMR();
    amr.group.position.set(-26, 0, 6);
    scene.add(amr.group);
    amrRef.current = {
      ...amr,
      waypoints: [
        { x: -26, z: 6 },
        { x: 3, z: 6 },
        { x: 3, z: 10.5 },
        { x: 3, z: 6 },
        { x: 22, z: 6 },
        { x: 3, z: 6 },
      ],
      currentWaypointIdx: 0,
      speed: 0.05,
    };

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

      // Check machines
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

      // Check workers, pods, AMR for pointer cursor
      const allClickable: THREE.Object3D[] = [];
      workersRef.current.forEach(w => allClickable.push(w.group));
      waferPods.current.forEach(p => allClickable.push(p.group));
      if (amrRef.current) allClickable.push(amrRef.current.group);
      const entityHits = raycaster.intersectObjects(allClickable, true);
      if (entityHits.length > 0) {
        el.style.cursor = "pointer";
        setHoveredNode(null);
        return;
      }

      el.style.cursor = "default";
      setHoveredNode(null);
    };

    const onPointerDown = (e: MouseEvent) => {
      downPos = { x: e.clientX, y: e.clientY };
      downTime = performance.now();
    };

    // Helper: get a simple task description for a worker
    const getWorkerTask = (worker: CleanroomWorker): string => {
      const wp = worker.waypoints[worker.currentWaypointIdx];
      if (!wp) return "Standing by";
      if (worker.state === "interacting") {
        const machineLabel = wp.targetMachine || "unknown";
        if (wp.action === "pickup") return `Picking up wafer pod from ${machineLabel}`;
        if (wp.action === "drop") return `Loading wafer pod into ${machineLabel}`;
        if (wp.action === "inspect") return `Inspecting ${machineLabel} diagnostics`;
        return `Working at ${machineLabel}`;
      }
      // Walking
      const nextWp = worker.waypoints[worker.currentWaypointIdx];
      if (nextWp?.targetMachine) {
        if (nextWp.action === "pickup") return `Walking to ${nextWp.targetMachine} to pick up wafers`;
        if (nextWp.action === "drop") return `Carrying wafer pod to ${nextWp.targetMachine}`;
        if (nextWp.action === "inspect") return `Heading to ${nextWp.targetMachine} for inspection`;
      }
      if (worker.hasFoup) return "Carrying wafer pod to next station";
      return "Walking through cleanroom";
    };

    // Helper: get a simple task description for a pod
    const getPodTask = (pod: WaferPod): string => {
      const fromNode = pod.path[pod.currentStep];
      const toNode = pod.path[pod.currentStep + 1];
      if (!toNode) return "Completed processing";
      const fromLabel = TOWER_COORDS[fromNode]?.label || fromNode;
      const toLabel = TOWER_COORDS[toNode]?.label || toNode;
      const statusNote = pod.status === "critical" ? " ⚠ Flagged critical" : pod.status === "warning" ? " ⚠ Drift detected" : "";
      return `Moving from ${fromLabel} → ${toLabel}${statusNote}`;
    };

    const onPointerUp = (e: MouseEvent) => {
      if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 6 || performance.now() - downTime > 400) return;
      const rect = el.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      // 1. Check machines first
      const intersects = raycaster.intersectObjects(machinesContainer.children, true);
      if (intersects.length > 0) {
        let obj: THREE.Object3D | null = intersects[0].object;
        while (obj && obj.parent !== machinesContainer) obj = obj.parent;
        if (obj?.name && VALID_TOOLS.includes(obj.name)) {
          const cid = obj.name;
          triggerShockwave(scene, TOWER_COORDS[cid]?.x ?? 0, TOWER_COORDS[cid]?.z ?? 0, TOWER_COORDS[cid]?.color ?? 0x0284C7);
          if (selIdRef.current === cid) {
            onSelRef.current?.("");
            targetCamPos.current = new THREE.Vector3(0, 34, 48);
            targetCamLook.current = new THREE.Vector3(0, 3.8, 0);
          } else {
            onSelRef.current?.(cid);
            focusOn(TOWER_COORDS[cid]?.x ?? 0, TOWER_COORDS[cid]?.z ?? 0);
          }
          setEntityTooltip(null);
          return;
        }
      }

      // 2. Check workers
      for (const worker of workersRef.current) {
        const wHits = raycaster.intersectObjects([worker.group], true);
        if (wHits.length > 0) {
          setEntityTooltip({
            name: `${worker.id} — ${worker.name}`,
            role: worker.role,
            task: getWorkerTask(worker),
            type: "worker",
            pos: { x: e.clientX - rect.left, y: e.clientY - rect.top },
          });
          return;
        }
      }

      // 3. Check wafer pods
      for (const pod of waferPods.current) {
        const pHits = raycaster.intersectObjects([pod.group], true);
        if (pHits.length > 0) {
          setEntityTooltip({
            name: `Wafer Pod #${pod.id}`,
            role: "FOUP Carrier",
            task: getPodTask(pod),
            type: "pod",
            pos: { x: e.clientX - rect.left, y: e.clientY - rect.top },
          });
          return;
        }
      }

      // 4. Check AMR
      if (amrRef.current) {
        const amrHits = raycaster.intersectObjects([amrRef.current.group], true);
        if (amrHits.length > 0) {
          setEntityTooltip({
            name: "AMR-09",
            role: "Autonomous Mobile Robot",
            task: "Ferrying wafer pods between stations automatically",
            type: "amr",
            pos: { x: e.clientX - rect.left, y: e.clientY - rect.top },
          });
          return;
        }
      }

      // 5. Clicked on empty space — close everything
      setEntityTooltip(null);
      if (selIdRef.current) {
        onSelRef.current?.("");
        targetCamPos.current = new THREE.Vector3(0, 34, 48);
        targetCamLook.current = new THREE.Vector3(0, 3.8, 0);
      }
    };

    el.addEventListener("mousemove", onPointerMove);
    el.addEventListener("mousedown", onPointerDown);
    el.addEventListener("mouseup", onPointerUp);

    /* ── Keyboard Controls: WASD/Arrows for panning, +/- for zoom ── */
    const keysDown = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => { keysDown.add(e.key.toLowerCase()); };
    const onKeyUp = (e: KeyboardEvent) => { keysDown.delete(e.key.toLowerCase()); };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);

    /* ── Render Loop ── */
    let animId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);
      const t = clock.getElapsedTime();

      // Keyboard-driven WASD / Arrow panning
      if (keysDown.size > 0) {
        const panStep = 0.8;
        const right = new THREE.Vector3();
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        right.crossVectors(forward, camera.up).normalize();
        const flatForward = new THREE.Vector3(forward.x, 0, forward.z).normalize();

        const keyDelta = new THREE.Vector3();
        if (keysDown.has("w") || keysDown.has("arrowup")) keyDelta.add(flatForward.clone().multiplyScalar(panStep));
        if (keysDown.has("s") || keysDown.has("arrowdown")) keyDelta.add(flatForward.clone().multiplyScalar(-panStep));
        if (keysDown.has("a") || keysDown.has("arrowleft")) keyDelta.add(right.clone().multiplyScalar(-panStep));
        if (keysDown.has("d") || keysDown.has("arrowright")) keyDelta.add(right.clone().multiplyScalar(panStep));
        if (keysDown.has("=") || keysDown.has("+")) {
          const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
          keyDelta.add(fwd.multiplyScalar(1.2));
        }
        if (keysDown.has("-") || keysDown.has("_")) {
          const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
          keyDelta.add(fwd.multiplyScalar(-1.2));
        }
        if (keyDelta.lengthSq() > 0) {
          camera.position.add(keyDelta);
          ctrl.target.add(keyDelta);
          targetCamPos.current = null;
          targetCamLook.current = null;
        }
      }

      // Camera Orbit / Lerp Focus
      ctrl.autoRotate = autoRotateRef.current;
      ctrl.autoRotateSpeed = 0.55;

      if (targetCamPos.current && targetCamLook.current) {
        camera.position.lerp(targetCamPos.current, 0.12);
        ctrl.target.lerp(targetCamLook.current, 0.12);
        if (camera.position.distanceTo(targetCamPos.current) < 0.15) {
          targetCamPos.current = null;
          targetCamLook.current = null;
        }
      }
      ctrl.update();

      // Automated Tour Progression
      if (camModeRef.current === "tour") {
        tourTimerRef.current += delta;
        if (tourTimerRef.current >= 4.0) {
          tourTimerRef.current = 0;
          tourStepRef.current = (tourStepRef.current + 1) % TOUR_SEQUENCE.length;
          const nextTool = TOUR_SEQUENCE[tourStepRef.current];
          const meta = TOWER_COORDS[nextTool];
          if (meta) {
            onSelRef.current?.(nextTool);
            focusOn(meta.x, meta.z);
          }
        }
      } else if (camModeRef.current === "tech") {
        const tech = workersRef.current[0];
        if (tech) {
          const tp = tech.group.position;
          ctrl.target.lerp(new THREE.Vector3(tp.x, 1.8, tp.z), 0.05);
          camera.position.lerp(new THREE.Vector3(tp.x + 8, 9, tp.z + 12), 0.05);
        }
      }

      // Air Particles Drift
      const pAttr = particleSystem.geometry.attributes.position as THREE.BufferAttribute;
      const posArr = pAttr.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        posArr[i * 3 + 1] -= pVelocities[i];
        if (posArr[i * 3 + 1] <= 0.2) {
          posArr[i * 3 + 1] = 26;
        }
      }
      pAttr.needsUpdate = true;

      // Radar & Plasma Viewports
      radarRings.current.forEach((rg) => {
        rg.rotation.y += 0.018;
      });

      plasmaViewports.current.forEach((pv, id) => {
        const pulse = 1.0 + Math.sin(t * 6.0 + id.charCodeAt(0)) * 0.16;
        pv.scale.set(pulse, pulse, pulse);
      });

      // Selection Reticle Spin
      if (selReticleRef.current && selIdRef.current) {
        const curMeta = TOWER_COORDS[selIdRef.current];
        if (curMeta) {
          selReticleRef.current.position.set(curMeta.x, 0.1, curMeta.z);
          selReticleRef.current.rotation.y += 0.015;
        }
      }

      /* ── Cleanroom Workers Walk & Load/Unload Automation ── */
      workersRef.current.forEach((worker) => {
        const targetWp = worker.waypoints[worker.currentWaypointIdx];
        if (!targetWp) return;

        if (worker.state === "walking") {
          const dx = targetWp.x - worker.group.position.x;
          const dz = targetWp.z - worker.group.position.z;
          const dist = Math.hypot(dx, dz);

          if (dist > 0.3) {
            // Move towards waypoint
            const moveStep = Math.min(dist, worker.speed * 60 * delta);
            worker.group.position.x += (dx / dist) * moveStep;
            worker.group.position.z += (dz / dist) * moveStep;

            // Turn towards movement direction
            const angle = Math.atan2(dx, dz);
            worker.group.rotation.y = angle;

            // Animate walking stride
            worker.walkCycle += worker.speed * 20;
            const swing = Math.sin(worker.walkCycle) * 0.45;
            worker.leftLeg.rotation.x = swing;
            worker.rightLeg.rotation.x = -swing;
            worker.torsoGroup.position.y = 1.35 + Math.abs(Math.sin(worker.walkCycle * 2)) * 0.05;

            // Arms animation
            if (worker.hasFoup) {
              worker.carriedFoup.visible = true;
              worker.leftArm.rotation.x = -0.6 + Math.sin(worker.walkCycle) * 0.08;
              worker.rightArm.rotation.x = -0.6 - Math.sin(worker.walkCycle) * 0.08;
            } else if (worker.tabletMesh) {
              worker.carriedFoup.visible = false;
              worker.leftArm.rotation.x = -0.7;
              worker.rightArm.rotation.x = -0.5;
            } else {
              worker.carriedFoup.visible = false;
              worker.leftArm.rotation.x = -swing * 0.7;
              worker.rightArm.rotation.x = swing * 0.7;
            }
          } else {
            // Reached waypoint: check for action
            if (targetWp.action === "pickup" || targetWp.action === "drop" || targetWp.action === "inspect") {
              worker.state = "interacting";
              worker.stateTimer = targetWp.dwellTime || 2.0;

              // Face the tool load port (towards -z for main bays)
              if (targetWp.targetMachine) {
                const tm = TOWER_COORDS[targetWp.targetMachine];
                if (tm) {
                  worker.group.lookAt(tm.x, 0, tm.z);
                }
              }
            } else {
              // Plain waypoint: proceed immediately to next
              worker.currentWaypointIdx = (worker.currentWaypointIdx + 1) % worker.waypoints.length;
            }
          }
        } else if (worker.state === "interacting") {
          worker.stateTimer -= delta;

          // Idle breathing & gesture
          worker.leftLeg.rotation.x = 0;
          worker.rightLeg.rotation.x = 0;
          worker.torsoGroup.position.y = 1.35 + Math.sin(t * 3.5) * 0.02;

          if (targetWp.action === "pickup") {
            // Reaching in to retrieve wafer pod
            worker.leftArm.rotation.x = -0.75 + Math.sin(t * 4) * 0.08;
            worker.rightArm.rotation.x = -0.75 + Math.sin(t * 4) * 0.08;
            worker.carriedFoup.visible = true;
            worker.hasFoup = true;
          } else if (targetWp.action === "drop") {
            // Docking wafer pod into machine load port
            worker.leftArm.rotation.x = -0.85 + Math.sin(t * 4) * 0.08;
            worker.rightArm.rotation.x = -0.85 + Math.sin(t * 4) * 0.08;
            if (worker.stateTimer < 0.6) {
              worker.carriedFoup.visible = false;
              worker.hasFoup = false;
            }
          } else if (targetWp.action === "inspect") {
            // Diagnostic scan tablet tilt
            worker.leftArm.rotation.x = -0.7 + Math.sin(t * 2) * 0.05;
            worker.rightArm.rotation.x = -0.6 - Math.sin(t * 2) * 0.05;
          }

          if (worker.stateTimer <= 0) {
            // Finished interaction: trigger ripple at machine port and proceed
            if (targetWp.targetMachine) {
              const tm = TOWER_COORDS[targetWp.targetMachine];
              if (tm) triggerShockwave(scene, tm.x, tm.z, tm.color);
            }
            worker.state = "walking";
            worker.currentWaypointIdx = (worker.currentWaypointIdx + 1) % worker.waypoints.length;
          }
        }
      });

      /* ── Autonomous Mobile Robot (AMR) Navigation ── */
      if (amrRef.current) {
        const amr = amrRef.current;
        const targetWp = amr.waypoints[amr.currentWaypointIdx];
        if (targetWp) {
          const dx = targetWp.x - amr.group.position.x;
          const dz = targetWp.z - amr.group.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 0.4) {
            const step = Math.min(dist, amr.speed * 60 * delta);
            amr.group.position.x += (dx / dist) * step;
            amr.group.position.z += (dz / dist) * step;
            amr.group.rotation.y = Math.atan2(dx, dz);
          } else {
            amr.currentWaypointIdx = (amr.currentWaypointIdx + 1) % amr.waypoints.length;
          }
        }
        // Blinking amber beacon
        (amr.beacon.material as THREE.MeshBasicMaterial).color.setHex(
          Math.sin(t * 10) > 0 ? 0xF59E0B : 0x78350F
        );
      }

      /* ── Monorail Wafer Pods Traversal ── */
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
        const deltaSpawn = Math.min(2, Math.max(1, totalProcessed - prevRecordCount.current));
        for (let i = 0; i < deltaSpawn; i++) spawnPod(0);
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
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      waferPods.current.forEach((p) => scene.remove(p.group));
      workersRef.current.forEach((w) => scene.remove(w.group));
      if (amrRef.current) scene.remove(amrRef.current.group);
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
    setActiveCamMode("iso");
    camModeRef.current = "iso";
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

  const setCameraPreset = (type: "iso" | "top" | "focus" | "tour" | "tech") => {
    setActiveCamMode(type);
    camModeRef.current = type;
    if (!cameraRef.current || !controlsRef.current) return;
    if (type === "iso") {
      resetToOverview();
    } else if (type === "top") {
      targetCamPos.current = new THREE.Vector3(0, 68, 2);
      targetCamLook.current = new THREE.Vector3(0, 0, 0);
    } else if (type === "focus") {
      const toolId = selectedMachineId || "ETCH-01";
      const meta = TOWER_COORDS[toolId];
      if (meta) focusOn(meta.x, meta.z);
    } else if (type === "tour") {
      tourStepRef.current = 0;
      tourTimerRef.current = 0;
      const first = TOUR_SEQUENCE[0];
      const meta = TOWER_COORDS[first];
      if (meta) {
        onSelRef.current?.(first);
        focusOn(meta.x, meta.z);
      }
    } else if (type === "tech") {
      const tech = workersRef.current[0];
      if (tech) {
        const tp = tech.group.position;
        targetCamLook.current = new THREE.Vector3(tp.x, 2, tp.z);
        targetCamPos.current = new THREE.Vector3(tp.x + 8, 9, tp.z + 12);
      }
    }
  };

  const handleSelectTool = (id: string) => {
    if (selectedMachineId === id) {
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
    <div style={{ position: "relative", width: "100%", height, borderRadius: 28, overflow: "hidden", background: "#F0F4F8" }}>
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
            background: "rgba(15, 23, 42, 0.88)",
            backdropFilter: "blur(20px)",
            padding: "6px 14px",
            borderRadius: 9999,
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
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
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "#94A3B8" }}>
            <Users size={12} style={{ color: "#10B981" }} />
            <span><strong style={{ color: "#FFF" }}>3</strong> Techs <span style={{ opacity: 0.6 }}>•</span> <strong style={{ color: "#FFF" }}>1</strong> AMR</span>
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
            gap: 3,
            background: "rgba(15, 23, 42, 0.88)",
            backdropFilter: "blur(20px)",
            padding: "4px 6px",
            borderRadius: 9999,
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            pointerEvents: "auto",
          }}
        >
          {[
            { t: "iso" as const, I: Compass, l: "ISO" },
            { t: "top" as const, I: Eye, l: "TOP" },
            { t: "focus" as const, I: Maximize2, l: "FOCUS" },
            { t: "tour" as const, I: Play, l: "TOUR" },
            { t: "tech" as const, I: Users, l: "TECH" },
          ].map(({ t, I, l }) => {
            const isActive = activeCamMode === t;
            return (
              <button
                key={t}
                onClick={() => setCameraPreset(t)}
                style={{
                  padding: "4px 10px",
                  fontSize: 11,
                  borderRadius: 9999,
                  background: isActive ? "rgba(56, 189, 248, 0.22)" : "transparent",
                  color: isActive ? "#38BDF8" : "#CBD5E1",
                  border: isActive ? "1px solid #38BDF8" : "1px solid transparent",
                  cursor: "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  transition: "all 0.15s ease",
                }}
                title={t === "tour" ? "Autonomous Wafer Process Flow Tour" : t === "tech" ? "Follow Cleanroom Technician" : undefined}
              >
                <I size={12} /> {l}
              </button>
            );
          })}

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

      {/* ── ZOOM CONTROLS (RIGHT EDGE, VERTICAL) ── */}
      <div
        style={{
          position: "absolute",
          right: 14,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: 3,
          background: "rgba(15, 23, 42, 0.88)",
          backdropFilter: "blur(20px)",
          padding: "5px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          zIndex: 10,
        }}
      >
        <button
          onClick={() => zoomCamera("in")}
          title="Zoom In"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "transparent",
            color: "#CBD5E1",
            border: "1px solid rgba(255,255,255,0.08)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            fontWeight: 300,
            fontFamily: "'Space Grotesk', sans-serif",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#F8FAFC"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#CBD5E1"; }}
        >
          +
        </button>
        <div style={{ width: "100%", height: 1, background: "rgba(255,255,255,0.1)" }} />
        <button
          onClick={() => zoomCamera("out")}
          title="Zoom Out"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "transparent",
            color: "#CBD5E1",
            border: "1px solid rgba(255,255,255,0.08)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            fontWeight: 300,
            fontFamily: "'Space Grotesk', sans-serif",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#F8FAFC"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#CBD5E1"; }}
        >
          −
        </button>
      </div>

      {/* ── TIER 2: CLEANROOM STATIONS DOCK ── */}
      <div
        style={{
          position: "absolute",
          top: 56,
          left: 14,
          display: "flex",
          alignItems: "center",
          gap: 5,
          background: "rgba(15, 23, 42, 0.88)",
          backdropFilter: "blur(20px)",
          padding: "4px 8px",
          borderRadius: 9999,
          border: "1px solid rgba(255,255,255,0.1)",
          zIndex: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
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
                background: isSel ? "rgba(255,255,255,0.15)" : "transparent",
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

        {/* RESET VIEW BUTTON */}
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
        <div style={{ position: "absolute", bottom: 16, left: 16, background: "rgba(15, 23, 42, 0.94)", backdropFilter: "blur(20px)", border: "1px solid rgba(56, 189, 248, 0.5)", padding: "9px 16px", borderRadius: 16, color: "#F8FAFC", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", display: "flex", alignItems: "center", gap: 9, zIndex: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.35)" }}>
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
            background: "rgba(15, 23, 42, 0.92)",
            backdropFilter: "blur(24px)",
            border: `1px solid ${selectedMachine.health === "critical" || selectedMachine.health === "interlocked"
              ? "rgba(239,68,68,0.5)"
              : selectedMachine.health === "warning"
                ? "rgba(245,158,11,0.5)"
                : "rgba(255,255,255,0.14)"
              }`,
            borderRadius: 24,
            padding: "16px 20px",
            color: "#F8FAFC",
            boxShadow: "0 16px 48px rgba(0,0,0,0.35)",
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
