"""Leakage-safe time-series feature engineering.

Every feature at time t uses ONLY data from t and earlier (trailing windows,
positive lags). No centred windows, no future information.
"""
import numpy as np
import pandas as pd

from app.schemas.dataset import PreprocessConfig

SERIES_KEYS = ["machine_id", "stage_name", "parameter_name"]


def engineer_features(df: pd.DataFrame, config: PreprocessConfig) -> pd.DataFrame:
    """Add engineered feature columns to a cleaned long-format dataframe."""
    out = df.sort_values([*SERIES_KEYS, "timestamp"]).reset_index(drop=True)
    w = config.rolling_window
    g = out.groupby(SERIES_KEYS, sort=False)["parameter_value"]

    # trailing rolling statistics (window ends at current row -> no leakage)
    out["rolling_mean"] = g.transform(lambda s: s.rolling(w, min_periods=2).mean())
    out["rolling_std"] = g.transform(lambda s: s.rolling(w, min_periods=2).std())
    out["rolling_min"] = g.transform(lambda s: s.rolling(w, min_periods=2).min())
    out["rolling_max"] = g.transform(lambda s: s.rolling(w, min_periods=2).max())
    out["ema"] = g.transform(lambda s: s.ewm(span=w, adjust=False).mean())

    # differences and rates
    out["first_diff"] = g.transform(lambda s: s.diff())
    out["pct_change"] = g.transform(lambda s: s.pct_change().replace([np.inf, -np.inf], np.nan))

    # trailing rolling slope (linear fit over the trailing window)
    def _slope(s: pd.Series) -> pd.Series:
        idx = np.arange(w, dtype=float)

        def fit(vals: np.ndarray) -> float:
            if np.isnan(vals).any():
                return np.nan
            return float(np.polyfit(idx, vals, 1)[0])

        return s.rolling(w, min_periods=w).apply(fit, raw=True)

    out["rolling_slope"] = g.transform(_slope)

    # deviation from set point
    if "target_value" in out.columns:
        target = pd.to_numeric(out["target_value"], errors="coerce")
        out["deviation_from_target"] = out["parameter_value"] - target
        with np.errstate(divide="ignore", invalid="ignore"):
            out["normalised_deviation"] = np.where(
                target.abs() > 1e-12, out["deviation_from_target"] / target.abs(), np.nan
            )
        out["cumulative_deviation"] = (
            out.assign(_d=out["deviation_from_target"])
            .groupby(SERIES_KEYS, sort=False)["_d"]
            .cumsum()
        )

    # lag features (strictly past values)
    for lag in config.lags:
        out[f"lag_{lag}"] = g.transform(lambda s, lag=lag: s.shift(lag))

    # resource-efficiency features
    if {"energy_kwh", "production_rate"}.issubset(out.columns):
        rate = pd.to_numeric(out["production_rate"], errors="coerce")
        energy = pd.to_numeric(out["energy_kwh"], errors="coerce")
        with np.errstate(divide="ignore", invalid="ignore"):
            out["energy_per_unit"] = np.where(rate > 0, energy / rate, np.nan)
    if {"chemical_consumption", "production_rate"}.issubset(out.columns):
        rate = pd.to_numeric(out["production_rate"], errors="coerce")
        chem = pd.to_numeric(out["chemical_consumption"], errors="coerce")
        with np.errstate(divide="ignore", invalid="ignore"):
            out["chemical_per_unit"] = np.where(rate > 0, chem / rate, np.nan)

    return out
