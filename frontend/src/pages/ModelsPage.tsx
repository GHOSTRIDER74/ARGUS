import { useCallback, useEffect, useState } from "react";
import {
  activateModel,
  deleteModel,
  listDatasets,
  listModels,
  runDetection,
  trainModel,
} from "../services/api";
import type { Dataset, ModelVersionItem } from "../types/api";

export default function ModelsPage() {
  const [models, setModels] = useState<ModelVersionItem[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // train form
  const [datasetId, setDatasetId] = useState<number | "">("");
  const [stageName, setStageName] = useState("etching");
  const [machineId, setMachineId] = useState("ETCH-01");
  const [seqLen, setSeqLen] = useState(30);
  const [epochs, setEpochs] = useState(30);

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.all([listModels(), listDatasets()])
      .then(([m, d]) => {
        setModels(m.data);
        setDatasets(d.data.filter((x) => x.status === "preprocessed"));
      })
      .catch(() => setError("Failed to load models"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(refresh, [refresh]);

  const onTrain = async () => {
    if (datasetId === "") return;
    setBusy("train");
    setError(null);
    setMessage(null);
    try {
      const r = await trainModel({
        dataset_id: datasetId,
        stage_name: stageName,
        machine_id: machineId,
        sequence_length: seqLen,
        baseline_selection: { method: "ground_truth" },
        model_config: { epochs },
      });
      const body = r.data as { model_id: string; best_validation_loss: number };
      setMessage(`Trained model ${body.model_id} (val loss ${body.best_validation_loss.toFixed(6)})`);
      refresh();
    } catch (e: unknown) {
      setError(String((e as { response?: { data?: { detail?: unknown } } }).response?.data?.detail ?? "Training failed"));
    } finally {
      setBusy(null);
    }
  };

  const onDetect = async (m: ModelVersionItem) => {
    setBusy(m.model_id);
    setError(null);
    setMessage(null);
    try {
      const r = await runDetection({
        dataset_id: m.dataset_id,
        machine_id: m.machine_scope,
        stage_name: m.stage_name,
        model_id: m.model_id,
        persist_results: true,
      });
      const d = r.data;
      setMessage(
        `Detection: ${d.status} · hybrid ${d.hybrid_score.toFixed(3)} · severity ${d.severity.score} (${d.severity.level})` +
          (d.event_id ? ` · event #${d.event_id} created/updated` : ""),
      );
    } catch (e: unknown) {
      setError(String((e as { response?: { data?: { detail?: unknown } } }).response?.data?.detail ?? "Detection failed"));
    } finally {
      setBusy(null);
    }
  };

  const onDelete = async (m: ModelVersionItem) => {
    if (!window.confirm(`Delete model ${m.model_id} and its artifacts?`)) return;
    await deleteModel(m.model_id);
    refresh();
  };

  const field = "rounded-md border border-slate-700 bg-slate-800 px-2 py-2 text-sm w-full";
  const label = "block text-xs text-slate-400 mb-1";

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Drift Models</h1>

      <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Train a new LSTM Autoencoder
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <div>
            <label className={label}>Dataset (preprocessed)</label>
            <select
              className={field}
              value={datasetId}
              onChange={(e) => setDatasetId(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">Select…</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  #{d.id} {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Stage</label>
            <input className={field} value={stageName} onChange={(e) => setStageName(e.target.value)} />
          </div>
          <div>
            <label className={label}>Machine ID</label>
            <input className={field} value={machineId} onChange={(e) => setMachineId(e.target.value)} />
          </div>
          <div>
            <label className={label}>Sequence length</label>
            <input className={field} type="number" min={5} value={seqLen} onChange={(e) => setSeqLen(Number(e.target.value))} />
          </div>
          <div>
            <label className={label}>Epochs</label>
            <input className={field} type="number" min={1} value={epochs} onChange={(e) => setEpochs(Number(e.target.value))} />
          </div>
        </div>
        <button
          onClick={onTrain}
          disabled={busy !== null || datasetId === ""}
          className="mt-4 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {busy === "train" ? "Training…" : "Train model"}
        </button>
        {message && <p className="mt-2 text-sm text-emerald-400">{message}</p>}
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Trained models</h2>
        {loading ? (
          <p className="text-slate-400">Loading…</p>
        ) : models.length === 0 ? (
          <p className="text-slate-500">No models yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-3 py-2">Model</th>
                  <th className="px-3 py-2">v</th>
                  <th className="px-3 py-2">Scope</th>
                  <th className="px-3 py-2">Features</th>
                  <th className="px-3 py-2">Seq</th>
                  <th className="px-3 py-2">Val loss</th>
                  <th className="px-3 py-2">Threshold</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Trained</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {models.map((m) => (
                  <tr key={m.model_id} className="hover:bg-slate-900/60">
                    <td className="px-3 py-2 font-mono text-xs text-sky-300">{m.model_id}</td>
                    <td className="px-3 py-2">{m.version}</td>
                    <td className="px-3 py-2 text-slate-300">
                      {m.machine_scope} / {m.stage_name}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-400">
                      {(m.feature_names ?? []).length} features
                    </td>
                    <td className="px-3 py-2">{m.sequence_length}</td>
                    <td className="px-3 py-2">
                      {m.metrics?.best_validation_loss?.toFixed(6) ?? "—"}
                    </td>
                    <td className="px-3 py-2">{m.threshold?.toFixed(6) ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          m.status === "active" ? "bg-emerald-900 text-emerald-300" : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-400">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 text-right text-xs whitespace-nowrap">
                      <button
                        onClick={() => onDetect(m)}
                        disabled={busy !== null}
                        className="mr-2 text-sky-400 hover:underline disabled:opacity-50"
                      >
                        {busy === m.model_id ? "Detecting…" : "Run detection"}
                      </button>
                      {m.status !== "active" && (
                        <button onClick={() => activateModel(m.model_id).then(refresh)} className="mr-2 text-emerald-400 hover:underline">
                          Activate
                        </button>
                      )}
                      <button onClick={() => onDelete(m)} className="text-red-400 hover:underline">
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
