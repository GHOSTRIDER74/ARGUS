"""
ARGUS Module 2 — Digital Twin / State Manager
Central router that holds the current machine state and dispatches
telemetry payloads to downstream analytics (drift, impact, LCA).
"""

import numpy as np
import pandas as pd
import time
from pathlib import Path
from typing import Optional, Dict, List, Any
from dataclasses import dataclass, field, asdict
from enum import Enum

# ── Paths ──
MODULE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = MODULE_DIR.parent.parent

import sys
sys.path.insert(0, str(PROJECT_ROOT / "src" / "1.ingestion"))
sys.path.insert(0, str(PROJECT_ROOT / "src" / "3.drift"))

MACHINE_FEATURES = {
    "ETCH-01": ["rf_power", "etch_rate", "chamber_pressure", "etchant_gas_flow"],
    "ETCH-02": ["rf_power", "etch_rate", "chamber_pressure", "etchant_gas_flow"],
    "DEP-01": ["dep_temp", "gas_flow_rate", "film_thickness", "chamber_vacuum"],
    "CMP-01": ["pad_pressure", "slurry_flow", "rotation_speed", "friction_coefficient"],
    "LITHO-01": ["focus_offset", "exposure_dose", "alignment_error", "lens_temp"],
    "CLEAN-01": ["bath_temp", "chemical_ph", "rinse_flow", "particle_count"],
}


class HealthState(str, Enum):
    HEALTHY = "healthy"
    WARNING = "warning"
    CRITICAL = "critical"
    OFFLINE = "offline"


class DriftPattern(str, Enum):
    NONE = "none"
    GRADUAL = "gradual"
    SUDDEN = "sudden"
    CYCLICAL = "cyclical"


@dataclass
class MachineState:
    """Represents the current state of a single machine/process stage."""
    machine_id: str
    stage: str
    health: HealthState = HealthState.HEALTHY
    drift_pattern: DriftPattern = DriftPattern.NONE
    drift_severity: float = 0.0
    cusum_scores: Dict[str, float] = field(default_factory=dict)
    lstm_score: float = 0.0
    hybrid_score: float = 0.0
    parameters: Dict[str, float] = field(default_factory=dict)
    targets: Dict[str, float] = field(default_factory=dict)
    limits: Dict[str, Dict[str, float]] = field(default_factory=dict)
    root_causes: List[str] = field(default_factory=list)
    last_updated: float = 0.0
    records_processed: int = 0

    def to_dict(self) -> dict:
        d = asdict(self)
        d["health"] = self.health.value
        d["drift_pattern"] = self.drift_pattern.value
        return d


# ── Default process targets and limits for SECOM semiconductor fab ──
DEFAULT_TARGETS = {feat: 0.0 for feats in MACHINE_FEATURES.values() for feat in feats}
DEFAULT_LIMITS = {feat: {"low": -2.0, "high": 2.0} for feats in MACHINE_FEATURES.values() for feat in feats}

# Machine/stage definitions for the simulated fab
MACHINES = [
    {"id": "ETCH-01", "stage": "Plasma Etch"},
    {"id": "ETCH-02", "stage": "Plasma Etch"},
    {"id": "DEP-01", "stage": "Deposition"},
    {"id": "CMP-01", "stage": "CMP Polish"},
    {"id": "LITHO-01", "stage": "Lithography"},
    {"id": "CLEAN-01", "stage": "Wet Clean"},
]


class StateManager:
    """
    Central Digital Twin that manages machine states and dispatches
    telemetry to downstream analysis engines.
    """

    def __init__(self):
        self.machines: Dict[str, MachineState] = {}
        self._telemetry_buffer: List[dict] = []
        self._drift_events: List[dict] = []
        self._max_buffer = 500
        self._global_record_count = 0
        self._initialize_machines()

    def _initialize_machines(self):
        """Create machine state objects for the simulated fab."""
        for m in MACHINES:
            state = MachineState(
                machine_id=m["id"],
                stage=m["stage"],
                targets=DEFAULT_TARGETS.copy(),
                limits={k: v.copy() for k, v in DEFAULT_LIMITS.items()},
                last_updated=time.time(),
            )
            self.machines[m["id"]] = state

    def get_machine(self, machine_id: str) -> Optional[MachineState]:
        return self.machines.get(machine_id)

    def get_all_machines(self) -> List[dict]:
        return [m.to_dict() for m in self.machines.values()]

    def ingest_telemetry(self, record: dict) -> dict:
        """
        Process a single telemetry record through the Digital Twin.
        Updates all machine states simultaneously.
        """
        # Buffer telemetry for windowed analysis
        self._telemetry_buffer.append(record)
        if len(self._telemetry_buffer) > self._max_buffer:
            self._telemetry_buffer = self._telemetry_buffer[-self._max_buffer:]

        self._global_record_count += 1
        results = {}
        for machine_id, machine in self.machines.items():
            # Data routing: alternate ETCH-01 and ETCH-02 to prevent data duplication
            if machine_id == "ETCH-01" and self._global_record_count % 2 != 0:
                pass
            elif machine_id == "ETCH-02" and self._global_record_count % 2 == 0:
                pass
            else:
                features = MACHINE_FEATURES.get(machine_id, [])
                
                # Update parameter readings
                for feat in features:
                    if feat in record:
                        machine.parameters[feat] = float(record[feat])

                # Run inline CUSUM-style anomaly scoring
                cusum_results = self._run_cusum_check(machine, record, features)

                # Determine health state
                self._update_health(machine, cusum_results, features)

                machine.records_processed += 1
                machine.last_updated = time.time()
            
            results[machine_id] = {
                "health": machine.health.value,
                "drift_pattern": machine.drift_pattern.value,
                "drift_severity": machine.drift_severity,
                "hybrid_score": machine.hybrid_score,
                "records_processed": machine.records_processed,
            }

        return results

    def _run_cusum_check(self, machine: MachineState, record: dict, features: List[str]) -> dict:
        """Simple inline CUSUM scoring for real-time state updates with decay."""
        results = {}
        for feat in features:
            if feat not in record:
                continue
            val = float(record[feat])
            target = machine.targets.get(feat, 0.0)
            deviation = abs(val - target)

            # Accumulate CUSUM-like score with decay
            prev = machine.cusum_scores.get(feat, 0.0)
            k = 1.2  # allowance
            
            # Apply decay: if deviation is within allowance, drift decays; otherwise it accumulates.
            decay_factor = 0.75 if deviation < k else 0.95
            
            new_score = max(0, prev * decay_factor + deviation - k)
            machine.cusum_scores[feat] = round(new_score, 4)
            results[feat] = new_score

        # Hybrid score: max of all CUSUM scores
        if results:
            machine.hybrid_score = round(max(results.values()), 4)

        return results

    def _update_health(self, machine: MachineState, cusum_results: dict, features: List[str]):
        """Update machine health based on CUSUM scores and parameter limits."""
        old_health = machine.health
        max_score = machine.hybrid_score
        violations = 0

        for feat in features:
            val = machine.parameters.get(feat, 0.0)
            limits = machine.limits.get(feat, {})
            if val < limits.get("low", -999) or val > limits.get("high", 999):
                violations += 1

        # Calculate a strict bounded severity percentage (0.0 to 1.0)
        bounded_severity = min(1.0, max(0.0, max_score / 25.0))

        # Health state logic
        if max_score > 15.0 or violations >= 3:
            machine.health = HealthState.CRITICAL
            machine.drift_severity = bounded_severity
            machine.drift_pattern = DriftPattern.GRADUAL
            machine.root_causes = self._identify_root_causes(machine)
        elif max_score > 8.0 or violations >= 1:
            machine.health = HealthState.WARNING
            machine.drift_severity = min(0.6, bounded_severity)
            machine.drift_pattern = DriftPattern.GRADUAL
            machine.root_causes = self._identify_root_causes(machine)
        else:
            machine.health = HealthState.HEALTHY
            machine.drift_severity = bounded_severity
            machine.drift_pattern = DriftPattern.NONE
            machine.root_causes = []

        if machine.health != HealthState.HEALTHY and old_health == HealthState.HEALTHY:
            event = {
                "id": f"DRF-{int(time.time())}-{machine.machine_id}",
                "time": time.strftime("%H:%M:%S"),
                "index": machine.records_processed,
                "machine_id": machine.machine_id,
                "stage": machine.stage,
                "parameter": machine.root_causes[0] if machine.root_causes else "unknown",
                "drift_pattern": machine.drift_pattern.value,
                "root_cause": machine.root_causes[0] if machine.root_causes else "unknown",
                "severity": machine.health.value,
                "confidence": min(0.99, 0.5 + machine.drift_severity * 0.4),
                "mean_shift": round(machine.hybrid_score, 4),
                "status": "active"
            }
            self._drift_events.insert(0, event)
            if len(self._drift_events) > 100:
                self._drift_events.pop()

    def _identify_root_causes(self, machine: MachineState) -> List[str]:
        """Identify which parameters are contributing to drift."""
        causes = []
        scored = sorted(
            machine.cusum_scores.items(),
            key=lambda x: x[1],
            reverse=True,
        )
        for feat, score in scored:
            if score > 3.0:
                causes.append(feat)
        return causes if causes else [scored[0][0]] if scored else []

    def get_drift_events(self) -> List[dict]:
        """Return accumulated drift events."""
        return self._drift_events

    def get_facility_summary(self) -> dict:
        """Return an aggregated facility-level health summary."""
        states = [m.health.value for m in self.machines.values()]
        critical = states.count(HealthState.CRITICAL.value)
        warning = states.count(HealthState.WARNING.value)
        healthy = states.count(HealthState.HEALTHY.value)

        overall = HealthState.HEALTHY
        if critical > 0:
            overall = HealthState.CRITICAL
        elif warning > 0:
            overall = HealthState.WARNING

        return {
            "overall_health": overall.value,
            "total_machines": len(self.machines),
            "healthy": healthy,
            "warning": warning,
            "critical": critical,
            "machines": self.get_all_machines(),
        }


# ── Module-level singleton ──
_manager: Optional[StateManager] = None


def get_state_manager() -> StateManager:
    global _manager
    if _manager is None:
        _manager = StateManager()
    return _manager


if __name__ == "__main__":
    sm = StateManager()
    print(f"Initialized {len(sm.machines)} machines")
    for mid, m in sm.machines.items():
        print(f"  {mid}: {m.stage} — {m.health.value}")
    print(f"\nFacility: {sm.get_facility_summary()}")
