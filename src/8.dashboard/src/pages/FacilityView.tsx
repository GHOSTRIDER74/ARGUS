import { useEffect, useState } from "react";
import { api } from "../services/api";
import { StatusBadge } from "../components/StatusBadge";
import { RadialGauge } from "../components/RadialGauge";

export function FacilityView() {
  const [facility, setFacility] = useState<any>(null);

  useEffect(() => {
    api.getFacility().then(setFacility);
  }, []);

  if (!facility) return <div className="loading-state"><div className="loading-spinner" /></div>;

  return (
    <div>
      <div className="page-grid-2">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Facility Overall Health</h2>
              <div className="panel-subtitle">Aggregated status of all production lines</div>
            </div>
            <StatusBadge status={facility.overall_health} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', margin: '40px 0' }}>
            <RadialGauge 
              value={facility.healthy / facility.total_machines} 
              label="Healthy Machines" 
              size={200}
              strokeWidth={16}
              color="var(--status-healthy)"
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
            <div>
              <div className="text-3xl font-bold font-mono">{facility.total_machines}</div>
              <div className="text-xs uppercase text-gray-500 mt-1">Total</div>
            </div>
            <div>
              <div className="text-3xl font-bold font-mono text-green-600">{facility.healthy}</div>
              <div className="text-xs uppercase text-gray-500 mt-1">Healthy</div>
            </div>
            <div>
              <div className="text-3xl font-bold font-mono text-yellow-600">{facility.warning}</div>
              <div className="text-xs uppercase text-gray-500 mt-1">Warning</div>
            </div>
            <div>
              <div className="text-3xl font-bold font-mono text-red-600">{facility.critical}</div>
              <div className="text-xs uppercase text-gray-500 mt-1">Critical</div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">Production Flow Map</h2>
          </div>
          <div style={{ 
            height: '400px', 
            background: 'var(--bg-input)', 
            borderRadius: 'var(--radius-md)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            border: '1px dashed var(--border-medium)',
            flexDirection: 'column'
          }}>
            <MapIcon className="w-16 h-16 text-gray-400 mb-4 opacity-50" />
            <div className="text-sm text-gray-500">2D/3D Process Flow Diagram</div>
            <div className="text-xs text-gray-400 mt-2">Interactive visualization placeholder</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple icon placeholder
function MapIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>
  );
}
