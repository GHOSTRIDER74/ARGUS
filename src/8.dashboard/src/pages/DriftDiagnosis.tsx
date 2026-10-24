import { useEffect, useState } from "react";
import { api } from "../services/api";
import { StatusBadge } from "../components/StatusBadge";
import { TrendChart } from "../components/TrendChart";

export function DriftDiagnosis() {
  const [data, setData] = useState<any>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [chartData, setChartData] = useState<any>(null);

  useEffect(() => {
    api.getDriftEvents().then(res => {
      setData(res);
      if (res.events?.length > 0) {
        handleSelect(res.events[0]);
      }
    });
  }, []);

  const handleSelect = async (event: any) => {
    setSelectedEvent(event);
    try {
      const chartRes = await api.getDriftTimeseries(event.parameter);
      setChartData(chartRes);
    } catch (e) {
      console.error(e);
    }
  };

  if (!data) return <div className="loading-state"><div className="loading-spinner" /> Loading drift telemetry...</div>;

  return (
    <div className="space-y-8 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-xl text-headline-xl font-bold text-primary tracking-tight">
            Drift & CUSUM Diagnosis
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Statistical change-point detection & SHAP root-cause feature attribution.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-coral-subtle text-secondary font-label-caps text-label-caps font-bold">
            {data.total_events || 0} Drift Events Captured
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Drift Events Triage Table */}
        <div className="lg:col-span-5 bg-surface-white rounded-3xl p-6 md:p-7 border border-outline-variant/30 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
            <h2 className="font-headline-md text-headline-md font-bold text-primary">Drift Events Triage</h2>
            <span className="material-symbols-outlined text-secondary text-[20px]">radar</span>
          </div>

          <div className="overflow-y-auto max-h-[560px] pr-1">
            <table className="w-full text-left font-body-sm text-body-sm">
              <thead>
                <tr className="border-b border-outline-variant/30 font-label-caps text-label-caps text-on-surface-variant">
                  <th className="py-2 px-2">TIME</th>
                  <th className="py-2 px-2">CHAMBER</th>
                  <th className="py-2 px-2">PARAMETER</th>
                  <th className="py-2 px-2 text-right">SEVERITY</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20 font-mono text-[12px]">
                {data.events.map((evt: any) => {
                  const isSelected = selectedEvent?.id === evt.id;
                  return (
                    <tr 
                      key={evt.id} 
                      onClick={() => handleSelect(evt)}
                      className={`cursor-pointer transition-colors ${
                        isSelected 
                          ? "bg-secondary-fixed/50 font-bold border-l-4 border-secondary" 
                          : "hover:bg-surface-container-low"
                      }`}
                    >
                      <td className="py-2.5 px-2 text-on-surface-variant">{evt.time}</td>
                      <td className="py-2.5 px-2 font-semibold text-primary">{evt.machine_id}</td>
                      <td className="py-2.5 px-2 text-on-surface">{evt.parameter.replace(/_/g, ' ')}</td>
                      <td className="py-2.5 px-2 text-right">
                        <StatusBadge status={evt.severity} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Diagnosis & Time Series Waveform */}
        <div className="lg:col-span-7 bg-surface-white rounded-3xl p-6 md:p-8 border border-outline-variant/30 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
            <div>
              <h2 className="font-headline-md text-headline-md font-bold text-primary">Diagnosis & Root Cause</h2>
              {selectedEvent && (
                <span className="font-mono text-xs text-on-surface-variant">Event ID: {selectedEvent.id}</span>
              )}
            </div>
            <span className="material-symbols-outlined text-secondary text-[22px]">troubleshoot</span>
          </div>

          {selectedEvent ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/30">
                  <div className="text-[10px] font-label-caps text-on-surface-variant uppercase font-bold">Root Cause</div>
                  <div className="font-semibold text-primary mt-1 text-sm">{selectedEvent.root_cause}</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/30">
                  <div className="text-[10px] font-label-caps text-on-surface-variant uppercase font-bold">Drift Pattern</div>
                  <div className="font-semibold text-primary mt-1 text-sm capitalize">{selectedEvent.drift_pattern}</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/30">
                  <div className="text-[10px] font-label-caps text-on-surface-variant uppercase font-bold">Mean Shift (μ)</div>
                  <div className="font-mono text-secondary mt-1 font-bold text-sm">+{selectedEvent.mean_shift.toFixed(4)}σ</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/30">
                  <div className="text-[10px] font-label-caps text-on-surface-variant uppercase font-bold">Confidence</div>
                  <div className="font-mono text-emerald-700 mt-1 font-bold text-sm">{(selectedEvent.confidence * 100).toFixed(1)}%</div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-primary">
                    Sensor Telemetry Waveform: <code className="text-secondary">{chartData?.parameter}</code>
                  </span>
                  <span className="font-mono text-xs text-on-surface-variant">CUSUM Decision Bounds: [-2.0, +2.0]</span>
                </div>

                {chartData ? (
                  <div className="bg-surface-container-lowest p-2 rounded-2xl border border-outline-variant/20">
                    <TrendChart 
                      data={chartData.data} 
                      xKey="index" 
                      yKey="value" 
                      target={chartData.target}
                      upperLimit={chartData.upper_limit}
                      lowerLimit={chartData.lower_limit}
                      height={280}
                    />
                  </div>
                ) : (
                  <div className="loading-state"><div className="loading-spinner"/> Loading chart...</div>
                )}
              </div>
            </div>
          ) : (
            <div className="empty-state text-on-surface-variant py-12 text-center">
              Select an event from the triage list to inspect CUSUM drift and SHAP attribution.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
