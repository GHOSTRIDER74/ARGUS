import { useEffect, useState } from "react";
import { api } from "../services/api";
import { StatusBadge } from "../components/StatusBadge";
import { TrendChart } from "../components/TrendChart";

export function DriftDiagnosis() {
  const [data, setData] = useState<any>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [chartData, setChartData] = useState<any>(null);
  const [benchmark, setBenchmark] = useState<any>(null);

  useEffect(() => {
    api.getDriftBenchmark().then(res => setBenchmark(res));
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
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/30">
                  <div className="text-[10px] font-label-caps text-on-surface-variant uppercase font-bold">Root Cause</div>
                  <div className="font-semibold text-primary mt-1 text-sm">{selectedEvent.root_cause}</div>
                </div>

                <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/30">
                  <div className="text-[10px] font-label-caps text-on-surface-variant uppercase font-bold">Detected By</div>
                  <div className="font-semibold text-primary mt-1 text-sm">{selectedEvent.detected_by || "CUSUM"}</div>
                  {selectedEvent.lstm_error != null && (
                    <div className="text-[10px] text-on-surface-variant mt-0.5 font-mono">LSTM error {selectedEvent.lstm_error} / τ₉₉ {selectedEvent.lstm_threshold}</div>
                  )}
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

      {/* Benchmark Evaluation Table */}
      {benchmark && (
        <div className="bg-surface-white rounded-3xl p-6 md:p-7 border border-outline-variant/30 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)]">
          <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20 mb-5">
            <div>
              <h2 className="font-headline-md text-headline-md font-bold text-primary">
                Detection Performance Benchmark
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                Measured on SECOM · {(benchmark.config?.scenarios_per_seed ?? 0) * (benchmark.config?.seeds ?? 0)} drift-injection runs · W={benchmark.config?.window} · k={benchmark.config?.cusum?.k} / h={benchmark.config?.cusum?.h}
              </p>
            </div>
            <span className="material-symbols-outlined text-secondary text-[22px]">analytics</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-body-sm text-body-sm">
              <thead>
                <tr className="border-b border-outline-variant/30 font-label-caps text-label-caps text-on-surface-variant">
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3 text-center">Latency (win.)</th>
                  <th className="py-2.5 px-3 text-center">FAR (%)</th>
                  <th className="py-2.5 px-3 text-center">F1 Score</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {Object.entries(benchmark.overall || {}).map(([method, ref]: [string, any]) => {
                  const isArgus = method === "ARGUS";
                  return (
                    <tr key={method} className={isArgus ? "bg-secondary-fixed/30 font-semibold" : "hover:bg-surface-container-low"}>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          {isArgus && <span className="w-2 h-2 rounded-full bg-secondary inline-block" />}
                          <span className={isArgus ? "text-secondary font-bold" : "text-primary"}>
                            {method}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        <span className={isArgus ? "text-emerald-700 font-bold" : "text-on-surface"}>
                          {ref.latency_mean ?? "-"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        <span className={isArgus ? "text-on-surface" : "text-on-surface"}>
                          {ref.far_pct_mean}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        <span className={isArgus ? "text-emerald-700 font-bold" : "text-on-surface"}>
                          {ref.f1_mean?.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isArgus
                          ? <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/25 text-xs font-bold">Hybrid (CUSUM OR LSTM-AE)</span>
                          : <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-xs">Baseline</span>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "CUSUM k / h", value: `${benchmark.config?.cusum?.k} / ${benchmark.config?.cusum?.h}` },
              { label: "CUSUM decay λ", value: (benchmark.config?.cusum?.decay || []).join(" / ") },
              { label: "LSTM-AE window W", value: benchmark.config?.window },
              { label: "EWMA λ / L", value: `${benchmark.config?.ewma?.lambda} / ${benchmark.config?.ewma?.L}` },
            ].map(({ label, value }) => (
              <div key={label} className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/20">
                <div className="text-[10px] font-label-caps text-on-surface-variant uppercase font-bold">{label}</div>
                <div className="font-mono text-primary font-semibold mt-1 text-sm">{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
