import { useLocation } from "react-router-dom";
import { useState } from "react";
import { api } from "../services/api";

const ROUTE_MAP: Record<string, { title: string; subtitle: string }> = {
  "/app/twin": { title: "Digital Twin", subtitle: "Real-time state and drift scoring per cleanroom machine" },
  "/app/facility": { title: "Facility View 3D", subtitle: "Fab-wide 3D cleanroom layout and stage throughput map" },
  "/app/drift": { title: "Drift & Diagnosis", subtitle: "Root cause analysis via CUSUM and LSTM Autoencoders" },
  "/app/impact": { title: "Impact & Financial", subtitle: "Scrap yield penalties, downtime, and operational cost analysis" },
  "/app/sustainability": { title: "Sustainability / LCA", subtitle: "Carbon footprint and dynamic energy efficiency tracking" },
  "/app/models": { title: "Models & Datasets", subtitle: "SECOM fab sensor schema and UCR Wafer benchmarks" },
  "/app/simulation": { title: "What-If Simulation", subtitle: "Synthetic drift scenario injection and CUSUM evaluation" },
};

export function Header() {
  const location = useLocation();
  const current = ROUTE_MAP[location.pathname] || { title: "ARGUS Dashboard", subtitle: "Process Monitoring" };
  const [interlockActive, setInterlockActive] = useState(false);
  const [streaming, setStreaming] = useState(false);

  const handleStreamBurst = async () => {
    setStreaming(true);
    try {
      await api.ingestToTwin(50);
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setStreaming(false), 800);
    }
  };

  return (
    <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-outline-variant/20 text-left">
      <div>
        <h1 className="font-headline-lg text-headline-lg font-bold text-primary tracking-tight">
          {current.title}
        </h1>
        <p className="font-body-md text-sm text-on-surface-variant mt-0.5">
          {current.subtitle}
        </p>
      </div>

      <div className="flex items-center flex-wrap gap-3">
        {/* Cleanroom SLA pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-white border border-outline-variant/30 text-xs font-mono text-on-surface-variant shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>FAB-EAST-01 • 99.998% SLA</span>
        </div>

        {/* Real-time Stream Telemetry Trigger */}
        <button
          onClick={handleStreamBurst}
          disabled={streaming}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-surface-cream-alt text-on-surface font-label-md text-xs font-semibold hover:bg-surface-variant transition-colors active:scale-95 border border-outline-variant/20"
          title="Inject real-time telemetry bursts into the digital twin"
        >
          <span className="material-symbols-outlined text-[16px] text-secondary">
            {streaming ? "hourglass_top" : "fast_forward"}
          </span>
          <span>{streaming ? "Ingesting..." : "Stream Telemetry"}</span>
        </button>

        {/* Tool Interlock Toggle */}
        <button
          onClick={() => setInterlockActive(prev => !prev)}
          className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full font-label-md text-xs font-semibold active:scale-95 transition-all shadow-sm ${
            interlockActive
              ? "bg-secondary text-surface-white"
              : "bg-primary text-on-primary hover:bg-neutral-800"
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">
            {interlockActive ? "lock" : "power_settings_new"}
          </span>
          <span>{interlockActive ? "Interlock ARMED" : "Tool Interlock"}</span>
        </button>

        {/* Operator avatar */}
        <div 
          className="w-8 h-8 rounded-full border border-secondary-container bg-secondary-fixed flex items-center justify-center font-label-caps text-xs text-on-secondary-fixed font-bold overflow-hidden" 
          title="Cleanroom Operator (Fab East Shift 1)"
        >
          OP
        </div>
      </div>
    </header>
  );
}
