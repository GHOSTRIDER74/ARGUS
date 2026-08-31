import { AnimatePresence, motion } from "framer-motion";
import { type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";

function titleFor(pathname: string): { title: string; subtitle?: string } {
  if (pathname.startsWith("/app/digital-twin"))  return { title: "Digital Twin Telemetry", subtitle: "Live Machine Health & Operating Parameters" };
  if (pathname.startsWith("/app/facility"))      return { title: "Real-Time Facility View", subtitle: "Live 3D overview of monitored process stages" };
  if (pathname.startsWith("/app/drift-events/")) return { title: "Drift Event Diagnostic", subtitle: "Root-Cause Attribution & Horizon Forecast" };
  if (pathname.startsWith("/app/drift-events"))  return { title: "Detected Drift Events", subtitle: "Real-time Anomaly Detection Feed" };
  if (pathname.startsWith("/app/impact/"))       return { title: "Financial Loss Breakdown", subtitle: "Detailed Cost Analysis & Uncertainty Ranges" };
  if (pathname.startsWith("/app/impact"))        return { title: "Operational Impact Assessment", subtitle: "Yield Loss, Scrap & Rework Quantification" };
  if (pathname.startsWith("/app/models"))        return { title: "LSTM Drift Models", subtitle: "Neural Network Training & Detection Engine" };
  if (pathname.startsWith("/app/datasets/"))     return { title: "Dataset Specification", subtitle: "Schema Validation & Telemetry Summary" };
  if (pathname.startsWith("/app/datasets"))      return { title: "Sensor Datasets", subtitle: "Telemetry Data Repository & Validation" };
  if (pathname.startsWith("/app/simulate"))      return { title: "Synthetic Telemetry Generator", subtitle: "Configurable Sensor Stream & Anomaly Synthesis" };
  return { title: "ARGUS" };
}

interface Props {
  children: ReactNode;
}

export default function DashboardLayout({ children }: Props) {
  const { pathname } = useLocation();
  const { title, subtitle } = titleFor(pathname);

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar />

      <div
        className="flex flex-col flex-1 min-w-0"
        style={{ marginLeft: "var(--sidebar-width)" }}
      >
        {/* Top Header */}
        <header
          className="sticky top-0 z-30 flex items-center px-8 bg-white/90 border-b border-slate-200 backdrop-blur-md"
          style={{ height: "var(--topbar-h)" }}
        >
          <div>
            <h1 className="text-base font-bold leading-tight text-[#0F1115]">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs leading-tight mt-0.5 text-[#5A5F6B] font-normal">
                {subtitle}
              </p>
            )}
          </div>
        </header>

        {/* Main Content Area with ~200ms opacity crossfade transition */}
        <main className="flex-1 px-8 py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
