import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AnimatedNumber from "../components/AnimatedNumber";
import EmptyState from "../components/EmptyState";
import { calculateImpact, listDriftEvents, listImpacts } from "../services/api";
import type { DriftEventItem, ImpactListItem, ImpactResult } from "../types/api";

function ImpactEmptyIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  );
}

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
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Module 3 — Financial & Operational Modeling</p>
        <h2 className="text-2xl font-bold text-slate-900 mt-0.5">Operational Impact Assessment</h2>
        <p className="mt-1 text-sm text-slate-500">
          Quantify yield loss, scrap units, rework requirements, and throughput degradation caused by confirmed drift.
        </p>
      </div>

      {/* Demo disclaimer */}
      <div className="inline-warn flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span>Demonstration configuration active — coefficients represent calibrated fab assumptions.</span>
      </div>

      {/* Calculate Form */}
      <section className="card">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Run Impact Calculation</h3>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[240px]">
            <label className="field-label">Target Drift Event</label>
            <select
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              className="field"
              id="select-drift-event"
            >
              <option value="">Select event to quantify…</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  #{ev.id} — {ev.machine_id} · {ev.stage_name} ({ev.severity_level ?? "unknown severity"})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Analysis Period (Hours)</label>
            <input
              type="number"
              min="0"
              step="0.5"
              placeholder="Auto (drift duration)"
              value={periodHours}
              onChange={(e) => setPeriodHours(e.target.value)}
              className="field w-44"
            />
          </div>
          <div>
            <label className="field-label">Downtime (Hours)</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={downtimeHours}
              onChange={(e) => setDowntimeHours(e.target.value)}
              className="field w-32"
            />
          </div>
          <button
            onClick={onCalculate}
            disabled={!eventId || busy}
            className="btn-primary self-end"
            id="btn-calculate-impact"
          >
            {busy ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Calculating…
              </span>
            ) : (
              "Calculate Impact"
            )}
          </button>
        </div>
        {error && <p className="mt-4 inline-error">{error}</p>}
      </section>

      {/* Result Glass Hero Card */}
      {result && op && (
        <section className="card-glass glow-amber space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200/80 pb-4">
            <div>
              <span className="tag-pill-accent mb-1">Calculation Complete</span>
              <h3 className="text-xl font-bold text-slate-900">
                Drift Event #{result.drift_event_id} — {result.machine_id} ({result.stage_name})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Primary Parameter: <span className="font-mono font-semibold text-slate-700">{result.primary_parameter}</span> · Analysis Period: {result.analysis_period_hours}h
              </p>
            </div>
            {result.impact_id != null && (
              <Link to={`/app/impact/${result.impact_id}`} className="btn-primary text-xs" id="link-financial-breakdown">
                View Full Financial Breakdown →
              </Link>
            )}
          </div>

          {/* Lead with Big Number */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-1">Yield Loss Impact</p>
              <div className="font-mono text-4xl font-extrabold text-amber-900">
                <AnimatedNumber value={op.yield_loss_percentage_points} decimals={2} />
                <span className="text-base font-medium ml-1">pp</span>
              </div>
              <p className="text-[11px] text-amber-700 mt-1">
                Baseline {op.baseline_yield_percent}% → Predicted {op.predicted_yield_percent}%
              </p>
            </div>

            <div className="p-4 rounded-xl bg-red-50/80 border border-red-200 text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-red-700 mb-1">Additional Defective Units</p>
              <div className="font-mono text-4xl font-extrabold text-red-900">
                <AnimatedNumber value={op.additional_defective_units} decimals={0} />
                <span className="text-base font-medium ml-1">wafers</span>
              </div>
              <p className="text-[11px] text-red-700 mt-1">
                Out of {op.total_units} total processed units
              </p>
            </div>

            <div className="p-4 rounded-xl bg-sky-50/80 border border-sky-200 text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-sky-700 mb-1">Throughput Loss</p>
              <div className="font-mono text-4xl font-extrabold text-sky-900">
                <AnimatedNumber value={op.throughput_loss_percent} decimals={1} />
                <span className="text-base font-medium ml-1">%</span>
              </div>
              <p className="text-[11px] text-sky-700 mt-1">
                {op.throughput_loss_units} units lost ({op.lost_good_units_per_hour}/hr)
              </p>
            </div>
          </div>

          {/* Component Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ["Scrap Wafers", op.scrap_units, "units"],
              ["Rework Required", op.rework_units, "units"],
              ["Relative Degradation", `${op.relative_yield_degradation_percent}%`, "vs baseline"],
              ["Processing Period", `${result.analysis_period_hours} hrs`, result.analysis_period_source],
            ].map(([label, val, sub]) => (
              <div key={label as string} className="p-3.5 rounded-lg bg-white border border-slate-200 shadow-sm">
                <p className="section-label mb-1">{label as string}</p>
                <p className="font-mono text-lg font-bold text-slate-900">{val as string}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{sub as string}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Persisted Assessments Table */}
      <section className="card">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Historical Impact Calculations</h3>
        {impacts.length === 0 ? (
          <EmptyState
            icon={<ImpactEmptyIcon />}
            title="No stored impact assessments"
            body="Select a drift event from the form above to run your first impact calculation."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="col-num w-12">ID</th>
                  <th className="col-num">Event</th>
                  <th className="col-txt">Machine · Stage</th>
                  <th className="col-num">Period</th>
                  <th className="col-num">Yield Loss</th>
                  <th className="col-num">Scrap</th>
                  <th className="col-num">Rework</th>
                  <th className="col-num">Financial Impact</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {impacts.map((i) => (
                  <tr key={i.id} className="hover:bg-slate-50 transition-colors">
                    <td className="col-num font-mono text-slate-400">{i.id}</td>
                    <td className="col-num font-mono text-sky-600 font-semibold">
                      <Link to={`/app/drift-events/${i.drift_event_id}`}>#{i.drift_event_id}</Link>
                    </td>
                    <td className="col-txt font-medium text-slate-800">
                      {i.machine_id} <span className="text-slate-400 font-normal">· {i.stage_name}</span>
                    </td>
                    <td className="col-num font-mono text-slate-600">
                      {i.analysis_period_hours}h
                    </td>
                    <td className="col-num font-mono font-bold text-amber-700">
                      {i.yield_loss_percentage_points != null ? `${i.yield_loss_percentage_points} pp` : "—"}
                    </td>
                    <td className="col-num font-mono text-slate-600">
                      {i.scrap_units ?? "—"}
                    </td>
                    <td className="col-num font-mono text-slate-600">
                      {i.rework_units ?? "—"}
                    </td>
                    <td className="col-num font-mono font-bold text-slate-900">
                      {i.total_financial_impact != null
                        ? `$${i.total_financial_impact.toLocaleString()} ${i.currency ?? ""}`
                        : "—"}
                    </td>
                    <td className="col-txt text-right pr-4">
                      <Link
                        to={`/app/impact/${i.id}`}
                        className="btn-ghost text-xs text-sky-600 hover:text-sky-700"
                      >
                        Financial Detail →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
