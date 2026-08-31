"""Unit tests for the two-sided CUSUM detector."""
import numpy as np
import pandas as pd

from app.modules.drift_detection.cusum_detector import CusumDetector


def _ts(n):
    return list(pd.date_range("2026-01-01", periods=n, freq="1min", tz="UTC").to_pydatetime())


def test_no_signal_on_stationary_data():
    rng = np.random.default_rng(1)
    values = rng.normal(10.0, 1.0, 500)
    res = CusumDetector(k=0.5, h=5.0).detect(values, _ts(500), 10.0, 1.0, "p")
    assert not res.signal
    assert res.normalised_score < 0.5


def test_detects_upward_drift():
    rng = np.random.default_rng(2)
    n = 600
    values = rng.normal(10.0, 1.0, n)
    values[300:] += np.linspace(0, 4.0, n - 300)  # gradual up-drift
    res = CusumDetector(k=0.5, h=5.0).detect(values, _ts(n), 10.0, 1.0, "p")
    assert res.signal
    assert res.direction == "up"
    # estimated start should be reasonably near the true start (index 300)
    est_idx = _ts(n).index(res.estimated_start_time)
    assert 250 <= est_idx <= 420


def test_detects_downward_shift():
    rng = np.random.default_rng(3)
    n = 400
    values = rng.normal(50.0, 2.0, n)
    values[200:] -= 6.0  # sudden down-shift of 3 sigma
    res = CusumDetector(k=0.5, h=5.0).detect(values, _ts(n), 50.0, 2.0, "p")
    assert res.signal
    assert res.direction == "down"


def test_reset_and_streaming_update():
    det = CusumDetector(k=0.5, h=3.0)
    fired = False
    for _ in range(20):
        _, _, alarm = det.update(1.5)  # persistent +1.5 sigma
        fired = fired or alarm
    assert fired
    det.reset()
    assert det.s_pos == 0.0 and det.s_neg == 0.0


def test_nan_values_do_not_crash():
    values = np.array([1.0, np.nan, 1.1, np.nan, 0.9] * 30)
    res = CusumDetector().detect(values, _ts(150), 1.0, 0.1, "p")
    assert res is not None
