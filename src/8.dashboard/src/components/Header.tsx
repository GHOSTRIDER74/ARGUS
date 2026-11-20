import { useLocation } from "react-router-dom";
import { useState } from "react";
import { api } from "../services/api";

const ROUTE_MAP: Record<string, { title: string; subtitle: string; icon: string }> = {
  "/app/twin": { title: "Digital Twin", subtitle: "Real-time state and drift scoring per cleanroom machine", icon: "precision_manufacturing" },
  "/app/facility": { title: "Facility View 3D", subtitle: "Fab-wide 3D cleanroom layout and stage throughput map", icon: "view_in_ar" },
  "/app/drift": { title: "Drift & Diagnosis", subtitle: "Root cause analysis via CUSUM and LSTM Autoencoders", icon: "insights" },
  "/app/impact": { title: "Impact & Financial", subtitle: "Scrap yield penalties, downtime, and operational cost analysis", icon: "monitoring" },
  "/app/sustainability": { title: "Sustainability / LCA", subtitle: "Carbon footprint and dynamic energy efficiency tracking", icon: "eco" },
  "/app/models": { title: "Models & Datasets", subtitle: "SECOM fab sensor schema and UCR Wafer benchmarks", icon: "database" },
  "/app/simulation": { title: "What-If Simulation", subtitle: "Synthetic drift scenario injection and CUSUM evaluation", icon: "tune" },
};

export function Header() {
  const location = useLocation();
  const current = ROUTE_MAP[location.pathname] || {
    title: "ARGUS Dashboard",
    subtitle: "Real-time Fab Process Observability",
    icon: "memory"
  };
  const [streaming, setStreaming] = useState(false);

  const handleStreamBurst = async () => {
    setStreaming(true);
    try {
      await api.ingestToTwin(50);
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setStreaming(false), 700);
    }
  };

  return (
    <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-200/80 text-left">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-[18px] text-slate-400">
            {current.icon}
          </span>
          <span className="text-[11px] font-mono font-semibold tracking-wider text-slate-400 uppercase">
            Telemetry Console // Fab East
          </span>
        </div>
        <h1 className="font-headline-lg text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
          {current.title}
        </h1>
        <p className="font-body-md text-xs md:text-sm text-slate-500 mt-1">
          {current.subtitle}
        </p>
      </div>

      <div className="flex items-center flex-wrap gap-2.5">
        {/* Cleanroom SLA pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200/90 text-xs font-mono text-slate-700 shadow-sm backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-semibold text-slate-800">FAB-EAST-01</span>
          <span className="text-slate-300">•</span>
          <span className="text-emerald-600 font-bold">99.998% SLA</span>
        </div>

        {/* Cleanroom Environment Pill */}
        <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100/80 border border-slate-200 text-xs font-mono text-slate-600">
          <span className="material-symbols-outlined text-[15px] text-slate-400">thermostat</span>
          <span>ISO-1 • 21.0°C</span>
        </div>

        {/* Real-time Stream Telemetry Trigger */}
        <button
          onClick={handleStreamBurst}
          disabled={streaming}
          className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-label-md text-xs font-semibold transition-all duration-150 active:scale-95 shadow-sm border ${streaming
            ? "bg-slate-900 text-white border-slate-900"
            : "bg-white hover:bg-slate-50 text-slate-800 border-slate-200 hover:border-slate-300 hover:shadow"
            }`}
          title="Inject real-time high-rate telemetry burst into the digital twin"
        >
          <span className={`material-symbols-outlined text-[16px] ${streaming ? "animate-spin text-rose-400" : "text-rose-500"}`}>
            {streaming ? "sync" : "bolt"}
          </span>
          <span>{streaming ? "Burst Ingesting..." : "Stream Telemetry"}</span>
        </button>

        {/* Operator profile badge */}
        <div
          className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white border border-slate-200 shadow-sm"
          title="Shift Operator: Shift Alpha-1"
        >
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white font-mono text-[11px] font-bold shadow-xs">
            OP
          </div>
          <div className="text-left leading-tight hidden sm:block">
            <div className="text-[11px] font-bold text-slate-800">Shift 1</div>
            <div className="text-[9px] font-mono text-emerald-600 font-semibold flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-emerald-500"></span> Active
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
