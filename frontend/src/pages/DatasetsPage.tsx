import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";
import { deleteDataset, listDatasets, uploadDataset } from "../services/api";
import type { Dataset } from "../types/api";

function DatasetEmptyIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4.03 3-9 3S3 13.66 3 12" />
      <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

export default function DatasetsPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [wideFormat, setWideFormat] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    listDatasets()
      .then((r) => setDatasets(r.data))
      .catch(() => setError("Failed to load datasets. Is the backend running?"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(refresh, [refresh]);

  const onUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadDataset(file, wideFormat);
      if (fileRef.current) fileRef.current.value = "";
      refresh();
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } }).response?.data
          ?.detail ?? "Upload failed";
      setError(detail);
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async (id: number) => {
    if (!window.confirm(`Delete dataset ${id}? This cannot be undone.`)) return;
    await deleteDataset(id);
    refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Module 1 — Telemetry Repository</p>
          <h2 className="text-2xl font-bold text-slate-900 mt-0.5">Sensor Datasets</h2>
        </div>
        <Link to="/app/simulate" className="btn-primary text-xs" id="link-generate-synthetic">
          + Generate Synthetic Dataset
        </Link>
      </div>

      {/* Upload Box */}
      <section className="card">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Upload Fab Sensor CSV</h3>
        <div className="flex flex-wrap items-center gap-4">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2.5 file:text-xs file:font-semibold file:text-slate-700 file:transition-colors hover:file:bg-slate-200 cursor-pointer"
            id="input-file-csv"
          />
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600 select-none">
            <input
              type="checkbox"
              checked={wideFormat}
              onChange={(e) => setWideFormat(e.target.checked)}
              className="accent-sky-500 rounded"
            />
            Wide Format (one parameter per column)
          </label>
          <button
            onClick={onUpload}
            disabled={uploading}
            className="btn-secondary"
            id="btn-upload-csv"
          >
            {uploading ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-600 border-t-transparent" />
                Uploading…
              </span>
            ) : (
              "Upload CSV"
            )}
          </button>
        </div>
        {error && <p className="mt-4 inline-error">{error}</p>}
      </section>

      {/* Table */}
      <section className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-3 py-8 text-slate-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
            Loading datasets…
          </div>
        ) : datasets.length === 0 ? (
          <EmptyState
            icon={<DatasetEmptyIcon />}
            title="No datasets uploaded yet"
            body="Upload a fab CSV above or generate synthetic sensor telemetry."
            ctaLabel="Generate Data"
            ctaTo="/app/simulate"
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="col-num w-12">ID</th>
                  <th className="col-txt">Name</th>
                  <th className="col-txt">Source</th>
                  <th className="col-num">Row Count</th>
                  <th className="col-txt">Status</th>
                  <th className="col-num">Quality Score</th>
                  <th className="text-right pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {datasets.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                    <td className="col-num font-mono text-slate-400">{d.id}</td>
                    <td className="col-txt">
                      <Link
                        to={`/app/datasets/${d.id}`}
                        className="font-bold text-sky-600 hover:underline"
                      >
                        {d.name}
                      </Link>
                    </td>
                    <td className="col-txt">
                      <span
                        className={`tag-pill ${
                          d.source_type === "synthetic" ? "tag-pill-purple" : "tag-pill-accent"
                        }`}
                      >
                        {d.source_type}
                      </span>
                    </td>
                    <td className="col-num font-mono font-semibold text-slate-700">
                      {d.row_count.toLocaleString()}
                    </td>
                    <td className="col-txt">
                      <StatusBadge
                        status={
                          d.status === "preprocessed"
                            ? "active"
                            : d.status === "validated"
                            ? "warning"
                            : d.status === "error"
                            ? "critical"
                            : d.status
                        }
                        label={d.status}
                      />
                    </td>
                    <td className="col-num font-mono text-xs font-bold text-slate-700">
                      {d.quality_score != null
                        ? `${d.quality_score.toFixed(1)}%`
                        : "—"}
                    </td>
                    <td className="col-txt text-right pr-4">
                      <button
                        onClick={() => onDelete(d.id)}
                        className="btn-danger-ghost text-xs"
                      >
                        Delete
                      </button>
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
