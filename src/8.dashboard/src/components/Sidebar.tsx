import { NavLink } from "react-router-dom";
import { 
  Activity, 
  Map, 
  AlertTriangle, 
  TrendingDown, 
  Leaf,
  Database,
  PlayCircle
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
    const interval = setInterval(fetchHealth, 30000); // 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">A</div>
        <div className="sidebar-brand-text">ARGUS</div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Monitor</div>
        <NavLink to="/app/twin" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Activity className="sidebar-link-icon" />
          Digital Twin
        </NavLink>
        <NavLink to="/app/facility" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Map className="sidebar-link-icon" />
          Facility View
        </NavLink>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Analyze</div>
        <NavLink to="/app/drift" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <AlertTriangle className="sidebar-link-icon" />
          Drift & Diagnosis
        </NavLink>
        <NavLink to="/app/impact" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <TrendingDown className="sidebar-link-icon" />
          Impact & Financial
        </NavLink>
        <NavLink to="/app/sustainability" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Leaf className="sidebar-link-icon" />
          Sustainability / LCA
        </NavLink>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-label">Data</div>
        <NavLink to="/app/models" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Database className="sidebar-link-icon" />
          Models & Datasets
        </NavLink>
        <NavLink to="/app/simulation" className={({isActive}) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <PlayCircle className="sidebar-link-icon" />
          Simulation
        </NavLink>
      </div>

      <div className="sidebar-footer">
        <NavLink to="/" className="sidebar-back-link">
          ← Back to Overview
        </NavLink>
        
        <div className="sidebar-health">
          <div className="sidebar-health-status">
            <div className={`badge-dot ${health?.status === 'online' ? '' : 'bg-red-500'}`} 
                 style={{ background: health?.status === 'online' ? 'var(--status-healthy)' : 'var(--status-critical)' }}/>
            API {health?.status === 'online' ? 'Online' : 'Offline'}
          </div>
          {health && (
            <div className="sidebar-health-latency">
              Latency: {health.latency_ms}ms | Queue: {health.queue_depth}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
