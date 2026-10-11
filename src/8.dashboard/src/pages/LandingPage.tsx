import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Activity, Shield, TrendingDown, Leaf } from "lucide-react";

export function LandingPage() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Intersection Observer for scroll reveals
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-page">
      <nav className="landing-nav" style={{ opacity: mounted ? 1 : 0, transition: 'opacity 1s ease' }}>
        <div className="landing-nav-brand">ARGUS</div>
        <a href="#features" className="landing-nav-link">Features</a>
        <a href="#technology" className="landing-nav-link">Technology</a>
        <button className="landing-nav-link text-blue-400" onClick={() => navigate('/app/twin')}>Launch App →</button>
      </nav>

      <section className="hero">
        <div className="hero-badge">v2.0 — Next-Gen Semiconductor Analytics</div>
        <h1 className="hero-title">
          Process Monitoring &<br/>Drift Analysis
        </h1>
        <p className="hero-subtitle">
          Detect anomalies before they impact yield. ARGUS combines statistical CUSUM detection 
          with LSTM Autoencoders to provide a comprehensive Digital Twin for semiconductor manufacturing.
        </p>
        <div className="hero-cta-group">
          <button className="hero-cta hero-cta-primary" onClick={() => navigate('/app/twin')}>
            Launch Dashboard
          </button>
          <button className="hero-cta hero-cta-secondary" onClick={() => navigate('/app/simulation')}>
            Run Simulation
          </button>
        </div>
      </section>

      <section id="features" className="landing-section">
        <div className="reveal">
          <div className="landing-section-label">Core Modules</div>
          <h2 className="landing-section-title">End-to-End Visibility</h2>
          <p className="landing-section-subtitle">
            From raw sensor ingestion to financial impact, ARGUS provides 8 integrated modules 
            designed specifically for complex manufacturing environments.
          </p>
        </div>

        <div className="capabilities-grid reveal">
          <div className="capability-card">
            <Activity className="capability-icon text-blue-400" />
            <h3 className="capability-title">Digital Twin</h3>
            <p className="capability-description">
              Real-time state management and visualization of machine health, parameter drift, 
              and process deviations across the entire fab.
            </p>
          </div>
          
          <div className="capability-card">
            <Shield className="capability-icon text-green-400" />
            <h3 className="capability-title">Hybrid Detection</h3>
            <p className="capability-description">
              Combining univariate CUSUM alerts with multivariate LSTM Autoencoder reconstruction 
              errors for robust anomaly detection.
            </p>
          </div>

          <div className="capability-card">
            <TrendingDown className="capability-icon text-red-400" />
            <h3 className="capability-title">Impact Analysis</h3>
            <p className="capability-description">
              Translate engineering metrics into financial impact. Automatically estimate scrap costs, 
              yield loss, and downtime penalties.
            </p>
          </div>

          <div className="capability-card">
            <Leaf className="capability-icon text-emerald-400" />
            <h3 className="capability-title">Dynamic LCA</h3>
            <p className="capability-description">
              Track your carbon footprint in real-time. ARGUS maps process inefficiencies directly 
              to energy loss (kWh) and CO₂ emissions.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-section" style={{ background: 'rgba(255,255,255,0.02)' }}>
        <div className="reveal" style={{ textAlign: 'center' }}>
          <h2 className="landing-section-title">Built for Scale</h2>
          <div className="landing-metrics">
            <div className="landing-metric">
              <div className="landing-metric-value">1,500+</div>
              <div className="landing-metric-label">Telemetry Records</div>
            </div>
            <div className="landing-metric">
              <div className="landing-metric-value">590</div>
              <div className="landing-metric-label">Sensors Monitored</div>
            </div>
            <div className="landing-metric">
              <div className="landing-metric-value">&lt;25ms</div>
              <div className="landing-metric-label">Stream Latency</div>
            </div>
            <div className="landing-metric">
              <div className="landing-metric-value">95%</div>
              <div className="landing-metric-label">Detection Accuracy</div>
            </div>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="mb-4 text-white font-mono font-bold tracking-widest">ARGUS</div>
        <p>Semiconductor Process-Monitoring & Drift-Analysis</p>
        <p className="mt-2 text-gray-600">Built with FastAPI, React, and Recharts</p>
      </footer>
    </div>
  );
}
