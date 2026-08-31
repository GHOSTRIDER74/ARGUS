import { Navigate, Route, Routes } from "react-router-dom";
import DashboardLayout from "./components/DashboardLayout";
import SmoothScroll from "./components/SmoothScroll";
import DatasetDetailPage from "./pages/DatasetDetailPage";
import DatasetsPage from "./pages/DatasetsPage";
import DigitalTwinPage from "./pages/DigitalTwinPage";
import DriftEventDetailPage from "./pages/DriftEventDetailPage";
import DriftEventsPage from "./pages/DriftEventsPage";
import FacilityViewPage from "./pages/FacilityViewPage";
import FinancialImpactPage from "./pages/FinancialImpactPage";
import LandingPage from "./pages/LandingPage";
import ModelsPage from "./pages/ModelsPage";
import OperationalImpactPage from "./pages/OperationalImpactPage";
import SimulationPage from "./pages/SimulationPage";

export default function App() {
  return (
    <>
      <SmoothScroll />
      <Routes>
        {/* ── Landing Page (Standalone entry point with Lenis inertia) ──── */}
        <Route path="/" element={<LandingPage />} />

        {/* ── Dashboard (Wrapped in DashboardLayout with Sidebar) ─────── */}
        <Route
          path="/app/*"
          element={
            <DashboardLayout>
              <Routes>
                <Route path="digital-twin" element={<DigitalTwinPage />} />
                <Route path="facility" element={<FacilityViewPage />} />
                <Route path="drift-events" element={<DriftEventsPage />} />
                <Route path="drift-events/:id" element={<DriftEventDetailPage />} />
                <Route path="impact" element={<OperationalImpactPage />} />
                <Route path="impact/:id" element={<FinancialImpactPage />} />
                <Route path="models" element={<ModelsPage />} />
                <Route path="datasets" element={<DatasetsPage />} />
                <Route path="datasets/:id" element={<DatasetDetailPage />} />
                <Route path="simulate" element={<SimulationPage />} />
                <Route path="*" element={<Navigate to="/app/digital-twin" replace />} />
              </Routes>
            </DashboardLayout>
          }
        />

        {/* Legacy route redirects */}
        <Route path="/digital-twin" element={<Navigate to="/app/digital-twin" replace />} />
        <Route path="/facility" element={<Navigate to="/app/facility" replace />} />
        <Route path="/drift-events" element={<Navigate to="/app/drift-events" replace />} />
        <Route path="/drift-events/:id" element={<Navigate to="/app/drift-events/:id" replace />} />
        <Route path="/impact" element={<Navigate to="/app/impact" replace />} />
        <Route path="/impact/:id" element={<Navigate to="/app/impact/:id" replace />} />
        <Route path="/models" element={<Navigate to="/app/models" replace />} />
        <Route path="/datasets" element={<Navigate to="/app/datasets" replace />} />
        <Route path="/simulate" element={<Navigate to="/app/simulate" replace />} />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
