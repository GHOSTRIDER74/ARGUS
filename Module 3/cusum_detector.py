import numpy as np
import pandas as pd

FEATURE_COLS = [
    "reflow_temp_c",
    "solder_viscosity_pa",
    "etch_concentration",
    "inspection_defect_rate",
]

def cusum_detect(series: np.ndarray, k: float = 0.5, h: float = 5.0):
    """
    One-sided CUSUM on a single standardised time series.
    k = allowance (slack), h = decision threshold.
    Returns binary alert array (1 = drift detected at that step).
    """
    mu = np.mean(series[:200])   # estimate from first 200 "normal" steps
    std = np.std(series[:200])
    normed = (series - mu) / (std + 1e-9)

    cusum_pos = np.zeros(len(normed))
    alerts = np.zeros(len(normed), dtype=int)

    for i in range(1, len(normed)):
        cusum_pos[i] = max(0, cusum_pos[i-1] + normed[i] - k)
        if cusum_pos[i] > h:
            alerts[i] = 1

    return alerts, cusum_pos


def run_cusum(df):
    """Run CUSUM on all features, return combined alert series."""
    results = {}
    for col in FEATURE_COLS:
        alerts, stat = cusum_detect(df[col].values)
        results[f"cusum_alert_{col}"] = alerts
        results[f"cusum_stat_{col}"] = stat

    result_df = pd.DataFrame(results, index=df.index)
    # Combined: alert if ANY parameter triggers CUSUM
    result_df["cusum_any_alert"] = result_df[
        [c for c in result_df.columns if "alert" in c]
    ].max(axis=1)
    return result_df