import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { LandingPage } from "./pages/LandingPage";
import { DigitalTwin } from "./pages/DigitalTwin";
import { FacilityView } from "./pages/FacilityView";
import { DriftDiagnosis } from "./pages/DriftDiagnosis";
import { ImpactFinancial } from "./pages/ImpactFinancial";
import { SustainabilityLCA } from "./pages/SustainabilityLCA";
import { ModelsDatasets } from "./pages/ModelsDatasets";
import { Simulation } from "./pages/Simulation";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        
        <Route path="/app" element={<Layout />}>
          <Route index element={<Navigate to="/app/twin" replace />} />
          <Route path="twin" element={<DigitalTwin />} />
          <Route path="facility" element={<FacilityView />} />
          <Route path="drift" element={<DriftDiagnosis />} />
          <Route path="impact" element={<ImpactFinancial />} />
          <Route path="sustainability" element={<SustainabilityLCA />} />
          <Route path="models" element={<ModelsDatasets />} />
          <Route path="simulation" element={<Simulation />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
