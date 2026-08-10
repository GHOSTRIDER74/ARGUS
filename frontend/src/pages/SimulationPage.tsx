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
    setSelectedStages((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));

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
      navigate(`/datasets/${(res.data as { dataset_id: number }).dataset_id}`);
    } catch (e: unknown) {
      const detail =
        (e as { response?: { data?: { detail?: string } } }).response?.data?.detail ??
        "Generation failed";
      setError(String(detail));
    } finally {
      setBusy(false);
    }
  };

  const field = "rounded-md border border-slate-700 bg-slate-800 px-2 py-2 text-sm w-full";
  const label = "block text-xs text-slate-400 mb-1";

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Generate synthetic data</h1>
      <p className="text-sm text-slate-400">
        Data produced here is <span className="text-amber-400">simulated</span>, driven by the
        configurable stage catalog. Ground-truth drift labels are stored for model evaluation.
      </p>

      <section className="grid grid-cols-2 gap-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <div>
          <label className={label}>Run name</label>
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className={label}>Random seed</label>
          <input
            className={field}
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
          />
        </div>
        <div>
          <label className={label}>Duration (hours)</label>
          <input
            className={field}
            type="number"
            min={1}
            value={durationHours}
            onChange={(e) => setDurationHours(Number(e.target.value))}
          />
        </div>
        <div>
          <label className={label}>Sampling interval (seconds)</label>
          <input
            className={field}
            type="number"
            min={1}
            value={intervalSec}
            onChange={(e) => setIntervalSec(Number(e.target.value))}
          />
        </div>
        <div className="col-span-2">
          <label className={label}>Stages</label>
          <div className="flex flex-wrap gap-3">
            {stages.map((s) => (
              <label key={s.name} className="flex items-center gap-1 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={selectedStages.includes(s.name)}
                  onChange={() => toggleStage(s.name)}
                />
                {s.display_name}
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={injectDrift}
            onChange={(e) => setInjectDrift(e.target.checked)}
          />
          Inject drift
        </label>
        {injectDrift && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>Stage</label>
              <select
                className={field}
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
              <label className={label}>Parameter</label>
              <select
                className={field}
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
              <label className={label}>Drift type</label>
              <select className={field} value={driftType} onChange={(e) => setDriftType(e.target.value)}>
                {DRIFT_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Direction</label>
              <select
                className={field}
                value={direction}
                onChange={(e) => setDirection(e.target.value as "up" | "down")}
              >
                <option value="up">up</option>
                <option value="down">down</option>
              </select>
            </div>
            <div>
              <label className={label}>Start (fraction of timeline: 0–1)</label>
              <input
                className={field}
                type="number"
                step={0.05}
                min={0}
                max={1}
                value={startFraction}
                onChange={(e) => setStartFraction(Number(e.target.value))}
              />
            </div>
            <div>
              <label className={label}>Magnitude (in sigmas)</label>
              <input
                className={field}
                type="number"
                step={0.5}
                value={magnitude}
                onChange={(e) => setMagnitude(Number(e.target.value))}
              />
            </div>
          </div>
        )}
      </section>

      <button
        onClick={onGenerate}
        disabled={busy || selectedStages.length === 0}
        className="rounded-md bg-sky-600 px-5 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
      >
        {busy ? "Generating…" : "Generate dataset"}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
