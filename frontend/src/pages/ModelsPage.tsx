import { useCallback, useEffect, useState } from "react";
import EmptyState from "../components/EmptyState";
import StatusBadge from "../components/StatusBadge";
import {
  activateModel,
  deleteModel,
  listDatasets,
  listModels,
  runDetection,
  trainModel,
} from "../services/api";
import type { Dataset, ModelVersionItem } from "../types/api";

function ModelsEmptyIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

export default function ModelsPage() {
  const [models, setModels] = useState<ModelVersionItem[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Train form state
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
      setMessage(
        `Successfully trained model ${body.model_id} · Val Loss: ${body.best_validation_loss.toFixed(6)}`
      );
      refresh();
    } catch (e: unknown) {
      setError(
        String(
          (e as { response?: { data?: { detail?: unknown } } }).response?.data
            ?.detail ?? "Training failed"
        )
      );
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
        `Detection result: ${d.status} · Hybrid Score: ${d.hybrid_score.toFixed(3)} · Severity: ${d.severity.score} (${d.severity.level})` +
          (d.event_id ? ` · Created Event #${d.event_id}` : "")
      );
    } catch (e: unknown) {
      setError(
        String(
          (e as { response?: { data?: { detail?: unknown } } }).response?.data
            ?.detail ?? "Detection failed"
        )
      );
    } finally {
      setBusy(null);
    }
  };

  const onDelete = async (m: ModelVersionItem) => {
    if (!window.confirm(`Delete model ${m.model_id} and its stored weights?`)) return;
    await deleteModel(m.model_id);
    refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Module 2 — Anomaly Engine</p>
        <h2 className="text-2xl font-bold text-slate-900 mt-0.5">LSTM Autoencoder Models</h2>
        <p className="mt-1 text-sm text-slate-500">
          Train sequence models on baseline telemetry and run hybrid drift detection against live or simulated data.
        </p>
      </div>

      {/* Train New Model Panel */}
      <section className="card">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Train New LSTM Model</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="field-label">Preprocessed Dataset</label>
            <select
              className="field"
              value={datasetId}
              onChange={(e) =>
                setDatasetId(e.target.value === "" ? "" : Number(e.target.value))
              }
              id="select-model-dataset"
            >
              <option value="">Select dataset…</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  #{d.id} — {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">Stage Name</label>
            <input
              className="field"
              value={stageName}
              onChange={(e) => setStageName(e.target.value)}
            />
          </div>

          <div>
            <label className="field-label">Machine Scope ID</label>
            <input
              className="field"
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
            />
          </div>

          <div>
            <label className="field-label">Sequence Length</label>
            <input
              className="field font-mono"
              type="number"
              min={5}
              value={seqLen}
              onChange={(e) => setSeqLen(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="field-label">Training Epochs</label>
            <input
              className="field font-mono"
              type="number"
              min={1}
              value={epochs}
              onChange={(e) => setEpochs(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="mt-5 flex items-center gap-4">
          <button
            onClick={onTrain}
            disabled={busy !== null || datasetId === ""}
            className="btn-primary"
            id="btn-train-model"
          >
            {busy === "train" ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Training Neural Network…
              </span>
            ) : (
              "Train Model"
            )}
          </button>
        </div>

        {message && <p className="mt-4 inline-success">{message}</p>}
        {error && <p className="mt-4 inline-error">{error}</p>}
      </section>

      {/* Trained Models Table */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Registered Model Artifacts</h3>
        {loading ? (
          <div className="flex items-center gap-3 py-8 text-slate-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
            Loading trained models…
          </div>
        ) : models.length === 0 ? (
          <EmptyState
            icon={<ModelsEmptyIcon />}
            title="No models trained yet"
            body="Use the panel above to train your first LSTM Autoencoder model on preprocessed telemetry."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="col-txt">Model ID</th>
                  <th className="col-num">Ver</th>
                  <th className="col-txt">Scope (Machine / Stage)</th>
                  <th className="col-num">Features</th>
                  <th className="col-num">Seq Len</th>
                  <th className="col-num">Val Loss</th>
                  <th className="col-num">Threshold</th>
                  <th className="col-txt">Status</th>
                  <th className="col-txt">Trained Date</th>
                  <th className="text-right pr-4">Inference & Actions</th>
                </tr>
              </thead>
              <tbody>
                {models.map((m) => (
                  <tr key={m.model_id} className="hover:bg-slate-50 transition-colors">
                    <td className="col-txt font-mono text-xs font-bold text-sky-600">
                      {m.model_id}
                    </td>
                    <td className="col-num font-mono text-slate-400">v{m.version}</td>
                    <td className="col-txt font-semibold text-slate-900">
                      {m.machine_scope} <span className="text-slate-400 font-normal">/ {m.stage_name}</span>
                    </td>
                    <td className="col-num font-mono text-slate-600">
                      {(m.feature_names ?? []).length}
                    </td>
                    <td className="col-num font-mono text-slate-600">
                      {m.sequence_length}
                    </td>
                    <td className="col-num font-mono text-xs font-bold text-slate-800">
                      {m.metrics?.best_validation_loss?.toFixed(6) ?? "—"}
                    </td>
                    <td className="col-num font-mono text-xs text-slate-600">
                      {m.threshold?.toFixed(6) ?? "—"}
                    </td>
                    <td className="col-txt">
                      <StatusBadge
                        status={m.status === "active" ? "active" : m.status}
                      />
                    </td>
                    <td className="col-txt text-xs text-slate-500 font-mono">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>
                    <td className="col-txt text-right text-xs whitespace-nowrap pr-4">
                      <button
                        onClick={() => onDetect(m)}
                        disabled={busy !== null}
                        className="btn-primary !py-1 !px-3 text-xs mr-2 disabled:opacity-40"
                      >
                        {busy === m.model_id ? "Running Detection…" : "Run Detection"}
                      </button>
                      {m.status !== "active" && (
                        <button
                          onClick={() => activateModel(m.model_id).then(refresh)}
                          className="btn-secondary !py-1 !px-2.5 text-xs text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 mr-2"
                        >
                          Activate
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(m)}
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
