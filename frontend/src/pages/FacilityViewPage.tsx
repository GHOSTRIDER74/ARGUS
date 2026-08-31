import {
  Background,
  Controls,
  type Edge,
  Handle,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { Detailed, Environment, Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Component,
  type ReactNode,
  Suspense,
  useCallback,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Cpu,
  Database,
  Info,
  Layers3,
  Loader2,
  Map,
  Navigation,
  RefreshCw,
  RotateCcw,
  Zap,
} from "lucide-react";
import RadialGauge from "../components/RadialGauge";

/* ──────────────────────────────────────────────────────────────────────────── */
/*  2D FLOW DIAGRAM — React Flow (unchanged)                                     */
/* ──────────────────────────────────────────────────────────────────────────── */

function DataIngestionNode({ data }: NodeProps) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="flow-node"
      style={{
        transform: hovered ? "scale(1.04)" : "scale(1)",
        boxShadow: hovered ? "0 0 0 2px #0EA5E9, 0 8px 24px rgba(14,165,233,0.15)" : undefined,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => navigate(data.route)}
    >
      <Handle type="source" position={Position.Right} className="flow-handle" />
      <div className="flow-node-icon" style={{ background: "#EFF6FF", color: "#0EA5E9" }}>
        <Database className="w-5 h-5" />
      </div>
      <div className="flow-node-body">
        <p className="flow-node-title">{data.label}</p>
        <p className="flow-node-sub">{data.sub}</p>
        {hovered && (
          <div className="flow-node-stat">
            <span className="flow-stat-dot bg-[#0EA5E9]" />
            {data.stat}
          </div>
        )}
      </div>
    </div>
  );
}

function HubNode({ data }: NodeProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="flow-node flow-node-hub"
      style={{
        transform: hovered ? "scale(1.04)" : "scale(1)",
        boxShadow: hovered ? "0 0 0 2px #4361EE, 0 8px 24px rgba(67,97,238,0.18)" : undefined,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Handle type="target" position={Position.Left} className="flow-handle" />
      <Handle type="source" position={Position.Right} className="flow-handle" id="right" />
      <Handle type="source" position={Position.Bottom} className="flow-handle" id="bottom" />
      <div className="flow-node-icon" style={{ background: "#EEF2FF", color: "#4361EE" }}>
        <Layers3 className="w-5 h-5" />
      </div>
      <div className="flow-node-body">
        <p className="flow-node-title">{data.label}</p>
        <p className="flow-node-sub">{data.sub}</p>
        {hovered && (
          <div className="flow-node-stat">
            <span className="flow-stat-dot bg-[#4361EE]" />
            {data.stat}
          </div>
        )}
      </div>
    </div>
  );
}

function DestinationNode({ data }: NodeProps) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const accentMap: Record<string, { border: string; iconBg: string; iconColor: string; dotBg: string }> = {
    green: { border: "#16A34A", iconBg: "#DCFCE7", iconColor: "#16A34A", dotBg: "bg-[#16A34A]" },
    red:   { border: "#DC2626", iconBg: "#FEE2E2", iconColor: "#DC2626", dotBg: "bg-[#DC2626]" },
    amber: { border: "#D97706", iconBg: "#FEF9C3", iconColor: "#D97706", dotBg: "bg-[#D97706]" },
    blue:  { border: "#4361EE", iconBg: "#EEF2FF", iconColor: "#4361EE", dotBg: "bg-[#4361EE]" },
  };
  const accent = accentMap[data.accent] ?? accentMap.blue;
  return (
    <div
      className="flow-node"
      style={{
        transform: hovered ? "scale(1.04)" : "scale(1)",
        boxShadow: hovered ? `0 0 0 2px ${accent.border}, 0 8px 24px rgba(0,0,0,0.08)` : undefined,
        borderColor: hovered ? accent.border : undefined,
        cursor: "pointer",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => navigate(data.route)}
    >
      <Handle type="target" position={Position.Left} className="flow-handle" />
      <Handle type="target" position={Position.Top} className="flow-handle" id="top" />
      <div className="flow-node-icon" style={{ background: accent.iconBg, color: accent.iconColor }}>
        {data.icon}
      </div>
      <div className="flow-node-body">
        <p className="flow-node-title">{data.label}</p>
        <p className="flow-node-sub">{data.sub}</p>
        {hovered && (
          <div className="flow-node-stat">
            <span className={`flow-stat-dot ${accent.dotBg}`} />
            {data.stat}
          </div>
        )}
      </div>
    </div>
  );
}

const nodeTypes = { dataIngestion: DataIngestionNode, hub: HubNode, destination: DestinationNode };

const initialNodes: Node[] = [
  { id: "data-intake", type: "dataIngestion", position: { x: 0, y: 140 },
    data: { label: "Data Ingestion", sub: "Sensor datasets & synthetic generation", stat: "1,200 msg/sec · 3 active streams", route: "/app/datasets" } },
  { id: "hub", type: "hub", position: { x: 310, y: 110 },
    data: { label: "ARGUS Core Engine", sub: "ML pipeline · Hybrid drift detection", stat: "3 twin models active · 99.8% uptime" } },
  { id: "digital-twin", type: "destination", position: { x: 640, y: 30 },
    data: { label: "Digital Twin Monitor", sub: "Process machines & telemetry", stat: "3 machines · Facility health 64/100", accent: "blue", route: "/app/digital-twin", icon: <Cpu className="w-5 h-5" /> } },
  { id: "drift-events", type: "destination", position: { x: 640, y: 210 },
    data: { label: "Drift Detection", sub: "CUSUM + LSTM anomaly detection", stat: "1 Critical · 1 Warning active", accent: "red", route: "/app/drift-events", icon: <AlertTriangle className="w-5 h-5" /> } },
  { id: "impact", type: "destination", position: { x: 970, y: 30 },
    data: { label: "Financial Impact", sub: "Scrap cost, rework & downtime", stat: "$48,320 USD estimated loss", accent: "green", route: "/app/impact", icon: <BarChart3 className="w-5 h-5" /> } },
];

const edgeDefaults = { type: "smoothstep", animated: true, style: { stroke: "#CBD5E1", strokeWidth: 2 }, labelStyle: { fontSize: 10, fill: "#8C919E" } };

const initialEdges: Edge[] = [
  { id: "intake-hub", source: "data-intake", target: "hub", label: "raw telemetry", ...edgeDefaults },
  { id: "hub-twin", source: "hub", target: "digital-twin", sourceHandle: "right", label: "live state", ...edgeDefaults, style: { stroke: "#4361EE", strokeWidth: 2 } },
  { id: "hub-drift", source: "hub", target: "drift-events", sourceHandle: "bottom", label: "anomaly signals", ...edgeDefaults, style: { stroke: "#DC2626", strokeWidth: 2 } },
  { id: "twin-impact", source: "digital-twin", target: "impact", label: "cost model", ...edgeDefaults, style: { stroke: "#16A34A", strokeWidth: 2 } },
];

function ARGUSFlowDiagram() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const onConnect = useCallback((params: any) => setEdges((eds) => addEdge(params, eds)), [setEdges]);
  return (
    <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes}
      fitView fitViewOptions={{ padding: 0.3 }} proOptions={{ hideAttribution: true }}
      panOnScroll zoomOnScroll minZoom={0.5} maxZoom={1.8}>
      <Background color="#E5E7EB" gap={24} size={1} />
      <Controls showInteractive={false} className="flow-controls" />
    </ReactFlow>
  );
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  3D GITCITY-PATTERN SCENE                                                     */
/*  - Buildings on a lit road path, sized by live metrics                        */
/*  - Staggered build-in animation (scale Y 0→1 per building, useFrame)          */
/*  - Drei <Detailed> LOD per building                                           */
/*  - Hover → Html label, Click → navigate                                       */
/* ──────────────────────────────────────────────────────────────────────────── */

/* ── Live metric data (would come from API in production) ─────────────────── */
const METRICS = {
  activeMachines: 3,       // Digital Twin building height driver
  activeDrifts: 2,         // Drift Detection spire height + glow driver
  throughputMsgSec: 1200,  // Data Ingestion building width driver (max ~2000)
  impactUSD: 48320,        // Financial Impact pulse driver
  facilityHealth: 64,
};

/* ── Animated Building wrapper — rises from ground on load ─────────────────── */
interface AnimatedBuildingProps {
  delay: number;
  position: [number, number, number];
  children: ReactNode;
}

function AnimatedBuilding({ delay, position, children }: AnimatedBuildingProps) {
  const ref = useRef<THREE.Group>(null!);
  const elapsed = useRef(0);
  const progress = useRef(0);

  useFrame((_, delta) => {
    elapsed.current += delta;
    if (elapsed.current < delay) return;
    if (progress.current >= 1) return;
    progress.current = Math.min(1, progress.current + delta * 1.8);
    // Cubic ease-out: feels like concrete rising and settling
    const eased = 1 - Math.pow(1 - progress.current, 3);
    if (ref.current) ref.current.scale.y = eased;
  });

  return (
    // originShift keeps the building rising from the ground (y=0) not the center
    <group position={position}>
      <group ref={ref} scale={[1, 0, 1]}>
        {children}
      </group>
    </group>
  );
}

/* ── Road strip connecting all buildings ──────────────────────────────────── */
function CityRoad() {
  return (
    <>
      {/* Main road slab */}
      <mesh receiveShadow position={[0, 0.01, 0]}>
        <boxGeometry args={[30, 0.06, 3.2]} />
        <meshStandardMaterial color="#334155" roughness={0.6} />
      </mesh>
      {/* Center divider line */}
      <mesh position={[0, 0.045, 0]}>
        <boxGeometry args={[29, 0.02, 0.12]} />
        <meshStandardMaterial color="#F8FAFC" emissive="#F8FAFC" emissiveIntensity={0.3} />
      </mesh>
      {/* Road edge glow strips — left & right */}
      {[-1.4, 1.4].map((z, i) => (
        <mesh key={i} position={[0, 0.045, z]}>
          <boxGeometry args={[29, 0.02, 0.08]} />
          <meshStandardMaterial color="#4361EE" emissive="#4361EE" emissiveIntensity={0.8} />
        </mesh>
      ))}
      {/* Ground plane */}
      <mesh receiveShadow position={[0, -0.05, 0]}>
        <boxGeometry args={[36, 0.1, 26]} />
        <meshStandardMaterial color="#E2E8F0" roughness={0.5} />
      </mesh>
      <gridHelper args={[36, 36, "#CBD5E1", "#E5E7EB"]} position={[0, 0.0, 0]} />
    </>
  );
}

/* ── Lamppost detail along road ───────────────────────────────────────────── */
function Lampposts() {
  const xPositions = [-10, -5, 0, 5, 10];
  return (
    <>
      {xPositions.map((x) =>
        [-2.4, 2.4].map((z, i) => (
          <group key={`${x}-${i}`} position={[x, 0, z]}>
            <mesh position={[0, 1.2, 0]}>
              <cylinderGeometry args={[0.06, 0.08, 2.4, 8]} />
              <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
            </mesh>
            <mesh position={[0, 2.5, 0]}>
              <sphereGeometry args={[0.2, 8, 8]} />
              <meshStandardMaterial color="#FEF9C3" emissive="#FEF9C3" emissiveIntensity={1.5} />
            </mesh>
            <pointLight position={[x, 2.5, z]} intensity={0.3} distance={6} color="#FFFBEB" />
          </group>
        ))
      )}
    </>
  );
}

/* ── BUILDING 1: Data Ingestion — width driven by throughput ──────────────── */
function DataIngestionBuilding({ onNav, hoveredZone, setHoveredZone }: BuildingProps) {
  const throughputNorm = Math.min(METRICS.throughputMsgSec / 2000, 1); // 0–1
  const width = 2.8 + throughputNorm * 2.2; // 2.8 – 5.0 wide
  const height = 3.5;
  const isHovered = hoveredZone === "data";

  return (
    <Detailed distances={[0, 18, 35]}>
      {/* High detail (close) */}
      <group
        onPointerOver={() => { setHoveredZone("data"); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHoveredZone(null); document.body.style.cursor = "auto"; }}
        onClick={() => onNav("/app/datasets")}
      >
        <mesh castShadow position={[0, height / 2, 0]}>
          <boxGeometry args={[width, height, 3.8]} />
          <meshStandardMaterial color="#1E293B" metalness={0.7} roughness={0.3}
            emissive={isHovered ? "#0EA5E9" : "#000"} emissiveIntensity={isHovered ? 0.12 : 0} />
        </mesh>
        {/* LED rack strips (count driven by throughput) */}
        {Array.from({ length: Math.round(3 + throughputNorm * 3) }).map((_, i) => (
          <mesh key={i} position={[width / 2 + 0.01, 0.6 + i * 0.48, 0]}>
            <boxGeometry args={[0.06, 0.22, 3.4]} />
            <meshStandardMaterial color="#0EA5E9" emissive="#0EA5E9" emissiveIntensity={1.2} />
          </mesh>
        ))}
        {/* Connector pipe stub toward hub */}
        <mesh position={[width / 2 + 0.9, height * 0.4, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.15, 0.15, 1.8, 10]} />
          <meshStandardMaterial color="#64748B" metalness={0.8} />
        </mesh>
        {isHovered && (
          <Html distanceFactor={11} position={[0, height + 1, 0]} center>
            <div className="glass-panel px-3.5 py-2.5 text-center pointer-events-none whitespace-nowrap shadow-xl">
              <p className="text-[11px] font-bold text-[#0EA5E9]">Data Ingestion</p>
              <p className="text-[10px] text-[#0F1115] mt-0.5">
                <span className="font-mono font-semibold">{METRICS.throughputMsgSec.toLocaleString()}</span> msg/sec
              </p>
              <p className="text-[10px] text-[#5A5F6B]">3 active sensor streams</p>
              <span className="text-[9px] text-[#4361EE] font-semibold mt-1 block">Click → /datasets</span>
            </div>
          </Html>
        )}
      </group>
      {/* Med detail */}
      <mesh castShadow position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, 3.8]} />
        <meshStandardMaterial color="#1E293B" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Low detail (far) */}
      <mesh castShadow position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, 3.5]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
    </Detailed>
  );
}

/* ── BUILDING 2: Central Hub — landmark, not data-driven ──────────────────── */
function HubBuilding() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    if (ref.current) {
      (ref.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        0.18 + Math.sin(state.clock.elapsedTime * 1.4) * 0.06;
    }
  });

  return (
    <Detailed distances={[0, 20, 40]}>
      {/* High detail */}
      <group>
        {/* Octagonal podium base */}
        <mesh castShadow position={[0, 0.6, 0]}>
          <cylinderGeometry args={[2.4, 2.8, 1.2, 8]} />
          <meshStandardMaterial color="#4361EE" emissive="#4361EE" emissiveIntensity={0.15} metalness={0.4} roughness={0.3} />
        </mesh>
        {/* Main tower */}
        <mesh ref={ref} castShadow position={[0, 2.8, 0]}>
          <cylinderGeometry args={[1.4, 1.8, 3.2, 8]} />
          <meshStandardMaterial color="#312E81" emissive="#4361EE" emissiveIntensity={0.18} metalness={0.6} roughness={0.2} />
        </mesh>
        {/* Pulsing crown sphere */}
        <mesh position={[0, 4.8, 0]}>
          <sphereGeometry args={[0.7, 16, 16]} />
          <meshStandardMaterial color="#818CF8" emissive="#818CF8" emissiveIntensity={0.9} />
        </mesh>
        {/* Hub label */}
        <Html distanceFactor={14} position={[0, 6.2, 0]} center>
          <div className="glass-panel px-3 py-1.5 text-center pointer-events-none whitespace-nowrap">
            <p className="text-[10px] font-bold text-[#4361EE]">ARGUS Core Engine</p>
            <p className="text-[9px] text-[#5A5F6B]">ML Pipeline Hub</p>
          </div>
        </Html>
      </group>
      {/* Med detail */}
      <group>
        <mesh castShadow position={[0, 0.6, 0]}>
          <cylinderGeometry args={[2.4, 2.8, 1.2, 8]} />
          <meshStandardMaterial color="#4361EE" metalness={0.4} roughness={0.3} />
        </mesh>
        <mesh castShadow position={[0, 2.8, 0]}>
          <cylinderGeometry args={[1.4, 1.8, 3.2, 8]} />
          <meshStandardMaterial color="#312E81" metalness={0.5} roughness={0.3} />
        </mesh>
      </group>
      {/* Low detail */}
      <mesh castShadow position={[0, 2, 0]}>
        <cylinderGeometry args={[1.6, 2.4, 4, 6]} />
        <meshStandardMaterial color="#4361EE" />
      </mesh>
    </Detailed>
  );
}

/* ── BUILDING 3: Digital Twin — height driven by active machine count ──────── */
interface BuildingProps {
  onNav: (route: string) => void;
  hoveredZone: string | null;
  setHoveredZone: (z: string | null) => void;
}

function DigitalTwinBuilding({ onNav, hoveredZone, setHoveredZone }: BuildingProps) {
  const machineCount = METRICS.activeMachines; // 1–8
  const height = 2.5 + machineCount * 0.8;    // taller = more machines monitored
  const isHovered = hoveredZone === "twin";

  return (
    <Detailed distances={[0, 18, 35]}>
      {/* High detail */}
      <group
        onPointerOver={() => { setHoveredZone("twin"); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHoveredZone(null); document.body.style.cursor = "auto"; }}
        onClick={() => onNav("/app/digital-twin")}
      >
        {/* Cleanroom block */}
        <mesh castShadow position={[0, height / 2, 0]}>
          <boxGeometry args={[4.2, height, 3.8]} />
          <meshStandardMaterial color="#F8FAFC" roughness={0.2} metalness={0.3}
            emissive={isHovered ? "#4361EE" : "#000"} emissiveIntensity={isHovered ? 0.06 : 0} />
        </mesh>
        {/* Glass facade */}
        <mesh position={[0, height * 0.5, 1.91]}>
          <planeGeometry args={[3.4, height * 0.45]} />
          <meshPhysicalMaterial color="#38BDF8" transmission={0.65} roughness={0.08} />
        </mesh>
        {/* Machine status cubes on roof — one per machine */}
        {Array.from({ length: machineCount }).map((_, i) => {
          const colors = ["#DC2626", "#D97706", "#16A34A"];
          const c = colors[i % colors.length];
          const xSpread = (machineCount - 1) * 0.7;
          return (
            <mesh key={i} castShadow position={[-xSpread / 2 + i * 0.7, height + 0.25, 0]}>
              <boxGeometry args={[0.4, 0.5, 0.4]} />
              <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.8} />
            </mesh>
          );
        })}
        {isHovered && (
          <Html distanceFactor={11} position={[0, height + 1.8, 0]} center>
            <div className="glass-panel px-3.5 py-2.5 text-center pointer-events-none whitespace-nowrap shadow-xl">
              <p className="text-[11px] font-bold text-[#4361EE]">Digital Twin Monitor</p>
              <p className="text-[10px] text-[#0F1115] mt-0.5">
                <span className="font-mono font-semibold">{machineCount}</span> machines monitored
              </p>
              <p className="text-[10px] text-[#5A5F6B]">Facility health: {METRICS.facilityHealth}/100</p>
              <span className="text-[9px] text-[#4361EE] font-semibold mt-1 block">Click → /digital-twin</span>
            </div>
          </Html>
        )}
      </group>
      {/* Med */}
      <mesh castShadow position={[0, height / 2, 0]}>
        <boxGeometry args={[4.2, height, 3.8]} />
        <meshStandardMaterial color="#F1F5F9" roughness={0.3} metalness={0.2} />
      </mesh>
      {/* Low */}
      <mesh castShadow position={[0, height / 2, 0]}>
        <boxGeometry args={[4, height, 3.5]} />
        <meshStandardMaterial color="#E2E8F0" />
      </mesh>
    </Detailed>
  );
}

/* ── BUILDING 4: Drift Detection — height & glow driven by drift count ──────── */
function DriftBeaconBuilding({ onNav, hoveredZone, setHoveredZone }: BuildingProps) {
  const driftCount = METRICS.activeDrifts; // 0–10
  const spireHeight = 3.5 + driftCount * 1.2;  // taller with more events
  const glowIntensity = 0.5 + driftCount * 0.25;
  const isHovered = hoveredZone === "drift";

  const pulseRef = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    if (pulseRef.current) {
      (pulseRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        glowIntensity + Math.sin(state.clock.elapsedTime * 2.5) * 0.3;
    }
  });

  return (
    <Detailed distances={[0, 18, 35]}>
      {/* High detail */}
      <group
        onPointerOver={() => { setHoveredZone("drift"); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHoveredZone(null); document.body.style.cursor = "auto"; }}
        onClick={() => onNav("/app/drift-events")}
      >
        {/* Spire shaft */}
        <mesh castShadow position={[0, spireHeight / 2, 0]}>
          <cylinderGeometry args={[0.55, 0.9, spireHeight, 8]} />
          <meshStandardMaterial color="#1E293B" metalness={0.85} roughness={0.2} />
        </mesh>
        {/* Alert cone cap */}
        <mesh castShadow position={[0, spireHeight + 0.9, 0]}>
          <coneGeometry args={[0.9, 1.8, 8]} />
          <meshStandardMaterial color="#991B1B" />
        </mesh>
        {/* Pulsing alert orb */}
        <mesh ref={pulseRef} position={[0, spireHeight + 2.1, 0]}>
          <sphereGeometry args={[0.55, 16, 16]} />
          <meshStandardMaterial color="#DC2626" emissive="#DC2626" emissiveIntensity={glowIntensity} />
        </mesh>
        {/* Alert ring bands — one per active drift */}
        {Array.from({ length: driftCount }).map((_, i) => (
          <mesh key={i} position={[0, 1.2 + i * 1.1, 0]}>
            <torusGeometry args={[1.1, 0.07, 8, 24]} />
            <meshStandardMaterial color="#DC2626" emissive="#DC2626" emissiveIntensity={0.7} />
          </mesh>
        ))}
        {isHovered && (
          <Html distanceFactor={11} position={[0, spireHeight + 3.4, 0]} center>
            <div className="glass-panel px-3.5 py-2.5 text-center pointer-events-none whitespace-nowrap shadow-xl">
              <p className="text-[11px] font-bold text-[#DC2626]">Drift Detection Tower</p>
              <p className="text-[10px] text-[#0F1115] mt-0.5">
                <span className="font-mono font-semibold">{driftCount}</span> active drift events
              </p>
              <p className="text-[10px] text-[#5A5F6B]">1 Critical · 1 Warning</p>
              <span className="text-[9px] text-[#4361EE] font-semibold mt-1 block">Click → /drift-events</span>
            </div>
          </Html>
        )}
      </group>
      {/* Med */}
      <group>
        <mesh castShadow position={[0, spireHeight / 2, 0]}>
          <cylinderGeometry args={[0.55, 0.9, spireHeight, 6]} />
          <meshStandardMaterial color="#1E293B" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0, spireHeight + 2.1, 0]}>
          <sphereGeometry args={[0.55, 8, 8]} />
          <meshStandardMaterial color="#DC2626" emissive="#DC2626" emissiveIntensity={0.5} />
        </mesh>
      </group>
      {/* Low */}
      <mesh castShadow position={[0, spireHeight / 2, 0]}>
        <cylinderGeometry args={[0.6, 1, spireHeight, 6]} />
        <meshStandardMaterial color="#7F1D1D" />
      </mesh>
    </Detailed>
  );
}

/* ── BUILDING 5: Financial Impact — pulse glow driven by impact severity ────── */
function ImpactBuilding({ onNav, hoveredZone, setHoveredZone }: BuildingProps) {
  const severityNorm = Math.min(METRICS.impactUSD / 100000, 1); // 0–1 (max $100k)
  const isHovered = hoveredZone === "impact";
  const glowRef = useRef<THREE.Mesh>(null!);

  useFrame((state) => {
    if (glowRef.current) {
      (glowRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        severityNorm * 0.35 + Math.sin(state.clock.elapsedTime * 1.1) * 0.1;
    }
  });

  return (
    <Detailed distances={[0, 18, 35]}>
      {/* High detail */}
      <group
        onPointerOver={() => { setHoveredZone("impact"); document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { setHoveredZone(null); document.body.style.cursor = "auto"; }}
        onClick={() => onNav("/app/impact")}
      >
        {/* Wide low control building */}
        <mesh ref={glowRef} castShadow position={[0, 1.1, 0]}>
          <boxGeometry args={[5.5, 2.2, 4]} />
          <meshStandardMaterial color="#F0FDF4" roughness={0.1} metalness={0.25}
            emissive="#16A34A" emissiveIntensity={severityNorm * 0.2}
          />
        </mesh>
        {/* Panoramic glass */}
        <mesh position={[0, 1.0, 2.01]}>
          <planeGeometry args={[4.8, 1.1]} />
          <meshPhysicalMaterial color={isHovered ? "#4ADE80" : "#16A34A"} transmission={0.72} roughness={0.08} />
        </mesh>
        {/* Severity status bar on facade */}
        <mesh position={[-5.5 / 2 + (severityNorm * 5.5) / 2, 2.35, 2.01]}>
          <boxGeometry args={[severityNorm * 5.5, 0.12, 0.01]} />
          <meshStandardMaterial
            color={severityNorm > 0.6 ? "#DC2626" : "#16A34A"}
            emissive={severityNorm > 0.6 ? "#DC2626" : "#16A34A"}
            emissiveIntensity={1}
          />
        </mesh>
        {isHovered && (
          <Html distanceFactor={11} position={[0, 3.4, 0]} center>
            <div className="glass-panel px-3.5 py-2.5 text-center pointer-events-none whitespace-nowrap shadow-xl">
              <p className="text-[11px] font-bold text-[#16A34A]">Financial Impact Centre</p>
              <p className="text-[10px] text-[#0F1115] mt-0.5">
                <span className="font-mono font-semibold">${METRICS.impactUSD.toLocaleString()}</span> estimated loss
              </p>
              <p className="text-[10px] text-[#5A5F6B]">Severity: {Math.round(severityNorm * 100)}% of threshold</p>
              <span className="text-[9px] text-[#4361EE] font-semibold mt-1 block">Click → /impact</span>
            </div>
          </Html>
        )}
      </group>
      {/* Med */}
      <mesh castShadow position={[0, 1.1, 0]}>
        <boxGeometry args={[5.5, 2.2, 4]} />
        <meshStandardMaterial color="#DCFCE7" roughness={0.2} metalness={0.15} />
      </mesh>
      {/* Low */}
      <mesh castShadow position={[0, 1.1, 0]}>
        <boxGeometry args={[5.5, 2.2, 3.8]} />
        <meshStandardMaterial color="#BBF7D0" />
      </mesh>
    </Detailed>
  );
}

/* ── Full GitCity Scene ───────────────────────────────────────────────────── */
function GitCityScene({ onNav }: { onNav: (route: string) => void }) {
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);

  const buildingProps = { onNav, hoveredZone, setHoveredZone };

  return (
    <group position={[0, -0.8, 0]}>
      <CityRoad />
      <Lampposts />

      {/* Building 1: Data Ingestion — far left along road */}
      <AnimatedBuilding delay={0.1} position={[-10.5, 0, 0]}>
        <DataIngestionBuilding {...buildingProps} />
      </AnimatedBuilding>

      {/* Building 2: ARGUS Hub — center landmark */}
      <AnimatedBuilding delay={0.55} position={[-2.5, 0, 0]}>
        <HubBuilding />
      </AnimatedBuilding>

      {/* Building 3: Digital Twin — right of hub, slightly behind road */}
      <AnimatedBuilding delay={1.0} position={[5.5, 0, -4.5]}>
        <DigitalTwinBuilding {...buildingProps} />
      </AnimatedBuilding>

      {/* Building 4: Drift Detection — right of hub, front */}
      <AnimatedBuilding delay={1.3} position={[5.5, 0, 4.5]}>
        <DriftBeaconBuilding {...buildingProps} />
      </AnimatedBuilding>

      {/* Building 5: Financial Impact — far right, end of road */}
      <AnimatedBuilding delay={1.7} position={[12.5, 0, 0]}>
        <ImpactBuilding {...buildingProps} />
      </AnimatedBuilding>
    </group>
  );
}

/* ── Error Boundary ───────────────────────────────────────────────────────── */
class ThreeErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: ReactNode; children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) { console.info("3D fallback:", error.message); }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

function CanvasSpinner() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 backdrop-blur-md z-20">
      <Loader2 className="w-7 h-7 text-[#4361EE] animate-spin mb-2" />
      <p className="text-xs font-semibold text-[#0F1115]">Building 3D City Map…</p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────── */
/*  PAGE COMPONENT                                                               */
/* ──────────────────────────────────────────────────────────────────────────── */

export default function FacilityViewPage() {
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const [autoRotate, setAutoRotate] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const orbitRef = useRef<any>(null);
  const navigate = useNavigate();

  const handleNav = (route: string) => {
    setIsNavigating(true);
    setTimeout(() => navigate(route), 250);
  };

  return (
    <div className="space-y-5 relative">
      {/* ── Header caption bar with 2D/3D toggle ─────────────────────────── */}
      <div className="p-3.5 rounded-xl bg-white border border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-[#0F1115] font-semibold">
          <Navigation className="w-4 h-4 text-[#4361EE]" />
          <span>ARGUS System Architecture</span>
          <span className="text-[#5A5F6B] font-normal hidden sm:inline">
            — Click any zone to navigate to that module.
          </span>
        </div>
        {/* 2D / 3D toggle */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#F4F4F5] border border-[#E5E7EB]">
          <button
            onClick={() => setViewMode("2d")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
              viewMode === "2d" ? "bg-white text-[#4361EE] shadow-sm border border-[#E5E7EB]" : "text-[#5A5F6B] hover:text-[#0F1115]"
            }`}
          >
            <Map className="w-3.5 h-3.5" />
            Flow Diagram
          </button>
          <button
            onClick={() => setViewMode("3d")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
              viewMode === "3d" ? "bg-white text-[#4361EE] shadow-sm border border-[#E5E7EB]" : "text-[#5A5F6B] hover:text-[#0F1115]"
            }`}
          >
            <Layers3 className="w-3.5 h-3.5" />
            3D City Map
          </button>
        </div>
      </div>

      {/* ── Main layout ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

        {/* Canvas Area (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="card p-0 overflow-hidden relative bg-[#FAFAFA]" style={{ height: 520 }}>
            {isNavigating && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-md z-30 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-[#4361EE] animate-spin" />
              </div>
            )}

            {/* 2D Flow Diagram */}
            {viewMode === "2d" && (
              <ReactFlowProvider>
                <ARGUSFlowDiagram />
              </ReactFlowProvider>
            )}

            {/* 3D GitCity Scene */}
            {viewMode === "3d" && (
              <>
                <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
                  <span className="glass-panel px-3 py-1 text-[11px] font-semibold text-[#0F1115] flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A] animate-pulse" />
                    Fab-04 · GitCity Architecture View
                  </span>
                </div>
                <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                  <button
                    onClick={() => setAutoRotate((p) => !p)}
                    className={`glass-panel px-2.5 py-1.5 text-[11px] font-semibold flex items-center gap-1.5 transition-all ${autoRotate ? "text-[#4361EE]" : "text-[#5A5F6B]"}`}
                  >
                    <RotateCcw className={`w-3 h-3 ${autoRotate ? "animate-spin" : ""}`} />
                    {autoRotate ? "Rotating" : "Static"}
                  </button>
                  <button onClick={() => orbitRef.current?.reset()} className="glass-panel p-1.5 text-[#5A5F6B] hover:text-[#0F1115]">
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>

                {/* Metric legend overlay */}
                <div className="absolute bottom-3 right-3 z-10 glass-panel px-3 py-2 space-y-1">
                  <p className="text-[9px] uppercase font-bold text-[#8C919E] tracking-wider mb-1">Building scale = live metric</p>
                  <div className="flex items-center gap-2 text-[9px] text-[#5A5F6B]">
                    <span className="h-2 w-2 rounded bg-[#0EA5E9]" /> Data Ingestion width = throughput
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-[#5A5F6B]">
                    <span className="h-2 w-2 rounded bg-[#4361EE]" /> Digital Twin height = machines
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-[#5A5F6B]">
                    <span className="h-2 w-2 rounded bg-[#DC2626]" /> Drift spire height = event count
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-[#5A5F6B]">
                    <span className="h-2 w-2 rounded bg-[#16A34A]" /> Impact pulse = severity
                  </div>
                </div>

                <ThreeErrorBoundary fallback={<CanvasSpinner />}>
                  <Suspense fallback={<CanvasSpinner />}>
                    <Canvas
                      camera={{ position: [0, 14, 22], fov: 50 }}
                      style={{ background: "linear-gradient(to b, #1E293B 0%, #0F172A 100%)", width: "100%", height: "100%" }}
                      shadows
                    >
                      <ambientLight intensity={0.5} />
                      <directionalLight position={[8, 20, 10]} intensity={1.4} castShadow
                        shadow-mapSize={[1024, 1024]} shadow-camera-far={60} shadow-camera-left={-20}
                        shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} />
                      <directionalLight position={[-12, 10, -8]} intensity={0.3} color="#818CF8" />
                      <Environment preset="city" />
                      <OrbitControls ref={orbitRef} enableDamping dampingFactor={0.05}
                        autoRotate={autoRotate} autoRotateSpeed={0.4}
                        minDistance={8} maxDistance={50} maxPolarAngle={Math.PI / 2.1} />
                      <GitCityScene onNav={handleNav} />
                    </Canvas>
                  </Suspense>
                </ThreeErrorBoundary>
              </>
            )}
          </div>

          {/* Hint below canvas */}
          <div className="p-3 rounded-lg bg-white border border-[#E5E7EB] flex items-start gap-2.5 text-[11px] text-[#5A5F6B]">
            <Info className="w-3.5 h-3.5 text-[#4361EE] flex-shrink-0 mt-0.5" />
            {viewMode === "2d"
              ? "Hover any node to see live stats. Click to navigate. Scroll to zoom — drag to pan."
              : "Buildings rise from the road on load. Size = live metric. Hover for stats · Click to navigate · Drag to orbit."}
          </div>
        </div>

        {/* Sidebar (4 cols) */}
        <div className="lg:col-span-4 space-y-5">

          {/* Health gauge */}
          <div className="card text-center p-6 bg-white border border-[#E5E7EB]">
            <p className="section-label mb-3">Facility Digital Twin Health</p>
            <div className="flex justify-center my-1">
              <RadialGauge value={METRICS.facilityHealth} size={130} />
            </div>
            <p className="text-[11px] text-[#5A5F6B] mt-2">
              Composite across {METRICS.activeMachines} active process twin models
            </p>
          </div>

          {/* Live metric summary — mirrors building size drivers */}
          <div className="card p-5 bg-white border border-[#E5E7EB] space-y-1">
            <p className="section-label mb-3">Live Metric Drivers</p>
            <p className="text-[10px] text-[#8C919E] mb-2">These values control 3D building sizes in real-time</p>

            {[
              { label: "Telemetry Throughput", value: `${METRICS.throughputMsgSec.toLocaleString()} msg/s`, color: "#0EA5E9", note: "→ Data building width" },
              { label: "Machines Monitored", value: `${METRICS.activeMachines} active`, color: "#4361EE", note: "→ Digital Twin height" },
              { label: "Active Drift Events", value: `${METRICS.activeDrifts} events`, color: "#DC2626", note: "→ Spire height + glow" },
              { label: "Financial Exposure", value: `$${METRICS.impactUSD.toLocaleString()}`, color: "#16A34A", note: "→ Control center pulse" },
            ].map((m) => (
              <div key={m.label} className="py-2 border-b border-[#F3F4F6] last:border-0">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#5A5F6B]">{m.label}</span>
                  <span className="font-mono text-xs font-semibold" style={{ color: m.color }}>{m.value}</span>
                </div>
                <p className="text-[9px] text-[#8C919E] mt-0.5">{m.note}</p>
              </div>
            ))}
          </div>

          {/* Module navigator */}
          <div className="card p-5 bg-white border border-[#E5E7EB] space-y-2">
            <p className="section-label mb-2">Module Navigator</p>
            {[
              { label: "Digital Twin Telemetry", sub: "Live gauges & parameters", route: "/app/digital-twin", icon: <Cpu className="w-4 h-4 text-[#4361EE]" /> },
              { label: "Data Ingestion", sub: "Datasets & synthetic streams", route: "/app/datasets", icon: <Database className="w-4 h-4 text-[#0EA5E9]" /> },
              { label: "Drift Event Diagnostics", sub: "1 Critical · 1 Warning", route: "/app/drift-events", icon: <AlertTriangle className="w-4 h-4 text-[#DC2626]" /> },
              { label: "Financial Impact", sub: "$48,320 estimated loss", route: "/app/impact", icon: <BarChart3 className="w-4 h-4 text-[#16A34A]" /> },
            ].map((item) => (
              <button key={item.route} onClick={() => handleNav(item.route)}
                className="w-full p-2.5 rounded-lg border border-[#E5E7EB] bg-[#FBFBFA] flex items-center justify-between text-left transition-all group hover:border-[#D1D5DB]">
                <div className="flex items-center gap-2.5">
                  {item.icon}
                  <div>
                    <p className="text-xs font-bold text-[#0F1115]">{item.label}</p>
                    <p className="text-[10px] text-[#5A5F6B]">{item.sub}</p>
                  </div>
                </div>
                <span className="text-[10px] text-[#8C919E] group-hover:text-[#4361EE] transition-colors">→</span>
              </button>
            ))}
          </div>

          {/* Telemetry bar */}
          <div className="card p-5 bg-white border border-[#E5E7EB] space-y-3">
            <p className="section-label mb-1">Live Telemetry</p>
            <div className="flex items-center justify-between py-1.5 border-b border-[#F3F4F6]">
              <div className="flex items-center gap-2 text-[11px] text-[#5A5F6B]"><Cpu className="w-3.5 h-3.5 text-[#4361EE]" /> Twin Models</div>
              <span className="font-mono text-xs font-semibold text-[#0F1115]">{METRICS.activeMachines}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-[#F3F4F6]">
              <div className="flex items-center gap-2 text-[11px] text-[#5A5F6B]"><AlertTriangle className="w-3.5 h-3.5 text-[#DC2626]" /> Critical Events</div>
              <span className="status-badge status-badge-red text-[10px]">1 Critical</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-[#F3F4F6]">
              <div className="flex items-center gap-2 text-[11px] text-[#5A5F6B]"><Zap className="w-3.5 h-3.5 text-[#D97706]" /> Ingestion Rate</div>
              <span className="font-mono text-[11px] text-[#0F1115]">{METRICS.throughputMsgSec.toLocaleString()} msg/s</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2 text-[11px] text-[#5A5F6B]"><Activity className="w-3.5 h-3.5 text-[#16A34A]" /> WebSocket</div>
              <span className="text-[10px] font-mono text-[#16A34A] bg-[#DCFCE7] px-2 py-0.5 rounded font-semibold">● Live</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
