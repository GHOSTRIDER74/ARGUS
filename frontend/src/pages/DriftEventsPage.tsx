import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";
import { acknowledgeEvent, listDriftEvents, resolveEvent } from "../services/api";
import type { DriftEventItem } from "../types/api";

function DriftEmptyIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12z" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

export default function DriftEventsPage() {
  const [events, setEvents] = useState<DriftEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    listDriftEvents()
      .then((r) => setEvents(r.data))
      .catch(() => setError("Failed to load drift events"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(refresh, [refresh]);

  const act = async (fn: () => Promise<unknown>) => {
    await fn();
    refresh();
  };

  if (loading)
    return (
      <div className="flex items-center gap-3 py-12 text-slate-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
        Loading drift events…
      </div>
    );

  if (error) return <p className="py-8 text-red-500 font-medium">{error}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Module 2 — Anomaly Feed</p>
          <h2 className="text-2xl font-bold text-slate-900 mt-0.5">Detected Process Drift Events</h2>
        </div>
        <Link to="/app/models" className="btn-secondary text-xs">
          Run Detection on Models →
        </Link>
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={<DriftEmptyIcon />}
          title="No drift events detected"
          body="Run model inference from the Models page to analyze datasets for process drift."
          ctaLabel="Go to Models"
          ctaTo="/app/models"
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="tbl">
            <thead>
              <tr>
                <th className="col-num w-12">ID</th>
                <th className="col-txt">Detected At</th>
                <th className="col-txt">Machine</th>
                <th className="col-txt">Stage</th>
                <th className="col-txt">Pattern</th>
                <th className="col-txt">Root Cause</th>
                <th className="col-txt">Severity</th>
                <th className="col-num">Confidence</th>
                <th className="col-txt">Status</th>
                <th className="text-right pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                  {/* ID */}
                  <td className="col-num">
                    <Link
                      to={`/app/drift-events/${e.id}`}
                      className="font-mono text-sky-600 font-bold hover:underline"
                    >
                      #{e.id}
                    </Link>
                  </td>

                  {/* Timestamp */}
                  <td className="col-txt text-slate-500 text-xs font-mono whitespace-nowrap">
                    {e.detected_at ? new Date(e.detected_at).toLocaleString() : "—"}
                  </td>

                  {/* Machine */}
                  <td className="col-txt font-bold text-slate-900">{e.machine_id}</td>

                  {/* Stage */}
                  <td className="col-txt text-slate-600 font-medium">{e.stage_name}</td>

                  {/* Type */}
                  <td className="col-txt text-slate-800 font-medium capitalize">
                    <span className="inline-flex items-center gap-1">
                      {e.drift_type?.replace("_", " ") ?? "—"}
                      {e.direction === "up" ? (
                        <span className="text-red-500 font-bold">↑</span>
                      ) : e.direction === "down" ? (
                        <span className="text-emerald-500 font-bold">↓</span>
                      ) : null}
                    </span>
                  </td>

                  {/* Root cause */}
                  <td className="col-txt font-mono text-xs text-slate-700">
                    {e.primary_parameter ?? "—"}
                  </td>

                  {/* Severity badge */}
                  <td className="col-txt">
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={e.severity_level ?? "unknown"} />
                      {e.severity_score != null && (
                        <span className="font-mono text-xs font-bold text-slate-600">
                          ({e.severity_score.toFixed(0)})
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Confidence */}
                  <td className="col-num font-mono text-xs font-semibold text-slate-700">
                    {e.confidence != null
                      ? `${(e.confidence * 100).toFixed(0)}%`
                      : "—"}
                  </td>

                  {/* Status */}
                  <td className="col-txt">
                    <StatusBadge status={e.status ?? "unknown"} />
                  </td>

                  {/* Actions */}
                  <td className="col-txt text-right text-xs whitespace-nowrap pr-4">
                    {e.status === "open" && (
                      <button
                        onClick={() => act(() => acknowledgeEvent(e.id))}
                        className="btn-secondary !py-1 !px-2.5 text-xs text-amber-700 border-amber-200 bg-amber-50 hover:bg-amber-100 mr-2"
                      >
                        Acknowledge
                      </button>
                    )}
                    {(e.status === "open" || e.status === "acknowledged") && (
                      <button
                        onClick={() => act(() => resolveEvent(e.id))}
                        className="btn-secondary !py-1 !px-2.5 text-xs text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                      >
                        Resolve
                      </button>
                    )}
                    {e.status === "resolved" && (
                      <Link
                        to={`/app/drift-events/${e.id}`}
                        className="text-sky-600 hover:underline font-semibold text-xs"
                      >
                        View Report →
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
