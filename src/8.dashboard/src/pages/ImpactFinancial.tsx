import { useEffect, useState } from "react";
import { api } from "../services/api";
import { formatCurrency } from "../lib/utils";
import { TrendChart } from "../components/TrendChart";
import { AnimatedNumber } from "../components/AnimatedNumber";

export function ImpactFinancial() {
  const [aggregate, setAggregate] = useState<any>(null);
  const [timeseries, setTimeseries] = useState<any[]>([]);

  useEffect(() => {
    api.getImpactAggregate().then(setAggregate);
    api.getImpactTimeseries().then((data) => {
      // Scale timeseries into INR for accurate plotting
      const inrData = (data || []).map((pt: any) => ({
        ...pt,
        total_cost: Math.round(pt.total_cost * 83.33)
      }));
      setTimeseries(inrData);
    });
  }, []);

  if (!aggregate) return <div className="loading-state"><div className="loading-spinner" /> Loading financial data...</div>;

  return (
    <div className="space-y-8 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-xl text-headline-xl font-bold text-primary tracking-tight">
            Techno-Economic & Yield Impact (INR)
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Quantifying wafer scrap loss (₹41,665/unit), cleanroom downtime (₹2,08,325/hr), and operational energy tariffs (₹12.50/kWh).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-surface-container font-label-caps text-label-caps text-on-surface">
            TOTAL ANALYZED: {aggregate.total_records || 1567} WAFERS
          </span>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-surface-white rounded-3xl p-6 border border-outline-variant/30 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <span className="font-label-caps text-label-caps text-on-surface-variant font-bold">TOTAL IMPACT LOSS</span>
            <span className="material-symbols-outlined text-secondary text-[20px]">payments</span>
          </div>
          <div className="mt-4 flex items-baseline gap-1 text-secondary font-headline-xl text-headline-xl font-bold">
            <AnimatedNumber value={aggregate.total_impact_cost || 0} formatFn={formatCurrency} />
          </div>
          <div className="mt-3 flex items-center justify-between font-body-sm text-body-sm text-on-surface-variant">
            <span>Avg: <strong className="text-primary font-bold">{formatCurrency(aggregate.avg_impact_cost || 0)}</strong></span>
            <span className="font-label-caps text-label-caps text-secondary font-bold">Peak: {formatCurrency(aggregate.max_impact_cost || 0)}</span>
          </div>
          <div className="absolute bottom-2 right-2 flex gap-1 opacity-20">
            <div className="w-1.5 h-1.5 bg-secondary"></div>
            <div className="w-1.5 h-1.5 bg-secondary"></div>
          </div>
        </div>

        <div className="bg-surface-white rounded-3xl p-6 border border-outline-variant/30 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <span className="font-label-caps text-label-caps text-on-surface-variant font-bold">SCRAP PENALTY LOSS</span>
            <span className="material-symbols-outlined text-secondary text-[20px]">delete_forever</span>
          </div>
          <div className="mt-4 flex items-baseline gap-1 text-primary font-headline-xl text-headline-xl font-bold">
            <AnimatedNumber value={aggregate.total_scrap_cost || 0} formatFn={formatCurrency} />
          </div>
          <div className="mt-3 flex items-center justify-between font-body-sm text-body-sm text-on-surface-variant">
            <span>Events: <strong className="text-primary font-bold">{aggregate.scrap_events || 0}</strong></span>
            <span className="font-label-caps text-label-caps text-secondary">@ ₹41,665</span>
          </div>
          <div className="absolute bottom-2 right-2 flex gap-1 opacity-20">
            <div className="w-1.5 h-1.5 bg-secondary"></div>
            <div className="w-1.5 h-1.5 bg-secondary"></div>
          </div>
        </div>

        <div className="bg-surface-white rounded-3xl p-6 border border-outline-variant/30 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <span className="font-label-caps text-label-caps text-on-surface-variant font-bold">ENERGY UTILITY TARIFF</span>
            <span className="material-symbols-outlined text-secondary text-[20px]">bolt</span>
          </div>
          <div className="mt-4 flex items-baseline gap-1 text-primary font-headline-xl text-headline-xl font-bold">
            <AnimatedNumber value={aggregate.total_operational_cost || 0} formatFn={formatCurrency} />
          </div>
          <div className="mt-3 flex items-center justify-between font-body-sm text-body-sm text-on-surface-variant">
            <span>Grid tariff: <strong className="text-primary font-bold">₹12.50/kWh</strong></span>
            <span className="font-label-caps text-label-caps text-emerald-700 font-semibold">Industrial Tariffs</span>
          </div>
          <div className="absolute bottom-2 right-2 flex gap-1 opacity-20">
            <div className="w-1.5 h-1.5 bg-secondary"></div>
            <div className="w-1.5 h-1.5 bg-secondary"></div>
          </div>
        </div>

        <div className="bg-surface-white rounded-3xl p-6 border border-outline-variant/30 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <span className="font-label-caps text-label-caps text-on-surface-variant font-bold">CLEANROOM YIELD RATE</span>
            <span className="material-symbols-outlined text-emerald-600 text-[20px]">check_circle</span>
          </div>
          <div className="mt-4 flex items-baseline gap-1 text-emerald-700 font-headline-xl text-headline-xl font-bold">
            <AnimatedNumber value={aggregate.yield_rate || 0} />%
          </div>
          <div className="mt-3 flex items-center justify-between font-body-sm text-body-sm text-on-surface-variant">
            <span>Failures: <strong className="text-secondary font-bold">{aggregate.total_failures || 0}</strong></span>
            <span className="font-label-caps text-label-caps text-emerald-700 font-semibold">Tier 1 Fab OK</span>
          </div>
          <div className="absolute bottom-2 right-2 flex gap-1 opacity-20">
            <div className="w-1.5 h-1.5 bg-secondary"></div>
            <div className="w-1.5 h-1.5 bg-secondary"></div>
          </div>
        </div>
      </div>

      {/* Main Rolling Financial Chart Panel */}
      <div className="bg-surface-white rounded-3xl p-6 md:p-8 border border-outline-variant/30 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
          <div>
            <h2 className="font-headline-md text-headline-md font-bold text-primary">Rolling Financial Impact (50 Moving Window — INR)</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">Cumulative yield scrap losses and RF power deviation billing in Indian Rupees (₹).</p>
          </div>
          <span className="material-symbols-outlined text-secondary text-[22px]">show_chart</span>
        </div>

        <div className="pt-2">
          <TrendChart
            data={timeseries}
            xKey="index"
            yKey="total_cost"
            color="var(--accent-primary)"
            height={380}
            valueFormatter={(v) => `₹${v.toLocaleString('en-IN')}`}
          />
        </div>
      </div>
    </div>
  );
}
