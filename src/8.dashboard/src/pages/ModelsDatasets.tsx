import { useEffect, useState } from "react";
import { api } from "../services/api";
import { formatNumber } from "../lib/utils";

export function ModelsDatasets() {
  const [info, setInfo] = useState<any>(null);

  useEffect(() => {
    api.getDatasetInfo().then(setInfo);
  }, []);

  if (!info) return <div className="loading-state"><div className="loading-spinner" /> Loading dataset schema...</div>;

  return (
    <div className="space-y-8 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-xl text-headline-xl font-bold text-primary tracking-tight">
            Datasets & ML Models Catalog
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            SECOM cleanroom high-dimensional wafer fabrication telemetry schema and statistical baseline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-coral-subtle text-secondary font-label-caps text-label-caps font-bold">
            HIGH-DIMENSIONAL REGIME (p ≫ n)
          </span>
        </div>
      </div>

      {/* 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-surface-white rounded-3xl p-6 border border-outline-variant/30 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <span className="font-label-caps text-label-caps text-on-surface-variant font-bold">SECOM SAMPLES</span>
            <span className="material-symbols-outlined text-secondary text-[20px]">database</span>
          </div>
          <div className="mt-4 flex items-baseline gap-1 text-primary font-headline-xl text-headline-xl font-bold">
            {formatNumber(info.total_records, 0)}
          </div>
          <div className="mt-3 flex items-center justify-between font-body-sm text-body-sm text-on-surface-variant">
            <span>Wafer runs</span>
            <span className="font-label-caps text-label-caps text-emerald-700 font-bold">100% Ingested</span>
          </div>
          <div className="absolute bottom-2 right-2 flex gap-1 opacity-20">
            <div className="w-1.5 h-1.5 bg-secondary"></div>
            <div className="w-1.5 h-1.5 bg-secondary"></div>
          </div>
        </div>

        <div className="bg-surface-white rounded-3xl p-6 border border-outline-variant/30 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <span className="font-label-caps text-label-caps text-on-surface-variant font-bold">ACTIVE SENSORS</span>
            <span className="material-symbols-outlined text-secondary text-[20px]">sensors</span>
          </div>
          <div className="mt-4 flex items-baseline gap-1 text-primary font-headline-xl text-headline-xl font-bold">
            {info.columns_count}
          </div>
          <div className="mt-3 flex items-center justify-between font-body-sm text-body-sm text-on-surface-variant">
            <span>Pruned from 590 raw</span>
            <span className="font-label-caps text-label-caps text-secondary font-bold">Top 20 Mapped</span>
          </div>
          <div className="absolute bottom-2 right-2 flex gap-1 opacity-20">
            <div className="w-1.5 h-1.5 bg-secondary"></div>
            <div className="w-1.5 h-1.5 bg-secondary"></div>
          </div>
        </div>

        <div className="bg-surface-white rounded-3xl p-6 border border-outline-variant/30 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <span className="font-label-caps text-label-caps text-on-surface-variant font-bold">DATA COMPLETENESS</span>
            <span className="material-symbols-outlined text-secondary text-[20px]">fact_check</span>
          </div>
          <div className="mt-4 flex items-baseline gap-1 text-emerald-700 font-headline-xl text-headline-xl font-bold">
            {info.quality?.completeness || 100}%
          </div>
          <div className="mt-3 flex items-center justify-between font-body-sm text-body-sm text-on-surface-variant">
            <span>Forward-fill + Median</span>
            <span className="font-label-caps text-label-caps text-emerald-700 font-bold">Zero NaNs</span>
          </div>
          <div className="absolute bottom-2 right-2 flex gap-1 opacity-20">
            <div className="w-1.5 h-1.5 bg-secondary"></div>
            <div className="w-1.5 h-1.5 bg-secondary"></div>
          </div>
        </div>

        <div className="bg-surface-white rounded-3xl p-6 border border-outline-variant/30 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <span className="font-label-caps text-label-caps text-on-surface-variant font-bold">CLEANROOM FAILURE RATE</span>
            <span className="material-symbols-outlined text-secondary text-[20px]">warning</span>
          </div>
          <div className="mt-4 flex items-baseline gap-1 text-secondary font-headline-xl text-headline-xl font-bold">
            {(info.failure_rate * 100).toFixed(2)}%
          </div>
          <div className="mt-3 flex items-center justify-between font-body-sm text-body-sm text-on-surface-variant">
            <span>104 defective / 1,567</span>
            <span className="font-label-caps text-label-caps text-secondary font-bold">Rare Defect Rate</span>
          </div>
          <div className="absolute bottom-2 right-2 flex gap-1 opacity-20">
            <div className="w-1.5 h-1.5 bg-secondary"></div>
            <div className="w-1.5 h-1.5 bg-secondary"></div>
          </div>
        </div>
      </div>

      {/* Primary Pipeline Specification Card */}
      <div className="bg-surface-white rounded-3xl p-6 md:p-8 border border-outline-variant/30 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
          <div>
            <span className="font-label-caps text-label-caps text-secondary font-bold">PRIMARY PIPELINE DATASET</span>
            <h2 className="font-headline-md text-headline-md font-bold text-primary">UCI SECOM Dataset Overview</h2>
          </div>
          <span className="material-symbols-outlined text-secondary text-[24px]">memory</span>
        </div>
        <p className="text-body-sm text-on-surface-variant leading-relaxed">
          Collected by McCann et al. from an operational semiconductor cleanroom. Contains 1,567 wafer runs across 590 physical process sensors tracking plasma RF power, gas flows, optical alignment overlay, and chemical polishing. Used for cross-tool digital twin orchestration, CUSUM change-point drift detection, and dynamic LCA energy modeling.
        </p>
        <div className="p-3 bg-surface-container-low rounded-2xl font-mono text-xs flex justify-between">
          <span>Cleaned Shape: (1567, 450)</span>
          <span className="text-emerald-700 font-bold">Standard Cleanroom Benchmark</span>
        </div>
      </div>

      {/* Schema Table */}
      <div className="bg-surface-white rounded-3xl p-6 md:p-8 border border-outline-variant/30 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
          <div>
            <h2 className="font-headline-md text-headline-md font-bold text-primary">Cleanroom Sensor Telemetry Schema</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">Top continuous sensors mapped to physical semiconductor equipment.</p>
          </div>
          <span className="material-symbols-outlined text-secondary text-[22px]">table_chart</span>
        </div>

        <div className="overflow-x-auto max-h-[460px]">
          <table className="w-full text-left font-body-sm text-body-sm">
            <thead>
              <tr className="border-b border-outline-variant/30 font-label-caps text-label-caps text-on-surface-variant">
                <th className="py-2.5 px-3">SENSOR NAME</th>
                <th className="py-2.5 px-3">DATA TYPE</th>
                <th className="py-2.5 px-3">NULL %</th>
                <th className="py-2.5 px-3">MEAN</th>
                <th className="py-2.5 px-3">STD DEV</th>
                <th className="py-2.5 px-3">MIN</th>
                <th className="py-2.5 px-3">MAX</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20 font-mono text-[12px]">
              {info.columns?.slice(0, 30).map((col: any) => (
                <tr key={col.name} className="hover:bg-surface-container-low transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-primary">{col.name}</td>
                  <td className="py-2.5 px-3 text-on-surface-variant">{col.dtype}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                      {col.null_pct}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-on-surface">{col.mean !== null ? col.mean : '-'}</td>
                  <td className="py-2.5 px-3 text-on-surface">{col.std !== null ? col.std : '-'}</td>
                  <td className="py-2.5 px-3 text-on-surface">{col.min !== null ? col.min : '-'}</td>
                  <td className="py-2.5 px-3 text-on-surface">{col.max !== null ? col.max : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
