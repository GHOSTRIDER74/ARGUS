import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { deleteDataset, listDatasets, uploadDataset } from "../services/api";
import type { Dataset } from "../types/api";

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
        (e as { response?: { data?: { detail?: string } } }).response?.data?.detail ??
        "Upload failed";
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
      <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Upload sensor CSV
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-slate-100"
          />
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={wideFormat}
              onChange={(e) => setWideFormat(e.target.checked)}
            />
            Wide format (one column per parameter)
          </label>
          <button
            onClick={onUpload}
            disabled={uploading}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Datasets
        </h2>
        {loading ? (
          <p className="text-slate-400">Loading…</p>
        ) : datasets.length === 0 ? (
          <p className="text-slate-500">
            No datasets yet. Upload a CSV above or generate synthetic data.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-2">ID</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Source</th>
                  <th className="px-4 py-2">Rows</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Quality</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {datasets.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-900/60">
                    <td className="px-4 py-2 text-slate-400">{d.id}</td>
                    <td className="px-4 py-2">
                      <Link to={`/datasets/${d.id}`} className="text-sky-400 hover:underline">
                        {d.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          d.source_type === "synthetic"
                            ? "bg-purple-900 text-purple-300"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {d.source_type}
                      </span>
                    </td>
                    <td className="px-4 py-2">{d.row_count.toLocaleString()}</td>
                    <td className="px-4 py-2 text-slate-300">{d.status}</td>
                    <td className="px-4 py-2">
                      {d.quality_score != null ? `${d.quality_score.toFixed(1)} / 100` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => onDelete(d.id)}
                        className="text-xs text-red-400 hover:underline"
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
