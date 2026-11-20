"""
ARGUS Module 2 — Digital Twin / State Manager
Central router that holds the current machine state and dispatches
telemetry payloads to downstream analytics (drift, impact, LCA).
"""

import numpy as np
import pandas as pd
import time
from collections import deque
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
    lstm_score: float = 0.0          # LSTM-AE reconstruction error of the latest etch window
    lstm_threshold: float = 0.0      # tau_99 of the live LSTM-AE (0 = not used on this machine)
    detected_by: str = ""            # "CUSUM", "LSTM-AE" or "CUSUM + LSTM-AE"
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

    def __init__(self, lstm: Any = "auto"):
        """lstm: a live scorer with .score(window), .tau, .window, .features;
        "auto" loads (or trains once) the saved LSTM-AE; None runs CUSUM only."""
        self.machines: Dict[str, MachineState] = {}
        self._telemetry_buffer: List[dict] = []
        self._drift_events: List[dict] = []
        self._max_buffer = 500
        self._global_record_count = 0
        if lstm == "auto":
            try:
                from live_lstm import LiveLSTM
                lstm = LiveLSTM.load_or_train()
            except Exception as e:  # keep the twin running on CUSUM if torch/model is unavailable
                print(f"[twin] LSTM-AE unavailable, using CUSUM only: {e}")
                lstm = None
        self._lstm = lstm
        # one shared window of consecutive etch records, matching how the LSTM-AE was trained
        self._etch_window = deque(maxlen=lstm.window if lstm else 1)
        self._initialize_machines()

    def reset(self):
        """Start the twin over: fresh machine states, no events, empty LSTM window.
        Called when the telemetry stream is replayed from record 0."""
        self.machines = {}
        self._telemetry_buffer = []
        self._drift_events = []
        self._global_record_count = 0
        self._etch_window.clear()
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
        lstm_result = self._score_etch_window(record)
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

                # The etch stream is also scored by the LSTM-AE; the result goes to the etcher that got this record
                lstm_here = lstm_result if machine_id.startswith("ETCH") else None
                if lstm_here:
                    machine.lstm_score = round(lstm_here[0], 4)
                    machine.lstm_threshold = round(self._lstm.tau, 4)

                # Determine health state (CUSUM + LSTM-AE)
                self._update_health(machine, cusum_results, features, lstm_here)

                machine.records_processed += 1
                machine.last_updated = time.time()
            
            results[machine_id] = {
                "health": machine.health.value,
                "drift_pattern": machine.drift_pattern.value,
                "drift_severity": machine.drift_severity,
                "hybrid_score": machine.hybrid_score,
                "lstm_score": machine.lstm_score,
                "detected_by": machine.detected_by,
                "records_processed": machine.records_processed,
            }

        return results

    def _score_etch_window(self, record: dict):
        """Add the record's etch values to the window; once it is full, return
        (LSTM-AE error, per-feature error). Returns None when the LSTM-AE is off or not ready."""
        if not self._lstm or not all(f in record for f in self._lstm.features):
            return None
        self._etch_window.append([float(record[f]) for f in self._lstm.features])
        if len(self._etch_window) < self._lstm.window:
            return None
        return self._lstm.score(np.array(self._etch_window))

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

        return results

    def _update_health(self, machine: MachineState, cusum_results: dict, features: List[str], lstm_result=None):
        """Update machine health from CUSUM, parameter limits and (for etchers) the LSTM-AE.

        Alarm (WARNING):  CUSUM > 8  or >= 1 limit violation  or  LSTM-AE error > tau_99   (OR rule)
        CRITICAL:         CUSUM > 15 or >= 3 limit violations or  both detectors agree (LSTM alarm and CUSUM > 8)
        """
        old_health = machine.health
        cusum_max = max(cusum_results.values()) if cusum_results else 0.0
        violations = 0

        for feat in features:
            val = machine.parameters.get(feat, 0.0)
            limits = machine.limits.get(feat, {})
            if val < limits.get("low", -999) or val > limits.get("high", 999):
                violations += 1

        lstm_alarm = bool(lstm_result) and lstm_result[0] > self._lstm.tau
        cusum_alarm = cusum_max > 8.0 or violations >= 1
        cusum_critical = cusum_max > 15.0 or violations >= 3

        # Hybrid score: CUSUM statistic, or the LSTM-AE error scaled so that tau_99 maps to h = 15 when it alarms
        lstm_scaled = 15.0 * lstm_result[0] / self._lstm.tau if lstm_alarm else 0.0
        machine.hybrid_score = round(max(cusum_max, lstm_scaled), 4)
        bounded_severity = min(1.0, max(0.0, machine.hybrid_score / 25.0))
        machine.detected_by = {(True, False): "CUSUM", (False, True): "LSTM-AE",
                               (True, True): "CUSUM + LSTM-AE"}.get((cusum_alarm, lstm_alarm), "")

        if cusum_critical or (lstm_alarm and cusum_alarm):
            machine.health = HealthState.CRITICAL
            machine.drift_severity = bounded_severity
        elif cusum_alarm or lstm_alarm:
            machine.health = HealthState.WARNING
            machine.drift_severity = min(0.6, bounded_severity)
        else:
            machine.health = HealthState.HEALTHY
            machine.drift_severity = bounded_severity

        if machine.health == HealthState.HEALTHY:
            machine.drift_pattern = DriftPattern.NONE
            machine.root_causes = []
        else:
            machine.drift_pattern = DriftPattern.GRADUAL
            if cusum_alarm:
                machine.root_causes = self._identify_root_causes(machine)
            else:  # LSTM-only alarm: rank sensors by their share of the reconstruction error
                machine.root_causes = sorted(lstm_result[1], key=lstm_result[1].get, reverse=True)[:2]

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
                "detected_by": machine.detected_by,
                "lstm_error": machine.lstm_score if lstm_result else None,
                "lstm_threshold": machine.lstm_threshold if lstm_result else None,
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
