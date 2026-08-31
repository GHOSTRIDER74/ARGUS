import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { generateSimulation, getStages } from "../services/api";
import type { Stage } from "../types/api";

const DRIFT_TYPES = [
  "linear",
  "exponential",
  "sudden_shift",
  "variance_increase",
  "sensor_bias",
  "sensor_dropout",
  "spike",
  "cyclic",
];

export default function SimulationPage() {
  const navigate = useNavigate();
  const [stages, setStages] = useState<Stage[]>([]);
  const [name, setName] = useState("synthetic-run");
  const [durationHours, setDurationHours] = useState(24);
  const [intervalSec, setIntervalSec] = useState(60);
  const [seed, setSeed] = useState(42);
  const [selectedStages, setSelectedStages] = useState<string[]>([]);
  const [injectDrift, setInjectDrift] = useState(true);
  const [driftStage, setDriftStage] = useState("etching");
  const [driftParam, setDriftParam] = useState("chamber_pressure");
  const [driftType, setDriftType] = useState("linear");
  const [startFraction, setStartFraction] = useState(0.5);
  const [magnitude, setMagnitude] = useState(4);
  const [direction, setDirection] = useState<"up" | "down">("up");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStages()
      .then((r) => {
        setStages(r.data.stages);
        if (r.data.stages.length) setSelectedStages(r.data.stages.map((s) => s.name));
      })
      .catch(() => setError("Failed to load stage catalog"));
  }, []);

  const driftStageObj = stages.find((s) => s.name === driftStage);

  const toggleStage = (n: string) =>
    setSelectedStages((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]
    );

  const onGenerate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await generateSimulation({
        name,
        duration_hours: durationHours,
        sampling_interval_seconds: intervalSec,
        stages: selectedStages.length ? selectedStages : null,
        seed,
        drifts: injectDrift
          ? [
              {
                stage_name: driftStage,
                parameter_name: driftParam,
                drift_type: driftType,
                start_fraction: startFraction,
                magnitude_sigmas: magnitude,
                direction,
              },
            ]
          : [],
      });
      navigate(`/app/datasets/${(res.data as { dataset_id: number }).dataset_id}`);
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } }).response?.data
          ?.detail ?? "Generation failed";
      setError(String(detail));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Module 1 — Data Synthesis</p>
        <h2 className="text-2xl font-bold text-slate-900 mt-0.5">Generate Synthetic Sensor Dataset</h2>
        <p className="mt-1 text-sm text-slate-500">
          Configure high-frequency multi-stage semiconductor telemetry with controlled drift injection for model evaluation.
        </p>
      </div>

      {/* Section 1: Run Parameters */}
      <section className="card space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <span className="h-6 w-6 rounded-md bg-sky-100 text-sky-600 flex items-center justify-center font-bold text-xs">1</span>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Simulation Parameters</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="field-label">Dataset Run Name</label>
            <input
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              id="input-sim-name"
            />
          </div>
          <div>
            <label className="field-label">Random Seed</label>
            <input
              className="field font-mono"
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="field-label">Duration (Hours)</label>
            <input
              className="field font-mono"
              type="number"
              min={1}
              value={durationHours}
              onChange={(e) => setDurationHours(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="field-label">Sampling Interval (Seconds)</label>
            <input
              className="field font-mono"
              type="number"
              min={1}
              value={intervalSec}
              onChange={(e) => setIntervalSec(Number(e.target.value))}
            />
          </div>
        </div>

        <div>
          <label className="field-label mb-3">Included Process Stages</label>
          <div className="flex flex-wrap gap-2.5">
            {stages.map((s) => {
              const checked = selectedStages.includes(s.name);
              return (
                <label
                  key={s.name}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3.5 py-2 text-xs font-semibold select-none transition-all ${
                    checked
                      ? "bg-sky-50 border border-sky-300 text-sky-700 shadow-sm"
                      : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleStage(s.name)}
                    className="accent-sky-500 rounded"
                  />
                  {s.display_name}
                </label>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 2: Controlled Drift Injection */}
      <section className="card space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="h-6 w-6 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">2</span>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Inject Controlled Process Drift</h3>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700 select-none">
            <input
              type="checkbox"
              checked={injectDrift}
              onChange={(e) => setInjectDrift(e.target.checked)}
              className="h-4 w-4 accent-sky-500 rounded"
              id="checkbox-inject-drift"
            />
            <span>Enable Drift Anomaly</span>
          </label>
        </div>

        {injectDrift && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
            <div>
              <label className="field-label">Target Stage</label>
              <select
                className="field"
                value={driftStage}
                onChange={(e) => {
                  setDriftStage(e.target.value);
                  const st = stages.find((s) => s.name === e.target.value);
                  if (st?.parameters.length) setDriftParam(st.parameters[0].name);
                }}
              >
                {stages.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.display_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label">Target Parameter</label>
              <select
                className="field"
                value={driftParam}
                onChange={(e) => setDriftParam(e.target.value)}
              >
                {(driftStageObj?.parameters ?? []).map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} ({p.unit})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label">Drift Pattern Type</label>
              <select
                className="field capitalize"
                value={driftType}
                onChange={(e) => setDriftType(e.target.value)}
              >
                {DRIFT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label">Shift Direction</label>
              <select
                className="field"
                value={direction}
                onChange={(e) => setDirection(e.target.value as "up" | "down")}
              >
                <option value="up">Upward Shift (↑)</option>
                <option value="down">Downward Shift (↓)</option>
              </select>
            </div>

            <div>
              <label className="field-label">Drift Onset (Fraction 0–1)</label>
              <input
                className="field font-mono"
                type="number"
                step={0.05}
                min={0}
                max={1}
                value={startFraction}
                onChange={(e) => setStartFraction(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="field-label">Magnitude (Standard Deviations σ)</label>
              <input
                className="field font-mono"
                type="number"
                step={0.5}
                value={magnitude}
                onChange={(e) => setMagnitude(Number(e.target.value))}
              />
            </div>
          </div>
        )}
      </section>

      {/* Action CTA */}
      <div className="flex items-center gap-4 pt-2">
        <button
          onClick={onGenerate}
          disabled={busy || selectedStages.length === 0}
          className="btn-primary px-6 py-3 text-base"
          id="btn-generate-dataset"
        >
          {busy ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Generating Synthetic Telemetry…
            </span>
          ) : (
            "Generate & Inspect Dataset →"
          )}
        </button>
        {selectedStages.length === 0 && (
          <span className="text-xs font-semibold text-red-500">Please select at least one stage</span>
        )}
      </div>

      {error && <p className="inline-error">{error}</p>}
    </div>
  );
}
