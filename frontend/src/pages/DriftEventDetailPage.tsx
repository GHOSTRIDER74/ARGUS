import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import TrendChart from "../components/TrendChart";
import {
  getDriftEvent,
  getEventExplanation,
  getEventForecast,
  getSeries,
} from "../services/api";
import type {
  DriftEventItem,
  EventExplanation,
  EventForecast,
  SeriesResponse,
} from "../types/api";

export default function DriftEventDetailPage() {
  const { id } = useParams();
  const eventId = Number(id);
  const [event, setEvent] = useState<DriftEventItem | null>(null);
  const [explanation, setExplanation] = useState<EventExplanation | null>(null);
  const [forecast, setForecast] = useState<EventForecast | null>(null);
  const [series, setSeries] = useState<SeriesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDriftEvent(eventId)
      .then(async (r) => {
        const ev = r.data;
        setEvent(ev);
        getEventExplanation(eventId).then((x) => setExplanation(x.data)).catch(() => undefined);
        getEventForecast(eventId).then((x) => setForecast(x.data)).catch(() => undefined);
        if (ev.dataset_id && ev.primary_parameter) {
          getSeries(ev.dataset_id, ev.machine_id, ev.stage_name, ev.primary_parameter)
            .then((x) => setSeries(x.data))
            .catch(() => undefined);
        }
      })
      .catch(() => setError("Event not found"));
  }, [eventId]);

  if (error) return <p className="text-red-400">{error}</p>;
  if (!event) return <p className="text-slate-400">Loading…</p>;

  const driftStartIndex =
    series && event.estimated_start_time
      ? series.timestamps.findIndex((t) => new Date(t) >= new Date(event.estimated_start_time!))
      : -1;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/drift-events" className="text-xs text-slate-400 hover:underline">
          ← Back to events
        </Link>
        <h1 className="mt-1 text-xl font-semibold">
          Drift event #{event.id}{" "}
          <span className="text-sm font-normal text-slate-400">
            {event.machine_id} · {event.stage_name}
          </span>
        </h1>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {[
          ["Type", `${event.drift_type ?? "—"} ${event.direction === "up" ? "↑" : event.direction === "down" ? "↓" : ""}`],
          ["Severity", `${event.severity_level ?? "—"} (${event.severity_score?.toFixed(0) ?? "—"})`],
          ["Hybrid score", event.hybrid_score?.toFixed(3) ?? "—"],
          ["Health", `${event.health_score?.toFixed(0) ?? "—"}/100`],
          ["Confidence", event.confidence != null ? `${(event.confidence * 100).toFixed(0)}%` : "—"],
          ["Status", event.status],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
            <p className="text-xs text-slate-500">{label}</p>
            <p className="text-sm font-semibold text-sky-300">{value}</p>
          </div>
        ))}
      </section>

      {series && (
        <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            {event.primary_parameter} — observed values
          </h2>
          <TrendChart
            values={series.values}
            refLines={
              series.target_value != null
                ? [{ value: series.target_value, color: "#10b981", label: "target", dashed: true }]
                : []
            }
            vertMarkers={
              driftStartIndex >= 0
                ? [{ index: driftStartIndex, color: "#f59e0b", label: "est. drift start" }]
                : []
            }
          />
          <p className="mt-1 text-xs text-slate-500">
            Estimated drift start:{" "}
            {event.estimated_start_time ? new Date(event.estimated_start_time).toLocaleString() : "—"}
          </p>
        </section>
      )}

      {explanation && (
        <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Root-cause ranking <span className="normal-case text-slate-500">({explanation.explanation_method})</span>
          </h2>
          <p className="mb-3 text-sm text-slate-300">{explanation.explanation_text}</p>
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1">Parameter</th>
                <th className="py-1">Contribution</th>
                <th className="py-1">Current</th>
                <th className="py-1">Baseline</th>
                <th className="py-1">Deviation</th>
                <th className="py-1">CUSUM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {explanation.feature_contributions.map((c) => (
                <tr key={c.parameter_name}>
                  <td className="py-1">{c.parameter_name}</td>
                  <td className="py-1">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 rounded bg-slate-800">
                        <div
                          className="h-2 rounded bg-sky-500"
                          style={{ width: `${Math.min(c.contribution * 100, 100)}%` }}
                        />
                      </div>
                      {(c.contribution * 100).toFixed(1)}%
                    </div>
                  </td>
                  <td className="py-1">{c.current_value?.toFixed(2) ?? "—"} {c.unit ?? ""}</td>
                  <td className="py-1">{c.baseline_value?.toFixed(2) ?? "—"}</td>
                  <td className="py-1">
                    {c.deviation_percent != null ? `${c.deviation_percent > 0 ? "+" : ""}${c.deviation_percent.toFixed(1)}%` : "—"}
                  </td>
                  <td className="py-1">{c.cusum_triggered ? "triggered" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {forecast && (
        <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Forecast <span className="normal-case text-slate-500">({forecast.forecast_method}, projected — not observed)</span>
          </h2>
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1">Horizon</th>
                <th className="py-1">Predicted</th>
                <th className="py-1">95% bounds</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {forecast.forecast_values.map((p) => (
                <tr key={p.horizon_hours}>
                  <td className="py-1">+{p.horizon_hours} h</td>
                  <td className="py-1">{p.predicted_value.toFixed(2)}</td>
                  <td className="py-1 text-slate-500">
                    {p.lower_bound.toFixed(2)} – {p.upper_bound.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-sm">
            Estimated operating-limit crossing:{" "}
            <span className="font-semibold text-amber-400">
              {forecast.threshold_crossing_time
                ? new Date(forecast.threshold_crossing_time).toLocaleString()
                : "not predicted within the trend"}
            </span>
          </p>
        </section>
      )}
    </div>
  );
}
