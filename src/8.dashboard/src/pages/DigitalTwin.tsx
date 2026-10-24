import { useEffect, useState } from "react";
import { api } from "../services/api";
import { RadialGauge } from "../components/RadialGauge";
import { StatusBadge } from "../components/StatusBadge";
import { AnimatedNumber } from "../components/AnimatedNumber";

export function DigitalTwin() {
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
      } catch (e) {}
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="py-24 text-center text-on-surface-variant">
        <div className="w-8 h-8 rounded-full border-2 border-secondary border-t-transparent animate-spin mx-auto mb-3" />
        <span className="font-mono text-sm">Connecting to cleanroom telemetry twin...</span>
      </div>
    );
  }

  const healthyCount = machines.filter(m => m.health === 'healthy').length;
  const warningCount = machines.filter(m => m.health === 'warning').length;
  const criticalCount = machines.filter(m => m.health === 'critical').length;
  const totalRows = machines.reduce((acc, m) => acc + (m.records_processed || 0), 0);

  return (
    <div className="space-y-8 text-left">
      {/* ================= 4 KPI METRIC CARDS (REAL DATA) ================= */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1: Active Tools */}
        <div className="bg-surface-white rounded-3xl p-6 border border-outline-variant/30 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <span className="font-label-caps text-label-caps text-on-surface-variant font-bold">ACTIVE FAB TOOLS</span>
            <span className="material-symbols-outlined text-secondary text-[20px]">precision_manufacturing</span>
          </div>
          <div className="mt-4 flex items-baseline gap-1 text-primary font-headline-xl text-headline-xl font-bold">
            <AnimatedNumber value={machines.length} />
            <span className="text-xs text-on-surface-variant font-normal">Chambers</span>
          </div>
          <div className="mt-3 flex items-center justify-between font-body-sm text-body-sm text-on-surface-variant">
            <span>Processed: <strong className="text-primary font-mono">{totalRows}</strong></span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">100% Online</span>
          </div>
          <div className="absolute bottom-2 right-2 flex gap-1 opacity-20">
            <div className="w-1.5 h-1.5 bg-secondary"></div>
            <div className="w-1.5 h-1.5 bg-secondary"></div>
          </div>
        </div>

        {/* Metric 2: Healthy Tools */}
        <div className="bg-surface-white rounded-3xl p-6 border border-outline-variant/30 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <span className="font-label-caps text-label-caps text-on-surface-variant font-bold">HEALTHY STATUS</span>
            <span className="material-symbols-outlined text-emerald-600 text-[20px]">check_circle</span>
          </div>
          <div className="mt-4 flex items-baseline gap-1 text-emerald-700 font-headline-xl text-headline-xl font-bold">
            <AnimatedNumber value={healthyCount} />
            <span className="text-xs text-on-surface-variant font-normal">/ {machines.length} Tools</span>
          </div>
          <div className="mt-3 flex items-center justify-between font-body-sm text-body-sm text-on-surface-variant">
            <span>Nominal Operations</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">In-Spec</span>
          </div>
          <div className="absolute bottom-2 right-2 flex gap-1 opacity-20">
            <div className="w-1.5 h-1.5 bg-secondary"></div>
            <div className="w-1.5 h-1.5 bg-secondary"></div>
          </div>
        </div>

        {/* Metric 3: Warning / Drift Stage */}
        <div className="bg-surface-white rounded-3xl p-6 border border-outline-variant/30 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <span className="font-label-caps text-label-caps text-on-surface-variant font-bold">WARNING DRIFT</span>
            <span className="material-symbols-outlined text-amber-500 text-[20px]">warning</span>
          </div>
          <div className="mt-4 flex items-baseline gap-1 text-amber-600 font-headline-xl text-headline-xl font-bold">
            <AnimatedNumber value={warningCount} />
            <span className="text-xs text-on-surface-variant font-normal">Chambers</span>
          </div>
          <div className="mt-3 flex items-center justify-between font-body-sm text-body-sm text-on-surface-variant">
            <span>CUSUM Slack exceeded</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold">Watch</span>
          </div>
          <div className="absolute bottom-2 right-2 flex gap-1 opacity-20">
            <div className="w-1.5 h-1.5 bg-secondary"></div>
            <div className="w-1.5 h-1.5 bg-secondary"></div>
          </div>
        </div>

        {/* Metric 4: Critical Anomaly */}
        <div className="bg-surface-white rounded-3xl p-6 border border-outline-variant/30 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <span className="font-label-caps text-label-caps text-on-surface-variant font-bold">CRITICAL ANOMALIES</span>
            <span className="material-symbols-outlined text-secondary text-[20px]">error</span>
          </div>
          <div className="mt-4 flex items-baseline gap-1 text-secondary font-headline-xl text-headline-xl font-bold">
            <AnimatedNumber value={criticalCount} />
            <span className="text-xs text-on-surface-variant font-normal">Chambers</span>
          </div>
          <div className="mt-3 flex items-center justify-between font-body-sm text-body-sm text-on-surface-variant">
            <span>Interlock Ready</span>
            <span className="px-2 py-0.5 rounded-full bg-coral-subtle text-secondary text-[11px] font-bold">
              {criticalCount > 0 ? "Action Required" : "Zero Critical"}
            </span>
          </div>
          <div className="absolute bottom-2 right-2 flex gap-1 opacity-20">
            <div className="w-1.5 h-1.5 bg-secondary"></div>
            <div className="w-1.5 h-1.5 bg-secondary"></div>
          </div>
        </div>
      </section>

      {/* ================= REAL MACHINE CARDS GRID ================= */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline-md text-headline-md font-bold text-primary">
              Cleanroom Machine State & Parameter Telemetry
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-0.5">
              Live physical sensor feeds, drift severity scores, and CUSUM threshold tracking.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-mono text-xs text-on-surface-variant">Polling interval: 1000ms</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {machines.map((machine) => {
            const gaugeColor = 
              machine.health === 'critical' ? '#9b4338' :
              machine.health === 'warning' ? '#F59E0B' : 
              '#10B981';

            return (
              <div 
                key={machine.machine_id}
                className="bg-surface-white rounded-3xl p-6 border border-outline-variant/30 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-all"
              >
                {/* Header */}
                <div>
                  <div className="flex items-start justify-between pb-4 border-b border-outline-variant/20">
                    <div>
                      <div className="font-headline-md text-lg font-bold text-primary tracking-tight">
                        {machine.machine_id}
                      </div>
                      <div className="text-xs font-semibold text-on-surface-variant">
                        {machine.stage}
                      </div>
                    </div>
                    <StatusBadge status={machine.health} />
                  </div>

                  {/* Radial Gauge & Details */}
                  <div className="flex items-center gap-5 my-5">
                    <RadialGauge 
                      value={machine.drift_severity || 0} 
                      label="Drift Severity" 
                      size={95} 
                      strokeWidth={8}
                      color={gaugeColor}
                    />
                    <div className="flex-1 space-y-1 text-xs text-on-surface-variant">
                      <div className="font-bold text-primary text-sm mb-1.5">Machine Telemetry</div>
                      <div>
                        Pattern: <strong className="text-primary capitalize">{machine.drift_pattern || "None"}</strong>
                      </div>
                      <div>
                        Severity Score: <strong className="text-secondary font-mono font-bold">{((machine.drift_severity || 0) * 100).toFixed(0)}%</strong>
                      </div>
                      <div>
                        Processed Rows: <strong className="text-primary font-mono"><AnimatedNumber value={machine.records_processed || 0} /></strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Parameters Grid */}
                <div className="pt-4 border-t border-outline-variant/20">
                  <div className="text-[10px] font-label-caps font-bold text-on-surface-variant uppercase mb-2">
                    Active Sensor Measurements
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(machine.parameters || {}).slice(0, 4).map(([key, value]) => (
                      <div key={key} className="p-2.5 rounded-2xl bg-surface-container-low border border-outline-variant/20">
                        <div className="text-[10px] font-mono text-on-surface-variant truncate capitalize" title={key}>
                          {key.replace(/_/g, ' ')}
                        </div>
                        <div className="font-mono text-xs font-bold text-primary mt-0.5">
                          <AnimatedNumber value={value as number} formatFn={(v) => v.toFixed(4)} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom decorative pixel accent */}
                <div className="absolute bottom-2 right-2 flex gap-1 opacity-20 pointer-events-none">
                  <div className="w-1.5 h-1.5 bg-secondary"></div>
                  <div className="w-1.5 h-1.5 bg-secondary"></div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
