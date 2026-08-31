import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BrainCircuit,
  ChevronRight,
  Cpu,
  Database,
  Eye,
  Sliders,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { getHealth } from "../services/api";

const NAV_SECTIONS = [
  {
    label: "Monitor",
    items: [
      { to: "/app/digital-twin",   label: "Digital Twin",            icon: <Cpu className="w-4 h-4" /> },
      { to: "/app/facility",       label: "Real-Time Facility View", icon: <Eye className="w-4 h-4" /> },
      { to: "/app/drift-events",   label: "Drift Events",            icon: <AlertTriangle className="w-4 h-4" /> },
    ],
  },
  {
    label: "Analyze",
    items: [
      { to: "/app/impact",         label: "Impact Analysis",         icon: <BarChart3 className="w-4 h-4" /> },
      { to: "/app/models",         label: "Drift Models",           icon: <BrainCircuit className="w-4 h-4" /> },
    ],
  },
  {
    label: "Data",
    items: [
      { to: "/app/datasets",       label: "Datasets",               icon: <Database className="w-4 h-4" /> },
      { to: "/app/simulate",       label: "Generate Data",          icon: <Sliders className="w-4 h-4" /> },
    ],
  },
];

export default function Sidebar() {
  const [apiUp, setApiUp] = useState<boolean | null>(null);

  useEffect(() => {
    getHealth()
      .then((r) => setApiUp(r.data.status === "ok"))
      .catch(() => setApiUp(false));
    const interval = setInterval(() => {
      getHealth()
        .then((r) => setApiUp(r.data.status === "ok"))
        .catch(() => setApiUp(false));
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 flex flex-col bg-white border-r border-slate-200"
      style={{
        width: "var(--sidebar-width)",
      }}
    >
      {/* Brand Logo */}
      <div className="flex items-center gap-2.5 px-5 h-14 flex-shrink-0 border-b border-slate-100">
        <div className="h-7 w-7 rounded-lg bg-[#4361EE] flex items-center justify-center text-white">
          <Activity className="w-4 h-4 stroke-[2.2]" />
        </div>
        <span className="font-extrabold tracking-wider uppercase text-base text-[#0F1115]">
          ARGUS
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-6" aria-label="Dashboard navigation">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {section.label}
            </p>
            <div className="space-y-1">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `sidebar-link group ${isActive ? "active" : ""}`}
                  id={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <span className="transition-colors">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-40 transition-opacity" />
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 flex-shrink-0 border-t border-slate-100 bg-slate-50/50">
        <NavLink
          to="/"
          className="flex items-center gap-2 text-xs text-[#5A5F6B] hover:text-[#0F1115] mb-3 transition-colors font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Overview
        </NavLink>
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full flex-shrink-0"
            style={{
              background: apiUp === null ? "#8C919E" : apiUp ? "#16A34A" : "#DC2626",
              boxShadow: apiUp === true ? "0 0 0 3px rgba(22,163,74,0.15)" : apiUp === false ? "0 0 0 3px rgba(220,38,38,0.15)" : "none",
              transition: "background 300ms ease, box-shadow 300ms ease",
            }}
          />
          <span className="text-[11px] font-mono text-slate-500">
            {apiUp === null ? "Connecting…" : apiUp ? "API System Online" : "API Offline"}
          </span>
        </div>
      </div>
    </aside>
  );
}
