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

  if (!summary) return <div className="loading-state"><div className="loading-spinner" /> Loading LCA footprint data...</div>;

  const currentEff = efficiency.length > 0 ? efficiency[efficiency.length - 1].avg_efficiency : 0;

  return (
    <div className="space-y-8 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-xl text-headline-xl font-bold text-primary tracking-tight">
            Dynamic LCA & Carbon Tracker
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Tracking energy loss (kWh) from RF power deviations and translating into CO₂ emissions (0.42 kg/kWh).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-surface-container font-label-caps text-label-caps text-on-surface">
            EPA Grid Factor: 0.42 kg CO₂/kWh
          </span>
        </div>
      </div>

      {/* Top 3 Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Radial Efficiency Gauge Card */}
        <div className="bg-surface-white rounded-3xl p-6 md:p-8 border border-outline-variant/30 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] flex flex-col items-center justify-center text-center">
          <RadialGauge
            value={currentEff}
            label="Current Energy Efficiency"
            size={180}
            strokeWidth={14}
            color={currentEff >= 0.90 ? '#10B981' : '#FB8D7E'}
          />
          <div className="text-sm text-on-surface-variant mt-4">
            Baseline: <strong className="text-primary font-bold">{(summary.avg_efficiency * 100).toFixed(1)}%</strong> <br />
            Cleanroom Fab Target: <strong className="text-primary font-bold">95.0%</strong>
          </div>
        </div>

        {/* Total Energy Loss Card */}
        <div className="bg-surface-white rounded-3xl p-6 md:p-8 border border-outline-variant/30 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="font-label-caps text-label-caps text-on-surface-variant font-bold">CUMULATIVE ENERGY LOSS</span>
            <span className="material-symbols-outlined text-secondary text-[20px]">bolt</span>
          </div>
          <div className="my-4">
            <div className="font-headline-xl text-headline-xl font-bold text-secondary">
              <AnimatedNumber value={summary.total_energy_loss_kwh || 0} formatFn={v => formatNumber(v, 2)} />
            </div>
            <span className="text-sm font-label-caps text-on-surface-variant">kWh Lost</span>
          </div>
          <div className="pt-3 border-t border-outline-variant/20 font-mono text-xs text-on-surface-variant">
            Avg: {formatNumber(summary.avg_energy_loss_kwh || 0, 4)} kWh <br />
            Peak anomaly: {formatNumber(summary.max_energy_loss_kwh || 0, 4)} kWh
          </div>
          <div className="absolute bottom-2 right-2 flex gap-1 opacity-20">
            <div className="w-1.5 h-1.5 bg-secondary"></div>
            <div className="w-1.5 h-1.5 bg-secondary"></div>
          </div>
        </div>

        {/* Total CO2 Emissions Card */}
        <div className="bg-surface-white rounded-3xl p-6 md:p-8 border border-outline-variant/30 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="font-label-caps text-label-caps text-on-surface-variant font-bold">CLEANROOM CARBON FOOTPRINT</span>
            <span className="material-symbols-outlined text-emerald-600 text-[20px]">eco</span>
          </div>
          <div className="my-4">
            <div className="font-headline-xl text-headline-xl font-bold text-primary">
              <AnimatedNumber value={summary.total_co2_emissions_kg || 0} formatFn={v => formatNumber(v, 2)} />
            </div>
            <span className="text-sm font-label-caps text-on-surface-variant">kg CO₂ Equivalent</span>
          </div>
          <div className="pt-3 border-t border-outline-variant/20 font-mono text-xs text-on-surface-variant">
            Grid Intensity: 0.42 kg/kWh <br />
            Avg: {formatNumber(summary.avg_co2_emission_kg || 0, 4)} kg
          </div>
          <div className="absolute bottom-2 right-2 flex gap-1 opacity-20">
            <div className="w-1.5 h-1.5 bg-secondary"></div>
            <div className="w-1.5 h-1.5 bg-secondary"></div>
          </div>
        </div>
      </div>

      {/* 2 Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface-white rounded-3xl p-6 md:p-8 border border-outline-variant/30 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
            <h2 className="font-headline-md text-headline-md font-bold text-primary">Energy Loss Progression (kWh)</h2>
            <span className="material-symbols-outlined text-secondary text-[20px]">trending_up</span>
          </div>
          <TrendChart
            data={timeseries}
            xKey="index"
            yKey="energy_loss_kwh"
            color="var(--accent-primary)"
            height={280}
          />
        </div>

        <div className="bg-surface-white rounded-3xl p-6 md:p-8 border border-outline-variant/30 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
            <h2 className="font-headline-md text-headline-md font-bold text-primary">Efficiency Tracking</h2>
            <span className="material-symbols-outlined text-emerald-600 text-[20px]">verified</span>
          </div>
          <TrendChart
            data={efficiency}
            xKey="index"
            yKey="avg_efficiency"
            target={0.95}
            color="#10B981"
            height={280}
          />
        </div>
      </div>
    </div>
  );
}
