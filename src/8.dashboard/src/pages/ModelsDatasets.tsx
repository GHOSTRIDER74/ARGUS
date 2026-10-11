import { useEffect, useState } from "react";
import { api } from "../services/api";
import { formatNumber } from "../lib/utils";

export function ModelsDatasets() {
  const [info, setInfo] = useState<any>(null);

  useEffect(() => {
    api.getDatasetInfo().then(setInfo);
  }, []);

  if (!info) return <div className="loading-state"><div className="loading-spinner" /></div>;

  return (
    <div>
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-card-label">Total Records</div>
          <div className="metric-card-value">{formatNumber(info.total_records, 0)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-card-label">Features</div>
          <div className="metric-card-value">{info.columns_count}</div>
        </div>
        <div className="metric-card">
          <div className="metric-card-label">Data Completeness</div>
          <div className="metric-card-value">{info.quality.completeness}%</div>
        </div>
        <div className="metric-card">
          <div className="metric-card-label">Overall Failure Rate</div>
          <div className="metric-card-value text-red-500">{(info.failure_rate * 100).toFixed(2)}%</div>
        </div>
      </div>

      <div className="panel full-width">
        <div className="panel-header">
          <h2 className="panel-title">Dataset Schema & Statistics (SECOM)</h2>
          <div className="text-xs text-gray-500">Showing first 50 columns</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Column Name</th>
                <th>Type</th>
                <th>Null %</th>
                <th>Mean</th>
                <th>Std Dev</th>
                <th>Min</th>
                <th>Max</th>
              </tr>
            </thead>
            <tbody>
              {info.columns.map((col: any) => (
                <tr key={col.name}>
                  <td className="font-mono text-xs font-semibold">{col.name}</td>
                  <td className="font-mono text-xs text-gray-500">{col.dtype}</td>
                  <td>{col.null_pct}%</td>
                  <td className="font-mono text-xs">{col.mean !== null ? col.mean : '-'}</td>
                  <td className="font-mono text-xs">{col.std !== null ? col.std : '-'}</td>
                  <td className="font-mono text-xs">{col.min !== null ? col.min : '-'}</td>
                  <td className="font-mono text-xs">{col.max !== null ? col.max : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
