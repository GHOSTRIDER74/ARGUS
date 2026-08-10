import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getImpact } from "../services/api";
import type { ImpactResult } from "../types/api";

/** Module 3 — financial impact detail for one persisted impact assessment. */
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

  if (error) return <p className="text-red-400">{error}</p>;
  if (!impact) return <p className="text-slate-400">Loading…</p>;

  const fin = impact.financial;
  const unc = impact.uncertainty;
  const fmt = (v: number | null | undefined) =>
    v != null ? `${v.toLocaleString()} ${fin?.currency ?? ""}` : "—";

  return (
    <div className="space-y-6">
      <div>
        <Link to="/impact" className="text-xs text-slate-400 hover:underline">
          ← Back to operational impact
        </Link>
        <h1 className="mt-1 text-xl font-semibold">
          Financial impact #{impact.impact_id}{" "}
          <span className="text-sm font-normal text-slate-400">
            drift event #{impact.drift_event_id} · {impact.machine_id} · {impact.stage_name} ·{" "}
            {impact.primary_parameter}
          </span>
        </h1>
      </div>

      {impact.is_demo_configuration && (
        <div className="rounded-lg border border-amber-700 bg-amber-950/40 px-4 py-2 text-xs text-amber-300">
          Demonstration configuration ({impact.impact_rule_version} /{" "}
          {impact.production_config_version ?? "file default"}): all coefficients and cost values are
          illustrative assumptions, not calibrated fab or accounting data.
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Total estimated loss", fmt(fin?.total_financial_impact), "text-amber-300"],
          ["Best case", fmt(unc?.best_case), "text-emerald-300"],
          ["Expected case", fmt(unc?.expected_case), "text-sky-300"],
          ["Worst case", fmt(unc?.worst_case), "text-red-300"],
        ].map(([label, value, color]) => (
          <div key={label as string} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`text-sm font-semibold ${color}`}>{value}</p>
          </div>
        ))}
      </section>
      <p className="text-xs text-slate-500">
        Uncertainty width {unc?.uncertainty_width} at confidence {unc?.confidence} (assumptions{" "}
        {unc?.assumption_version}). {unc?.note}
      </p>

      {fin && (
        <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Cost components
          </h2>
          <table className="w-full text-left text-xs">
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {[
                ["Scrap — material", fin.scrap_material_cost],
                ["Scrap — accumulated processing", fin.scrap_processing_cost],
                ["Scrap — disposal", fin.scrap_disposal_cost],
                ["Total scrap cost", fin.total_scrap_cost],
                ["Rework — labour", fin.rework_labour_cost],
                ["Rework — energy", fin.rework_energy_cost],
                ["Rework — material", fin.rework_material_cost],
                ["Total rework cost", fin.total_rework_cost],
                ["Estimated lost production value", fin.estimated_lost_production_value],
                ["Downtime cost", fin.downtime_cost],
                ["Total estimated financial impact", fin.total_financial_impact],
              ].map(([label, value]) => (
                <tr key={label as string}>
                  <td
                    className={`py-1 ${String(label).startsWith("Total") ? "font-semibold text-slate-200" : ""}`}
                  >
                    {label}
                  </td>
                  <td
                    className={`py-1 text-right ${String(label).startsWith("Total") ? "font-semibold text-amber-300" : ""}`}
                  >
                    {fmt(value as number)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {impact.calculation_notes && impact.calculation_notes.length > 0 && (
        <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Calculation notes
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-400">
            {impact.calculation_notes.map((n, idx) => (
              <li key={idx}>{n}</li>
            ))}
          </ul>
        </section>
      )}

      {impact.calculation_breakdown && impact.calculation_breakdown.length > 0 && (
        <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Calculation breakdown <span className="normal-case text-slate-500">(traceable steps)</span>
          </h2>
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr>
                <th className="py-1">Step</th>
                <th className="py-1">Formula</th>
                <th className="py-1">Inputs</th>
                <th className="py-1">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {impact.calculation_breakdown.map((s, idx) => (
                <tr key={idx}>
                  <td className="py-1 align-top font-medium">{s.name}</td>
                  <td className="py-1 align-top text-slate-400">{s.formula}</td>
                  <td className="py-1 align-top text-slate-500">
                    {Object.entries(s.inputs)
                      .map(([k, v]) => `${k}=${v}`)
                      .join(", ")}
                  </td>
                  <td className="py-1 align-top text-sky-300">
                    {typeof s.result === "object" ? JSON.stringify(s.result) : String(s.result)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
