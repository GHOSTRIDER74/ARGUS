"""Hybrid drift rule in the digital twin: CUSUM OR LSTM-AE raises an alarm; both agreeing makes it CRITICAL."""
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path[:0] = [str(ROOT / "src" / "2.twin"), str(ROOT / "src" / "3.drift")]
from state_manager import StateManager  # noqa: E402

ETCH = ["rf_power", "etch_rate", "chamber_pressure", "etchant_gas_flow"]


class FakeLSTM:
    """Returns a fixed reconstruction error; rf_power gets most of it."""
    window, tau, features = 3, 1.0, ETCH

    def __init__(self, error):
        self.error = error

    def score(self, window):
        assert window.shape == (3, 4)
        return self.error, {"rf_power": 0.7, "etch_rate": 0.1, "chamber_pressure": 0.1, "etchant_gas_flow": 0.1}


def run(error, rf_power=0.0, n=20):
    sm = StateManager(lstm=FakeLSTM(error))
    for _ in range(n):
        sm.ingest_telemetry({f: (rf_power if f == "rf_power" else 0.0) for f in ETCH})
    return sm.machines["ETCH-01"], sm


def test_quiet_process_stays_healthy():
    m, _ = run(error=0.5)
    assert m.health.value == "healthy" and m.detected_by == ""


def test_lstm_alone_raises_warning_with_its_root_cause():
    m, sm = run(error=2.0)
    assert m.health.value == "warning" and m.detected_by == "LSTM-AE"
    assert m.root_causes[0] == "rf_power"
    assert sm.get_drift_events()[0]["detected_by"] == "LSTM-AE"


def test_both_detectors_agree_gives_critical():
    m, _ = run(error=2.0, rf_power=1.9, n=60)    # |z| 1.9: CUSUM settles near 11 (above 8, below 15), no limit breach
    assert 8 < max(m.cusum_scores.values()) < 15
    assert m.detected_by == "CUSUM + LSTM-AE" and m.health.value == "critical"


def test_cusum_only_when_lstm_off():
    sm = StateManager(lstm=None)
    for _ in range(20):
        sm.ingest_telemetry({f: (5.0 if f == "rf_power" else 0.0) for f in ETCH})
    m = sm.machines["ETCH-01"]
    assert m.health.value == "critical" and m.detected_by == "CUSUM" and m.lstm_threshold == 0.0


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn(); print("ok", name)
