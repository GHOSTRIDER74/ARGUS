import { animate, motion, useInView, useMotionValue, useTransform } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Banknote,
  BrainCircuit,
  CheckCircle2,
  Cpu,
  Database,
  Disc,
  DollarSign,
  Flame,
  Layers,
  Radar,
  SlidersHorizontal,
  Thermometer,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import MagneticButton from "../components/MagneticButton";

const APPLE_EASE = [0.16, 1, 0.3, 1] as const;

/* ─── Light Browser Chrome In-Context Dashboard Mockup ────────────────────── */
function DashboardMockup() {
  return (
    <div
      className="w-full rounded-2xl overflow-hidden bg-white/60 backdrop-blur-xl border border-white/80 shadow-[0_16px_48px_rgba(0,0,0,0.06)]"
    >
      {/* Light Browser Chrome Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-white/80 border-b border-slate-200/60 backdrop-blur-md">
        <span className="h-3 w-3 rounded-full bg-[#EF4444] flex-shrink-0" />
        <span className="h-3 w-3 rounded-full bg-[#F59E0B] flex-shrink-0" />
        <span className="h-3 w-3 rounded-full bg-[#10B981] flex-shrink-0" />
        <div className="flex-1 mx-4 h-6 rounded-md bg-white/90 border border-slate-200/80 flex items-center px-3">
          <span className="text-[11px] font-mono text-[#8C919E]">argus.fab/app/digital-twin</span>
        </div>
      </div>

      {/* App Interface Mockup */}
      <div className="flex bg-[#FBFBFA]/80 backdrop-blur-md" style={{ minHeight: 360 }}>
        {/* Sidebar */}
        <div className="w-48 flex-shrink-0 py-4 bg-white/80 border-r border-slate-200/60 hidden sm:block">
          <div className="flex items-center gap-2 px-4 mb-6">
            <div className="h-5 w-5 rounded bg-[#4361EE] flex items-center justify-center text-white">
              <Activity className="w-3 h-3 stroke-[2.5]" />
            </div>
            <span className="text-[11px] font-bold tracking-wider uppercase text-[#0F1115]">ARGUS</span>
          </div>
          {[
            { label: "Digital Twin", active: true, icon: <Cpu className="w-3.5 h-3.5" /> },
            { label: "Drift Events", active: false, icon: <AlertTriangle className="w-3.5 h-3.5" /> },
            { label: "Impact Analysis", active: false, icon: <TrendingUp className="w-3.5 h-3.5" /> },
            { label: "Drift Models", active: false, icon: <BrainCircuit className="w-3.5 h-3.5" /> },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2.5 px-4 py-2 mx-2 rounded-lg mb-0.5"
              style={{ background: item.active ? "rgba(67, 97, 238, 0.08)" : "transparent" }}
            >
              <span style={{ color: item.active ? "#4361EE" : "#8C919E" }}>{item.icon}</span>
              <span className="text-[11px] font-medium" style={{ color: item.active ? "#4361EE" : "#5A5F6B" }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Main Content */}
        <div className="flex-1 p-5 text-left">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-[#0F1115]">Digital Twin — Live Machine Telemetry</p>
            <span className="text-[10px] font-mono text-[#16A34A] bg-[#DCFCE7] border border-[#BBF7D0] px-2 py-0.5 rounded font-medium">
              ● 3 Active Twin Models
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: "ETCH-01", score: 92, status: "Healthy", color: "#16A34A", bg: "#DCFCE7", border: "#BBF7D0", params: ["Pressure: 2.14 mTorr", "RF Power: 412 W", "Gas Flow: 48.3 sccm"] },
              { id: "CVD-02",  score: 68, status: "Warning",  color: "#D97706", bg: "#FEF9C3", border: "#FDE68A", params: ["Temp: 823°C", "Pressure: 1.87 mTorr", "N₂ Flow: 31.1 sccm"] },
              { id: "CMP-01", score: 34, status: "Critical", color: "#DC2626", bg: "#FEE2E2", border: "#FECDD3", params: ["Pressure: 5.2 psi", "Speed: 87 rpm", "Slurry: 182 mL/min"] },
            ].map((m) => (
              <div
                key={m.id}
                className="rounded-xl p-3 flex flex-col bg-white/90 border border-slate-200/80 shadow-sm"
                style={{ borderLeft: `3px solid ${m.color}` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-[11px] font-bold text-[#0F1115]">{m.id}</p>
                    <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>{m.status}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="font-mono text-lg font-light" style={{ color: m.color }}>{m.score}</span>
                    <span className="text-[7px] text-[#8C919E]">/100</span>
                  </div>
                </div>
                {m.params.map((p) => (
                  <p key={p} className="font-mono text-[8px] font-light mb-0.5 text-[#5A5F6B]">{p}</p>
                ))}
                <div className="mt-2 flex gap-1">
                  {["CUSUM", "LSTM", "Hybrid"].map((s, i) => (
                    <div key={s} className="flex-1 rounded px-1 py-0.5 text-center bg-[#F4F4F5]">
                      <p className="text-[6px] font-semibold uppercase text-[#8C919E]">{s}</p>
                      <p className="font-mono text-[8px] font-light text-[#0F1115]">
                        {[0.12, 0.38, 0.74][i]}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Mini Telemetry Chart */}
          <div className="mt-3 rounded-xl p-3 bg-white/90 border border-slate-200/80 shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <p className="text-[9px] font-semibold text-[#5A5F6B]">ETCH-01 — Chamber Pressure Telemetry (mTorr)</p>
              <span className="text-[8px] font-mono text-[#D97706]">Est. Drift Onset: 14:22 UTC</span>
            </div>
            <svg viewBox="0 0 400 40" className="w-full">
              <path
                d="M0,32 L20,31 L40,30 L60,29 L80,28 L100,25 L120,23 L140,16 L160,14 L180,12 L200,10 L220,7 L240,6 L260,9 L280,13 L300,15 L320,18 L340,21 L360,24 L380,26 L400,28"
                fill="none" stroke="#4361EE" strokeWidth="1.5" strokeLinecap="round"
              />
              <line x1="220" y1="0" x2="220" y2="40" stroke="#D97706" strokeWidth="1" strokeDasharray="3,2" />
              <line x1="0" y1="29" x2="400" y2="29" stroke="#16A34A" strokeWidth="0.8" strokeDasharray="4,3" opacity="0.6" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Scroll-Into-View Stat Count-Up Component ───────────────────────────── */
function StatNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));

  useEffect(() => {
    if (isInView) {
      const controls = animate(count, value, {
        duration: 1.2,
        ease: APPLE_EASE,
      });
      return () => controls.stop();
    }
  }, [isInView, value, count]);

  return (
    <span ref={ref} className="font-mono font-light">
      <motion.span>{rounded}</motion.span>
      {suffix}
    </span>
  );
}

export default function LandingPage() {
  const [withArgus, setWithArgus] = useState(false);

  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: "var(--bg)", color: "var(--text-primary)" }}>

      {/* ══ AMBIENT BACKGROUND BLOBS (Horizon Glass Depth) ════════════════ */}
      <div className="absolute top-[-5%] left-[10%] w-[500px] h-[500px] rounded-full bg-[#4361EE]/15 blur-[120px] pointer-events-none" />
      <div className="absolute top-[15%] right-[5%] w-[450px] h-[450px] rounded-full bg-[#0EA5E9]/12 blur-[120px] pointer-events-none" />
      <div className="absolute top-[45%] left-[-5%] w-[550px] h-[550px] rounded-full bg-[#4361EE]/10 blur-[130px] pointer-events-none" />
      <div className="absolute top-[70%] right-[10%] w-[500px] h-[500px] rounded-full bg-[#0EA5E9]/10 blur-[120px] pointer-events-none" />

      {/* ══ FLOATING PILL NAV BAR (Horizon Component Pattern) ══════════════ */}
      <div className="sticky top-4 z-50 px-4">
        <header className="glass-nav max-w-5xl mx-auto flex items-center justify-between px-6 h-14 transition-all">
          {/* Logo */}
          <a href="#hero" className="flex items-center gap-2.5 active:scale-95 transition-transform">
            <div className="h-7 w-7 rounded-full bg-[#4361EE] flex items-center justify-center text-white shadow-sm">
              <Activity className="w-4 h-4 stroke-[2.2]" />
            </div>
            <span className="font-extrabold tracking-wider uppercase text-sm text-[#0F1115]">ARGUS</span>
          </a>

          {/* Links */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Hero navigation">
            {[
              { href: "#overview",   label: "Overview" },
              { href: "#modules",    label: "Modules" },
              { href: "#how",        label: "How It Works" },
              { href: "#comparison", label: "Compare" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="nav-link text-xs px-3.5 py-1.5"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <Link
            to="/app/digital-twin"
            className="btn-primary text-xs px-4 py-2"
          >
            Sign In →
          </Link>
        </header>
      </div>

      {/* ══ HERO ZONE: Glassmorphic Panel Structure ═══════════════════════ */}
      <section id="hero" className="pt-24 pb-28 px-6 text-center relative z-10">
        <div className="mx-auto max-w-4xl">
          {/* Glassmorphic Eyebrow Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: APPLE_EASE }}
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold mb-8 glass-panel border-white/80"
          >
            <span className="h-2 w-2 rounded-full bg-[#4361EE] animate-pulse" />
            <span className="text-[#4361EE]">Digital Twin Process Drift Control System</span>
          </motion.div>

          {/* Headline: Clean Geometric Sans (600 weight), Understated Blue Gradient */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: APPLE_EASE }}
            className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight text-[#0F1115] mb-6 leading-[1.08]"
          >
            Catch process drift{" "}
            <span className="bg-gradient-to-r from-[#1D4ED8] via-[#2563EB] to-[#3B82F6] bg-clip-text text-transparent font-semibold">
              before it costs a wafer.
            </span>
          </motion.h1>

          {/* Subheadline: Muted Gray (text-slate-500), Weight 400 */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: APPLE_EASE }}
            className="text-base md:text-lg leading-[1.65] mx-auto max-w-xl mb-12 text-[#5A5F6B] font-normal"
          >
            Real-time digital twin monitoring, LSTM anomaly detection, and financial impact quantification for semiconductor manufacturing.
          </motion.p>

          {/* Pill Actions: Solid CTA + Glass Secondary Pill */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: APPLE_EASE }}
            className="flex flex-wrap justify-center gap-4 mb-24"
          >
            <MagneticButton>
              <Link
                to="/app/digital-twin"
                className="btn-primary px-8 py-3.5 text-base shadow-lg shadow-[#4361EE]/25"
                id="hero-open-dashboard"
              >
                Open Dashboard
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </Link>
            </MagneticButton>

            <MagneticButton>
              <a
                href="#modules"
                className="glass-pill px-7 py-3.5 text-base"
              >
                Explore Modules
              </a>
            </MagneticButton>
          </motion.div>

          {/* Light Glass Browser Chrome Frame Mockup Overlapping Bottom Edge */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4, ease: APPLE_EASE }}
            className="mx-auto max-w-5xl -mb-48"
          >
            <DashboardMockup />
          </motion.div>
        </div>
      </section>

      {/* Spacer for overlapping hero product mockup */}
      <div className="h-36" />

      {/* ══ CONTEXT STRIP: Glass Pill Bar ═════════════════════════════════ */}
      <div className="py-6 px-6 relative z-10">
        <div className="mx-auto max-w-5xl glass-panel p-4 flex flex-wrap justify-center items-center gap-8 text-sm text-[#5A5F6B]">
          <span className="text-xs uppercase font-semibold text-[#8C919E] tracking-wider">Built for process stages:</span>
          <div className="flex items-center gap-2 font-semibold text-[#0F1115]">
            <Layers className="w-4 h-4 text-[#4361EE]" /> CVD
          </div>
          <span>·</span>
          <div className="flex items-center gap-2 font-semibold text-[#0F1115]">
            <Flame className="w-4 h-4 text-[#D97706]" /> Etching
          </div>
          <span>·</span>
          <div className="flex items-center gap-2 font-semibold text-[#0F1115]">
            <Disc className="w-4 h-4 text-[#16A34A]" /> CMP
          </div>
          <span>·</span>
          <div className="flex items-center gap-2 font-semibold text-[#0F1115]">
            <Thermometer className="w-4 h-4 text-[#DC2626]" /> Reflow Soldering
          </div>
        </div>
      </div>

      {/* ══ BIG-NUMBER STATS ROW: Glass Panels ═════════════════════════════ */}
      <section id="overview" className="py-24 px-6 relative z-10">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: APPLE_EASE }}
            className="text-center mb-16"
          >
            <p className="section-label mb-3">System Capability</p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#0F1115]">
              Real-time drift detection & financial quantification
            </h2>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { num: 3,   suffix: "",    label: "Integrated Modules", sub: "Data → Drift → Impact" },
              { num: 6,   suffix: "+",   label: "Core Parameters", sub: "Monitored per machine" },
              { num: 100, suffix: "",    label: "Live Health Index", sub: "0–100 composite score" },
              { num: 3,   suffix: "-Stage", label: "Cost Breakdown", sub: "Scrap · Rework · Downtime" },
            ].map((s, idx) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1, ease: APPLE_EASE }}
                className="glass-card flex flex-col items-center text-center p-6"
              >
                <div className="text-5xl md:text-6xl font-mono font-light text-[#0F1115]">
                  <StatNumber value={s.num} suffix={s.suffix} />
                </div>
                <p className="text-base font-semibold mt-3 text-[#0F1115]">{s.label}</p>
                <p className="text-xs text-[#5A5F6B] mt-1">{s.sub}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FEATURE CARDS GRID: Horizon Glassmorphism ═════════════════════ */}
      <section className="py-24 px-6 relative z-10">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: APPLE_EASE }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <p className="section-label mb-3">Core Features</p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#0F1115] mb-4">
              Engineered for semiconductor process control
            </h2>
            <p className="text-base text-[#5A5F6B]">
              Every capability is purpose-built around fab-floor realities and high-precision sensor telemetry.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: <Cpu className="w-5 h-5 text-[#4361EE]" />, title: "Digital Twin Health Score", desc: "Composite 0–100 health gauge calculated from CUSUM, LSTM, and hybrid anomaly scores." },
              { icon: <Radar className="w-5 h-5 text-[#16A34A]" />, title: "Hybrid Drift Detection", desc: "CUSUM for step-changes and linear drift, combined with LSTM Autoencoders for gradual multivariate shifts." },
              { icon: <BrainCircuit className="w-5 h-5 text-[#D97706]" />, title: "Root-Cause Attribution", desc: "Feature contribution ranking identifies the primary parameter driving process drift with deviation metrics." },
              { icon: <TrendingUp className="w-5 h-5 text-[#2563EB]" />, title: "Telemetry Horizon Forecast", desc: "Projects parameter trends forward with confidence bounds to predict limit-crossing times." },
              { icon: <DollarSign className="w-5 h-5 text-[#DC2626]" />, title: "Financial Loss Quantification", desc: "Converts drift events into scrap, rework, downtime, and lost revenue with best/expected/worst case ranges." },
              { icon: <SlidersHorizontal className="w-5 h-5 text-[#7C3AED]" />, title: "Synthetic Data Synthesis", desc: "Configurable synthetic telemetry generator with controlled drift injection for model validation." },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: APPLE_EASE }}
                className="feature-card"
              >
                <div className="h-11 w-11 rounded-full flex items-center justify-center bg-white/80 border border-white/90 shadow-sm mb-5">
                  {f.icon}
                </div>
                <h3 className="text-lg font-semibold text-[#0F1115] mb-2">{f.title}</h3>
                <p className="text-sm text-[#5A5F6B] leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ ALTERNATING TWO-COLUMN FEATURE LAYOUT (Horizon Component Pattern) ═ */}
      <section id="modules" className="py-24 px-6 relative z-10">
        <div className="mx-auto max-w-5xl space-y-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: APPLE_EASE }}
            className="text-center mb-16"
          >
            <p className="section-label mb-3">Architectural Workflow</p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#0F1115]">
              Three integrated modules
            </h2>
          </motion.div>

          {/* Module 1: Data Engineering (Text Left, Glass Visual Right) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: APPLE_EASE }}
            className="grid lg:grid-cols-2 gap-12 items-center"
          >
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Database className="w-5 h-5 text-[#4361EE]" />
                <span className="font-mono text-2xl font-light text-[#8C919E]">01</span>
                <span className="tag-pill-accent">Data Engineering</span>
              </div>
              <h3 className="text-3xl font-semibold text-[#0F1115] mb-4">Ingest & preprocess fab telemetry</h3>
              <p className="text-base text-[#5A5F6B] leading-relaxed mb-6">
                Upload raw CSV sensor streams or synthesize multi-stage datasets with ground-truth drift labels. Automated validation checks schema integrity and calculates quality metrics.
              </p>
              <ul className="space-y-3 text-sm text-[#5A5F6B]">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A]" /> Wide & long-format CSV upload support
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A]" /> Linear interpolation & feature engineering
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A]" /> Data quality scoring (completeness, validity)
                </li>
              </ul>
            </div>
            <div className="glass-card p-8">
              <p className="section-label mb-5">Telemetry Quality Assessment</p>
              <div className="space-y-4">
                {[
                  { name: "Completeness", val: 98.4 },
                  { name: "Validity",     val: 96.1 },
                  { name: "Uniqueness",   val: 99.8 },
                  { name: "Timeliness",   val: 94.2 },
                ].map((q) => (
                  <div key={q.name} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-[#5A5F6B] w-28">{q.name}</span>
                    <div className="flex-1 h-2 rounded-full bg-white/70 overflow-hidden border border-white/80">
                      <div className="h-2 rounded-full bg-[#16A34A]" style={{ width: `${q.val}%` }} />
                    </div>
                    <span className="font-mono text-xs font-light text-[#0F1115] w-12 text-right">{q.val}%</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Module 2: Drift Detection (Glass Visual Left, Text Right — Alternating) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: APPLE_EASE }}
            className="grid lg:grid-cols-2 gap-12 items-center"
          >
            <div className="lg:order-2">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-5 h-5 text-[#4361EE]" />
                <span className="font-mono text-2xl font-light text-[#8C919E]">02</span>
                <span className="tag-pill-accent">Drift Detection & Digital Twin</span>
              </div>
              <h3 className="text-3xl font-semibold text-[#0F1115] mb-4">Detect anomalies & synthesize health</h3>
              <p className="text-base text-[#5A5F6B] leading-relaxed mb-6">
                LSTM Autoencoders trained on normal operating baseline data evaluate incoming sensor sequences. CUSUM and LSTM reconstruction errors fuse into a 0–100 Digital Twin health score.
              </p>
              <ul className="space-y-3 text-sm text-[#5A5F6B]">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A]" /> Real-time 0–100 circular radial health gauge
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A]" /> SHAP-style root-cause feature attribution
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A]" /> Predictive threshold limit crossing forecast
                </li>
              </ul>
            </div>
            <div className="lg:order-1 glass-card p-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-base font-semibold text-[#0F1115]">ETCH-01 Machine State</h4>
                  <p className="text-xs text-[#5A5F6B]">Etching Stage · Chamber Pressure Drift</p>
                </div>
                <span className="status-badge status-badge-red">Critical</span>
              </div>
              <div className="p-4 rounded-xl bg-[#FEE2E2]/80 border border-[#FECDD3] flex items-center justify-between mb-5">
                <span className="text-xs font-semibold text-[#DC2626]">Health Score</span>
                <span className="font-mono text-2xl font-light text-[#DC2626]">34 / 100</span>
              </div>
              <p className="section-label mb-3">Root Cause Contribution</p>
              <div className="space-y-3">
                {[
                  { name: "chamber_pressure", pct: 76 },
                  { name: "rf_power",         pct: 16 },
                  { name: "gas_flow",          pct:  8 },
                ].map((c) => (
                  <div key={c.name} className="flex items-center gap-3">
                    <span className="font-mono text-xs text-[#5A5F6B] w-32">{c.name}</span>
                    <div className="flex-1 h-2 rounded-full bg-white/70 overflow-hidden border border-white/80">
                      <div className="h-2 rounded-full bg-[#4361EE]" style={{ width: `${c.pct}%` }} />
                    </div>
                    <span className="font-mono text-xs font-light text-[#0F1115]">{c.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Module 3: Financial Impact (Text Left, Glass Visual Right — Alternating) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: APPLE_EASE }}
            className="grid lg:grid-cols-2 gap-12 items-center"
          >
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Banknote className="w-5 h-5 text-[#4361EE]" />
                <span className="font-mono text-2xl font-light text-[#8C919E]">03</span>
                <span className="tag-pill-accent">Financial Impact</span>
              </div>
              <h3 className="text-3xl font-semibold text-[#0F1115] mb-4">Quantify cost & yield degradation</h3>
              <p className="text-base text-[#5A5F6B] leading-relaxed mb-6">
                Converts confirmed process drift into financial terms: scrap material, rework processing, downtime cost, and lost production value — complete with 95% confidence uncertainty ranges.
              </p>
              <ul className="space-y-3 text-sm text-[#5A5F6B]">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A]" /> Detailed scrap, rework, & downtime cost breakdown
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A]" /> 3-point uncertainty visual (Best / Expected / Worst Case)
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A]" /> Traceable mathematical formulas per step
                </li>
              </ul>
            </div>
            <div className="glass-card p-8 text-center">
              <p className="section-label mb-2">Estimated Financial Loss</p>
              <p className="font-mono text-4xl font-light text-[#0F1115] mb-6">$48,320 USD</p>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-[#DCFCE7]/80 border border-[#BBF7D0]">
                  <p className="text-[9px] font-bold uppercase text-[#16A34A]">Best Case</p>
                  <p className="font-mono text-sm font-light text-[#16A34A] mt-1">$31,200</p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FEF9C3]/80 border border-[#FDE68A]">
                  <p className="text-[9px] font-bold uppercase text-[#D97706]">Expected</p>
                  <p className="font-mono text-sm font-light text-[#D97706] mt-1">$48,320</p>
                </div>
                <div className="p-3.5 rounded-xl bg-[#FEE2E2]/80 border border-[#FECDD3]">
                  <p className="text-[9px] font-bold uppercase text-[#DC2626]">Worst Case</p>
                  <p className="font-mono text-sm font-light text-[#DC2626] mt-1">$74,800</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══ "WITHOUT vs WITH ARGUS" TOGGLE COMPARISON ══════════════════════ */}
      <section id="comparison" className="py-24 px-6 relative z-10">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: APPLE_EASE }}
            className="text-center mb-16"
          >
            <p className="section-label mb-3">Side-by-Side Contrast</p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#0F1115] mb-4">
              Manual Monitoring vs. ARGUS
            </h2>
            <p className="text-base text-[#5A5F6B] mb-8">
              Compare traditional reactive SPC chart inspection against automated ARGUS detection.
            </p>

            {/* Toggle Pill */}
            <div className="inline-flex rounded-full p-1.5 glass-panel">
              <button
                onClick={() => setWithArgus(false)}
                className="px-6 py-2 rounded-full text-xs font-semibold transition-all active:scale-95"
                style={{
                  background: !withArgus ? "#FFFFFF" : "transparent",
                  color: !withArgus ? "#0F1115" : "#5A5F6B",
                  boxShadow: !withArgus ? "0 2px 8px rgba(0,0,0,0.04)" : "none",
                }}
              >
                Without ARGUS
              </button>
              <button
                onClick={() => setWithArgus(true)}
                className="px-6 py-2 rounded-full text-xs font-semibold transition-all active:scale-95"
                style={{
                  background: withArgus ? "#4361EE" : "transparent",
                  color: withArgus ? "#FFFFFF" : "#5A5F6B",
                  boxShadow: withArgus ? "0 4px 14px rgba(67, 97, 238, 0.3)" : "none",
                }}
              >
                With ARGUS
              </button>
            </div>
          </motion.div>

          <motion.div
            layout
            className="glass-panel p-8 transition-all duration-300 rounded-2xl"
            style={{
              borderColor: withArgus ? "rgba(187, 247, 208, 0.8)" : "rgba(254, 205, 211, 0.8)",
            }}
          >
            {!withArgus ? (
              <div className="grid md:grid-cols-2 gap-8 items-center text-left">
                <div>
                  <div className="flex items-center gap-2.5 mb-4">
                    <XCircle className="w-5 h-5 text-[#DC2626]" />
                    <h3 className="text-xl font-semibold text-[#DC2626]">Manual / Reactive Monitoring</h3>
                  </div>
                  <ul className="space-y-3.5 text-sm text-[#7F1D1D]">
                    <li className="flex items-start gap-2.5">
                      <span className="text-[#DC2626] font-bold mt-0.5">✕</span> Drift identified only after batch yield loss occurs.
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-[#DC2626] font-bold mt-0.5">✕</span> Hours spent reading individual parameter SPC charts.
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-[#DC2626] font-bold mt-0.5">✕</span> Cost impact calculated post-mortem by accounting.
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-[#DC2626] font-bold mt-0.5">✕</span> Detection Latency: 4–8 hours after onset.
                    </li>
                  </ul>
                </div>
                <div className="p-5 rounded-xl bg-white/80 border border-[#FECDD3]">
                  <p className="text-xs font-semibold text-[#DC2626] uppercase mb-3">Metrics Without ARGUS</p>
                  <div className="space-y-2.5 font-mono text-xs text-[#0F1115]">
                    <div className="flex justify-between"><span>Detection Latency:</span><span className="font-light text-[#DC2626]">4–8 hours</span></div>
                    <div className="flex justify-between"><span>Root Cause Time:</span><span className="font-light text-[#DC2626]">2–6 hours</span></div>
                    <div className="flex justify-between"><span>Yield Loss:</span><span className="font-light text-[#DC2626]">3–8 percentage points</span></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-8 items-center text-left">
                <div>
                  <div className="flex items-center gap-2.5 mb-4">
                    <CheckCircle2 className="w-5 h-5 text-[#16A34A]" />
                    <h3 className="text-xl font-semibold text-[#16A34A]">Automated ARGUS Detection</h3>
                  </div>
                  <ul className="space-y-3.5 text-sm text-[#14532D]">
                    <li className="flex items-start gap-2.5">
                      <span className="text-[#16A34A] font-bold mt-0.5">✓</span> Drift detected within minutes via hybrid CUSUM + LSTM pipeline.
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-[#16A34A] font-bold mt-0.5">✓</span> Root-cause parameter ranked automatically with deviation metrics.
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-[#16A34A] font-bold mt-0.5">✓</span> Instant scrap, rework, and downtime financial quantification.
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="text-[#16A34A] font-bold mt-0.5">✓</span> Detection Latency: &lt; 5 minutes.
                    </li>
                  </ul>
                </div>
                <div className="p-4 rounded-xl bg-white/80 border border-[#BBF7D0]">
                  <p className="text-xs font-semibold text-[#16A34A] uppercase mb-3">Metrics With ARGUS</p>
                  <div className="space-y-2.5 font-mono text-xs text-[#0F1115]">
                    <div className="flex justify-between"><span>Detection Latency:</span><span className="font-light text-[#16A34A]">&lt; 5 minutes</span></div>
                    <div className="flex justify-between"><span>Root Cause Time:</span><span className="font-light text-[#16A34A]">&lt; 1 minute</span></div>
                    <div className="flex justify-between"><span>Financial Impact:</span><span className="font-light text-[#16A34A]">Instant breakdown</span></div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ══════════════════════════════════════════════════ */}
      <section id="how" className="py-24 px-6 relative z-10">
        <div className="mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: APPLE_EASE }}
            className="text-center mb-16"
          >
            <p className="section-label mb-3">Structured Process</p>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#0F1115]">
              How ARGUS works in 4 steps
            </h2>
          </motion.div>

          <div className="space-y-6">
            {[
              { step: "01", title: "Ingest Telemetry", desc: "Upload sensor CSV or generate synthetic fab datasets with controlled drift anomalies." },
              { step: "02", title: "Detect Anomaly", desc: "Run parallel CUSUM and LSTM Autoencoders to detect step-changes and subtle multivariate drift." },
              { step: "03", title: "Explain Root Cause", desc: "Identify the primary drifting parameter with SHAP-style feature contribution scores." },
              { step: "04", title: "Quantify Impact", desc: "Calculate operational scrap/rework units and financial loss with uncertainty ranges." },
            ].map((s, i) => (
              <motion.div
                key={s.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: APPLE_EASE }}
                className="glass-card flex items-start gap-6 p-6 text-left"
              >
                <div className="h-10 w-10 rounded-full bg-[#4361EE] text-white flex items-center justify-center font-mono font-light text-sm flex-shrink-0 shadow-md">
                  {s.step}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[#0F1115] mb-1.5">{s.title}</h3>
                  <p className="text-sm text-[#5A5F6B] leading-relaxed">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FINAL CTA ════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 text-center relative z-10">
        <div className="mx-auto max-w-3xl glass-card p-14 text-center">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-[#0F1115] mb-4">
            Launch the Live Dashboard
          </h2>
          <p className="text-lg text-[#5A5F6B] mb-10 max-w-lg mx-auto">
            Access the Digital Twin, inspect drift events, and evaluate financial impact models in real time.
          </p>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="inline-block">
            <MagneticButton>
              <Link to="/app/digital-twin" className="btn-primary px-8 py-4 text-base shadow-lg shadow-[#4361EE]/25" id="final-cta-dashboard">
                Open Dashboard
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </Link>
            </MagneticButton>
          </motion.div>
        </div>
      </section>

      {/* ══ FOOTER ════════════════════════════════════════════════════════ */}
      <footer className="glass-panel border-x-0 border-b-0 rounded-none py-12 px-6 relative z-10 mt-12">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-[#5A5F6B]">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-[#4361EE] flex items-center justify-center text-white">
              <Activity className="w-3.5 h-3.5 stroke-[2.2]" />
            </div>
            <span className="font-extrabold text-[#0F1115] tracking-wider uppercase text-xs">ARGUS Process Control</span>
          </div>
          <p className="text-xs">© 2026 ARGUS Digital Twin System. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
