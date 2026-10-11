const API_BASE = "http://localhost:8000/api";

export const api = {
  getHealth: () => fetch(`${API_BASE}/health`).then(r => r.json()),
  
  // Twin
  getMachines: () => fetch(`${API_BASE}/twin/machines`).then(r => r.json()),
  getMachine: (id: string) => fetch(`${API_BASE}/twin/machines/${id}`).then(r => r.json()),
  getFacility: () => fetch(`${API_BASE}/twin/facility`).then(r => r.json()),
  ingestToTwin: (count: number = 1) => fetch(`${API_BASE}/twin/ingest?count=${count}`, { method: 'POST' }).then(r => r.json()),

  // Drift
  getDriftEvents: () => fetch(`${API_BASE}/drift/events`).then(r => r.json()),
  getDriftTimeseries: (param: string) => fetch(`${API_BASE}/drift/timeseries/${param}`).then(r => r.json()),

  // Impact
  getImpactAggregate: () => fetch(`${API_BASE}/impact/aggregate`).then(r => r.json()),
  getImpactTimeseries: () => fetch(`${API_BASE}/impact/timeseries?window=50`).then(r => r.json()),
  calculateImpact: (payload: any) => fetch(`${API_BASE}/impact/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(r => r.json()),

  // LCA
  getLcaSummary: () => fetch(`${API_BASE}/lca/summary`).then(r => r.json()),
  getLcaTimeseries: () => fetch(`${API_BASE}/lca/timeseries?downsample=10`).then(r => r.json()),
  getLcaEfficiency: () => fetch(`${API_BASE}/lca/efficiency?window=50`).then(r => r.json()),

  // Simulation
  getSimulationParams: () => fetch(`${API_BASE}/simulation/parameters`).then(r => r.json()),
  generateSimulation: (payload: any) => fetch(`${API_BASE}/simulation/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(r => r.json()),

  // Datasets
  getDatasetInfo: () => fetch(`${API_BASE}/dataset/info`).then(r => r.json())
};
