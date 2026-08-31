"""Drift-type classification using transparent heuristics."""
import numpy as np
import pandas as pd


def classify_drift(
    series: pd.Series,
    baseline_mean: float,
    baseline_std: float,
    anomalous_flags: np.ndarray,
    recovered: bool,
) -> dict:
    """Classify the drift shape of the (root-cause) parameter series.

    Rules (documented, heuristic — not ML):
      sensor_fault      stuck value (near-zero variance) or NaN burst at the tail
      temporary_spike   short anomalous run that has already recovered
      sudden_shift      recent mean far from baseline with an abrupt jump
      variance_increase recent std >> baseline std while mean stays near baseline
      gradual_linear    persistent anomaly with a consistent slope
      unknown_anomaly   anything else
    """
    std = baseline_std if baseline_std > 1e-12 else 1e-12
    s = series.dropna()
    n = len(s)
    if n < 10:
        return {"drift_type": "unknown_anomaly", "confidence": 0.3, "rule": "insufficient data"}

    tail = s.iloc[-max(n // 5, 10):]
    recent_mean_shift = abs(tail.mean() - baseline_mean) / std
    recent_std_ratio = tail.std() / std

    nan_tail_frac = series.iloc[-max(len(series) // 10, 10):].isna().mean()
    if nan_tail_frac > 0.5:
        return {"drift_type": "sensor_fault", "confidence": 0.8, "rule": "burst of missing readings at the tail"}
    if recent_std_ratio < 0.05 and n > 30:
        return {"drift_type": "sensor_fault", "confidence": 0.7, "rule": "stuck (near-constant) sensor value"}

    anomaly_ratio = float(anomalous_flags.mean()) if len(anomalous_flags) else 0.0
    run = _longest_true_run(anomalous_flags)
    if recovered and run > 0 and run < max(len(anomalous_flags) * 0.1, 5):
        return {"drift_type": "temporary_spike", "confidence": 0.7, "rule": "short anomalous burst followed by recovery"}

    # slope over the anomalous portion (in sigmas per observation)
    x = np.arange(n, dtype=float)
    slope_sigma = float(np.polyfit(x, (s.to_numpy() - baseline_mean) / std, 1)[0])

    # jump detection: largest single-step change in a smoothed series
    smoothed = s.rolling(5, min_periods=1).mean()
    max_jump_sigma = float(smoothed.diff().abs().max() / std)

    if recent_mean_shift > 2.0 and max_jump_sigma > 1.5:
        return {"drift_type": "sudden_shift", "confidence": 0.75, "rule": "abrupt jump and sustained mean shift"}
    if recent_std_ratio > 2.0 and recent_mean_shift < 1.0:
        return {"drift_type": "variance_increase", "confidence": 0.7, "rule": "variance grew while mean stayed near baseline"}
    if anomaly_ratio > 0.1 and abs(slope_sigma) * n > 1.5:
        return {"drift_type": "gradual_linear", "confidence": 0.75, "rule": "persistent anomaly with a consistent trend"}
    return {"drift_type": "unknown_anomaly", "confidence": 0.4, "rule": "no rule matched"}


def _longest_true_run(flags: np.ndarray) -> int:
    best = cur = 0
    for f in flags:
        cur = cur + 1 if f else 0
        best = max(best, cur)
    return best
