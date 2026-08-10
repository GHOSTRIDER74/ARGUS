"""Unit tests for hybrid scoring, severity, health score, and forecasting."""
import numpy as np
import pandas as pd

from app.modules.digital_twin.health_score import compute_health_score, health_band
from app.modules.drift_detection.config import HybridConfig
from app.modules.drift_detection.forecasting_service import forecast_parameter
from app.modules.drift_detection.hybrid_detector import combine, normalise_lstm_score
from app.modules.drift_detection.severity_service import compute_severity


# ---------- hybrid ----------

def test_hybrid_status_matrix():
    assert combine(0.1, 0.1, False, False)["status"] == "healthy"
    assert combine(0.6, 0.1, True, False)["status"] == "warning"
    assert combine(0.1, 0.6, False, True)["status"] == "warning"
    assert combine(0.7, 0.7, True, True)["status"] == "confirmed_drift"
    assert combine(0.95, 0.95, True, True)["status"] == "critical_anomaly"


def test_hybrid_weighted_score():
    out = combine(0.5, 1.0, True, True, HybridConfig(cusum_weight=0.4, lstm_weight=0.6))
    assert abs(out["hybrid_score"] - (0.4 * 0.5 + 0.6 * 1.0)) < 1e-6


def test_normalise_lstm_score():
    assert normalise_lstm_score(0.0, 0.05) == 0.0
    assert abs(normalise_lstm_score(0.05, 0.05) - 0.5) < 1e-9
    assert normalise_lstm_score(1.0, 0.05) == 1.0


# ---------- severity ----------

def test_severity_zero_when_all_quiet():
    s = compute_severity(0.0, 0.0, 0.0, 0, 5, None)
    assert s["score"] == 0.0
    assert s["level"] == "minor"


def test_severity_critical_case():
    s = compute_severity(1.0, 25.0, 1.0, 5, 5, 1.0)
    assert s["score"] > 80
    assert s["level"] == "critical"
    assert set(s["components"]) == {"hybrid", "deviation", "persistence", "affected_features", "forecast"}


def test_severity_bounded():
    s = compute_severity(5.0, 500.0, 5.0, 50, 5, 0.0)
    assert 0 <= s["score"] <= 100


# ---------- health ----------

def test_health_perfect():
    h = compute_health_score(0.0, 0.0, 0, 0.0)
    assert h["health_score"] == 100.0
    assert h["band"] == "healthy"


def test_health_degrades_and_clamps():
    h = compute_health_score(1.0, 100.0, 10, 1.0)
    assert h["health_score"] == 0.0
    assert h["band"] == "critical"


def test_health_bands():
    assert health_band(95) == "healthy"
    assert health_band(75) == "warning"
    assert health_band(50) == "degraded"
    assert health_band(10) == "critical"


# ---------- forecasting ----------

def test_forecast_linear_trend_and_crossing():
    idx = pd.date_range("2026-01-01", periods=120, freq="1min", tz="UTC")
    values = 65.0 + np.arange(120) * 0.01  # +0.6/hour upward trend
    fc = forecast_parameter(pd.Series(values, index=idx), lower_limit=58.0, upper_limit=72.0)
    assert not fc["insufficient_data"]
    assert fc["slope_per_hour"] > 0.5
    assert fc["threshold_crossing_time"] is not None
    assert 0 < fc["hours_to_threshold_crossing"] < 24
    assert len(fc["points"]) == 4
    p1 = fc["points"][0]
    assert p1["lower_bound"] <= p1["predicted_value"] <= p1["upper_bound"]


def test_forecast_flat_series_never_crosses():
    idx = pd.date_range("2026-01-01", periods=60, freq="1min", tz="UTC")
    fc = forecast_parameter(pd.Series(np.full(60, 65.0), index=idx), 58.0, 72.0)
    assert fc["threshold_crossing_time"] is None


def test_forecast_insufficient_data():
    idx = pd.date_range("2026-01-01", periods=5, freq="1min", tz="UTC")
    fc = forecast_parameter(pd.Series(np.ones(5), index=idx), None, None)
    assert fc["insufficient_data"]
