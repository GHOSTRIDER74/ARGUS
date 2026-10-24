import { useEffect, useState } from "react";
import { api } from "../services/api";
import { StatusBadge } from "../components/StatusBadge";
import { RadialGauge } from "../components/RadialGauge";
import { FabCity3D } from "../components/FabCity3D";
import { 
  Layers, 
  Cpu, 
  Zap, 
  RotateCw, 
  Droplets, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  Activity,
  Maximize2,
  Box
} from "lucide-react";

// Standard semiconductor wafer fabrication stage sequence
const FAB_STAGES = [
  {
    step: 1,
    id: "DEP-01",
    name: "Thin Film Deposition",
    stage: "Deposition",
    icon: Layers,
    desc: "CVD oxide layer growth",
    keyParam: "dep_temp",
    unit: "°C"
  },
  {
    step: 2,
    id: "LITHO-01",
    name: "Photolithography",
    stage: "Lithography",
    icon: Zap,
    desc: "UV circuit exposure & mask alignment",
    keyParam: "exposure_dose",
    unit: "mJ/cm²"
  },
  {
    step: 3,
    id: "ETCH",
    name: "Plasma Reactive Etch",
    stage: "Plasma Etch",
    isDual: true,
    chambers: ["ETCH-01", "ETCH-02"],
    icon: Cpu,
    desc: "Parallel RF plasma wafer etching",
    keyParam: "rf_power",
    unit: "W"
  },
  {
    step: 4,
    id: "CMP-01",
    name: "Chemical Mechanical Polish",
    stage: "CMP Polish",
    icon: RotateCw,
    desc: "Wafer planarization & pad polishing",
    keyParam: "pad_pressure",
    unit: "psi"
  },
  {
    step: 5,
    id: "CLEAN-01",
    name: "Post-CMP Wet Clean",
    stage: "Wet Clean",
    icon: Droplets,
    desc: "Deionized chemical bath & particle scrub",
    keyParam: "particle_count",
    unit: "pcs"
  }
];

export function FacilityView() {
  const [facility, setFacility] = useState<any>(null);
  const [selectedMachineId, setSelectedMachineId] = useState<string>("ETCH-01");
  const [viewMode, setViewMode] = useState<"3d" | "2d">("3d");
  // Bumped on every machine selection to trigger CSS fade-in on the inspector panel
  const [selectionVersion, setSelectionVersion] = useState(0);

  const handleSelectMachine = (id: string) => {
    setSelectedMachineId(id);
    setSelectionVersion(v => v + 1);
  };

  const fetchFacilityData = async () => {
    try {
      const data = await api.getFacility();
      setFacility(data);
    } catch (err) {
      console.error("Failed to fetch facility data:", err);
    }
  };

  useEffect(() => {
    fetchFacilityData();
    // Poll every 1 second to sync with streaming telemetry
    const interval = setInterval(fetchFacilityData, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!facility) {
    return (
      <div className="loading-state">
        <div className="loading-spinner" />
        <span>Loading fab facility map...</span>
      </div>
    );
  }

  // Helper to look up a machine object from facility.machines list
  const getMachine = (id: string) => {
    return facility.machines?.find((m: any) => m.machine_id === id);
  };

  // No fallback to machines[0] — only show the explicitly selected machine
  const selectedMachine = getMachine(selectedMachineId) ?? null;

  const getHealthColor = (status: string) => {
    switch (status) {
      case "critical": return "var(--status-critical)";
      case "warning": return "var(--status-warning)";
      case "healthy": 
      default: return "var(--status-healthy)";
    }
  };

  return (
    <div className="space-y-8 text-left">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-xl text-headline-xl font-bold text-primary tracking-tight">
            Spatial Digital Twin & Fab Topology
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Real-time cyber-physical cleanroom pipeline mapping wafer conduits, tool telemetry, and thermal drift states.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-full bg-surface-container font-label-caps text-label-caps text-on-surface font-semibold">
            TOTAL TOOLS: {facility.total_machines || 6}
          </span>
          <StatusBadge status={facility.overall_health} />
        </div>
      </div>

      {/* Top Section: Health Summary & Station Live Telemetry Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Overall Health Metrics */}
        <div className="lg:col-span-5 bg-surface-white rounded-3xl p-6 md:p-8 border border-outline-variant/30 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
            <div>
              <h2 className="font-headline-md text-headline-md font-bold text-primary">Facility Health Index</h2>
              <div className="text-xs text-on-surface-variant mt-0.5">Fleet-wide tool stability & yield readiness</div>
            </div>
            <StatusBadge status={facility.overall_health} />
          </div>

          <div className="flex justify-center my-6">
            <RadialGauge 
              value={facility.total_machines > 0 ? facility.healthy / facility.total_machines : 1} 
              label="Healthy Tool Ratio" 
              size={180} 
              strokeWidth={14} 
              color={getHealthColor(facility.overall_health)}
            />
          </div>

          <div className="grid grid-cols-4 gap-2 pt-4 border-t border-outline-variant/20 text-center">
            <div className="p-2.5 rounded-2xl bg-surface-container-low border border-outline-variant/20">
              <div className="text-xl font-bold font-mono text-primary">{facility.total_machines}</div>
              <div className="text-[10px] uppercase font-bold text-on-surface-variant mt-0.5">Total</div>
            </div>
            <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200/50">
              <div className="text-xl font-bold font-mono text-emerald-700">{facility.healthy}</div>
              <div className="text-[10px] uppercase font-bold text-emerald-700 mt-0.5">Healthy</div>
            </div>
            <div className="p-2.5 rounded-2xl bg-amber-50 border border-amber-200/50">
              <div className="text-xl font-bold font-mono text-amber-700">{facility.warning}</div>
              <div className="text-[10px] uppercase font-bold text-amber-700 mt-0.5">Warning</div>
            </div>
            <div className="p-2.5 rounded-2xl bg-coral-subtle border border-[#FB8D7E]/30">
              <div className="text-xl font-bold font-mono text-secondary">{facility.critical}</div>
              <div className="text-[10px] uppercase font-bold text-secondary mt-0.5">Critical</div>
            </div>
          </div>
        </div>

        {/* Right: Selected Tool Live Telemetry Inspector */}
        <div key={selectionVersion} className="lg:col-span-7 bg-surface-white rounded-3xl p-6 md:p-8 border border-outline-variant/30 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
            <div>
              <h2 className="font-headline-md text-headline-md font-bold text-primary">Station Telemetry Inspector</h2>
              <div className="text-xs text-on-surface-variant mt-0.5">
                {selectedMachine ? `${selectedMachine.stage} — Tool ${selectedMachine.machine_id}` : "Select a tool below"}
              </div>
            </div>
            {selectedMachine && <StatusBadge status={selectedMachine.health} />}
          </div>

          {selectedMachine ? (
            <div className="space-y-4 my-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-surface-container-low rounded-2xl border border-outline-variant/30">
                  <div className="text-[10px] font-label-caps text-on-surface-variant uppercase font-bold mb-1">Drift Severity</div>
                  <div className="text-2xl font-bold font-mono" style={{ color: getHealthColor(selectedMachine.health) }}>
                    {(selectedMachine.drift_severity * 100).toFixed(1)}%
                  </div>
                  <div className="text-xs text-on-surface-variant capitalize mt-1">Pattern: <strong className="text-primary">{selectedMachine.drift_pattern}</strong></div>
                </div>

                <div className="p-3.5 bg-surface-container-low rounded-2xl border border-outline-variant/30">
                  <div className="text-[10px] font-label-caps text-on-surface-variant uppercase font-bold mb-1">Processed Wafers</div>
                  <div className="text-2xl font-bold font-mono text-primary">
                    {selectedMachine.records_processed.toLocaleString()}
                  </div>
                  <div className="text-xs text-on-surface-variant mt-1">Hybrid Anomaly: <strong className="text-primary font-mono">{selectedMachine.hybrid_score.toFixed(3)}</strong></div>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-label-caps text-on-surface-variant uppercase font-bold mb-2">Live Chamber Parameters</div>
                <div className="grid grid-cols-2 gap-2.5">
                  {Object.entries(selectedMachine.parameters || {}).map(([key, val]: any) => {
                    const isRoot = selectedMachine.root_causes?.includes(key);
                    return (
                      <div 
                        key={key}
                        className={`p-2.5 rounded-2xl border flex items-center justify-between transition-colors ${
                          isRoot 
                            ? "bg-amber-50 border-amber-300 text-amber-950" 
                            : "bg-surface-container-low border-outline-variant/30 text-on-surface"
                        }`}
                      >
                        <div>
                          <div className="text-xs font-medium capitalize">
                            {key.replace(/_/g, " ")}
                          </div>
                          {isRoot && <div className="text-[10px] font-bold text-amber-700">Root Drift Cause</div>}
                        </div>
                        <div className="font-mono font-bold text-sm">
                          {typeof val === "number" ? val.toFixed(3) : val}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-on-surface-variant font-body-md">
              <span className="material-symbols-outlined text-[36px] text-outline-variant mb-1 block">precision_manufacturing</span>
              Select any station from the production line below to inspect live parameters.
            </div>
          )}
        </div>
      </div>

      {/* Production Flow Map Panel */}
      <div className="bg-surface-white rounded-3xl p-6 md:p-8 border border-outline-variant/30 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-outline-variant/20">
          <div>
            <h2 className="font-headline-lg text-headline-lg font-bold text-primary tracking-tight">
              {viewMode === "3d" ? "Argus FabCity 3D — Real-Time Spatial Pipeline" : "Production Line Flow Architecture"}
            </h2>
            <div className="font-body-md text-sm text-on-surface-variant mt-0.5">
              {viewMode === "3d" 
                ? "Interactive 3D digital twin: wafer flow conduits, glowing telemetry towers & real-time drift alerts" 
                : "End-to-end sequential wafer fabrication stages (Click a tool to inspect)"}
            </div>
          </div>
          
          <div className="flex items-center gap-4 flex-wrap">
            {/* View Switcher Toggle */}
            <div className="inline-flex p-1 rounded-full bg-surface-container border border-outline-variant/30 shadow-inner">
              <button
                onClick={() => setViewMode("3d")}
                className={`px-4 py-1.5 rounded-full font-label-md text-xs font-semibold flex items-center gap-2 transition-all ${
                  viewMode === "3d" 
                    ? "bg-primary text-surface-white shadow-sm" 
                    : "text-on-surface-variant hover:text-primary"
                }`}
              >
                <span>🏙️</span> 3D FabCity Matrix
              </button>
              <button
                onClick={() => setViewMode("2d")}
                className={`px-4 py-1.5 rounded-full font-label-md text-xs font-semibold flex items-center gap-2 transition-all ${
                  viewMode === "2d" 
                    ? "bg-primary text-surface-white shadow-sm" 
                    : "text-on-surface-variant hover:text-primary"
                }`}
              >
                <span>📐</span> 2D Schematic
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono font-medium text-on-surface-variant">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Healthy
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Warning
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500" /> Critical
              </span>
            </div>
          </div>
        </div>

        {viewMode === "3d" ? (
          <div className="rounded-3xl overflow-hidden border border-slate-900/60 shadow-xl bg-slate-950">
            <FabCity3D
              machines={facility.machines || []}
              selectedMachineId={selectedMachineId}
              onSelectMachine={handleSelectMachine}
              height={580}
            />
          </div>
        ) : (
          /* Interactive Production Line Pipeline */
          <div className="overflow-x-auto py-4">
            <div className="flex items-center justify-between min-w-[920px] relative">
              {FAB_STAGES.map((stage, idx) => {
                const Icon = stage.icon;
                const isLast = idx === FAB_STAGES.length - 1;

                // If dual chambers (ETCH-01 and ETCH-02)
                if (stage.isDual && stage.chambers) {
                  const m1 = getMachine(stage.chambers[0]);
                  const m2 = getMachine(stage.chambers[1]);

                  return (
                    <div key={stage.step} className="flex items-center flex-1">
                      <div className="flex flex-col gap-3 w-full max-w-[210px]">
                        <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-center">
                          Step {stage.step}: {stage.stage}
                        </div>

                        {[m1, m2].map((m) => {
                          if (!m) return null;
                          const isSelected = selectedMachineId === m.machine_id;

                          return (
                            <div
                              key={m.machine_id}
                              onClick={() => handleSelectMachine(m.machine_id)}
                              className={`p-3.5 rounded-2xl cursor-pointer transition-all border ${
                                isSelected 
                                  ? "bg-surface-white border-secondary ring-2 ring-secondary/20 shadow-md" 
                                  : "bg-surface-container-low border-outline-variant/30 hover:border-outline-variant shadow-sm"
                              }`}
                            >
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-bold font-mono text-sm text-primary">{m.machine_id}</span>
                                <StatusBadge status={m.health} />
                              </div>
                              <div className="text-xs text-on-surface-variant capitalize">
                                {stage.keyParam.replace(/_/g, " ")}:{" "}
                                <span className="font-mono font-semibold text-primary">
                                  {m.parameters?.[stage.keyParam]?.toFixed(2) ?? "—"} {stage.unit}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {!isLast && (
                        <div className="flex items-center justify-center flex-1 px-2">
                          <div className="h-[2px] w-full bg-outline-variant/40 relative">
                            <ArrowRight 
                              size={16} 
                              className="absolute -right-1 -top-2 text-on-surface-variant" 
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                // Single machine stage
                const m = getMachine(stage.id);
                const isSelected = selectedMachineId === stage.id;

                return (
                  <div key={stage.step} className="flex items-center flex-1">
                    <div
                      onClick={() => m && handleSelectMachine(m.machine_id)}
                      className={`w-full max-w-[200px] p-4 rounded-2xl cursor-pointer transition-all border ${
                        isSelected 
                          ? "bg-surface-white border-secondary ring-2 ring-secondary/20 shadow-md" 
                          : "bg-surface-container-low border-outline-variant/30 hover:border-outline-variant shadow-sm"
                      }`}
                    >
                      <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">
                        Step {stage.step}
                      </div>

                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="p-1.5 bg-surface-container rounded-xl text-secondary">
                          <Icon size={16} />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-primary font-mono">{stage.id}</div>
                          <div className="text-xs text-on-surface-variant">{stage.stage}</div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center mt-3 pt-2 border-t border-outline-variant/20">
                        <div className="text-xs text-on-surface-variant">
                          <span className="font-mono font-semibold text-primary">
                            {m?.parameters?.[stage.keyParam]?.toFixed(2) ?? "—"} {stage.unit}
                          </span>
                        </div>
                        {m && <StatusBadge status={m.health} />}
                      </div>
                    </div>

                    {!isLast && (
                      <div className="flex items-center justify-center flex-1 px-2">
                        <div className="h-[2px] w-full bg-outline-variant/40 relative">
                          <ArrowRight 
                            size={16} 
                            className="absolute -right-1 -top-2 text-on-surface-variant" 
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
