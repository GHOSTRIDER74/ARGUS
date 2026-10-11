import { useEffect, useState } from "react";
import { api } from "../services/api";
import { RadialGauge } from "../components/RadialGauge";
import { StatusBadge } from "../components/StatusBadge";
import { AnimatedNumber } from "../components/AnimatedNumber";

export function DigitalTwin() {
  const [machines, setMachines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTwinState = async () => {
    try {
      const res = await api.getMachines();
      setMachines(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTwinState();
    const interval = setInterval(async () => {
      try {
        await api.ingestToTwin(10);
        fetchTwinState();
      } catch(e) {}
    }, 250);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="loading-state"><div className="loading-spinner" /> Loading twin state...</div>;
  }

  return (
    <div>
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-card-label">Active Machines</div>
          <div className="metric-card-value">{machines.length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-card-label">Healthy</div>
          <div className="metric-card-value">{machines.filter(m => m.health === 'healthy').length}</div>
        </div>
        <div className="metric-card">
          <div className="metric-card-label">Critical</div>
          <div className="metric-card-value text-red-500">{machines.filter(m => m.health === 'critical').length}</div>
        </div>
      </div>

      <div className="machine-grid">
        {machines.map((machine) => (
          <div key={machine.machine_id} className={`machine-card ${machine.health}`}>
            <div className="machine-card-header">
              <div>
                <div className="machine-card-id">{machine.machine_id}</div>
                <div className="machine-card-stage">{machine.stage}</div>
              </div>
              <StatusBadge status={machine.health} />
            </div>

            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
              <RadialGauge 
                value={machine.drift_severity} 
                label="Drift Score" 
                size={90} 
                strokeWidth={8}
                color={machine.health === 'critical' ? 'var(--status-critical)' : machine.health === 'warning' ? 'var(--status-warning)' : 'var(--status-healthy)'}
              />
              <div style={{ flex: 1 }}>
                <div className="text-sm font-semibold mb-2">Details</div>
                <div className="text-xs text-gray-500 mb-1">Pattern: {machine.drift_pattern}</div>
                <div className="text-xs text-gray-500 mb-1">Severity: {(machine.drift_severity * 100).toFixed(0)}%</div>
                <div className="text-xs text-gray-500 mb-1">Processed: <AnimatedNumber value={machine.records_processed} /> rows</div>
              </div>
            </div>

            <div className="machine-card-params">
              {Object.entries(machine.parameters).slice(0, 4).map(([key, value]) => (
                <div key={key} className="machine-param">
                  <div className="machine-param-label">{key.replace(/_/g, ' ')}</div>
                  <div className="machine-param-value">
                    <AnimatedNumber value={value as number} formatFn={(v) => v.toFixed(4)} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
