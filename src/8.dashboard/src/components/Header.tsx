import { useLocation } from "react-router-dom";

const ROUTE_MAP: Record<string, { title: string; subtitle: string }> = {
  "/app/twin": { title: "Digital Twin", subtitle: "Real-time state and drift scoring per machine" },
  "/app/facility": { title: "Facility View", subtitle: "Fab-wide health and throughput map" },
  "/app/drift": { title: "Drift & Diagnosis", subtitle: "Root cause analysis via CUSUM and LSTM" },
  "/app/impact": { title: "Impact & Financial", subtitle: "Scrap, downtime, and operational cost estimations" },
  "/app/sustainability": { title: "Sustainability / LCA", subtitle: "Carbon footprint and energy efficiency tracking" },
  "/app/models": { title: "Models & Datasets", subtitle: "Training data schema and quality metrics" },
  "/app/simulation": { title: "Simulation", subtitle: "What-if scenario generation and drift injection" },
};

export function Header() {
  const location = useLocation();
  const current = ROUTE_MAP[location.pathname] || { title: "ARGUS Dashboard", subtitle: "Process Monitoring" };

  return (
    <header className="header">
      <h1 className="header-title">{current.title}</h1>
      <span className="header-subtitle">{current.subtitle}</span>
    </header>
  );
}
