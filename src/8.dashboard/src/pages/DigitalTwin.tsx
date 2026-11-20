import { useEffect, useState } from "react";
import { api } from "../services/api";
import { RadialGauge } from "../components/RadialGauge";
import { StatusBadge } from "../components/StatusBadge";
import { AnimatedNumber } from "../components/AnimatedNumber";

export function DigitalTwin() {
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");

  const fetchTwinState = async () => {
    try {
      const res = await api.getMachines();
      if (res && Array.isArray(res)) {
        setMachines(res);
      }
    } catch (err) {
      console.error("Twin polling error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTwinState();
    const interval = setInterval(async () => {
      try {
        await api.ingestToTwin(10);
        fetchTwinState();
      } catch (e) { }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-500">
        <div className="w-9 h-9 rounded-full border-3 border-rose-500 border-t-transparent animate-spin mx-auto mb-3" />
        <span className="font-mono text-sm tracking-wide">Connecting to cleanroom telemetry twin...</span>
      </div>
    );
  }

  const healthyCount = machines.filter(m => m.health === 'healthy').length;
  const warningCount = machines.filter(m => m.health === 'warning').length;
  const criticalCount = machines.filter(m => m.health === 'critical' || m.health === 'interlocked').length;
  const totalRows = machines.reduce((acc, m) => acc + (Math.round(m.records_processed) || 0), 0);

  // Filter machines based on selected stage
  const filteredMachines = machines.filter(m => {
    if (selectedFilter === "all") return true;
    if (selectedFilter === "etch") return m.machine_id?.toLowerCase().includes("etch") || m.stage?.toLowerCase().includes("etch");
    if (selectedFilter === "dep") return m.machine_id?.toLowerCase().includes("dep") || m.stage?.toLowerCase().includes("deposition");
    if (selectedFilter === "litho") return m.machine_id?.toLowerCase().includes("litho") || m.stage?.toLowerCase().includes("litho");
    if (selectedFilter === "cmp") return m.machine_id?.toLowerCase().includes("cmp") || m.stage?.toLowerCase().includes("cmp");
    return true;
  });

  return (
    <div className="space-y-8 text-left">
      {/* ================= 4 KPI METRIC CARDS ================= */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1: Active Tools */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] relative overflow-hidden group hover:shadow-md hover:border-slate-300 transition-all duration-200">
          <div className="h-1 absolute top-0 inset-x-0 bg-gradient-to-r from-slate-700 to-slate-900" />
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-mono tracking-wider text-slate-500 font-semibold uppercase">
              ACTIVE FAB TOOLS
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <span className="material-symbols-outlined text-[18px]">precision_manufacturing</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5 text-slate-900 font-headline-xl text-3xl md:text-4xl font-extrabold tracking-tight">
            <AnimatedNumber value={machines.length} />
            <span className="text-xs text-slate-400 font-mono font-normal">Chambers</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Processed: <strong className="text-slate-900 font-mono font-bold">{totalRows.toLocaleString()}</strong></span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-mono font-bold">
              100% Online
            </span>
          </div>
        </div>

        {/* Metric 2: Healthy Tools */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] relative overflow-hidden group hover:shadow-md hover:border-emerald-200 transition-all duration-200">
          <div className="h-1 absolute top-0 inset-x-0 bg-gradient-to-r from-emerald-500 to-teal-500" />
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-mono tracking-wider text-slate-500 font-semibold uppercase">
              HEALTHY STATUS
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5 text-emerald-600 font-headline-xl text-3xl md:text-4xl font-extrabold tracking-tight">
            <AnimatedNumber value={healthyCount} />
            <span className="text-xs text-slate-400 font-mono font-normal">/ {machines.length} Tools</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Nominal Operations</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-mono font-bold">
              In-Spec
            </span>
          </div>
        </div>

        {/* Metric 3: Warning / Drift Stage */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] relative overflow-hidden group hover:shadow-md hover:border-amber-200 transition-all duration-200">
          <div className="h-1 absolute top-0 inset-x-0 bg-gradient-to-r from-amber-400 to-orange-500" />
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-mono tracking-wider text-slate-500 font-semibold uppercase">
              WARNING DRIFT
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">warning</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5 text-amber-600 font-headline-xl text-3xl md:text-4xl font-extrabold tracking-tight">
            <AnimatedNumber value={warningCount} />
            <span className="text-xs text-slate-400 font-mono font-normal">Chambers</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>CUSUM Slack Exceeded</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-mono font-bold">
              {warningCount > 0 ? "Watch Stage" : "Zero Drift"}
            </span>
          </div>
        </div>

        {/* Metric 4: Critical Anomaly */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] relative overflow-hidden group hover:shadow-md hover:border-rose-200 transition-all duration-200">
          <div className="h-1 absolute top-0 inset-x-0 bg-gradient-to-r from-rose-500 to-red-600" />
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-mono tracking-wider text-slate-500 font-semibold uppercase">
              CRITICAL ANOMALIES
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">shield</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5 text-rose-600 font-headline-xl text-3xl md:text-4xl font-extrabold tracking-tight">
            <AnimatedNumber value={criticalCount} />
            <span className="text-xs text-slate-400 font-mono font-normal">Chambers</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Safety Guard Active</span>
            <span className={`px-2 py-0.5 rounded-full border text-[11px] font-mono font-bold ${criticalCount > 0
              ? "bg-rose-50 text-rose-700 border-rose-200"
              : "bg-slate-50 text-slate-600 border-slate-200"
              }`}>
              {criticalCount > 0 ? "Action Required" : "Zero Critical"}
            </span>
          </div>
        </div>
      </section>

      {/* ================= REAL MACHINE CARDS GRID ================= */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-headline-md text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
                Cleanroom Machine State & Parameter Telemetry
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-xs font-mono font-semibold">
                {machines.length} Units
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-500 mt-1">
              Live physical sensor feeds, drift severity scores, and CUSUM threshold tracking.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Stage filter pills */}
            <div className="flex items-center p-1 rounded-xl bg-slate-100/90 border border-slate-200 text-xs font-mono">
              {[
                { id: "all", label: "All" },
                { id: "etch", label: "Etch" },
                { id: "dep", label: "Dep" },
                { id: "litho", label: "Litho" },
                { id: "cmp", label: "CMP" },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg transition-all text-xs font-semibold ${selectedFilter === tab.id
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-500 hover:text-slate-900"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-mono text-slate-500 shadow-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>1000ms Loop</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMachines.map((machine) => {
            const isCrit = machine.health === 'critical' || machine.health === 'interlocked';
            const isWarn = machine.health === 'warning';
            const gaugeColor = isCrit ? '#ef4444' : isWarn ? '#f59e0b' : '#10b981';
            const borderAccent = isCrit ? 'from-rose-500 to-red-600' : isWarn ? 'from-amber-400 to-orange-500' : 'from-emerald-400 to-teal-500';

            return (
              <div
                key={machine.machine_id}
                className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] relative overflow-hidden flex flex-col justify-between hover:shadow-lg hover:border-slate-300 transition-all duration-200 group"
              >
                {/* Top Health Color Accent */}
                <div className={`h-1 absolute top-0 inset-x-0 bg-gradient-to-r ${borderAccent}`} />

                {/* Header */}
                <div>
                  <div className="flex items-start justify-between pb-3.5 border-b border-slate-100">
                    <div>
                      <div className="font-mono text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                        <span>{machine.machine_id}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono font-semibold">
                          Chamber
                        </span>
                      </div>
                      <div className="text-xs font-medium text-slate-500 mt-0.5">
                        {machine.stage}
                      </div>
                    </div>
                    <StatusBadge status={machine.health} />
                  </div>

                  {/* Radial Gauge & Details */}
                  <div className="flex items-center gap-5 my-5">
                    <RadialGauge
                      value={machine.drift_severity || 0}
                      size={90}
                      strokeWidth={7}
                      color={gaugeColor}
                    />
                    <div className="flex-1 space-y-1.5 text-xs text-slate-600">
                      <div className="font-bold text-slate-900 text-xs tracking-wide uppercase font-mono">
                        Telemetry State
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-mono">Pattern:</span>
                        <span className={`font-semibold capitalize px-2 py-0.5 rounded text-[11px] ${machine.drift_pattern && machine.drift_pattern !== 'None'
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-slate-100 text-slate-600"
                          }`}>
                          {machine.drift_pattern || "None"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-mono">Severity:</span>
                        <span className="font-mono font-bold" style={{ color: gaugeColor }}>
                          {((machine.drift_severity || 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-mono">Processed:</span>
                        <strong className="text-slate-900 font-mono font-bold">
                          <AnimatedNumber value={Math.round(machine.records_processed || 0)} />
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Parameters Grid */}
                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                      Physical Sensor Feeds
                    </span>
                    <span className="text-[10px] font-mono text-emerald-600 font-semibold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Live
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(machine.parameters || {}).slice(0, 4).map(([key, value]) => {
                      const formattedName = key
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, l => l.toUpperCase());

                      return (
                        <div
                          key={key}
                          className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/70 hover:bg-slate-100/80 transition-colors"
                        >
                          <div className="text-[10px] font-mono text-slate-500 truncate font-medium" title={formattedName}>
                            {formattedName}
                          </div>
                          <div className="font-mono text-xs font-bold text-slate-900 mt-1 flex items-baseline justify-between">
                            <AnimatedNumber
                              value={value as number}
                              formatFn={(v) => v.toFixed(3)}
                            />
                            <span className="text-[9px] text-slate-400 font-normal">val</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
