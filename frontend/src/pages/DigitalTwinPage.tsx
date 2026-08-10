import { useEffect, useState } from "react";
import { getTwinStates } from "../services/api";
import type { TwinState } from "../types/api";

const bandColor = (score: number | null) => {
  if (score == null) return "text-slate-400";
  if (score >= 90) return "text-emerald-400";
  if (score >= 70) return "text-amber-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-500";
};

const bandLabel = (score: number | null) => {
  if (score == null) return "unknown";
  if (score >= 90) return "Healthy";
  if (score >= 70) return "Warning";
  if (score >= 40) return "Degraded";
  return "Critical";
};

export default function DigitalTwinPage() {
  const [states, setStates] = useState<TwinState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTwinStates()
      .then((r) => setStates(r.data))
      .catch(() => setError("Failed to load digital twin states"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-400">Loading digital twin…</p>;
  if (error) return <p className="text-red-400">{error}</p>;
  if (states.length === 0)
    return (
      <p className="text-slate-500">
        No twin states yet. Train a model and run detection on a dataset first.
      </p>
    );

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Digital Twin</h1>
      <p className="text-xs text-slate-500">
        Health is the ARGUS composite health score (0–100), not an industry-standard metric.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {states.map((s) => (
          <div key={s.id} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-semibold">
                {s.machine_id} <span className="text-sm font-normal text-slate-400">· {s.stage_name}</span>
              </h2>
              <div className="text-right">
                <span className={`text-2xl font-bold ${bandColor(s.health_score)}`}>
                  {s.health_score?.toFixed(0) ?? "—"}
                </span>
                <span className="ml-1 text-xs text-slate-500">/100 · {bandLabel(s.health_score)}</span>
              </div>
            </div>
            <p className="mb-2 text-xs text-slate-500">
              Last update: {s.state_timestamp ? new Date(s.state_timestamp).toLocaleString() : "—"} ·
              dataset #{s.dataset_id ?? "—"}
            </p>
            <div className="mb-3 flex flex-wrap gap-2 text-xs">
              <span
                className={`rounded-full px-2 py-0.5 ${
                  s.status === "healthy"
                    ? "bg-emerald-900 text-emerald-300"
                    : s.status === "warning"
                      ? "bg-amber-900 text-amber-300"
                      : "bg-red-900 text-red-300"
                }`}
              >
                {s.status ?? "unknown"}
              </span>
              {s.drift_type && (
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-300">
                  {s.drift_type}
                </span>
              )}
              {s.root_cause_parameter && (
                <span className="rounded-full bg-purple-900 px-2 py-0.5 text-purple-300">
                  root cause: {s.root_cause_parameter}
                </span>
              )}
            </div>
            <table className="w-full text-left text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1">Parameter</th>
                  <th className="py-1">Current</th>
                  <th className="py-1">Target</th>
                  <th className="py-1">Limits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {Object.entries(s.parameter_values ?? {}).map(([name, value]) => {
                  const lim = s.operating_limits?.[name];
                  const target = s.target_values?.[name];
                  const out =
                    lim && lim.lower != null && lim.upper != null && (value < lim.lower || value > lim.upper);
                  return (
                    <tr key={name}>
                      <td className="py-1">{name}</td>
                      <td className={`py-1 ${out ? "font-semibold text-red-400" : ""}`}>
                        {value.toFixed(2)}
                      </td>
                      <td className="py-1">{target != null ? target.toFixed(2) : "—"}</td>
                      <td className="py-1 text-slate-500">
                        {lim && lim.lower != null ? `${lim.lower} – ${lim.upper}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded bg-slate-950 p-2">
                <p className="text-slate-500">CUSUM</p>
                <p className="text-slate-200">{s.cusum_score?.toFixed(3) ?? "—"}</p>
              </div>
              <div className="rounded bg-slate-950 p-2">
                <p className="text-slate-500">LSTM</p>
                <p className="text-slate-200">{s.lstm_score?.toFixed(3) ?? "—"}</p>
              </div>
              <div className="rounded bg-slate-950 p-2">
                <p className="text-slate-500">Hybrid</p>
                <p className="text-slate-200">{s.hybrid_score?.toFixed(3) ?? "—"}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
