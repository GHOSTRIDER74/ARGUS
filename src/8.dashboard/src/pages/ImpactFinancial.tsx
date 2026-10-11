import { useEffect, useState } from "react";
import { api } from "../services/api";
import { formatCurrency, formatNumber } from "../lib/utils";
import { TrendChart } from "../components/TrendChart";
import { AnimatedNumber } from "../components/AnimatedNumber";

export function ImpactFinancial() {
  const [aggregate, setAggregate] = useState<any>(null);
  const [timeseries, setTimeseries] = useState<any[]>([]);

  useEffect(() => {
    api.getImpactAggregate().then(setAggregate);
    api.getImpactTimeseries().then(setTimeseries);
  }, []);

  if (!aggregate) return <div className="loading-state"><div className="loading-spinner" /></div>;

  return (
    <div>
      <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-cost)' }}>
          <div className="metric-card-label">Total Impact Cost</div>
          <div className="metric-card-value" style={{ color: 'var(--color-cost)' }}>
            <AnimatedNumber value={aggregate.total_impact_cost || 0} formatFn={formatCurrency} />
          </div>
          <div className="text-xs text-gray-500 mt-2 font-mono">Avg: {formatCurrency(aggregate.avg_impact_cost || 0)}</div>
        </div>
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-scrap)' }}>
          <div className="metric-card-label">Scrap Cost</div>
          <div className="metric-card-value" style={{ color: 'var(--color-scrap)' }}>
            <AnimatedNumber value={aggregate.total_scrap_cost || 0} formatFn={formatCurrency} />
          </div>
          <div className="text-xs text-gray-500 mt-2 font-mono">Events: {aggregate.scrap_events || 0}</div>
        </div>
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-energy)' }}>
          <div className="metric-card-label">Operational Energy Cost</div>
          <div className="metric-card-value" style={{ color: 'var(--color-energy)' }}>
            <AnimatedNumber value={aggregate.total_operational_cost || 0} formatFn={formatCurrency} />
          </div>
          <div className="text-xs text-gray-500 mt-2 font-mono">@ $0.15/kWh</div>
        </div>
        <div className="metric-card" style={{ borderTop: '3px solid var(--color-yield)' }}>
          <div className="metric-card-label">Yield Rate</div>
          <div className="metric-card-value" style={{ color: 'var(--color-yield)' }}>
            <AnimatedNumber value={aggregate.yield_rate || 0} />%
          </div>
          <div className="text-xs text-gray-500 mt-2 font-mono">Failures: {aggregate.total_failures || 0}</div>
        </div>
      </div>

      <div className="panel full-width">
        <div className="panel-header">
          <h2 className="panel-title">Rolling Financial Impact (50-Unit Windows)</h2>
        </div>
        <TrendChart 
          data={timeseries}
          xKey="index"
          yKey="total_cost"
          color="var(--color-cost)"
          height={400}
        />
      </div>
    </div>
  );
}
