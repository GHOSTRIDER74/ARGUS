import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import Lenis from "@studio-freight/lenis";

export function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.1,
      wheelMultiplier: 1.0,
      smoothWheel: true,
    });

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }

    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return (
    <div className="bg-background text-on-surface antialiased font-body-md relative overflow-x-hidden selection:bg-coral-subtle selection:text-primary min-h-screen">
      {/* FLOATING TOP BAR (Shared Component: TopNavBar) */}
      <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between gap-6 px-4 py-2 bg-surface-white/90 backdrop-blur-md floating pill mx-auto rounded-full max-w-fit shadow-[0_12px_40px_-8px_rgba(61,58,64,0.08)] ring-1 ring-primary/5">
        {/* Brand Anchor */}
        <a 
          className="flex items-center gap-2 text-headline-md font-headline-md font-bold tracking-tight text-primary pl-2 pr-1 active:scale-[0.98] transition-transform duration-150" 
          href="#"
        >
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-surface-white">
            <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              circle
            </span>
          </div>
          <span className="tracking-tight text-primary">ARGUS // Telemetry</span>
        </a>

        {/* Center Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 px-2">
          <a className="text-primary font-semibold text-label-md font-label-md hover:text-primary transition-all duration-200" href="#overview">
            Overview
          </a>
          <a className="text-on-surface-variant hover:text-primary font-medium text-label-md font-label-md transition-all duration-200" href="#nodes">
            Telemetry Nodes
          </a>
          <a className="text-on-surface-variant hover:text-primary font-medium text-label-md font-label-md transition-all duration-200" href="#queries">
            Live Queries
          </a>
          <a className="text-on-surface-variant hover:text-primary font-medium text-label-md font-label-md transition-all duration-200" href="#metrics">
            Metrics
          </a>
          <a className="text-on-surface-variant hover:text-primary font-medium text-label-md font-label-md transition-all duration-200" href="#faq">
            FAQ
          </a>
        </nav>

        {/* Trailing Action */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/app/twin")}
            className="bg-primary text-surface-white rounded-full px-5 py-2 text-label-md font-label-md font-semibold hover:bg-neutral-800 transition-colors active:scale-[0.98]"
          >
            Launch Dashboard →
          </button>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-36 md:pt-44 pb-20 px-6 md:px-12 max-w-[1180px] mx-auto text-center overflow-visible" id="overview">
        {/* Top Decorative Coral Pixel Mosaic Grids */}
        <div className="absolute -top-12 -left-12 opacity-80 pointer-events-none select-none hidden lg:block">
          <div className="grid grid-cols-6 gap-1 w-36">
            <div className="pixel-tile bg-transparent"></div>
            <div className="pixel-tile bg-[#FB8D7E]/20"></div>
            <div className="pixel-tile bg-[#FB8D7E]/40"></div>
            <div className="pixel-tile bg-transparent"></div>
            <div className="pixel-tile bg-[#FB8D7E]/60"></div>
            <div className="pixel-tile bg-[#FB8D7E]/30"></div>
            <div className="pixel-tile bg-[#FB8D7E]/40"></div>
            <div className="pixel-tile bg-[#FB8D7E]"></div>
            <div className="pixel-tile bg-[#FB8D7E]/70"></div>
            <div className="pixel-tile bg-[#FB8D7E]/40"></div>
            <div className="pixel-tile bg-transparent"></div>
            <div className="pixel-tile bg-[#FB8D7E]/30"></div>
            <div className="pixel-tile bg-transparent"></div>
            <div className="pixel-tile bg-[#FB8D7E]/50"></div>
            <div className="pixel-tile bg-[#FB8D7E]"></div>
            <div className="pixel-tile bg-[#FB8D7E]/80"></div>
            <div className="pixel-tile bg-[#FB8D7E]/30"></div>
            <div className="pixel-tile bg-transparent"></div>
          </div>
        </div>

        <div className="absolute -top-8 -right-8 opacity-80 pointer-events-none select-none hidden lg:block">
          <div className="grid grid-cols-6 gap-1 w-36">
            <div className="pixel-tile bg-transparent"></div>
            <div className="pixel-tile bg-[#FB8D7E]/30"></div>
            <div className="pixel-tile bg-[#FB8D7E]/60"></div>
            <div className="pixel-tile bg-[#FB8D7E]"></div>
            <div className="pixel-tile bg-[#FB8D7E]/40"></div>
            <div className="pixel-tile bg-transparent"></div>
            <div className="pixel-tile bg-[#FB8D7E]/40"></div>
            <div className="pixel-tile bg-[#FB8D7E]/80"></div>
            <div className="pixel-tile bg-[#FB8D7E]"></div>
            <div className="pixel-tile bg-[#FB8D7E]/50"></div>
            <div className="pixel-tile bg-transparent"></div>
            <div className="pixel-tile bg-[#FB8D7E]/20"></div>
            <div className="pixel-tile bg-[#FB8D7E]/30"></div>
            <div className="pixel-tile bg-transparent"></div>
            <div className="pixel-tile bg-[#FB8D7E]/70"></div>
            <div className="pixel-tile bg-[#FB8D7E]/40"></div>
            <div className="pixel-tile bg-transparent"></div>
            <div className="pixel-tile bg-transparent"></div>
          </div>
        </div>

        {/* Editorial Main Headline */}
        <h1 className="text-display-hero-mobile md:text-display-hero font-display-hero text-primary max-w-4xl mx-auto tracking-tight mb-6">
          Real-Time Electronics Telemetry & Drift Observability
        </h1>
        <p className="text-body-md md:text-body-lg font-body-lg text-on-surface-variant max-w-2xl mx-auto mb-12">
          Stream in-situ hardware telemetry, track statistical process drift, and isolate root-cause anomalies across multi-stage electronics production lines in real-time.
        </p>

        {/* Real-time Telemetry Status & Launch Card */}
        <div 
          className="relative max-w-2xl mx-auto bg-surface-white rounded-3xl p-6 md:p-8 shadow-[0_12px_40px_-8px_rgba(61,58,64,0.08),0_0_0_1px_rgba(18,18,18,0.04)] text-left mb-16 transition-all hover:shadow-[0_16px_48px_-8px_rgba(61,58,64,0.12)]" 
          id="queries"
        >
          {/* Top Micro Badge */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-container/20 text-on-secondary-container text-label-caps font-label-caps font-bold">
              <span className="w-2 h-2 rounded-full bg-[#FB8D7E] animate-pulse"></span>
              <span>LIVE ELECTRONICS INGESTION STREAM</span>
            </div>
            <span className="font-mono text-xs text-on-surface-variant font-semibold">1,567 Runs • 590 Sensor Channels</span>
          </div>

          <div className="mb-5">
            <h3 className="font-headline-md text-xl font-bold text-primary mb-1">
              Cyber-Physical Twin Active
            </h3>
            <p className="text-body-md text-sm text-on-surface-variant">
              Continuous in-situ monitoring across fabrication chambers, thermal profiles, etch rates, and precision electronics manufacturing stages.
            </p>
          </div>

          {/* Quick Chamber Status Badges */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
            {["ETCH-01", "ETCH-02", "DEP-01", "CMP-01", "LITHO-01", "CLEAN-01"].map((chamber) => (
              <div key={chamber} className="p-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-center">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mb-1"></span>
                <div className="text-[11px] font-mono font-bold text-primary">{chamber}</div>
              </div>
            ))}
          </div>

          {/* Actions Bar */}
          <div className="flex items-center justify-between pt-3 border-t border-surface-container/60">
            <div className="flex items-center gap-2 text-xs font-mono text-on-surface-variant">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>CUSUM Slack k=1.2 • Decay α=0.75</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate("/app/facility")}
                className="px-4 py-2 rounded-full bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-primary transition-all"
              >
                Facility 3D
              </button>
              <button 
                type="button" 
                onClick={() => navigate("/app/twin")}
                className="px-5 py-2 rounded-full bg-secondary text-surface-white text-xs font-semibold hover:opacity-95 transition-all shadow-sm flex items-center gap-1.5"
              >
                <span>Launch Twin</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>

        {/* Partner & Node Status Row */}
        <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14 text-on-surface-variant/70 font-display-hero text-sm md:text-base font-semibold tracking-wider uppercase">
          <div className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
            <span className="material-symbols-outlined text-[18px] text-primary">precision_manufacturing</span>
            <span>LAM ETCH-01</span>
          </div>
          <div className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
            <span className="material-symbols-outlined text-[18px] text-primary">layers</span>
            <span>AMAT CMP-01</span>
          </div>
          <div className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
            <span className="material-symbols-outlined text-[18px] text-primary">wb_iridescent</span>
            <span>ASML LITHO-01</span>
          </div>
          <div className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-mono text-xs lowercase">CUSUM/LSTM quorum (6/6) active</span>
          </div>
        </div>
      </section>

      {/* BANNER FEATURE HERO CARD (Dark Slate Rocket/Chamber Capsule) */}
      <section className="max-w-[1180px] mx-auto px-4 md:px-8 mb-28">
        <div className="bg-[#1e1e24] text-surface-white rounded-3xl p-8 md:p-14 relative overflow-hidden shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Left Content */}
          <div className="max-w-xl z-10 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-white/10 text-coral-primary text-label-caps font-label-caps mb-4">
              <span className="material-symbols-outlined text-[14px]">speed</span>
              <span>12MS INTERLOCK PIPELINE</span>
            </div>
            <h2 className="text-headline-xl-mobile md:text-headline-xl font-headline-xl text-surface-white mb-4 tracking-tight">
              From parameter drift anomaly to safety interlock in 12 milliseconds
            </h2>
            <p className="text-body-md md:text-body-lg font-body-md text-surface-variant/80 mb-6 leading-relaxed">
              While traditional manufacturing waits for post-production QA testing and costly scrap discovery, ARGUS detects statistical sensor drift using adaptive CUSUM and LSTM Autoencoders, quantifying yield risk and triggering safety interlocks instantaneously.
            </p>
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2">
                <span className="w-8 h-8 rounded-full bg-[#FB8D7E] flex items-center justify-center text-xs font-mono font-bold text-primary">01</span>
                <span className="w-8 h-8 rounded-full bg-surface-cream-alt flex items-center justify-center text-xs font-mono font-bold text-primary">02</span>
                <span className="w-8 h-8 rounded-full bg-surface-white flex items-center justify-center text-xs font-mono font-bold text-primary">03</span>
              </div>
              <span className="text-body-sm font-body-sm text-surface-white/70">Verified zero-shift hardware tracing</span>
            </div>
          </div>

          {/* Right Graphic / Capsule Illustration */}
          <div className="relative w-full md:w-80 h-64 flex items-center justify-center">
            <div className="absolute w-48 h-48 bg-[#FB8D7E]/20 rounded-full blur-3xl"></div>
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-28 h-40 bg-gradient-to-b from-[#FB8D7E] to-[#e66a59] rounded-t-full rounded-b-xl shadow-xl flex flex-col items-center justify-between p-3 border-2 border-surface-white/20">
                <div className="w-7 h-7 rounded-full bg-surface-white/30 flex items-center justify-center mt-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-surface-white"></div>
                </div>
                <div className="flex gap-2 mb-1">
                  <span className="w-2 h-4 bg-surface-white/40 rounded-full"></span>
                  <span className="w-2 h-4 bg-surface-white/40 rounded-full"></span>
                </div>
              </div>
              <div className="flex gap-1 -mt-1">
                <div className="w-2 h-6 bg-[#FB8D7E]/60 rounded-full animate-bounce"></div>
                <div className="w-3 h-10 bg-amber-400 rounded-full animate-pulse"></div>
                <div className="w-2 h-6 bg-[#FB8D7E]/60 rounded-full animate-bounce"></div>
              </div>
            </div>
            <div className="absolute bottom-2 right-4 bg-surface-white/10 backdrop-blur-md border border-surface-white/15 px-3 py-2 rounded-2xl text-xs font-mono text-surface-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>1,428,953 evt/sec</span>
            </div>
          </div>
        </div>
      </section>

      {/* PROCESS / STEP SECTION */}
      <section className="max-w-[1180px] mx-auto px-6 md:px-12 mb-32" id="nodes">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-headline-xl-mobile md:text-headline-xl font-headline-xl text-primary tracking-tight mb-4">
            Where others stop, the Telemetry Mesh begins
          </h2>
          <p className="text-body-md md:text-body-lg font-body-md text-on-surface-variant">
            Continuous statistical process control and deep learning autoencoders deliver real-time observability across electronics manufacturing lines, combining high-frequency telemetry with explainable root-cause diagnosis.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Left Column: Sticky Editorial Concept */}
          <div className="md:col-span-4 md:sticky md:top-28 space-y-6 text-left">
            <div className="p-8 bg-surface-white rounded-3xl shadow-[0_8px_32px_-4px_rgba(61,58,64,0.05)] border border-black/[0.03]">
              <span className="text-label-caps font-label-caps text-[#FB8D7E] tracking-widest block mb-2 font-bold">
                SYSTEM WORKFLOW
              </span>
              <h3 className="text-headline-md font-headline-md text-primary mb-3">
                Continuous In-Situ Engine
              </h3>
              <p className="text-body-md font-body-md text-on-surface-variant leading-relaxed mb-6">
                Unlike legacy batch-based SPC charts that wait for post-production QA testing, our kernel mesh hooks directly into in-situ machine sensors for sub-millisecond trace capture.
              </p>
              <div className="pt-4 border-t border-surface-container flex items-center justify-between text-body-sm text-on-surface-variant">
                <span>Telemetry SLA Verification</span>
                <span className="font-mono font-bold text-primary">99.998%</span>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-1 w-28 opacity-60">
              <div className="pixel-tile bg-[#FB8D7E]/20"></div>
              <div className="pixel-tile bg-[#FB8D7E]/50"></div>
              <div className="pixel-tile bg-[#FB8D7E]"></div>
              <div className="pixel-tile bg-transparent"></div>
              <div className="pixel-tile bg-[#FB8D7E]/30"></div>
              <div className="pixel-tile bg-[#FB8D7E]"></div>
              <div className="pixel-tile bg-[#FB8D7E]/60"></div>
              <div className="pixel-tile bg-transparent"></div>
              <div className="pixel-tile bg-[#FB8D7E]/40"></div>
              <div className="pixel-tile bg-[#FB8D7E]/10"></div>
            </div>
          </div>

          {/* Right Column: Numbered Cards Sequence (01 to 06) */}
          <div className="md:col-span-8 space-y-4 text-left">
            <div className="bg-surface-white rounded-2xl p-6 md:p-8 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] border border-black/[0.02] hover:translate-x-1 transition-transform">
              <div className="text-label-caps font-label-caps text-[#FB8D7E] mb-2 font-bold tracking-widest">01</div>
              <h4 className="text-headline-md font-headline-md text-primary mb-2">Your manufacturing line topology enters the Mesh</h4>
              <p className="text-body-md font-body-md text-on-surface-variant leading-relaxed">
                Connect manufacturing stages, vacuum chambers, and thermal equipment via standard industrial protocols (OPC-UA, MQTT, or SECS/GEM). In seconds, ARGUS maps all 590 sensor channels into a unified digital twin graph.
              </p>
            </div>

            <div className="bg-surface-white rounded-2xl p-6 md:p-8 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] border border-black/[0.02] hover:translate-x-1 transition-transform">
              <div className="text-label-caps font-label-caps text-[#FB8D7E] mb-2 font-bold tracking-widest">02</div>
              <h4 className="text-headline-md font-headline-md text-primary mb-2">Watch the telemetry traces stream in real-time</h4>
              <p className="text-body-md font-body-md text-on-surface-variant leading-relaxed">
                A unified telemetry console displays every production run in real-time. If an RF generator, heater, or flow controller slips out of setpoint, statistical change-point detectors flag the anomaly immediately.
              </p>
            </div>

            <div className="bg-surface-white rounded-2xl p-6 md:p-8 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] border border-black/[0.02] hover:translate-x-1 transition-transform">
              <div className="text-label-caps font-label-caps text-[#FB8D7E] mb-2 font-bold tracking-widest">03</div>
              <h4 className="text-headline-md font-headline-md text-primary mb-2">In-situ quality control always on (CUSUM + LSTM)</h4>
              <p className="text-body-md font-body-md text-on-surface-variant leading-relaxed">
                Our dual-engine pipeline pairs adaptive CUSUM with a deep-learning LSTM Autoencoder, capturing subtle mean shifts as well as non-linear cross-sensor interactions before scrap occurs.
              </p>
            </div>

            <div className="bg-surface-white rounded-2xl p-6 md:p-8 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] border border-black/[0.02] hover:translate-x-1 transition-transform">
              <div className="text-label-caps font-label-caps text-[#FB8D7E] mb-2 font-bold tracking-widest">04</div>
              <h4 className="text-headline-md font-headline-md text-primary mb-2">Checked and signed off by Process Engineers</h4>
              <p className="text-body-md font-body-md text-on-surface-variant leading-relaxed">
                Every critical interlock or parameter adjustment is backed by explainable SHAP attributions, giving process engineers full confidence without black-box opacity.
              </p>
            </div>

            <div className="bg-surface-white rounded-2xl p-6 md:p-8 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] border border-black/[0.02] hover:translate-x-1 transition-transform">
              <div className="text-label-caps font-label-caps text-[#FB8D7E] mb-2 font-bold tracking-widest">05</div>
              <h4 className="text-headline-md font-headline-md text-primary mb-2">The telemetry data is 100% yours</h4>
              <p className="text-body-md font-body-md text-on-surface-variant leading-relaxed">
                Standard OpenTelemetry and Parquet formats deliver raw sensor streams directly to your on-premise industrial cluster. Zero vendor lock-in and zero confidential IP egress.
              </p>
            </div>

            <div className="bg-surface-white rounded-2xl p-6 md:p-8 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.04)] border border-black/[0.02] hover:translate-x-1 transition-transform">
              <div className="text-label-caps font-label-caps text-[#FB8D7E] mb-2 font-bold tracking-widest">06</div>
              <h4 className="text-headline-md font-headline-md text-primary mb-2">Techno-Economic & ESG Telemetry (INR)</h4>
              <p className="text-body-md font-body-md text-on-surface-variant leading-relaxed">
                Monitor dynamic power consumption and carbon footprints in real-time. Automatically quantify scrap loss (@ ₹41,665/unit) and cleanroom downtime (@ ₹2,08,325/hr) in Indian Rupees (₹) when parameter drift occurs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* PIXEL PATTERN DIVIDER TRANSITION */}
      <div className="w-full max-w-[1180px] mx-auto px-6 overflow-hidden mb-16 pointer-events-none select-none">
        <div className="flex items-center justify-center gap-1 opacity-70">
          <div className="pixel-tile bg-transparent"></div>
          <div className="pixel-tile bg-[#FB8D7E]/30"></div>
          <div className="pixel-tile bg-[#FB8D7E]"></div>
          <div className="pixel-tile bg-[#FB8D7E]/60"></div>
          <div className="pixel-tile bg-[#FB8D7E]/20"></div>
          <div className="pixel-tile bg-[#FB8D7E]"></div>
          <div className="pixel-tile bg-[#FB8D7E]/80"></div>
          <div className="pixel-tile bg-[#FB8D7E]/40"></div>
          <div className="pixel-tile bg-[#FB8D7E]"></div>
          <div className="pixel-tile bg-[#FB8D7E]/50"></div>
          <div className="pixel-tile bg-transparent"></div>
          <div className="pixel-tile bg-[#FB8D7E]/30"></div>
          <div className="pixel-tile bg-[#FB8D7E]"></div>
          <div className="pixel-tile bg-[#FB8D7E]/70"></div>
          <div className="pixel-tile bg-[#FB8D7E]/20"></div>
          <div className="pixel-tile bg-[#FB8D7E]"></div>
          <div className="pixel-tile bg-[#FB8D7E]/90"></div>
          <div className="pixel-tile bg-[#FB8D7E]/40"></div>
          <div className="pixel-tile bg-transparent"></div>
          <div className="pixel-tile bg-[#FB8D7E]/60"></div>
          <div className="pixel-tile bg-[#FB8D7E]"></div>
        </div>
      </div>

      {/* STATS & IMPACT SECTION: "ARGUS in numbers" */}
      <section className="max-w-[1180px] mx-auto px-6 md:px-12 mb-36" id="metrics">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 text-left">
          <div>
            <h2 className="text-headline-xl-mobile md:text-headline-xl font-headline-xl text-primary tracking-tight">
              ARGUS<br />in numbers
            </h2>
          </div>
          <p className="text-body-md font-body-md text-on-surface-variant max-w-md">
            If your manufacturing observability is stuck waiting for manual inspection, you are in good company. We measure what goes live and stays resilient.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="bg-surface-white rounded-3xl p-8 md:p-10 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.05)] border border-black/[0.03] flex flex-col justify-between min-h-[220px]">
            <div className="text-stat-display-mobile md:text-stat-display font-stat-display text-primary tracking-tight mb-4">
              1,567<span className="text-secondary font-semibold">+</span>
            </div>
            <p className="text-body-md font-body-md text-on-surface-variant">
              Full production cycles analyzed. High-dimensional telemetry across 590 simultaneous in-situ sensors.
            </p>
          </div>

          <div className="bg-surface-white rounded-3xl p-8 md:p-10 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.05)] border border-black/[0.03] flex flex-col justify-between min-h-[220px]">
            <div className="text-stat-display-mobile md:text-stat-display font-stat-display text-primary tracking-tight mb-4">
              6<span className="text-secondary font-semibold">+</span>
            </div>
            <p className="text-body-md font-body-md text-on-surface-variant">
              Active manufacturing tools in the live Cyber-Physical Twin (Plasma Etch, Deposition, CMP, Photolithography, Wet Clean).
            </p>
          </div>

          <div className="bg-surface-white rounded-3xl p-8 md:p-10 shadow-[0_8px_32px_-4px_rgba(61,58,64,0.05)] border border-black/[0.03] flex flex-col justify-between min-h-[220px]">
            <div className="text-stat-display-mobile md:text-stat-display font-stat-display text-primary tracking-tight mb-4">
              12<span className="text-secondary font-headline-md font-medium text-3xl">ms</span>
            </div>
            <p className="text-body-md font-body-md text-on-surface-variant">
              Average turnaround time from sensor deviation to CUSUM drift detection and automated tool interlock.
            </p>
          </div>
        </div>
      </section>

      {/* PIXEL CLUSTER DIVIDER 2 */}
      <div className="w-full max-w-[1180px] mx-auto px-6 overflow-hidden mb-20 pointer-events-none select-none">
        <div className="grid grid-cols-12 gap-1 opacity-75 max-w-md mx-auto">
          <div className="pixel-tile bg-[#FB8D7E]/20"></div>
          <div className="pixel-tile bg-[#FB8D7E]"></div>
          <div className="pixel-tile bg-[#FB8D7E]/60"></div>
          <div className="pixel-tile bg-transparent"></div>
          <div className="pixel-tile bg-[#FB8D7E]"></div>
          <div className="pixel-tile bg-[#FB8D7E]/40"></div>
          <div className="pixel-tile bg-[#FB8D7E]/80"></div>
          <div className="pixel-tile bg-[#FB8D7E]"></div>
          <div className="pixel-tile bg-transparent"></div>
          <div className="pixel-tile bg-[#FB8D7E]/50"></div>
          <div className="pixel-tile bg-[#FB8D7E]"></div>
          <div className="pixel-tile bg-[#FB8D7E]/30"></div>
        </div>
      </div>

      {/* FAQ SECTION */}
      <section className="max-w-[1180px] mx-auto px-6 md:px-12 mb-36" id="faq">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 items-start text-left">
          <div className="md:col-span-4">
            <h2 className="text-headline-xl-mobile md:text-headline-xl font-headline-xl text-primary tracking-tight mb-4">
              FAQs
            </h2>
            <p className="text-body-md font-body-md text-on-surface-variant mb-6">
              The most common questions about the ARGUS Telemetry Mesh and how we deliver real-time observability across electronics manufacturing lines.
            </p>
            <button 
              onClick={() => navigate("/app/twin")}
              className="inline-flex items-center gap-2 bg-primary text-surface-white px-5 py-2.5 rounded-full text-label-md font-label-md hover:bg-neutral-800 transition-colors"
            >
              <span>Explore Dashboard</span>
              <span className="material-symbols-outlined text-[16px]">north_east</span>
            </button>
          </div>

          <div className="md:col-span-8 space-y-3">
            <details className="group bg-surface-white rounded-2xl border border-black/[0.04] p-6 open:shadow-[0_8px_32px_-4px_rgba(61,58,64,0.06)] transition-all" open>
              <summary className="flex items-center justify-between cursor-pointer list-none select-none">
                <h3 className="text-headline-md font-headline-md text-primary pr-4">
                  What makes ARGUS different from legacy SPC software?
                </h3>
                <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center group-open:bg-primary group-open:text-surface-white transition-colors">
                  <span className="material-symbols-outlined text-[18px] group-open:rotate-45 transition-transform">add</span>
                </div>
              </summary>
              <div className="pt-4 mt-4 border-t border-surface-container text-body-md font-body-md text-on-surface-variant leading-relaxed">
                Traditional Statistical Process Control (SPC) relies on static 3-sigma thresholds that ignore multi-sensor correlations and trigger thousands of false alarms. ARGUS combines adaptive CUSUM with an LSTM Autoencoder, catching micro-drifts and translating them directly into dynamic energy loss (kWh) and financial scrap impact (₹ INR).
              </div>
            </details>

            <details className="group bg-surface-white rounded-2xl border border-black/[0.04] p-6 open:shadow-[0_8px_32px_-4px_rgba(61,58,64,0.06)] transition-all">
              <summary className="flex items-center justify-between cursor-pointer list-none select-none">
                <h3 className="text-headline-md font-headline-md text-primary pr-4">
                  Can ARGUS integrate directly with real manufacturing equipment?
                </h3>
                <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center group-open:bg-primary group-open:text-surface-white transition-colors">
                  <span className="material-symbols-outlined text-[18px] group-open:rotate-45 transition-transform">add</span>
                </div>
              </summary>
              <div className="pt-4 mt-4 border-t border-surface-container text-body-md font-body-md text-on-surface-variant leading-relaxed">
                Yes. While our demonstration environment uses 590 in-situ manufacturing sensor streams, our ingestion layer is built as a modular streaming interface. In production, it connects directly to industrial OPC-UA, MQTT, or SECS/GEM edge brokers with zero modifications to the core digital twin engine.
              </div>
            </details>

            <details className="group bg-surface-white rounded-2xl border border-black/[0.04] p-6 open:shadow-[0_8px_32px_-4px_rgba(61,58,64,0.06)] transition-all">
              <summary className="flex items-center justify-between cursor-pointer list-none select-none">
                <h3 className="text-headline-md font-headline-md text-primary pr-4">
                  How does ARGUS explain the root cause of an anomaly without black-box AI?
                </h3>
                <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center group-open:bg-primary group-open:text-surface-white transition-colors">
                  <span className="material-symbols-outlined text-[18px] group-open:rotate-45 transition-transform">add</span>
                </div>
              </summary>
              <div className="pt-4 mt-4 border-t border-surface-container text-body-md font-body-md text-on-surface-variant leading-relaxed">
                Instead of leaving engineers with an unexplained black-box alarm, ARGUS utilizes mathematical Kernel SHAP (Shapley Additive exPlanations) to decompose anomaly scores into individual sensor contributions, explicitly ranking whether RF power, thermal setpoints, or gas flow caused the alert.
              </div>
            </details>

            <details className="group bg-surface-white rounded-2xl border border-black/[0.04] p-6 open:shadow-[0_8px_32px_-4px_rgba(61,58,64,0.06)] transition-all">
              <summary className="flex items-center justify-between cursor-pointer list-none select-none">
                <h3 className="text-headline-md font-headline-md text-primary pr-4">
                  What is the Dynamic LCA (Life Cycle Assessment) module?
                </h3>
                <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center group-open:bg-primary group-open:text-surface-white transition-colors">
                  <span className="material-symbols-outlined text-[18px] group-open:rotate-45 transition-transform">add</span>
                </div>
              </summary>
              <div className="pt-4 mt-4 border-t border-surface-container text-body-md font-body-md text-on-surface-variant leading-relaxed">
                ARGUS translates tool deviations from baseline calibration into real-time kilowatt-hour power losses (E = |ΔRF| × 0.05) and carbon emissions (0.42 kg CO₂/kWh), enabling electronics manufacturing facilities to quantify ESG compliance and cleanroom energy efficiency continuously.
              </div>
            </details>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-footer-dark text-surface-white border-t border-primary-container full-width text-left">
        <div className="w-full px-6 py-16 md:px-12 lg:px-20 max-w-7xl mx-auto flex flex-col justify-between">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-16 border-b border-white/10">
            <div className="md:col-span-5 space-y-4">
              <div className="text-headline-lg font-headline-lg font-bold tracking-tighter text-surface-white uppercase">
                ARGUS // TELEMETRY
              </div>
              <p className="text-body-sm font-body-sm text-outline-variant max-w-sm">
                Enterprise Electronics Manufacturing Telemetry & Drift Observability Platform. Delivering cyber-physical digital twins, statistical change-point tracking, and sub-millisecond drift diagnosis.
              </p>
              <div className="pt-2 flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                <span className="text-label-caps font-label-caps text-surface-white/80">Kernel 6.8.0-RT-ARCH — System Status 100% OK</span>
              </div>
            </div>

            <div className="md:col-span-3 space-y-3">
              <div className="text-label-caps font-label-caps text-surface-white tracking-widest">PRODUCTION TESTBED</div>
              <p className="text-body-sm font-body-sm text-outline-variant">
                In-situ Manufacturing Telemetry<br />1,567 Process Cycles • 590 Sensors
              </p>
              <div className="text-label-caps font-label-caps text-surface-white tracking-widest pt-4">DIGITAL TWIN ENGINE</div>
              <p className="text-body-sm font-body-sm text-outline-variant">
                Dual CUSUM + PyTorch LSTM Autoencoder<br />FastAPI Stream Ingestion Core
              </p>
            </div>

            <div className="md:col-span-4 space-y-3">
              <div className="text-label-caps font-label-caps text-surface-white tracking-widest">PLATFORM MODULES</div>
              <ul className="space-y-2">
                <li><button onClick={() => navigate("/app/twin")} className="text-outline-variant hover:text-surface-white text-body-sm transition-colors">Digital Twin State Manager</button></li>
                <li><button onClick={() => navigate("/app/facility")} className="text-outline-variant hover:text-surface-white text-body-sm transition-colors">Facility & Manufacturing 3D View</button></li>
                <li><button onClick={() => navigate("/app/drift")} className="text-outline-variant hover:text-surface-white text-body-sm transition-colors">Drift & SHAP Diagnosis</button></li>
                <li><button onClick={() => navigate("/app/impact")} className="text-outline-variant hover:text-surface-white text-body-sm transition-colors">Techno-Economic Impact</button></li>
                <li><button onClick={() => navigate("/app/sustainability")} className="text-outline-variant hover:text-surface-white text-body-sm transition-colors">Dynamic Carbon & LCA</button></li>
                <li><button onClick={() => navigate("/app/simulation")} className="text-outline-variant hover:text-surface-white text-body-sm transition-colors">What-If Scenario Simulation</button></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 flex flex-col md:flex-row items-center justify-between text-body-sm font-body-sm text-outline-variant/70 gap-4">
            <div>
              © 2026 ARGUS Cyber-Physical Observability Systems Inc. All rights reserved.
            </div>
            <div className="text-xs text-outline-variant/50 max-w-xl text-center md:text-right">
              Built for high-precision electronics and advanced hardware production lines. Designed with CUSUM change-point statistical tracking and LSTM autoencoder anomaly scoring.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
