"""Data cleaning: dedupe, sort, interpolate, outlier labelling, resampling, quality scoring."""
import numpy as np
import pandas as pd

from app.schemas.dataset import PreprocessConfig

SERIES_KEYS = ["machine_id", "stage_name", "parameter_name"]


def clean_dataframe(df: pd.DataFrame, config: PreprocessConfig) -> tuple[pd.DataFrame, dict]:
    """Clean a long-format sensor dataframe. Returns (clean_df, report).

    Steps: timestamp conversion -> duplicate removal -> chronological sort ->
    resample per sensor series -> configurable interpolation -> outlier labelling.
    """
    report: dict = {}
    out = df.copy()

    # 1. timestamps
    out["timestamp"] = pd.to_datetime(out["timestamp"], errors="coerce", utc=True, format="mixed")
    n_bad_ts = int(out["timestamp"].isna().sum())
    report["rows_dropped_bad_timestamp"] = n_bad_ts
    out = out.dropna(subset=["timestamp"])

    out["parameter_value"] = pd.to_numeric(out["parameter_value"], errors="coerce")
    report["missing_values_before"] = int(out["parameter_value"].isna().sum())

    # 2. duplicates — keep first full duplicate; average conflicting readings
    n_before = len(out)
    out = out.drop_duplicates()
    report["duplicate_rows_removed"] = n_before - len(out)

    key = ["timestamp", *SERIES_KEYS]
    n_before = len(out)
    agg = {c: "first" for c in out.columns if c not in key}
    agg["parameter_value"] = "mean"
    out = out.groupby(key, as_index=False, sort=False).agg(agg)
    report["conflicting_readings_merged"] = n_before - len(out)

    # 3. chronological sort
    out = out.sort_values([*SERIES_KEYS, "timestamp"]).reset_index(drop=True)

    # 4. resample each sensor series to the common interval
    interval = config.resample_interval
    resampled_parts: list[pd.DataFrame] = []
    for keys, g in out.groupby(SERIES_KEYS, sort=False):
        g = g.set_index("timestamp")
        numeric_cols = g.select_dtypes(include=[np.number]).columns
        meta_cols = [c for c in g.columns if c not in numeric_cols]
        r_num = g[numeric_cols].resample(interval).mean()
        r_meta = g[meta_cols].resample(interval).first() if meta_cols else None
        r = pd.concat([r_num, r_meta], axis=1) if r_meta is not None else r_num
        for col, val in zip(SERIES_KEYS, keys):
            r[col] = val
        resampled_parts.append(r.reset_index())
    out = pd.concat(resampled_parts, ignore_index=True) if resampled_parts else out
    report["rows_after_resampling"] = len(out)

    # 5. interpolation (per series, trailing information only for ffill)
    missing_before_interp = int(out["parameter_value"].isna().sum())

    def _fill(s: pd.Series) -> pd.Series:
        if config.interpolation == "linear":
            return s.interpolate(method="linear", limit=config.max_ffill_gap, limit_area="inside")
        if config.interpolation == "ffill":
            return s.ffill(limit=config.max_ffill_gap)
        return s

    out["parameter_value"] = out.groupby(SERIES_KEYS, sort=False)["parameter_value"].transform(_fill)
    report["missing_values_after"] = int(out["parameter_value"].isna().sum())
    report["values_interpolated"] = missing_before_interp - report["missing_values_after"]

    # 6. outlier labelling (never dropped — only labelled)
    def _z(s: pd.Series) -> pd.Series:
        std = s.std()
        if not std or np.isnan(std):
            return pd.Series(0.0, index=s.index)
        return (s - s.mean()) / std

    z = out.groupby(SERIES_KEYS, sort=False)["parameter_value"].transform(_z)
    out["is_outlier"] = (z.abs() > config.outlier_zscore).astype(int)
    report["outliers_labelled"] = int(out["is_outlier"].sum())

    return out, report


def compute_quality_score(df: pd.DataFrame) -> dict:
    """Data-quality score in [0, 100].

    Documented formula (weights configurable in code):
        score = 100 * (0.4*completeness + 0.3*validity + 0.15*uniqueness + 0.15*timeliness)
      completeness = fraction of non-missing parameter_value
      validity     = fraction of readings inside operating limits (1.0 when no limits given)
      uniqueness   = 1 - fraction of duplicated (timestamp, series) keys
      timeliness   = fraction of series with regular sampling
    """
    n = len(df)
    if n == 0:
        return {"quality_score": 0.0, "completeness": 0.0, "validity": 0.0, "uniqueness": 0.0, "timeliness": 0.0}

    completeness = 1.0 - df["parameter_value"].isna().mean()

    if {"lower_operating_limit", "upper_operating_limit"}.issubset(df.columns):
        lo = pd.to_numeric(df["lower_operating_limit"], errors="coerce")
        hi = pd.to_numeric(df["upper_operating_limit"], errors="coerce")
        vals = df["parameter_value"]
        with_limits = lo.notna() & hi.notna() & vals.notna()
        validity = float(((vals >= lo) & (vals <= hi))[with_limits].mean()) if with_limits.any() else 1.0
    else:
        validity = 1.0

    key = ["timestamp", *SERIES_KEYS]
    uniqueness = 1.0 - df.duplicated(subset=[k for k in key if k in df.columns]).mean()

    regular = 0
    total_series = 0
    ts = pd.to_datetime(df["timestamp"], errors="coerce", utc=True, format="mixed")
    for _, g in df.assign(_ts=ts).groupby([k for k in SERIES_KEYS if k in df.columns], sort=False):
        total_series += 1
        deltas = g["_ts"].sort_values().diff().dropna()
        if len(deltas) < 2 or (deltas == deltas.mode().iloc[0]).mean() >= 0.95:
            regular += 1
    timeliness = regular / total_series if total_series else 1.0

    score = 100.0 * (0.4 * completeness + 0.3 * validity + 0.15 * uniqueness + 0.15 * timeliness)
    return {
        "quality_score": round(float(score), 2),
        "completeness": round(float(completeness), 4),
        "validity": round(float(validity), 4),
        "uniqueness": round(float(uniqueness), 4),
        "timeliness": round(float(timeliness), 4),
    }
