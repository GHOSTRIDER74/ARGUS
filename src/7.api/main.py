"""
ARGUS Module 7 — FastAPI API Layer
Bridges all backend analytics engines (Modules 1-6) to the frontend dashboard.
Provides REST endpoints for telemetry, drift, impact, LCA, simulation, and facility data.
"""

import sys
import time
import json
import numpy as np
from pathlib import Path
from typing import Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Resolve module paths ──
MODULE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = MODULE_DIR.parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src" / "1.ingestion"))
sys.path.insert(0, str(PROJECT_ROOT / "src" / "2.twin"))
sys.path.insert(0, str(PROJECT_ROOT / "src" / "4.impact"))
sys.path.insert(0, str(PROJECT_ROOT / "src" / "5.lca"))
sys.path.insert(0, str(PROJECT_ROOT / "src" / "6.simulation"))

# ── Import engines ──
from streamer import TelemetryStreamer, get_streamer
from state_manager import StateManager, get_state_manager
from calculator import ImpactCalculator, get_impact_calculator
from carbon_tracker import CarbonTracker, get_carbon_tracker
from scenario_engine import ScenarioEngine, SimulationConfig, get_scenario_engine

# ── Track API start time ──
API_START_TIME = time.time()


# ── Lifespan ──
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize all engines
    get_streamer()
    get_state_manager()
    get_impact_calculator()
    get_carbon_tracker()
    get_scenario_engine()
    print("ARGUS API — All engines initialized.")
    yield
    print("ARGUS API — Shutting down.")


# ── App ──
app = FastAPI(
    title="ARGUS API",
    description="Semiconductor Process-Monitoring & Drift-Analysis",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────────────────────────
#  Pydantic Models
# ──────────────────────────────────────

class SimulationRequest(BaseModel):
    n_samples: int = 1000
    drift_type: str = "none"
    drift_onset: int = 500
    drift_magnitude: float = 0.04
    target_parameter: str = "rf_power"
    drift_direction: str = "positive"
    seed: int = 42
    noise_scale: float = 1.0


class ImpactRequest(BaseModel):
    machine_id: str = "ETCH-01"
    stage: str = "Plasma Etch"
    drift_severity: float = 0.5
    affected_records: int = 100
    energy_loss_kwh: float = 10.0


# ──────────────────────────────────────
#  Health & Status
# ──────────────────────────────────────

@app.get("/api/health")
def health_check():
    """API health with uptime and stream latency."""
    uptime = time.time() - API_START_TIME
    streamer = get_streamer()
    return {
        "status": "online",
        "uptime_seconds": round(uptime, 2),
        "stream_cursor": streamer.cursor_position,
        "total_records": streamer.total_records,
        "latency_ms": round(np.random.uniform(5, 25), 1),  # simulated
        "queue_depth": max(0, streamer.total_records - streamer.cursor_position),
        "modules": {
            "ingestion": "online",
            "twin": "online",
            "drift": "online",
            "impact": "online",
            "lca": "online",
            "simulation": "online",
        },
    }


# ──────────────────────────────────────
#  Module 1: Telemetry / Ingestion
# ──────────────────────────────────────

@app.get("/api/telemetry/summary")
def telemetry_summary():
    """Dataset summary statistics."""
    return get_streamer().get_summary_stats()


@app.get("/api/telemetry/batch")
def telemetry_batch(
    start: int = Query(0, ge=0),
    end: Optional[int] = Query(None),
    limit: int = Query(100, ge=1, le=500),
):
    """Fetch a batch of telemetry records."""
    streamer = get_streamer()
    if end is None:
        end = min(start + limit, streamer.total_records)
    df = streamer.get_batch(start, end)
    # Convert timestamps
    if "Time" in df.columns:
        df["Time"] = df["Time"].astype(str)
    records = df.to_dict(orient="records")
    return {
        "start": start,
        "end": end,
        "count": len(records),
        "total": streamer.total_records,
        "records": records,
    }


@app.get("/api/telemetry/stream")
def telemetry_next(count: int = Query(1, ge=1, le=50)):
    """Get next N records from the stream cursor."""
    streamer = get_streamer()
    records = []
    for _ in range(count):
        rec = streamer.next_record()
        if rec is None:
            break
        # Convert any non-serializable types
        clean = {}
        for k, v in rec.items():
            if isinstance(v, (np.integer,)):
                clean[k] = int(v)
            elif isinstance(v, (np.floating,)):
                clean[k] = float(v)
            elif isinstance(v, (np.ndarray,)):
                clean[k] = v.tolist()
            else:
                clean[k] = v
            # Handle NaN
            if isinstance(clean[k], float) and np.isnan(clean[k]):
                clean[k] = None
        records.append(clean)
    return {
        "count": len(records),
        "cursor": streamer.cursor_position,
        "total": streamer.total_records,
        "records": records,
    }


@app.post("/api/telemetry/reset")
def telemetry_reset():
    """Reset the stream cursor."""
    get_streamer().reset()
    return {"status": "reset", "cursor": 0}


# ──────────────────────────────────────
#  Module 2: Digital Twin
# ──────────────────────────────────────

@app.get("/api/twin/machines")
def get_machines():
    """Get all machine states."""
    return get_state_manager().get_all_machines()


@app.get("/api/twin/machines/{machine_id}")
def get_machine(machine_id: str):
    """Get a specific machine state."""
    m = get_state_manager().get_machine(machine_id)
    if not m:
        raise HTTPException(404, f"Machine {machine_id} not found")
    return m.to_dict()


@app.get("/api/twin/facility")
def get_facility():
    """Get facility-level health summary."""
    return get_state_manager().get_facility_summary()


@app.post("/api/twin/ingest")
def ingest_to_twin(count: int = Query(1, ge=1, le=100)):
    """Ingest N telemetry records into the Digital Twin for all machines."""
    streamer = get_streamer()
    sm = get_state_manager()
    results = []
    for _ in range(count):
        rec = streamer.next_record()
        if rec is None:
            break
        result = sm.ingest_telemetry(rec)
        results.append(result)
    return {
        "ingested": len(results),
        "cursor": streamer.cursor_position,
        "latest": results[-1] if results else None,
    }


# ──────────────────────────────────────
#  Module 3: Drift Events
# ──────────────────────────────────────

@app.get("/api/drift/events")
def get_drift_events():
    """
    Get drift events. Since the full CUSUM/LSTM pipeline is heavy,
    this provides drift analysis events tracked by the StateManager.
    """
    events = get_state_manager().get_drift_events()
    return {
        "total_events": len(events),
        "events": events[:100],  # cap at 100
    }


@app.get("/api/drift/timeseries/{parameter}")
def get_drift_timeseries(parameter: str, downsample: int = Query(1, ge=1, le=20)):
    """Get time series data for a specific parameter for drift charting."""
    streamer = get_streamer()
    df = streamer.get_full_dataset()

    if parameter not in df.columns:
        raise HTTPException(404, f"Parameter {parameter} not found")

    series = df[parameter].values[::downsample]
    indices = list(range(0, len(df), downsample))

    # Compute targets/thresholds from baseline (first 200 records)
    baseline = df[parameter].iloc[:200]
    target = float(baseline.mean())
    upper = float(baseline.mean() + 2 * baseline.std())
    lower = float(baseline.mean() - 2 * baseline.std())

    return {
        "parameter": parameter,
        "target": round(target, 4),
        "upper_limit": round(upper, 4),
        "lower_limit": round(lower, 4),
        "data": [
            {"index": idx, "value": round(float(v), 6) if not np.isnan(v) else None}
            for idx, v in zip(indices, series)
        ],
    }


# ──────────────────────────────────────
#  Module 4: Impact & Financial
# ──────────────────────────────────────

@app.get("/api/impact/aggregate")
def get_impact_aggregate():
    """Get aggregate impact and financial summary."""
    return get_impact_calculator().get_aggregate_impact()


@app.get("/api/impact/timeseries")
def get_impact_timeseries(window: int = Query(50, ge=10, le=200)):
    """Get impact metrics over time."""
    return get_impact_calculator().get_impact_timeseries(window)


@app.post("/api/impact/calculate")
def calculate_impact(req: ImpactRequest):
    """Calculate impact for a specific drift event."""
    calc = get_impact_calculator()
    report = calc.calculate_event_impact(
        machine_id=req.machine_id,
        stage=req.stage,
        drift_severity=req.drift_severity,
        affected_records=req.affected_records,
        energy_loss_kwh=req.energy_loss_kwh,
    )
    return report.to_dict()


# ──────────────────────────────────────
#  Module 5: LCA / Sustainability
# ──────────────────────────────────────

@app.get("/api/lca/summary")
def get_lca_summary():
    """Get LCA / carbon footprint summary."""
    return get_carbon_tracker().get_current_summary()


@app.get("/api/lca/timeseries")
def get_lca_timeseries(downsample: int = Query(5, ge=1, le=50)):
    """Get LCA metrics time series."""
    return get_carbon_tracker().get_timeseries(downsample)


@app.get("/api/lca/efficiency")
def get_lca_efficiency(window: int = Query(50, ge=10, le=200)):
    """Get rolling energy efficiency against baseline."""
    return get_carbon_tracker().get_efficiency_baseline(window)


# ──────────────────────────────────────
#  Module 6: Simulation
# ──────────────────────────────────────

@app.post("/api/simulation/generate")
def run_simulation(req: SimulationRequest):
    """Generate synthetic data with drift injection."""
    engine = get_scenario_engine()
    cfg = SimulationConfig(
        n_samples=req.n_samples,
        drift_type=req.drift_type,
        drift_onset=req.drift_onset,
        drift_magnitude=req.drift_magnitude,
        target_parameter=req.target_parameter,
        drift_direction=req.drift_direction,
        seed=req.seed,
        noise_scale=req.noise_scale,
    )
    df = engine.generate(cfg)

    # Return summary + first 200 records
    records = df.head(200).to_dict(orient="records")
    return {
        "config": cfg.to_dict(),
        "total_generated": len(df),
        "summary": {
            "failures": int(df["Pass/Fail"].sum()),
            "failure_rate": round(float(df["Pass/Fail"].mean() * 100), 2),
            "total_energy_loss": round(float(df["energy_loss_kwh"].sum()), 2),
            "total_co2": round(float(df["co2_emission_kg"].sum()), 2),
            "total_cost": round(float(df["total_impact_cost_usd"].sum()), 2),
        },
        "sample_records": records,
    }


@app.get("/api/simulation/parameters")
def get_simulation_parameters():
    """Get available simulation parameters and drift types."""
    engine = get_scenario_engine()
    return {
        "parameters": engine.get_available_parameters(),
        "drift_types": engine.get_available_drift_types(),
    }


# ──────────────────────────────────────
#  Dataset Management
# ──────────────────────────────────────

@app.get("/api/dataset/info")
def dataset_info():
    """Get dataset schema and quality metrics."""
    streamer = get_streamer()
    df = streamer.get_full_dataset()
    stats = streamer.get_summary_stats()

    # Column summary
    columns = []
    for col in df.columns:
        col_info = {
            "name": str(col),
            "dtype": str(df[col].dtype),
            "null_count": int(df[col].isnull().sum()),
            "null_pct": round(float(df[col].isnull().mean() * 100), 2),
        }
        if df[col].dtype in ["float64", "int64"]:
            col_info["mean"] = round(float(df[col].mean()), 4) if not df[col].isnull().all() else None
            col_info["std"] = round(float(df[col].std()), 4) if not df[col].isnull().all() else None
            col_info["min"] = round(float(df[col].min()), 4) if not df[col].isnull().all() else None
            col_info["max"] = round(float(df[col].max()), 4) if not df[col].isnull().all() else None
        columns.append(col_info)

    return {
        "rows": len(df),
        "columns_count": len(df.columns),
        "columns": columns[:50],  # cap for performance
        "quality": {
            "completeness": round(float((1 - df.isnull().mean().mean()) * 100), 2),
            "total_nulls": int(df.isnull().sum().sum()),
        },
        **stats,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
