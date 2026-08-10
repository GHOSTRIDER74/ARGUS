import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getDataset,
  getQualityReport,
  getSummary,
  preprocessDataset,
  validateDataset,
} from "../services/api";
import type { Dataset, DatasetSummary, QualityReport, ValidationReport } from "../types/api";

export default function DatasetDetailPage() {
  const { id } = useParams();
  const dsId = Number(id);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [summary, setSummary] = useState<DatasetSummary | null>(null);
  const [quality, setQuality] = useState<QualityReport | null>(null);
  const [interval, setInterval] = useState("1min");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getDataset(dsId)
      .then((r) => {
        setDataset(r.data);
        if (r.data.status === "preprocessed") {
          getSummary(dsId).then((s) => setSummary(s.data)).catch(() => undefined);
          getQualityReport(dsId).then((q) => setQuality(q.data)).catch(() => undefined);
        }
      })
      .catch(() => setError("Dataset not found"));
  }, [dsId]);

  useEffect(load, [load]);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
      load();
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? `${label} failed`;
      setError(String(detail));
    } finally {
      setBusy(null);
    }
  };

  if (error && !dataset) return <p className="text-red-400">{error}</p>;
  if (!dataset) return <p className="text-slate-400">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-xs text-slate-400 hover:underline">
          ← Back to datasets
        </Link>
        <h1 className="mt-1 text-xl font-semibold">
          {dataset.name} <span className="text-sm font-normal text-slate-500">#{dataset.id}</span>
        </h1>
        <p className="text-sm text-slate-400">
          {dataset.source_type} · {dataset.row_count.toLocaleString()} rows · status:{" "}
          <span className="text-slate-200">{dataset.status}</span>
        </p>
      </div>

      <section className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <button
          onClick={() => run("Validate", () => validateDataset(dsId).then((r) => setValidation(r.data)))}
          disabled={busy !== null}
          className="rounded-md bg-slate-700 px-4 py-2 text-sm hover:bg-slate-600 disabled:opacity-50"
        >
          {busy === "Validate" ? "Validating…" : "Validate"}
        </button>
        <select
          value={interval}
          onChange={(e) => setInterval(e.target.value)}
          className="rounded-md border border-slate-700 bg-slate-800 px-2 py-2 text-sm"
        >
          <option value="1s">1 second</option>
          <option value="1min">1 minute</option>
          <option value="5min">5 minutes</option>
        </select>
        <button
          onClick={() => run("Preprocess", () => preprocessDataset(dsId, interval))}
          disabled={busy !== null}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {busy === "Preprocess" ? "Preprocessing…" : "Preprocess"}
        </button>
        {error && <span className="text-sm text-red-400">{error}</span>}
      </section>

      {validation && (
        <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Validation report —{" "}
            <span className={validation.is_valid ? "text-emerald-400" : "text-red-400"}>
              {validation.is_valid ? "VALID" : "INVALID"}
            </span>
          </h2>
          {validation.issues.length === 0 ? (
            <p className="text-sm text-slate-400">No issues found.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {validation.issues.map((i, idx) => (
                <li key={idx} className={i.severity === "error" ? "text-red-400" : "text-amber-400"}>
                  [{i.severity}] {i.message}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {quality && (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            ["Quality score", `${quality.quality_score.toFixed(1)} / 100`],
            ["Completeness", `${(quality.completeness * 100).toFixed(1)}%`],
            ["Validity", `${(quality.validity * 100).toFixed(1)}%`],
            ["Uniqueness", `${(quality.uniqueness * 100).toFixed(1)}%`],
            ["Timeliness", `${(quality.timeliness * 100).toFixed(1)}%`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-lg font-semibold text-sky-300">{value}</p>
            </div>
          ))}
        </section>
      )}

      {summary && (
        <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Summary statistics
          </h2>
          <p className="mb-3 text-sm text-slate-400">
            Stages: {summary.stages.join(", ")} · Machines: {summary.machines.join(", ")}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-1">Stage / Parameter</th>
                  <th className="px-3 py-1">Count</th>
                  <th className="px-3 py-1">Mean</th>
                  <th className="px-3 py-1">Min</th>
                  <th className="px-3 py-1">Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {Object.entries(summary.statistics).map(([key, s]) => (
                  <tr key={key}>
                    <td className="px-3 py-1 text-slate-300">{key}</td>
                    <td className="px-3 py-1">{s.count}</td>
                    <td className="px-3 py-1">{s.mean}</td>
                    <td className="px-3 py-1">{s.min}</td>
                    <td className="px-3 py-1">{s.max}</td>
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
