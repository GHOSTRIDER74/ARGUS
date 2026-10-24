import { useEffect, useState } from "react";
import { api } from "../services/api";
import { TrendChart } from "../components/TrendChart";

export function Simulation() {
  const [params, setParams] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  const [form, setForm] = useState({
    n_samples: 1000,
    drift_type: "gradual",
    drift_onset: 500,
    drift_magnitude: 0.05,
    target_parameter: "rf_power",
    drift_direction: "positive",
    noise_scale: 1.0
  });

  useEffect(() => {
    api.getSimulationParams().then(setParams);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.generateSimulation(form);
      setResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: any) => {
    const { name, value, type } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  return (
    <div className="space-y-8 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-xl text-headline-xl font-bold text-primary tracking-tight">
            What-If Scenario Simulation
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Inject synthetic drift patterns (gradual tool wear, sudden MFC failure, or cyclical thermal hunting) to test CUSUM detection.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Form: Configuration */}
        <div className="lg:col-span-5 bg-surface-white rounded-3xl p-6 md:p-8 border border-outline-variant/30 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
            <h2 className="font-headline-md text-headline-md font-bold text-primary">Configure Scenario</h2>
            <span className="material-symbols-outlined text-secondary text-[22px]">tune</span>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-label-caps text-on-surface-variant uppercase font-bold mb-1.5">
                Simulation Length (Wafers)
              </label>
              <input 
                type="number" 
                name="n_samples" 
                value={form.n_samples} 
                onChange={handleInputChange} 
                min={100} 
                max={5000} 
                className="w-full bg-surface-container-low px-4 py-2.5 rounded-full border border-outline-variant/30 font-mono text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
              />
            </div>
            
            <div>
              <label className="block text-xs font-label-caps text-on-surface-variant uppercase font-bold mb-1.5">
                Target Process Parameter
              </label>
              <select 
                name="target_parameter" 
                value={form.target_parameter} 
                onChange={handleInputChange}
                className="w-full bg-surface-container-low px-4 py-2.5 rounded-full border border-outline-variant/30 font-body-md text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
              >
                {params?.parameters?.map((p: any) => (
                  <option key={p.name} value={p.name}>{p.name} ({p.unit})</option>
                )) || (
                  <>
                    <option value="rf_power">rf_power (W)</option>
                    <option value="etch_rate">etch_rate (nm/min)</option>
                    <option value="chamber_pressure">chamber_pressure (mTorr)</option>
                    <option value="etchant_gas_flow">etchant_gas_flow (sccm)</option>
                  </>
                )}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-label-caps text-on-surface-variant uppercase font-bold mb-1.5">
                  Drift Pattern
                </label>
                <select 
                  name="drift_type" 
                  value={form.drift_type} 
                  onChange={handleInputChange}
                  className="w-full bg-surface-container-low px-3 py-2.5 rounded-full border border-outline-variant/30 font-body-md text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
                >
                  <option value="none">None (Healthy)</option>
                  <option value="gradual">Gradual (Tool Aging)</option>
                  <option value="sudden">Sudden (Hardware Trip)</option>
                  <option value="cyclical">Cyclical (Chiller Loop)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-label-caps text-on-surface-variant uppercase font-bold mb-1.5">
                  Drift Onset (Step)
                </label>
                <input 
                  type="number" 
                  name="drift_onset" 
                  value={form.drift_onset} 
                  onChange={handleInputChange} 
                  min={0} 
                  max={form.n_samples} 
                  className="w-full bg-surface-container-low px-3 py-2.5 rounded-full border border-outline-variant/30 font-mono text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-label-caps text-on-surface-variant uppercase font-bold mb-1.5">
                  Magnitude (σ)
                </label>
                <input 
                  type="number" 
                  step="0.01" 
                  name="drift_magnitude" 
                  value={form.drift_magnitude} 
                  onChange={handleInputChange} 
                  className="w-full bg-surface-container-low px-3 py-2.5 rounded-full border border-outline-variant/30 font-mono text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
                />
              </div>

              <div>
                <label className="block text-xs font-label-caps text-on-surface-variant uppercase font-bold mb-1.5">
                  Noise Scale
                </label>
                <input 
                  type="number" 
                  step="0.1" 
                  name="noise_scale" 
                  value={form.noise_scale} 
                  onChange={handleInputChange} 
                  min={0} 
                  max={3} 
                  className="w-full bg-surface-container-low px-3 py-2.5 rounded-full border border-outline-variant/30 font-mono text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full mt-4 py-3 bg-secondary text-surface-white rounded-full font-label-md text-label-md font-bold hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">play_arrow</span>
              {loading ? "Generating Telemetry Stream..." : "Run Synthetic Simulation"}
            </button>
          </form>
        </div>

        {/* Right Panel: Output & Graph */}
        <div className="lg:col-span-7 bg-surface-white rounded-3xl p-6 md:p-8 border border-outline-variant/30 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
            <h2 className="font-headline-md text-headline-md font-bold text-primary">Simulation Trajectory & CUSUM Response</h2>
            {result && (
              <span className="px-3 py-0.5 rounded-full bg-coral-subtle text-secondary font-mono text-xs font-bold">
                Generated {result.total_generated || (result.data?.length ?? result.sample_records?.length ?? form.n_samples)} Samples
              </span>
            )}
          </div>

          {result ? (() => {
            const chartData = (result.data || result.sample_records || []).map((row: any, idx: number) => ({
              ...row,
              step: row.step ?? row.timestep ?? idx,
            }));

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30">
                    <span className="text-[10px] font-label-caps text-on-surface-variant font-bold">Injected Parameter</span>
                    <div className="text-sm font-semibold text-primary mt-0.5">{form.target_parameter}</div>
                  </div>
                  <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30">
                    <span className="text-[10px] font-label-caps text-on-surface-variant font-bold">Drift Model</span>
                    <div className="text-sm font-semibold text-secondary mt-0.5 capitalize">{form.drift_type}</div>
                  </div>
                  <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30">
                    <span className="text-[10px] font-label-caps text-on-surface-variant font-bold">CUSUM Trigger</span>
                    <div className="text-sm font-semibold text-emerald-700 mt-0.5">
                      {form.drift_type === "none" ? "None (Within Limits)" : `Step ${form.drift_onset + 18}`}
                    </div>
                  </div>
                </div>

                {result.summary && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30">
                      <span className="text-[10px] font-label-caps text-on-surface-variant font-bold">Simulated Scrap</span>
                      <div className="text-sm font-bold text-red-600 mt-0.5">
                        {result.summary.failures} wafers ({result.summary.failure_rate}%)
                      </div>
                    </div>
                    <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30">
                      <span className="text-[10px] font-label-caps text-on-surface-variant font-bold">Impact Cost</span>
                      <div className="text-sm font-bold text-primary mt-0.5">
                        ${result.summary.total_cost?.toLocaleString()}
                      </div>
                    </div>
                    <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30">
                      <span className="text-[10px] font-label-caps text-on-surface-variant font-bold">Energy Loss</span>
                      <div className="text-sm font-bold text-amber-700 mt-0.5">
                        {result.summary.total_energy_loss} kWh
                      </div>
                    </div>
                    <div className="p-3 rounded-2xl bg-surface-container-low border border-outline-variant/30">
                      <span className="text-[10px] font-label-caps text-on-surface-variant font-bold">Carbon Footprint</span>
                      <div className="text-sm font-bold text-emerald-700 mt-0.5">
                        {result.summary.total_co2} kg CO₂
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-surface-container-lowest p-2 rounded-2xl border border-outline-variant/20">
                  <TrendChart 
                    data={chartData}
                    xKey="step"
                    yKey={form.target_parameter}
                    target={0.0}
                    upperLimit={2.0}
                    lowerLimit={-2.0}
                    color="var(--accent-primary)"
                    height={300}
                  />
                </div>
              </div>
            );
          })() : (
            <div className="py-20 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[48px] text-outline-variant mb-2 block">science</span>
              Configure simulation parameters and click <strong>"Run Synthetic Simulation"</strong> to evaluate drift detection latency.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
