"""Basic drift forecasting: linear trend extrapolation with residual-based bounds.

Deliberately simple and isolated so a stronger model (ARIMA, ES, ML) can
replace it without touching callers.
"""
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

DEFAULT_HORIZONS_HOURS = [1, 6, 12, 24]
FIT_WINDOW_POINTS = 240  # fit on up to the last N observations


def forecast_parameter(
    series: pd.Series,
    lower_limit: float | None,
    upper_limit: float | None,
    horizons_hours: list[int] | None = None,
) -> dict:
    """Linear-trend forecast of one parameter.

    series: timestamp-indexed values (chronological). Returns forecast points,
    95% confidence bounds (from fit residual std), and the estimated time the
    trend crosses an operating limit (None when the trend never crosses).
    """
    horizons = horizons_hours or DEFAULT_HORIZONS_HOURS
    s = series.dropna().iloc[-FIT_WINDOW_POINTS:]
    if len(s) < 10:
        return {"forecast_method": "linear_trend", "insufficient_data": True, "points": []}

    t0 = s.index[0]
    x_hours = ((s.index - t0).total_seconds() / 3600.0).to_numpy(dtype=float)
    y = s.to_numpy(dtype=float)
    slope, intercept = np.polyfit(x_hours, y, 1)
    residuals = y - (slope * x_hours + intercept)
    resid_std = float(residuals.std())

    last_ts: datetime = s.index[-1].to_pydatetime()
    last_x = float(x_hours[-1])

    points = []
    for h in horizons:
        x_f = last_x + h
        pred = slope * x_f + intercept
        points.append(
            {
                "horizon_hours": h,
                "timestamp": (last_ts + timedelta(hours=h)).isoformat(),
                "predicted_value": round(float(pred), 4),
                "lower_bound": round(float(pred - 1.96 * resid_std), 4),
                "upper_bound": round(float(pred + 1.96 * resid_std), 4),
            }
        )

    crossing_time = None
    hours_to_crossing = None
    if abs(slope) > 1e-12:
        candidates = []
        for limit in (lower_limit, upper_limit):
            if limit is None:
                continue
            x_cross = (limit - intercept) / slope
            if x_cross > last_x:
                candidates.append(x_cross - last_x)
        if candidates:
            hours_to_crossing = round(min(candidates), 2)
            crossing_time = (last_ts + timedelta(hours=hours_to_crossing)).isoformat()

    return {
        "forecast_method": "linear_trend",
        "insufficient_data": False,
        "slope_per_hour": round(float(slope), 6),
        "residual_std": round(resid_std, 6),
        "points": points,
        "threshold_crossing_time": crossing_time,
        "hours_to_threshold_crossing": hours_to_crossing,
        "assumptions": "Assumes the current linear trend continues; bounds are ±1.96 x fit residual std.",
    }
