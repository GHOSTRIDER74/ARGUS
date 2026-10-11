import { useEffect, useState } from "react";
import { api } from "../services/api";
import { StatusBadge } from "../components/StatusBadge";
import { TrendChart } from "../components/TrendChart";

export function DriftDiagnosis() {
  const [data, setData] = useState<any>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [chartData, setChartData] = useState<any>(null);

  useEffect(() => {
    api.getDriftEvents().then(res => {
      setData(res);
      if (res.events?.length > 0) {
        handleSelect(res.events[0]);
      }
    });
  }, []);

  const handleSelect = async (event: any) => {
    setSelectedEvent(event);
    try {
      const chartRes = await api.getDriftTimeseries(event.parameter);
      setChartData(chartRes);
    } catch (e) {
      console.error(e);
    }
  };

  if (!data) return <div className="loading-state"><div className="loading-spinner" /></div>;

  return (
    <div>
      <div className="page-grid-2">
        <div className="panel" style={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
          <div className="panel-header">
            <h2 className="panel-title">Drift Events Triage</h2>
            <div className="badge">{data.total_events} Events</div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Machine</th>
                  <th>Parameter</th>
                  <th>Severity</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((evt: any) => (
                  <tr 
                    key={evt.id} 
                    onClick={() => handleSelect(evt)}
                    style={{ 
                      cursor: 'pointer',
                      background: selectedEvent?.id === evt.id ? 'var(--bg-input)' : 'transparent',
                      borderLeft: selectedEvent?.id === evt.id ? '3px solid var(--accent-primary)' : '3px solid transparent'
                    }}
                  >
                    <td className="mono">{evt.time}</td>
                    <td>{evt.machine_id}</td>
                    <td>{evt.parameter.replace(/_/g, ' ')}</td>
                    <td><StatusBadge status={evt.severity} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel" style={{ height: '600px', display: 'flex', flexDirection: 'column' }}>
          <div className="panel-header">
            <h2 className="panel-title">Diagnosis & Telemetry</h2>
            {selectedEvent && <div className="text-xs text-gray-500 font-mono">ID: {selectedEvent.id}</div>}
          </div>
          
          {selectedEvent ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="p-3 bg-gray-50 rounded-md border border-gray-100">
                  <div className="text-xs text-gray-500 uppercase mb-1">Root Cause Parameter</div>
                  <div className="font-semibold">{selectedEvent.root_cause}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-md border border-gray-100">
                  <div className="text-xs text-gray-500 uppercase mb-1">Pattern</div>
                  <div className="font-semibold capitalize">{selectedEvent.drift_pattern} Drift</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-md border border-gray-100">
                  <div className="text-xs text-gray-500 uppercase mb-1">Mean Shift</div>
                  <div className="font-mono">{selectedEvent.mean_shift.toFixed(4)}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-md border border-gray-100">
                  <div className="text-xs text-gray-500 uppercase mb-1">Detection Confidence</div>
                  <div className="font-mono">{(selectedEvent.confidence * 100).toFixed(1)}%</div>
                </div>
              </div>

              <div style={{ flex: 1, marginTop: '20px' }}>
                <div className="text-sm font-semibold mb-2 uppercase text-gray-700">Parameter Telemetry ({chartData?.parameter})</div>
                {chartData ? (
                  <TrendChart 
                    data={chartData.data} 
                    xKey="index" 
                    yKey="value" 
                    target={chartData.target}
                    upperLimit={chartData.upper_limit}
                    lowerLimit={chartData.lower_limit}
                    height="100%"
                  />
                ) : (
                  <div className="loading-state"><div className="loading-spinner"/></div>
                )}
              </div>
            </div>
          ) : (
            <div className="empty-state">Select an event to view diagnosis details</div>
          )}
        </div>
      </div>
    </div>
  );
}
