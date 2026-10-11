import { useEffect, useState } from "react";
import { api } from "../services/api";
import { formatCurrency, formatNumber } from "../lib/utils";
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
    <div className="page-grid-2">
      <div className="panel" style={{ alignSelf: 'start' }}>
        <div className="panel-header">
          <h2 className="panel-title">Configure Scenario</h2>
          <div className="text-xs text-gray-500">Inject synthetic drift</div>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Simulation Length (Samples)</label>
            <input type="number" className="form-input" name="n_samples" value={form.n_samples} onChange={handleInputChange} min={100} max={5000} />
          </div>
          
          <div className="form-group">
            <label className="form-label">Target Parameter</label>
            <select className="form-select" name="target_parameter" value={form.target_parameter} onChange={handleInputChange}>
              {params?.parameters.map((p: any) => (
                <option key={p.name} value={p.name}>{p.name} ({p.unit})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div className="form-group">
              <label className="form-label">Drift Type</label>
              <select className="form-select" name="drift_type" value={form.drift_type} onChange={handleInputChange}>
                {params?.drift_types.map((d: any) => (
                  <option key={d} value={d} className="capitalize">{d}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Direction</label>
              <select className="form-select" name="drift_direction" value={form.drift_direction} onChange={handleInputChange}>
                <option value="positive">Positive (+)</option>
                <option value="negative">Negative (-)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div className="form-group">
              <label className="form-label">Onset Timestep</label>
              <input type="number" className="form-input" name="drift_onset" value={form.drift_onset} onChange={handleInputChange} min={0} />
            </div>
            <div className="form-group">
              <label className="form-label">Magnitude / Rate</label>
              <input type="number" className="form-input" name="drift_magnitude" value={form.drift_magnitude} onChange={handleInputChange} step={0.01} />
            </div>
          </div>

          <button type="submit" className="btn btn-primary w-full mt-4" disabled={loading}>
            {loading ? 'Generating...' : 'Generate Synthetic Run'}
          </button>
        </form>
      </div>

      <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="panel-header">
          <h2 className="panel-title">Simulation Results</h2>
        </div>
        
        {result ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div className="text-xs text-gray-500 uppercase mb-1">Failure Rate</div>
                <div className="text-2xl font-bold font-mono text-red-600">{result.summary.failure_rate}%</div>
                <div className="text-xs text-gray-400 mt-1">{result.summary.failures} defects</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div className="text-xs text-gray-500 uppercase mb-1">Total Impact Cost</div>
                <div className="text-2xl font-bold font-mono text-red-600">{formatCurrency(result.summary.total_cost)}</div>
                <div className="text-xs text-gray-400 mt-1">Scrap + Energy</div>
              </div>
            </div>

            <div className="flex-1 min-h-[300px]">
              <div className="text-sm font-semibold mb-2 text-gray-700">Synthetic Telemetry ({form.target_parameter})</div>
              <TrendChart 
                data={result.sample_records}
                xKey="timestep"
                yKey={form.target_parameter}
                color={form.drift_type === 'none' ? 'var(--status-healthy)' : 'var(--status-warning)'}
                height={300}
              />
              <div className="text-xs text-gray-400 text-center mt-2">Showing first 200 samples</div>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">🧪</div>
            Configure and generate a scenario to view results
          </div>
        )}
      </div>
    </div>
  );
}
