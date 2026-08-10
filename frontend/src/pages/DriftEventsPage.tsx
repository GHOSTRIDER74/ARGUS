import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { acknowledgeEvent, listDriftEvents, resolveEvent } from "../services/api";
import type { DriftEventItem } from "../types/api";

const sevColor: Record<string, string> = {
  minor: "bg-slate-800 text-slate-300",
  low: "bg-sky-900 text-sky-300",
  moderate: "bg-amber-900 text-amber-300",
  high: "bg-orange-900 text-orange-300",
  critical: "bg-red-900 text-red-300",
};

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

  if (loading) return <p className="text-slate-400">Loading events…</p>;
  if (error) return <p className="text-red-400">{error}</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Drift Events</h1>
      {events.length === 0 ? (
        <p className="text-slate-500">No drift events. Run detection from the Models page.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Detected</th>
                <th className="px-3 py-2">Machine</th>
                <th className="px-3 py-2">Stage</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Severity</th>
                <th className="px-3 py-2">Root cause</th>
                <th className="px-3 py-2">Confidence</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-slate-900/60">
                  <td className="px-3 py-2">
                    <Link to={`/drift-events/${e.id}`} className="text-sky-400 hover:underline">
                      #{e.id}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {e.detected_at ? new Date(e.detected_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2">{e.machine_id}</td>
                  <td className="px-3 py-2">{e.stage_name}</td>
                  <td className="px-3 py-2 text-slate-300">
                    {e.drift_type ?? "—"} {e.direction === "up" ? "↑" : e.direction === "down" ? "↓" : ""}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${sevColor[e.severity_level ?? ""] ?? "bg-slate-800"}`}>
                      {e.severity_level ?? "—"} {e.severity_score != null ? `(${e.severity_score.toFixed(0)})` : ""}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-300">{e.primary_parameter ?? "—"}</td>
                  <td className="px-3 py-2">{e.confidence != null ? `${(e.confidence * 100).toFixed(0)}%` : "—"}</td>
                  <td className="px-3 py-2 text-slate-300">{e.status}</td>
                  <td className="px-3 py-2 text-right text-xs">
                    {e.status === "open" && (
                      <button
                        onClick={() => act(() => acknowledgeEvent(e.id))}
                        className="mr-2 text-amber-400 hover:underline"
                      >
                        Acknowledge
                      </button>
                    )}
                    {(e.status === "open" || e.status === "acknowledged") && (
                      <button
                        onClick={() => act(() => resolveEvent(e.id))}
                        className="text-emerald-400 hover:underline"
                      >
                        Resolve
                      </button>
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
