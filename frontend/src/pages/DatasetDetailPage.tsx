import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AnimatedNumber from "../components/AnimatedNumber";
import StatusBadge from "../components/StatusBadge";
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
        (e as { response?: { data?: { detail?: string } } }).response?.data?.detail ??
        `${label} failed`;
      setError(String(detail));
    } finally {
      setBusy(null);
    }
  };

  if (error && !dataset) return <p className="py-8 text-red-500 font-medium">{error}</p>;
  if (!dataset)
    return (
      <div className="flex items-center gap-3 py-12 text-slate-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
        Loading dataset detail…
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <Link to="/app/datasets" className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 hover:text-sky-700 transition-colors">
          ← Back to Datasets
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              {dataset.name} <span className="font-mono text-sm font-normal text-slate-400">#{dataset.id}</span>
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
              <span className="capitalize">{dataset.source_type} Source</span>
              <span>·</span>
              <span className="font-mono">{dataset.row_count.toLocaleString()} rows</span>
              <span>·</span>
              <StatusBadge
                status={
                  dataset.status === "preprocessed"
                    ? "active"
                    : dataset.status === "validated"
                    ? "warning"
                    : dataset.status === "error"
                    ? "critical"
                    : dataset.status
                }
                label={dataset.status}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Dataset Actions Card */}
      <section className="card">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Pipeline Actions</h3>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() =>
              run("Validate", () =>
                validateDataset(dsId).then((r) => setValidation(r.data))
              )
            }
            disabled={busy !== null}
            className="btn-secondary"
          >
            {busy === "Validate" ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-600 border-t-transparent" />
                Validating Schema…
              </span>
            ) : (
              "Validate Schema"
            )}
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs font-semibold text-slate-500">Resample Interval:</span>
            <select
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
              className="field !w-auto !py-1.5 text-xs font-mono"
            >
              <option value="1s">1 second</option>
              <option value="1min">1 minute</option>
              <option value="5min">5 minutes</option>
            </select>

            <button
              onClick={() => run("Preprocess", () => preprocessDataset(dsId, interval))}
              disabled={busy !== null}
              className="btn-primary"
            >
              {busy === "Preprocess" ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Preprocessing…
                </span>
              ) : (
                "Run Preprocessing"
              )}
            </button>
          </div>
          {error && <span className="inline-error text-xs w-full mt-2">{error}</span>}
        </div>
      </section>

      {/* Validation Report */}
      {validation && (
        <section className="card">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Validation Report</h3>
            <StatusBadge
              status={validation.is_valid ? "healthy" : "critical"}
              label={validation.is_valid ? "Schema Valid" : "Issues Found"}
            />
          </div>
          {validation.issues.length === 0 ? (
            <p className="text-sm text-emerald-700 bg-emerald-50 p-3 rounded-lg border border-emerald-200">No schema or quality issues detected in this dataset.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {validation.issues.map((i, idx) => (
                <li
                  key={idx}
                  className={`p-2.5 rounded-md border ${
                    i.severity === "error"
                      ? "bg-red-50 text-red-800 border-red-200"
                      : "bg-amber-50 text-amber-800 border-amber-200"
                  }`}
                >
                  <span className="font-mono font-bold uppercase mr-1">[{i.severity}]</span>{" "}
                  {i.message}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Quality Metrics */}
      {quality && (
        <section className="space-y-3">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Telemetry Quality Assessment</h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {[
              ["Overall Quality Score", quality.quality_score, true],
              ["Completeness", quality.completeness * 100, false],
              ["Validity", quality.validity * 100, false],
              ["Uniqueness", quality.uniqueness * 100, false],
              ["Timeliness", quality.timeliness * 100, false],
            ].map(([label, value, isHero]) => (
              <div
                key={label as string}
                className={isHero ? "card-glass glow-green text-center" : "card-sm text-center"}
              >
                <p className="section-label mb-2">{label as string}</p>
                {isHero ? (
                  <AnimatedNumber
                    value={value as number}
                    decimals={1}
                    duration={700}
                    className="kpi-lg text-emerald-600 font-extrabold"
                  />
                ) : (
                  <p className="font-mono text-2xl font-bold text-slate-900">
                    {(value as number).toFixed(1)}
                    <span className="text-xs font-normal text-slate-400 ml-0.5">%</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Summary Statistics */}
      {summary && (
        <section className="card">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Summary Statistics</h3>
            <p className="mt-1 text-xs text-slate-500">
              Stages: <span className="font-semibold text-slate-700">{summary.stages.join(", ")}</span> · Machines: <span className="font-semibold text-slate-700">{summary.machines.join(", ")}</span>
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="col-txt">Stage / Parameter</th>
                  <th className="col-num">Sample Count</th>
                  <th className="col-num">Mean</th>
                  <th className="col-num">Min</th>
                  <th className="col-num">Max</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(summary.statistics).map(([key, s]) => (
                  <tr key={key} className="hover:bg-slate-50 transition-colors">
                    <td className="col-txt font-semibold text-xs text-slate-900">{key}</td>
                    <td className="col-num font-mono text-xs text-slate-600">{s.count}</td>
                    <td className="col-num font-mono text-xs font-bold text-slate-900">{s.mean}</td>
                    <td className="col-num font-mono text-xs text-slate-500">{s.min}</td>
                    <td className="col-num font-mono text-xs text-slate-500">{s.max}</td>
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
