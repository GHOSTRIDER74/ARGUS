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
    <aside className="w-64 bg-[#121212] text-surface-white flex flex-col justify-between p-5 shrink-0 border-r border-white/5 select-none h-screen sticky top-0">
      <div className="space-y-6">
        {/* Brand */}
        <div className="flex items-center gap-3 px-2 pt-2">
          <div className="w-9 h-9 rounded-2xl bg-[#FB8D7E] flex items-center justify-center text-primary font-bold shadow-lg shadow-[#FB8D7E]/20">
            <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              memory
            </span>
          </div>
          <div>
            <div className="font-headline-md text-base font-bold text-surface-white tracking-tight flex items-center gap-1.5">
              <span>ARGUS</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-coral-primary font-mono font-semibold">v2.4</span>
            </div>
            <div className="text-[11px] text-outline-variant">Semiconductor Fab Twin</div>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="space-y-5 text-left">
          {/* Section 1: Monitor */}
          <div>
            <div className="text-[10px] font-label-caps font-bold tracking-widest text-[#FB8D7E] px-3 mb-2 uppercase">
              Monitor
            </div>
            <div className="space-y-1">
              <NavLink 
                to="/app/twin" 
                className={({ isActive }) => 
                  `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive 
                      ? "bg-white/15 text-surface-white shadow-sm font-bold border-l-2 border-[#FB8D7E]" 
                      : "text-outline-variant hover:text-surface-white hover:bg-white/5"
                  }`
                }
              >
                <Activity size={16} className="text-[#FB8D7E]" />
                <span>Digital Twin</span>
              </NavLink>

              <NavLink 
                to="/app/facility" 
                className={({ isActive }) => 
                  `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive 
                      ? "bg-white/15 text-surface-white shadow-sm font-bold border-l-2 border-[#FB8D7E]" 
                      : "text-outline-variant hover:text-surface-white hover:bg-white/5"
                  }`
                }
              >
                <Map size={16} className="text-[#FB8D7E]" />
                <span>Facility View 3D</span>
              </NavLink>
            </div>
          </div>

          {/* Section 2: Analyze */}
          <div>
            <div className="text-[10px] font-label-caps font-bold tracking-widest text-[#FB8D7E] px-3 mb-2 uppercase">
              Analyze
            </div>
            <div className="space-y-1">
              <NavLink 
                to="/app/drift" 
                className={({ isActive }) => 
                  `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive 
                      ? "bg-white/15 text-surface-white shadow-sm font-bold border-l-2 border-[#FB8D7E]" 
                      : "text-outline-variant hover:text-surface-white hover:bg-white/5"
                  }`
                }
              >
                <AlertTriangle size={16} className="text-[#FB8D7E]" />
                <span>Drift & Diagnosis</span>
              </NavLink>

              <NavLink 
                to="/app/impact" 
                className={({ isActive }) => 
                  `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive 
                      ? "bg-white/15 text-surface-white shadow-sm font-bold border-l-2 border-[#FB8D7E]" 
                      : "text-outline-variant hover:text-surface-white hover:bg-white/5"
                  }`
                }
              >
                <TrendingDown size={16} className="text-[#FB8D7E]" />
                <span>Impact & Financial</span>
              </NavLink>

              <NavLink 
                to="/app/sustainability" 
                className={({ isActive }) => 
                  `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive 
                      ? "bg-white/15 text-surface-white shadow-sm font-bold border-l-2 border-[#FB8D7E]" 
                      : "text-outline-variant hover:text-surface-white hover:bg-white/5"
                  }`
                }
              >
                <Leaf size={16} className="text-[#FB8D7E]" />
                <span>Sustainability / LCA</span>
              </NavLink>
            </div>
          </div>

          {/* Section 3: Data & Simulation */}
          <div>
            <div className="text-[10px] font-label-caps font-bold tracking-widest text-[#FB8D7E] px-3 mb-2 uppercase">
              Data & Scenarios
            </div>
            <div className="space-y-1">
              <NavLink 
                to="/app/models" 
                className={({ isActive }) => 
                  `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive 
                      ? "bg-white/15 text-surface-white shadow-sm font-bold border-l-2 border-[#FB8D7E]" 
                      : "text-outline-variant hover:text-surface-white hover:bg-white/5"
                  }`
                }
              >
                <Database size={16} className="text-[#FB8D7E]" />
                <span>Models & Datasets</span>
              </NavLink>

              <NavLink 
                to="/app/simulation" 
                className={({ isActive }) => 
                  `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive 
                      ? "bg-white/15 text-surface-white shadow-sm font-bold border-l-2 border-[#FB8D7E]" 
                      : "text-outline-variant hover:text-surface-white hover:bg-white/5"
                  }`
                }
              >
                <PlayCircle size={16} className="text-[#FB8D7E]" />
                <span>What-If Simulation</span>
              </NavLink>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="pt-4 border-t border-white/10 space-y-3 text-left">
        <NavLink 
          to="/" 
          className="flex items-center gap-2 text-xs text-outline-variant hover:text-surface-white transition-colors px-2 py-1"
        >
          <ArrowLeft size={14} />
          <span>Back to Overview</span>
        </NavLink>

        <div className="p-3 rounded-2xl bg-white/5 border border-white/5 text-[11px] font-mono">
          <div className="flex items-center gap-2 mb-1">
            <span className={`w-2 h-2 rounded-full ${health?.status === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-surface-white font-semibold">
              API {health?.status === 'online' ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="text-outline-variant text-[10px]">
            Latency: {health?.latency_ms ?? 0.8}ms • Ingest Queue: {health?.queue_depth ?? 0}
          </div>
        </div>
      </div>
    </aside>
  );
}
