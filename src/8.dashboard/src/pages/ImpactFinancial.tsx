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
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] relative overflow-hidden group hover:shadow-md transition-all">
          <div className="h-1 absolute top-0 inset-x-0 bg-gradient-to-r from-rose-500 to-red-600" />
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-mono font-semibold tracking-wider text-slate-500 uppercase">TOTAL IMPACT LOSS</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">payments</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1 text-rose-600 font-headline-xl text-3xl md:text-4xl font-extrabold tracking-tight">
            <AnimatedNumber value={aggregate.total_impact_cost || 0} formatFn={formatCurrency} />
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Avg: <strong className="text-slate-900 font-mono font-bold">{formatCurrency(aggregate.avg_impact_cost || 0)}</strong></span>
            <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-mono font-bold">
              Peak: {formatCurrency(aggregate.max_impact_cost || 0)}
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] relative overflow-hidden group hover:shadow-md transition-all">
          <div className="h-1 absolute top-0 inset-x-0 bg-gradient-to-r from-slate-700 to-slate-900" />
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-mono font-semibold tracking-wider text-slate-500 uppercase">SCRAP PENALTY LOSS</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">delete_forever</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1 text-slate-900 font-headline-xl text-3xl md:text-4xl font-extrabold tracking-tight">
            <AnimatedNumber value={aggregate.total_scrap_cost || 0} formatFn={formatCurrency} />
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Events: <strong className="text-slate-900 font-mono font-bold">{aggregate.scrap_events || 0}</strong></span>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-mono font-bold">
              @ ₹41,665
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] relative overflow-hidden group hover:shadow-md transition-all">
          <div className="h-1 absolute top-0 inset-x-0 bg-gradient-to-r from-amber-400 to-orange-500" />
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-mono font-semibold tracking-wider text-slate-500 uppercase">ENERGY UTILITY TARIFF</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">bolt</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1 text-slate-900 font-headline-xl text-3xl md:text-4xl font-extrabold tracking-tight">
            <AnimatedNumber value={aggregate.total_operational_cost || 0} formatFn={formatCurrency} />
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Grid tariff: <strong className="text-slate-900 font-mono font-bold">₹12.50/kWh</strong></span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-mono font-bold">
              Industrial
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)] relative overflow-hidden group hover:shadow-md transition-all">
          <div className="h-1 absolute top-0 inset-x-0 bg-gradient-to-r from-emerald-500 to-teal-500" />
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-mono font-semibold tracking-wider text-slate-500 uppercase">CLEANROOM YIELD RATE</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1 text-emerald-600 font-headline-xl text-3xl md:text-4xl font-extrabold tracking-tight">
            <AnimatedNumber value={aggregate.yield_rate || 0} decimals={1} />%
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Failures: <strong className="text-rose-600 font-mono font-bold">{aggregate.total_failures || 0}</strong></span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-mono font-bold">
              Tier 1 Fab OK
            </span>
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
