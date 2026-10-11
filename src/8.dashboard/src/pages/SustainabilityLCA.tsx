import { useEffect, useState } from "react";
import { api } from "../services/api";
import { formatNumber } from "../lib/utils";
import { TrendChart } from "../components/TrendChart";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { RadialGauge } from "../components/RadialGauge";

export function SustainabilityLCA() {
  const [summary, setSummary] = useState<any>(null);
  const [timeseries, setTimeseries] = useState<any[]>([]);
  const [efficiency, setEfficiency] = useState<any[]>([]);

  useEffect(() => {
    api.getLcaSummary().then(setSummary);
    api.getLcaTimeseries().then(setTimeseries);
    api.getLcaEfficiency().then(setEfficiency);
  }, []);

  if (!summary) return <div className="loading-state"><div className="loading-spinner" /></div>;

  const currentEff = efficiency.length > 0 ? efficiency[efficiency.length - 1].avg_efficiency : 0;

  return (
    <div>
      <div className="page-grid-3">
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <RadialGauge 
            value={currentEff} 
            label="Current Energy Efficiency"
            size={180}
            strokeWidth={14}
            color={currentEff >= 0.90 ? 'var(--status-healthy)' : 'var(--status-warning)'}
          />
          <div className="text-sm text-gray-500 mt-4 text-center">
            Baseline: {(summary.avg_efficiency * 100).toFixed(1)}% <br/>
            Target: 95.0%
          </div>
        </div>
        
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-energy)' }}>
          <div className="metric-card-label">Total Energy Loss</div>
          <div className="metric-card-value" style={{ color: 'var(--color-energy)' }}>
            <AnimatedNumber value={summary.total_energy_loss_kwh || 0} formatFn={v => formatNumber(v, 2)} />
          </div>
          <div className="metric-card-unit">kWh</div>
          <div className="text-xs text-gray-500 mt-4 font-mono">
            Avg/unit: {formatNumber(summary.avg_energy_loss_kwh || 0, 4)} kWh <br/>
            Peak: {formatNumber(summary.max_energy_loss_kwh || 0, 4)} kWh
          </div>
        </div>

        <div className="metric-card" style={{ borderTop: '3px solid var(--color-co2)' }}>
          <div className="metric-card-label">Total CO₂ Emissions</div>
          <div className="metric-card-value" style={{ color: 'var(--color-co2)' }}>
            <AnimatedNumber value={summary.total_co2_emissions_kg || 0} formatFn={v => formatNumber(v, 2)} />
          </div>
          <div className="metric-card-unit">kg CO₂e</div>
          <div className="text-xs text-gray-500 mt-4 font-mono">
            Grid factor: 0.42 kg/kWh <br/>
            Avg/unit: {formatNumber(summary.avg_co2_emission_kg || 0, 4)} kg
          </div>
        </div>
      </div>

      <div className="page-grid-2">
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Energy Loss (kWh)</h2>
          </div>
          <TrendChart 
            data={timeseries}
            xKey="index"
            yKey="energy_loss_kwh"
            color="var(--color-energy)"
            height={300}
          />
        </div>
        
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Efficiency vs Baseline</h2>
          </div>
          <TrendChart 
            data={efficiency}
            xKey="index"
            yKey="avg_efficiency"
            target={0.95}
            color="var(--status-healthy)"
            height={300}
          />
        </div>
      </div>
    </div>
  );
}
