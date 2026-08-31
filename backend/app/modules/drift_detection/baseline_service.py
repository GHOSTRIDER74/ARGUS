"""Healthy-baseline selection for training the LSTM Autoencoder."""
import pandas as pd

from app.modules.drift_detection.config import (
    BaselineSelection,
    MAX_MISSING_FRACTION,
    MIN_BASELINE_ROWS,
)
from app.modules.drift_detection.exceptions import InsufficientDataError


def select_baseline(
    wide_df: pd.DataFrame,
    selection: BaselineSelection,
    dataset_meta: dict | None = None,
    machine_id: str | None = None,
    stage_name: str | None = None,
) -> tuple[pd.DataFrame, dict]:
    """Return (baseline_df, summary). Baseline = data assumed healthy.

    Methods:
      ground_truth — use synthetic drift labels stored in dataset meta; healthy =
                     everything before the earliest injected drift start.
      time_range   — explicit [start_time, end_time].
      fraction     — first X fraction of the timeline (chronological).
    """
    if wide_df.empty:
        raise InsufficientDataError("Dataset contains no rows for the requested machine/stage.")

    method = selection.method
    baseline = None

    if method == "ground_truth":
        gt = (dataset_meta or {}).get("ground_truth") or []
        relevant = [
            g
            for g in gt
            if (stage_name is None or g.get("stage_name") == stage_name)
            and (machine_id is None or g.get("machine_id") == machine_id)
        ]
        if relevant:
            earliest = min(pd.to_datetime(g["start_timestamp"], utc=True) for g in relevant)
            baseline = wide_df[wide_df.index < earliest]
        else:
            # no injected drift for this scope -> whole dataset is healthy
            baseline = wide_df
    elif method == "time_range":
        if not selection.start_time or not selection.end_time:
            raise InsufficientDataError("time_range baseline requires start_time and end_time.")
        start = pd.to_datetime(selection.start_time, utc=True)
        end = pd.to_datetime(selection.end_time, utc=True)
        if start >= end:
            raise InsufficientDataError("Baseline start_time must be before end_time.")
        baseline = wide_df[(wide_df.index >= start) & (wide_df.index <= end)]
    elif method == "fraction":
        n = int(len(wide_df) * selection.fraction)
        baseline = wide_df.iloc[:n]
    else:
        raise InsufficientDataError(f"Unknown baseline selection method '{method}'.")

    if len(baseline) < MIN_BASELINE_ROWS:
        raise InsufficientDataError(
            f"Only {len(baseline)} healthy rows selected; need at least {MIN_BASELINE_ROWS}."
        )
    missing_frac = float(baseline.isna().mean().mean())
    if missing_frac > MAX_MISSING_FRACTION:
        raise InsufficientDataError(
            f"Baseline has {missing_frac:.0%} missing values (limit {MAX_MISSING_FRACTION:.0%})."
        )

    summary = {
        "method": method,
        "total_rows": int(len(wide_df)),
        "healthy_rows": int(len(baseline)),
        "baseline_start": baseline.index.min().isoformat(),
        "baseline_end": baseline.index.max().isoformat(),
        "missing_fraction": round(missing_frac, 4),
    }
    return baseline, summary
