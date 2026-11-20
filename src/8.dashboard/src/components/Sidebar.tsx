import { NavLink } from "react-router-dom";
import {
  Activity,
  Map,
  AlertTriangle,
  TrendingDown,
  Leaf,
  Database,
  PlayCircle,
  ArrowLeft
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../services/api";

export function Sidebar() {
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await api.getHealth();
        setHealth(res);
      } catch (err) {
        console.error("Health check failed", err);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="w-64 bg-[#0b0f19] text-slate-100 flex flex-col justify-between p-5 shrink-0 border-r border-slate-800/80 select-none h-screen sticky top-0 shadow-2xl">
      <div className="space-y-6">
        {/* Brand */}
        <div className="flex items-center gap-3 px-2 pt-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white font-bold shadow-lg shadow-rose-500/20">
            <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              memory
            </span>
          </div>
          <div>
            <div className="font-headline-md text-base font-extrabold text-white tracking-tight flex items-center gap-1.5">
              <span>ARGUS</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 font-mono font-bold">
                v2.4
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium">Semiconductor Fab Twin</div>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="space-y-6 text-left">
          {/* Section 1: Monitor */}
          <div>
            <div className="text-[10px] font-mono font-bold tracking-widest text-slate-400 px-3 mb-2 uppercase">
              Monitor
            </div>
            <div className="space-y-1">
              <NavLink
                to="/app/twin"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${isActive
                    ? "bg-gradient-to-r from-rose-500/15 to-transparent text-white shadow-xs font-bold border-l-2 border-rose-500"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  }`
                }
              >
                <Activity size={16} className="text-rose-400" />
                <span>Digital Twin</span>
              </NavLink>

              <NavLink
                to="/app/facility"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${isActive
                    ? "bg-gradient-to-r from-rose-500/15 to-transparent text-white shadow-xs font-bold border-l-2 border-rose-500"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  }`
                }
              >
                <Map size={16} className="text-rose-400" />
                <span>Facility View 3D</span>
              </NavLink>
            </div>
          </div>

          {/* Section 2: Analyze */}
          <div>
            <div className="text-[10px] font-mono font-bold tracking-widest text-slate-400 px-3 mb-2 uppercase">
              Analyze
            </div>
            <div className="space-y-1">
              <NavLink
                to="/app/drift"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${isActive
                    ? "bg-gradient-to-r from-rose-500/15 to-transparent text-white shadow-xs font-bold border-l-2 border-rose-500"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  }`
                }
              >
                <AlertTriangle size={16} className="text-rose-400" />
                <span>Drift & Diagnosis</span>
              </NavLink>

              <NavLink
                to="/app/impact"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${isActive
                    ? "bg-gradient-to-r from-rose-500/15 to-transparent text-white shadow-xs font-bold border-l-2 border-rose-500"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  }`
                }
              >
                <TrendingDown size={16} className="text-rose-400" />
                <span>Impact & Financial</span>
              </NavLink>

              <NavLink
                to="/app/sustainability"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${isActive
                    ? "bg-gradient-to-r from-rose-500/15 to-transparent text-white shadow-xs font-bold border-l-2 border-rose-500"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  }`
                }
              >
                <Leaf size={16} className="text-rose-400" />
                <span>Sustainability / LCA</span>
              </NavLink>
            </div>
          </div>

          {/* Section 3: Data & Simulation */}
          <div>
            <div className="text-[10px] font-mono font-bold tracking-widest text-slate-400 px-3 mb-2 uppercase">
              Data & Scenarios
            </div>
            <div className="space-y-1">
              <NavLink
                to="/app/models"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${isActive
                    ? "bg-gradient-to-r from-rose-500/15 to-transparent text-white shadow-xs font-bold border-l-2 border-rose-500"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  }`
                }
              >
                <Database size={16} className="text-rose-400" />
                <span>Models & Datasets</span>
              </NavLink>

              <NavLink
                to="/app/simulation"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${isActive
                    ? "bg-gradient-to-r from-rose-500/15 to-transparent text-white shadow-xs font-bold border-l-2 border-rose-500"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  }`
                }
              >
                <PlayCircle size={16} className="text-rose-400" />
                <span>What-If Simulation</span>
              </NavLink>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-slate-800/80 space-y-3 text-left">
        <NavLink
          to="/"
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 font-medium"
        >
          <ArrowLeft size={14} />
          <span>Back to Overview</span>
        </NavLink>

        <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] font-mono">
          <div className="flex items-center gap-2 mb-1">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${health?.status === 'online' ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${health?.status === 'online' ? 'bg-emerald-500' : 'bg-red-500'}`} />
            </span>
            <span className="text-white font-semibold">
              API {health?.status === 'online' ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="text-slate-400 text-[10px]">
            Latency: {health?.latency_ms ?? 0.8}ms • Queue: {health?.queue_depth ?? 0}
          </div>
        </div>
      </div>
    </aside>
  );
}
