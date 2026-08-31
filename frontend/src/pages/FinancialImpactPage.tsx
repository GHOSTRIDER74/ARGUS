import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AnimatedNumber from "../components/AnimatedNumber";
import { getImpact } from "../services/api";
import type { ImpactResult } from "../types/api";

export default function FinancialImpactPage() {
  const { id } = useParams();
  const impactId = Number(id);
  const [impact, setImpact] = useState<ImpactResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getImpact(impactId)
      .then((r) => setImpact(r.data))
      .catch(() => setError("Impact assessment not found"));
  }, [impactId]);

  if (error) return <p className="py-8 text-red-500 font-medium">{error}</p>;
  if (!impact)
    return (
      <div className="flex items-center gap-3 py-12 text-slate-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
        Loading financial breakdown…
      </div>
    );

  const fin = impact.financial;
  const unc = impact.uncertainty;
  const fmt = (v: number | null | undefined) =>
    v != null ? `$${v.toLocaleString()} ${fin?.currency ?? "USD"}` : "—";

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Title */}
      <div>
        <Link
          to="/app/impact"
          className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700 transition-colors"
        >
          ← Back to Operational Impact
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Financial Impact Assessment #{impact.impact_id}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 font-medium">
              Drift Event <Link to={`/app/drift-events/${impact.drift_event_id}`} className="font-mono text-sky-600 font-semibold hover:underline">#{impact.drift_event_id}</Link> · Machine <span className="font-semibold text-slate-700">{impact.machine_id}</span> · Stage <span className="font-semibold text-slate-700">{impact.stage_name}</span> · Parameter <span className="font-mono font-semibold text-slate-700">{impact.primary_parameter}</span>
            </p>
          </div>
        </div>
      </div>

      {impact.is_demo_configuration && (
        <div className="inline-warn flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>Demonstration Configuration ({impact.impact_rule_version}): Coefficients and cost functions are illustrative fab assumptions.</span>
        </div>
      )}

      {/* Hero Financial Totals Card */}
      <section className="card-glass glow-amber space-y-6">
        <div className="text-center py-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Total Estimated Financial Impact</p>
          <div className="font-mono text-5xl md:text-6xl font-extrabold text-amber-900">
            <AnimatedNumber value={fin?.total_financial_impact} decimals={0} duration={700} />
            <span className="text-xl font-bold text-amber-700 ml-2">{fin?.currency ?? "USD"}</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Analysis Period: <span className="font-mono font-semibold text-slate-700">{impact.analysis_period_hours} hours</span> ({impact.analysis_period_source})
          </p>
        </div>

        {/* 3-Point Uncertainty Range Visual */}
        <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Uncertainty Range ({unc?.confidence ?? 95}% Confidence)</h4>
            <span className="text-xs text-slate-400 font-mono">Width: {unc?.uncertainty_width}</span>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Best Case</p>
              <p className="font-mono text-xl font-bold text-emerald-900 mt-0.5">{fmt(unc?.best_case)}</p>
            </div>

            <div className="p-3 rounded-lg bg-sky-50 border border-sky-200">
              <p className="text-[10px] font-bold uppercase tracking-wider text-sky-700">Expected Case</p>
              <p className="font-mono text-xl font-bold text-sky-900 mt-0.5">{fmt(unc?.expected_case)}</p>
            </div>

            <div className="p-3 rounded-lg bg-red-50 border border-red-200">
              <p className="text-[10px] font-bold uppercase tracking-wider text-red-700">Worst Case</p>
              <p className="font-mono text-xl font-bold text-red-900 mt-0.5">{fmt(unc?.worst_case)}</p>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 text-center italic">
            {unc?.note}
          </p>
        </div>
      </section>

      {/* Cost Components Breakdown */}
      {fin && (
        <section className="card">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Cost Components Breakdown</h3>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="col-txt">Cost Category / Sub-Component</th>
                  <th className="col-num">Estimated Loss</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["Scrap — Material Wafers", fin.scrap_material_cost, false],
                    ["Scrap — Accumulated Process Value", fin.scrap_processing_cost, false],
                    ["Scrap — Hazardous Disposal", fin.scrap_disposal_cost, false],
                    ["Total Scrap Cost", fin.total_scrap_cost, true],
                    ["Rework — Technician Labour", fin.rework_labour_cost, false],
                    ["Rework — Chamber Energy", fin.rework_energy_cost, false],
                    ["Rework — Consumable Chemical/Gas", fin.rework_material_cost, false],
                    ["Total Rework Cost", fin.total_rework_cost, true],
                    ["Estimated Lost Production Value", fin.estimated_lost_production_value, false],
                    ["Unscheduled Downtime Cost", fin.downtime_cost, false],
                    ["Total Estimated Financial Impact", fin.total_financial_impact, true],
                  ] as [string, number | null | undefined, boolean][]
                ).map(([label, value, isTotal]) => (
                  <tr
                    key={label}
                    className={
                      isTotal
                        ? "bg-slate-100/80 font-bold border-t border-slate-300"
                        : "hover:bg-slate-50 transition-colors"
                    }
                  >
                    <td
                      className={`col-txt text-xs ${
                        isTotal ? "font-bold text-slate-900 pl-4" : "text-slate-600 pl-8"
                      }`}
                    >
                      {label}
                    </td>
                    <td
                      className={`col-num font-mono text-xs ${
                        isTotal ? "font-bold text-amber-700 text-sm" : "text-slate-800"
                      }`}
                    >
                      {fmt(value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Calculation Notes */}
      {impact.calculation_notes && impact.calculation_notes.length > 0 && (
        <section className="card">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Model Calculation Assumptions</h3>
          <ul className="space-y-2 pl-4 text-xs text-slate-600">
            {impact.calculation_notes.map((n, idx) => (
              <li key={idx} className="list-disc leading-relaxed">{n}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Traceable Steps Calculation Breakdown */}
      {impact.calculation_breakdown && impact.calculation_breakdown.length > 0 && (
        <section className="card">
          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Auditability</p>
            <h3 className="text-base font-bold text-slate-900">Calculation Step Traceability</h3>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="col-txt">Step Name</th>
                  <th className="col-txt">Formula</th>
                  <th className="col-txt">Inputs</th>
                  <th className="col-num">Step Result</th>
                </tr>
              </thead>
              <tbody>
                {impact.calculation_breakdown.map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="col-txt font-semibold text-xs text-slate-900">{s.name}</td>
                    <td className="col-txt text-xs font-mono text-slate-500">{s.formula}</td>
                    <td className="col-txt text-xs font-mono text-slate-600">
                      {Object.entries(s.inputs)
                        .map(([k, v]) => `${k}=${v}`)
                        .join(", ")}
                    </td>
                    <td className="col-num font-mono text-xs font-bold text-sky-600">
                      {typeof s.result === "object"
                        ? JSON.stringify(s.result)
                        : String(s.result)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
