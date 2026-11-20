import { useEffect, useRef, useState } from "react";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { Pause, Play, RotateCcw, Radio, Cpu, ShieldAlert, Activity, BrainCircuit } from "lucide-react";
import { api } from "../services/api";
import { StatusBadge } from "../components/StatusBadge";
import { AnimatedNumber } from "../components/AnimatedNumber";

type Machine = {
  machine_id: string; stage: string; health: string; drift_severity: number;
  cusum_scores: Record<string, number>; parameters: Record<string, number>;
  lstm_score: number; lstm_threshold: number; detected_by: string; hybrid_score: number;
  root_causes: string[]; records_processed: number;
};

const LINE = ["DEP-01", "LITHO-01", "ETCH", "CMP-01", "CLEAN-01"];             // fab order; ETCH holds ETCH-01/02
const HEALTH = {
  healthy:  { ring: "#34D399", glow: "rgba(52,211,153,0.25)" },
  warning:  { ring: "#FBBF24", glow: "rgba(251,191,36,0.30)" },
  critical: { ring: "#F87171", glow: "rgba(248,113,113,0.40)" },
} as Record<string, { ring: string; glow: string }>;
const WARN_H = 8, CRIT_H = 15, BAR_MAX = 20;
const HISTORY = 90;

export function DigitalTwin() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [selected, setSelected] = useState("ETCH-01");
  const [running, setRunning] = useState(true);
  const [ended, setEnded] = useState(false);
  const [cursor, setCursor] = useState(0);              // position in the SECOM replay (0..total)
  const [total, setTotal] = useState(1567);
  const history = useRef<Record<string, { t: number; v: number }[]>>({});
  const tick = useRef(0);

  const refresh = async () => {
    const res: Machine[] = await api.getMachines();
    if (!Array.isArray(res)) return;
    tick.current += 1;
    for (const m of res) {
      const h = (history.current[m.machine_id] ??= []);
      h.push({ t: tick.current, v: m.hybrid_score });
      if (h.length > HISTORY) h.shift();
    }
    setMachines(res);
  };

  useEffect(() => {
    refresh().catch(() => {});
    api.getHealth().then((h) => { setCursor(h.stream_cursor); setTotal(h.total_records); }).catch(() => {});
    api.getDriftEvents().then((r) => setEvents(r.events ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(async () => {
      try {
        const r = await api.ingestToTwin(10);          // pull the next 10 SECOM records into the twin
        setEnded(r.ingested === 0);
        if (typeof r.cursor === "number") setCursor(r.cursor);
        await refresh();
        const ev = await api.getDriftEvents();
        setEvents(ev.events ?? []);
      } catch { /* API restarting: keep polling */ }
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const replay = async () => {
    await api.resetTelemetry();                          // resets the stream and the twin together
    setCursor(0); setEnded(false); setEvents([]); history.current = {}; tick.current = 0; setRunning(true);
  };

  if (!machines.length) {
    return (
      <div className="py-24 text-center text-on-surface-variant">
        <div className="w-8 h-8 rounded-full border-2 border-secondary border-t-transparent animate-spin mx-auto mb-3" />
        <span className="font-mono text-sm">Connecting to the digital twin…</span>
      </div>
    );
  }

  const byId = Object.fromEntries(machines.map((m) => [m.machine_id, m]));
  const count = (h: string) => machines.filter((m) => m.health === h).length;
  const alerting = machines.filter((m) => m.health !== "healthy");
  const byDetector = (d: string) => alerting.filter((m) => m.detected_by === d).length;
  const etch = [byId["ETCH-01"], byId["ETCH-02"]].filter(Boolean);
  const tau = etch[0]?.lstm_threshold || 0;
  const sel = byId[selected] ?? machines[0];

  return (
    <div className="space-y-6 text-left">
      {/* ── KPI strip ── */}
      <section className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <Kpi icon={<Cpu size={16} />} label="Fleet health">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-50 font-headline-md"><AnimatedNumber value={count("healthy")} /></span>
            <span className="text-sm text-slate-400">/ {machines.length} healthy</span>
          </div>
          <div className="mt-3 flex h-1.5 rounded-full overflow-hidden bg-slate-800">
            {(["healthy", "warning", "critical"] as const).map((h) => (
              <div key={h} style={{ width: `${(count(h) / machines.length) * 100}%`, background: HEALTH[h].ring }} />
            ))}
          </div>
        </Kpi>
        <Kpi icon={<ShieldAlert size={16} />} label="Active alerts">
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-amber-300 font-headline-md"><AnimatedNumber value={count("warning")} /></span>
            <span className="text-xs text-slate-400">warning</span>
            <span className="text-3xl font-bold text-red-300 font-headline-md"><AnimatedNumber value={count("critical")} /></span>
            <span className="text-xs text-slate-400">critical</span>
          </div>
        </Kpi>
        <Kpi icon={<Activity size={16} />} label="Detected by (live)">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[["CUSUM", "CUSUM"], ["LSTM-AE", "LSTM"], ["CUSUM + LSTM-AE", "Both"]].map(([k, l]) => (
              <div key={k} className="rounded-[8px] bg-slate-800/60 py-1.5">
                <div className="text-lg font-bold text-slate-100 font-mono">{byDetector(k)}</div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500">{l}</div>
              </div>
            ))}
          </div>
        </Kpi>
        <Kpi icon={<BrainCircuit size={16} />} label="LSTM-AE error (etch)">
          {etch.map((m) => (
            <div key={m.machine_id} className="mb-1.5 last:mb-0">
              <div className="flex justify-between text-[11px] font-mono text-slate-400">
                <span>{m.machine_id}</span>
                <span className={m.lstm_score > tau ? "text-red-300" : "text-slate-300"}>{m.lstm_score.toFixed(2)} / τ {tau.toFixed(2)}</span>
              </div>
              <Meter value={m.lstm_score} max={tau * 2} mark={tau} color={m.lstm_score > tau ? "#F87171" : "#38BDF8"} />
            </div>
          ))}
        </Kpi>
        <Kpi icon={<Radio size={16} />} label="Telemetry stream">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold text-slate-50 font-headline-md"><AnimatedNumber value={cursor} /></div>
              <div className="text-xs text-slate-400">of {total.toLocaleString("en-IN")} SECOM records</div>
            </div>
            <div className="flex gap-1.5">
              {ended ? (
                <IconBtn onClick={replay} title="Replay from the start"><RotateCcw size={15} /></IconBtn>
              ) : (
                <IconBtn onClick={() => setRunning((r) => !r)} title={running ? "Pause" : "Resume"}>
                  {running ? <Pause size={15} /> : <Play size={15} />}
                </IconBtn>
              )}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-mono text-slate-500">
            <span className={`w-1.5 h-1.5 rounded-full ${running && !ended ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
            {ended ? "replay finished" : running ? "10 records / s" : "paused"}
          </div>
        </Kpi>
      </section>

      {/* ── Production line ── */}
      <Panel title="Production line" subtitle="Machines in fab order · click a machine to inspect it">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {LINE.map((stage, i) => (
            <div key={stage} className="flex items-center gap-2 flex-1 min-w-[150px]">
              <div className="flex-1 flex flex-col gap-2">
                {(stage === "ETCH" ? ["ETCH-01", "ETCH-02"] : [stage]).map((id) => byId[id] && (
                  <LineNode key={id} m={byId[id]} active={sel.machine_id === id} hist={history.current[id] ?? []}
                    onClick={() => setSelected(id)} />
                ))}
              </div>
              {i < LINE.length - 1 && <div className="flow-line w-8 shrink-0" />}
            </div>
          ))}
        </div>
      </Panel>

      {/* ── Selected machine + event feed ── */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <Panel
            title={`${sel.machine_id} · ${sel.stage}`}
            subtitle={sel.lstm_threshold ? "Adaptive CUSUM on every sensor + LSTM autoencoder on the etch window" : "Adaptive CUSUM on every sensor"}
            right={<div className="flex items-center gap-2">
              {sel.detected_by && <DetectorChip value={sel.detected_by} />}
              <StatusBadge status={sel.health} />
            </div>}>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3 space-y-3.5">
                <div className="flex justify-between text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                  <span>Sensor · value (z)</span><span>CUSUM statistic · warn 8 · critical 15</span>
                </div>
                {Object.keys(sel.cusum_scores).map((f) => {
                  const s = sel.cusum_scores[f];
                  const col = s > CRIT_H ? "#F87171" : s > WARN_H ? "#FBBF24" : "#34D399";
                  return (
                    <div key={f}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-mono text-slate-300">
                          {f}{sel.root_causes?.[0] === f && <span className="ml-2 text-[10px] text-[#FF8C7A]">root cause</span>}
                        </span>
                        <span className="font-mono text-slate-400">z {(sel.parameters[f] ?? 0).toFixed(2)} · <span style={{ color: col }}>{s.toFixed(1)}</span></span>
                      </div>
                      <Meter value={s} max={BAR_MAX} marks={[WARN_H, CRIT_H]} color={col} />
                    </div>
                  );
                })}
                {sel.lstm_threshold > 0 && (
                  <div className="pt-2 border-t border-slate-800">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-mono text-slate-300">LSTM-AE reconstruction error (30-record window)</span>
                      <span className="font-mono" style={{ color: sel.lstm_score > sel.lstm_threshold ? "#F87171" : "#38BDF8" }}>
                        {sel.lstm_score.toFixed(3)} / τ₉₉ {sel.lstm_threshold.toFixed(2)}
                      </span>
                    </div>
                    <Meter value={sel.lstm_score} max={sel.lstm_threshold * 2} mark={sel.lstm_threshold}
                      color={sel.lstm_score > sel.lstm_threshold ? "#F87171" : "#38BDF8"} />
                  </div>
                )}
              </div>
              <div className="lg:col-span-2 flex flex-col">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Hybrid score · last {HISTORY} s</div>
                <div className="flex-1 min-h-[170px] rounded-[12px] bg-slate-900/50 border border-slate-800 p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history.current[sel.machine_id] ?? []} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="hs" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#FF8C7A" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="#FF8C7A" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <YAxis domain={[0, (max: number) => Math.max(20, Math.ceil(max))]} tick={{ fill: "#64748B", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <ReferenceLine y={WARN_H} stroke="#FBBF24" strokeDasharray="4 4" strokeOpacity={0.6} />
                      <ReferenceLine y={CRIT_H} stroke="#F87171" strokeDasharray="4 4" strokeOpacity={0.6} />
                      <Tooltip contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 8, fontSize: 12 }}
                        labelFormatter={() => ""} formatter={(v: any) => [Number(v).toFixed(2), "hybrid"]} />
                      <Area type="monotone" dataKey="v" stroke="#FF8C7A" strokeWidth={2} fill="url(#hs)" isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <Stat label="Severity" value={`${Math.round((sel.drift_severity || 0) * 100)}%`} />
                  <Stat label="Hybrid" value={sel.hybrid_score.toFixed(1)} />
                  <Stat label="Records" value={sel.records_processed.toLocaleString("en-IN")} />
                </div>
              </div>
            </div>
          </Panel>
        </div>

        <Panel title="Live drift events" subtitle={`${events.length} logged · newest first`}>
          <div className="space-y-2 max-h-[372px] overflow-y-auto pr-1">
            {events.length === 0 && <div className="text-sm text-slate-500 py-8 text-center">No drift events yet</div>}
            {events.slice(0, 20).map((e) => (
              <button key={e.id + e.index} onClick={() => setSelected(e.machine_id)}
                className="w-full text-left rounded-[8px] border border-slate-800 bg-slate-900/40 hover:bg-slate-800/50 px-3 py-2 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">{e.machine_id}</span>
                  <span className="text-[10px] font-mono text-slate-500">{e.time}</span>
                </div>
                <div className="flex items-center justify-between mt-1 gap-2">
                  <span className="text-[11px] font-mono text-slate-400 truncate">{e.root_cause}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <DetectorChip value={e.detected_by || "CUSUM"} small />
                    <StatusBadge status={e.severity} className="text-[9px] px-1.5" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}

/* ── small building blocks ── */

function Panel({ title, subtitle, right, children }: { title: string; subtitle?: string; right?: any; children: any }) {
  return (
    <div className="rounded-[16px] border border-slate-800 bg-[#0F1729] p-5 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-100 font-headline-md">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function Kpi({ icon, label, children }: { icon: any; label: string; children: any }) {
  return (
    <div className="rounded-[16px] border border-slate-800 bg-[#0F1729] p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-3">
        <span className="text-[#FF8C7A]">{icon}</span>{label}
      </div>
      {children}
    </div>
  );
}

function Meter({ value, max, color, mark, marks }: { value: number; max: number; color: string; mark?: number; marks?: number[] }) {
  const pct = (x: number) => `${Math.min(100, Math.max(0, (x / max) * 100))}%`;
  return (
    <div className="relative h-2 rounded-full bg-slate-800">
      <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700" style={{ width: pct(value), background: color, boxShadow: `0 0 10px ${color}66` }} />
      {[...(marks ?? []), ...(mark != null ? [mark] : [])].map((m) => (
        <div key={m} className="absolute -top-0.5 -bottom-0.5 w-px bg-slate-400/70" style={{ left: pct(m) }} />
      ))}
    </div>
  );
}

function LineNode({ m, active, hist, onClick }: { m: Machine; active: boolean; hist: { t: number; v: number }[]; onClick: () => void }) {
  const c = HEALTH[m.health] ?? HEALTH.healthy;
  return (
    <button onClick={onClick}
      className={`relative w-full rounded-[12px] border px-3 py-2.5 text-left transition-all ${active ? "border-[#FF8C7A]/70 bg-slate-800/70" : "border-slate-800 bg-slate-900/50 hover:border-slate-600"}`}
      style={{ boxShadow: m.health !== "healthy" ? `0 0 0 1px ${c.ring}55, 0 0 22px ${c.glow}` : undefined }}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${m.health !== "healthy" ? "animate-pulse" : ""}`} style={{ background: c.ring }} />
          <span className="text-[13px] font-semibold text-slate-100">{m.machine_id}</span>
        </span>
        <span className="text-[10px] font-mono text-slate-500">{Math.round((m.drift_severity || 0) * 100)}%</span>
      </div>
      <div className="h-7 mt-1.5 -mx-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={hist} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
            <YAxis hide domain={[0, 20]} />
            <Area type="monotone" dataKey="v" stroke={c.ring} strokeWidth={1.5} fill={c.ring} fillOpacity={0.12} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="text-[10px] text-slate-500 truncate">{m.detected_by ? `by ${m.detected_by}` : m.stage}</div>
    </button>
  );
}

function DetectorChip({ value, small }: { value: string; small?: boolean }) {
  const parts = value.split(" + ");
  return (
    <span className="inline-flex gap-1">
      {parts.map((p) => (
        <span key={p} className={`rounded-md font-mono font-semibold ring-1 ring-inset ${small ? "text-[9px] px-1.5 py-px" : "text-[10px] px-2 py-0.5"} ${
          p === "LSTM-AE" ? "bg-sky-500/10 text-sky-300 ring-sky-400/30" : "bg-violet-500/10 text-violet-300 ring-violet-400/30"}`}>
          {p}
        </span>
      ))}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] bg-slate-800/50 py-2">
      <div className="text-sm font-bold text-slate-100 font-mono">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}

function IconBtn({ onClick, title, children }: { onClick: () => void; title: string; children: any }) {
  return (
    <button onClick={onClick} title={title}
      className="w-8 h-8 rounded-[8px] border border-slate-700 bg-slate-800/60 text-slate-200 hover:bg-slate-700 flex items-center justify-center transition-colors">
      {children}
    </button>
  );
}
