import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { calculateImpact, listDriftEvents, listImpacts } from "../services/api";
import type { DriftEventItem, ImpactListItem, ImpactResult } from "../types/api";

/** Module 3 — operational impact: run a calculation and inspect yield/scrap/rework/throughput. */
export default function OperationalImpactPage() {
  const [events, setEvents] = useState<DriftEventItem[]>([]);
  const [impacts, setImpacts] = useState<ImpactListItem[]>([]);
  const [eventId, setEventId] = useState<string>("");
  const [periodHours, setPeriodHours] = useState<string>("");
  const [downtimeHours, setDowntimeHours] = useState<string>("0");
  const [result, setResult] = useState<ImpactResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    listDriftEvents().then((r) => setEvents(r.data)).catch(() => undefined);
    listImpacts().then((r) => setImpacts(r.data)).catch(() => undefined);
  };

  useEffect(refresh, []);

  const onCalculate = () => {
    if (!eventId) return;
    setBusy(true);
    setError(null);
    calculateImpact({
      drift_event_id: Number(eventId),
      analysis_period_hours: periodHours ? Number(periodHours) : null,
      downtime_hours: downtimeHours ? Number(downtimeHours) : 0,
      persist_result: true,
    })
      .then((r) => {
        setResult(r.data);
        refresh();
      })
      .catch((e) => setError(e.response?.data?.detail ?? "Impact calculation failed"))
      .finally(() => setBusy(false));
  };

  const op = result?.operational;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Operational Impact</h1>
        <p className="text-sm text-slate-400">
          Module 3 — converts a confirmed drift event into yield, scrap, rework and throughput impact.
        </p>
      </div>

      <div className="rounded-lg border border-amber-700 bg-amber-950/40 px-4 py-2 text-xs text-amber-300">
        All impact coefficients and cost values are demonstration assumptions (is_demo=true) — not
        calibrated fab or accounting data.
      </div>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Calculate impact for a drift event
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-400">
            Drift event
            <select
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              className="mt-1 block rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
            >
              <option value="">Select…</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  #{ev.id} {ev.machine_id} · {ev.stage_name} · {ev.primary_parameter ?? "—"} (
                  {ev.severity_level ?? "—"})
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Analysis period (h, empty = drift duration)
            <input
              type="number"
              min="0"
              step="0.5"
              value={periodHours}
              onChange={(e) => setPeriodHours(e.target.value)}
              className="mt-1 block w-40 rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
            />
          </label>
          <label className="text-xs text-slate-400">
            Downtime (h, optional)
            <input
              type="number"
              min="0"
              step="0.5"
              value={downtimeHours}
              onChange={(e) => setDowntimeHours(e.target.value)}
              className="mt-1 block w-32 rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
            />
          </label>
          <button
            onClick={onCalculate}
            disabled={!eventId || busy}
            className="rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
          >
            {busy ? "Calculating…" : "Calculate"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </section>

      {result && op && (
        <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Result — drift event #{result.drift_event_id}{" "}
            <span className="normal-case text-slate-500">
              ({result.machine_id} · {result.stage_name} · {result.primary_parameter})
            </span>
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            Analysis period: {result.analysis_period_hours} h ({result.analysis_period_source}) · model:{" "}
            {result.impact_model} · rules: {result.impact_rule_version} · defect probability (confidence-adjusted):{" "}
            {result.defect_probability?.confidence_adjusted}
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Baseline yield", `${op.baseline_yield_percent}%`],
              ["Predicted yield", `${op.predicted_yield_percent}%`],
              ["Yield loss", `${op.yield_loss_percentage_points} pp`],
              ["Relative degradation", `${op.relative_yield_degradation_percent}%`],
              ["Total units", op.total_units],
              ["Additional defective", op.additional_defective_units],
              ["Scrap units", op.scrap_units],
              ["Rework units", op.rework_units],
              ["Throughput loss", `${op.throughput_loss_units} u (${op.throughput_loss_percent}%)`],
              ["Lost good units/h", op.lost_good_units_per_hour],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-sm font-semibold text-sky-300">{value as string}</p>
              </div>
            ))}
          </div>
          {result.impact_id != null && (
            <p className="mt-3 text-sm">
              <Link to={`/impact/${result.impact_id}`} className="text-sky-400 hover:underline">
                View financial impact & calculation breakdown →
              </Link>
            </p>
          )}
        </section>
      )}

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Persisted impact assessments
        </h2>
        {impacts.length === 0 ? (
          <p className="text-sm text-slate-500">No impact assessments yet.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1">ID</th>
                <th className="py-1">Event</th>
                <th className="py-1">Machine · Stage</th>
                <th className="py-1">Period (h)</th>
                <th className="py-1">Yield loss (pp)</th>
                <th className="py-1">Scrap</th>
                <th className="py-1">Rework</th>
                <th className="py-1">Total impact</th>
                <th className="py-1"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {impacts.map((i) => (
                <tr key={i.id}>
                  <td className="py-1">{i.id}</td>
                  <td className="py-1">#{i.drift_event_id}</td>
                  <td className="py-1">
                    {i.machine_id} · {i.stage_name}
                  </td>
                  <td className="py-1">{i.analysis_period_hours}</td>
                  <td className="py-1">{i.yield_loss_percentage_points ?? "—"}</td>
                  <td className="py-1">{i.scrap_units ?? "—"}</td>
                  <td className="py-1">{i.rework_units ?? "—"}</td>
                  <td className="py-1 font-semibold text-amber-300">
                    {i.total_financial_impact != null
                      ? `${i.total_financial_impact.toLocaleString()} ${i.currency ?? ""}`
                      : "—"}
                  </td>
                  <td className="py-1">
                    <Link to={`/impact/${i.id}`} className="text-sky-400 hover:underline">
                      financial →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
