import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { getHealth } from "./services/api";
import DatasetDetailPage from "./pages/DatasetDetailPage";
import DatasetsPage from "./pages/DatasetsPage";
import DigitalTwinPage from "./pages/DigitalTwinPage";
import DriftEventDetailPage from "./pages/DriftEventDetailPage";
import DriftEventsPage from "./pages/DriftEventsPage";
import FinancialImpactPage from "./pages/FinancialImpactPage";
import ModelsPage from "./pages/ModelsPage";
import OperationalImpactPage from "./pages/OperationalImpactPage";
import SimulationPage from "./pages/SimulationPage";

export default function App() {
  const [apiUp, setApiUp] = useState<boolean | null>(null);

  useEffect(() => {
    getHealth()
      .then((r) => setApiUp(r.data.status === "ok"))
      .catch(() => setApiUp(false));
  }, []);

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-md text-sm font-medium ${
      isActive ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-slate-800"
    }`;

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <span className="text-lg font-bold tracking-wide text-sky-400">ARGUS</span>
          <nav className="flex gap-2">
            <NavLink to="/" end className={navClass}>
              Datasets
            </NavLink>
            <NavLink to="/simulate" className={navClass}>
              Generate Data
            </NavLink>
            <NavLink to="/digital-twin" className={navClass}>
              Digital Twin
            </NavLink>
            <NavLink to="/drift-events" className={navClass}>
              Drift Events
            </NavLink>
            <NavLink to="/impact" className={navClass}>
              Impact
            </NavLink>
            <NavLink to="/models" className={navClass}>
              Models
            </NavLink>
          </nav>
          <span className="ml-auto flex items-center gap-2 text-xs text-slate-400">
            <span
              className={`h-2 w-2 rounded-full ${
                apiUp === null ? "bg-slate-500" : apiUp ? "bg-emerald-400" : "bg-red-500"
              }`}
            />
            {apiUp === null ? "Checking API…" : apiUp ? "API online" : "API offline"}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/" element={<DatasetsPage />} />
          <Route path="/datasets/:id" element={<DatasetDetailPage />} />
          <Route path="/simulate" element={<SimulationPage />} />
          <Route path="/digital-twin" element={<DigitalTwinPage />} />
          <Route path="/drift-events" element={<DriftEventsPage />} />
          <Route path="/drift-events/:id" element={<DriftEventDetailPage />} />
          <Route path="/impact" element={<OperationalImpactPage />} />
          <Route path="/impact/:id" element={<FinancialImpactPage />} />
          <Route path="/models" element={<ModelsPage />} />
        </Routes>
      </main>
    </div>
  );
}
