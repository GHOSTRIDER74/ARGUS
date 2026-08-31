import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import StatusBadge from "../components/StatusBadge";
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

  if (error) return <p className="py-8 text-red-500 font-medium">{error}</p>;
  if (!event)
    return (
      <div className="flex items-center gap-3 py-12 text-slate-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
        Loading event details…
      </div>
    );

  const driftStartIndex =
    series && event.estimated_start_time
      ? series.timestamps.findIndex(
          (t) => new Date(t) >= new Date(event.estimated_start_time!)
        )
      : -1;

  const sevStatus = event.severity_level ?? "unknown";
  const sevGlow =
    sevStatus === "critical" || sevStatus === "high"
      ? "glow-red"
      : sevStatus === "moderate"
      ? "glow-amber"
      : "glow-green";

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div>
        <Link to="/app/drift-events" className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700 transition-colors">
          ← Back to Drift Events
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Drift Event #{event.id}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 font-medium">
              Machine <span className="font-mono text-slate-700 font-semibold">{event.machine_id}</span> · Stage <span className="text-slate-700 font-semibold">{event.stage_name}</span> · Detected: {event.detected_at ? new Date(event.detected_at).toLocaleString() : "—"}
            </p>
          </div>
          <Link
            to={`/app/impact`}
            className="btn-secondary text-xs"
          >
            Calculate Operational Impact →
          </Link>
        </div>
      </div>

      {/* Hero KPI Summary Card */}
      <section className={`card-glass ${sevGlow}`}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Event Diagnostic Overview</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
          {[
            [
              "Drift Pattern",
              <div key="type" className="font-mono text-sm font-bold text-slate-900 capitalize">
                {event.drift_type ?? "—"}{" "}
                {event.direction === "up" ? (
                  <span className="text-red-500">↑</span>
                ) : event.direction === "down" ? (
                  <span className="text-emerald-500">↓</span>
                ) : null}
              </div>,
            ],
            [
              "Severity Score",
              <div key="sev" className="flex items-center gap-2">
                <StatusBadge status={event.severity_level ?? "unknown"} />
                {event.severity_score != null && (
                  <span className="font-mono text-xl font-bold text-slate-900">
                    {event.severity_score.toFixed(0)}
                  </span>
                )}
              </div>,
            ],
            ["Hybrid Score", <span key="hyb" className="font-mono text-sm font-bold text-slate-900">{event.hybrid_score?.toFixed(3) ?? "—"}</span>],
            [
              "Health Score",
              <span key="health" className="font-mono text-xl font-bold text-slate-900">
                {event.health_score?.toFixed(0) ?? "—"}
                <span className="text-xs font-normal text-slate-400">/100</span>
              </span>,
            ],
            [
              "Confidence",
              <span key="conf" className="font-mono text-sm font-bold text-slate-900">
                {event.confidence != null ? `${(event.confidence * 100).toFixed(0)}%` : "—"}
              </span>,
            ],
            [
              "Event Status",
              <StatusBadge key="st" status={event.status ?? "unknown"} />,
            ],
          ].map(([label, value]) => (
            <div
              key={label as string}
              className="rounded-lg p-3 bg-white border border-slate-200/80 shadow-sm"
            >
              <p className="section-label mb-1.5">{label as string}</p>
              {value}
            </div>
          ))}
        </div>
      </section>

      {/* Time-Series Parameter Chart */}
      {series && (
        <section className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Telemetry Visualizer</p>
              <h3 className="text-base font-bold text-slate-900">
                Primary Parameter: <span className="font-mono text-sky-600">{event.primary_parameter}</span>
              </h3>
            </div>
            {event.estimated_start_time && (
              <span className="text-xs font-mono bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-md font-medium">
                Est. Drift Start: {new Date(event.estimated_start_time).toLocaleTimeString()}
              </span>
            )}
          </div>

          <TrendChart
            values={series.values}
            height={240}
            color="#0ea5e9"
            refLines={
              series.target_value != null
                ? [
                    {
                      value: series.target_value,
                      color: "#16a34a",
                      label: "Target",
                      dashed: true,
                    },
                  ]
                : []
            }
            vertMarkers={
              driftStartIndex >= 0
                ? [
                    {
                      index: driftStartIndex,
                      color: "#ea580c",
                      label: "Drift Onset",
                    },
                  ]
                : []
            }
          />
        </section>
      )}

      {/* Root-Cause Contribution Bar Ranking */}
      {explanation && (
        <section className="card">
          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Root-Cause Attribution</p>
            <h3 className="text-base font-bold text-slate-900">{explanation.explanation_method}</h3>
            <p className="mt-1 text-sm text-slate-600">{explanation.explanation_text}</p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="col-txt">Parameter</th>
                  <th className="col-num">Contribution</th>
                  <th className="col-num">Current Value</th>
                  <th className="col-num">Baseline</th>
                  <th className="col-num">Deviation</th>
                  <th className="col-txt">CUSUM Triggered</th>
                </tr>
              </thead>
              <tbody>
                {explanation.feature_contributions.map((c) => (
                  <tr key={c.parameter_name}>
                    <td className="col-txt font-semibold text-slate-900">{c.parameter_name}</td>
                    <td className="col-num">
                      <div className="flex items-center justify-end gap-2">
                        <div className="contrib-bar-track">
                          <div
                            className="contrib-bar-fill"
                            style={{ width: `${Math.min(c.contribution * 100, 100)}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs font-bold text-slate-700 w-12 text-right">
                          {(c.contribution * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="col-num font-mono text-xs font-semibold text-slate-900">
                      {c.current_value?.toFixed(2) ?? "—"}{" "}
                      <span className="text-slate-400 font-normal">{c.unit ?? ""}</span>
                    </td>
                    <td className="col-num font-mono text-xs text-slate-500">
                      {c.baseline_value?.toFixed(2) ?? "—"}
                    </td>
                    <td className="col-num font-mono text-xs">
                      <span
                        className={
                          c.deviation_percent != null && Math.abs(c.deviation_percent) > 5
                            ? "font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded"
                            : "text-slate-600"
                        }
                      >
                        {c.deviation_percent != null
                          ? `${c.deviation_percent > 0 ? "+" : ""}${c.deviation_percent.toFixed(1)}%`
                          : "—"}
                      </span>
                    </td>
                    <td className="col-txt">
                      {c.cusum_triggered ? (
                        <StatusBadge status="critical" label="Yes" />
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Forecast Trend & Threshold Crossing */}
      {forecast && (
        <section className="card">
          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Predictive Horizon</p>
            <h3 className="text-base font-bold text-slate-900">Forecast Model ({forecast.forecast_method})</h3>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 mb-4">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="col-txt">Horizon (Hours)</th>
                  <th className="col-num">Predicted Value</th>
                  <th className="col-num">95% Confidence Bounds</th>
                </tr>
              </thead>
              <tbody>
                {forecast.forecast_values.map((p) => (
                  <tr key={p.horizon_hours}>
                    <td className="col-txt font-mono font-semibold text-slate-700">+{p.horizon_hours} h</td>
                    <td className="col-num font-mono text-xs font-bold text-sky-600">
                      {p.predicted_value.toFixed(2)}
                    </td>
                    <td className="col-num font-mono text-xs text-slate-500">
                      [{p.lower_bound.toFixed(2)} – {p.upper_bound.toFixed(2)}]
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between">
            <span className="text-xs font-medium text-amber-800">Estimated Limit Threshold Crossing:</span>
            <span className="font-mono text-xs font-bold text-amber-900">
              {forecast.threshold_crossing_time
                ? new Date(forecast.threshold_crossing_time).toLocaleString()
                : "Not predicted within projection window"}
            </span>
          </div>
        </section>
      )}
    </div>
  );
}
