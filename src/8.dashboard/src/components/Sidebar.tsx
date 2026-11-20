import { NavLink } from "react-router-dom";
import { Activity, Map, AlertTriangle, TrendingDown, Leaf, Database, PlayCircle, ArrowLeft, Cpu } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../services/api";

const SECTIONS = [
  { title: "Monitor", items: [
    { to: "/app/twin", label: "Digital Twin", icon: Activity },
    { to: "/app/facility", label: "Facility View 3D", icon: Map },
  ]},
  { title: "Analyze", items: [
    { to: "/app/drift", label: "Drift & Diagnosis", icon: AlertTriangle },
    { to: "/app/impact", label: "Impact & Financial", icon: TrendingDown },
    { to: "/app/sustainability", label: "Sustainability / LCA", icon: Leaf },
  ]},
  { title: "Data & Scenarios", items: [
    { to: "/app/models", label: "Models & Datasets", icon: Database },
    { to: "/app/simulation", label: "What-If Simulation", icon: PlayCircle },
  ]},
];

export function Sidebar() {
  const [health, setHealth] = useState<any>(null);
  const [rtt, setRtt] = useState<number | null>(null);

  useEffect(() => {
    const check = async () => {
      const t0 = performance.now();
      try {
        setHealth(await api.getHealth());
        setRtt(performance.now() - t0);          // measured round trip, not a server-side estimate
      } catch {
        setHealth(null); setRtt(null);
      }
    };
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, []);

  const online = health?.status === "online";
  const progress = health ? Math.min(100, (health.stream_cursor / Math.max(1, health.total_records)) * 100) : 0;

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 flex flex-col justify-between bg-[#070B15] border-r border-slate-800/80 px-4 py-5 select-none">
      <div className="space-y-7">
        <div className="flex items-center gap-3 px-2">
          <div className="w-9 h-9 rounded-[12px] bg-gradient-to-br from-[#FF8C7A] to-[#E0604D] flex items-center justify-center shadow-lg shadow-[#FF8C7A]/20">
            <Cpu size={18} className="text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-slate-100 font-headline-md text-base font-bold tracking-tight">
              ARGUS
              <span className="text-[10px] px-1.5 rounded bg-slate-800 text-[#FF8C7A] font-mono font-semibold">v2.4</span>
            </div>
            <div className="text-[11px] text-slate-500">Semiconductor Fab Twin</div>
          </div>
        </div>

        <nav className="space-y-5">
          {SECTIONS.map((sec) => (
            <div key={sec.title}>
              <div className="px-3 mb-2 text-[10px] font-bold tracking-[0.14em] uppercase text-slate-500">{sec.title}</div>
              <div className="space-y-0.5">
                {sec.items.map(({ to, label, icon: Icon }) => (
                  <NavLink key={to} to={to}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3 px-3 py-2 rounded-[8px] text-[13px] font-medium transition-colors ${
                        isActive ? "bg-slate-800/70 text-slate-50" : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/40"}`}>
                    {({ isActive }) => (
                      <>
                        {isActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-[3px] bg-[#FF8C7A]" />}
                        <Icon size={16} className={isActive ? "text-[#FF8C7A]" : "text-slate-500 group-hover:text-slate-300"} />
                        <span>{label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>

      <div className="space-y-3">
        <NavLink to="/" className="flex items-center gap-2 px-3 py-1 text-xs text-slate-500 hover:text-slate-200 transition-colors">
          <ArrowLeft size={14} /> Back to Overview
        </NavLink>
        <div className="rounded-[12px] border border-slate-800 bg-slate-900/60 p-3 font-mono text-[11px] space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-slate-200 font-semibold">
              <span className={`w-2 h-2 rounded-full ${online ? "bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/70" : "bg-red-500"}`} />
              API {online ? "online" : "offline"}
            </span>
            <span className="text-slate-500">{rtt != null ? `${rtt.toFixed(0)} ms` : "--"}</span>
          </div>
          <div>
            <div className="flex justify-between text-slate-500 mb-1">
              <span>SECOM replay</span>
              <span>{health ? `${health.stream_cursor}/${health.total_records}` : "--"}</span>
            </div>
            <div className="h-1 rounded bg-slate-800 overflow-hidden">
              <div className="h-full bg-[#FF8C7A] transition-all duration-700" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
