"""Sequence building for LSTM training/inference.

Leakage-safe: windows contain only chronologically contiguous past data,
never cross machines/stages (caller groups) and never span large time gaps.
"""
from dataclasses import dataclass
from datetime import datetime

import numpy as np
import pandas as pd

from app.modules.drift_detection.config import MAX_GAP_FACTOR
from app.modules.drift_detection.exceptions import InsufficientDataError


@dataclass
class SequenceMeta:
    start_timestamp: datetime
    end_timestamp: datetime
    end_index: int  # position of the window's last row in the source frame


def pivot_readings(long_df: pd.DataFrame) -> pd.DataFrame:
    """Pivot long-format readings to a wide, timestamp-indexed feature table."""
    df = long_df.copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True, format="mixed")
    wide = df.pivot_table(
        index="timestamp", columns="parameter_name", values="parameter_value", aggfunc="mean"
    ).sort_index()
    wide.columns.name = None
    return wide


def build_sequences(
    wide_df: pd.DataFrame,
    feature_names: list[str],
    sequence_length: int,
    stride: int = 1,
    max_gap_factor: float = MAX_GAP_FACTOR,
) -> tuple[np.ndarray, list[SequenceMeta]]:
    """Create [n, sequence_length, n_features] windows plus per-window metadata.

    Splits the frame into contiguous segments wherever the sampling gap exceeds
    max_gap_factor x median interval, then windows each segment independently.
    Rows containing NaN in any selected feature are excluded (they terminate a segment).
    """
    missing = [f for f in feature_names if f not in wide_df.columns]
    if missing:
        raise InsufficientDataError(f"Features not present in data: {', '.join(missing)}")

    frame = wide_df[feature_names].copy()
    ts = frame.index

    if len(frame) < sequence_length:
        raise InsufficientDataError(
            f"Need at least {sequence_length} rows to build one sequence, got {len(frame)}"
        )

    deltas = ts.to_series().diff().dropna()
    median_delta = deltas.median()
    gap_breaks = set(np.where(deltas > max_gap_factor * median_delta)[0] + 1) if len(deltas) else set()
    nan_rows = set(np.where(frame.isna().any(axis=1))[0])

    X: list[np.ndarray] = []
    meta: list[SequenceMeta] = []
    values = frame.to_numpy(dtype=np.float32)

    segment_start = 0
    breakpoints = sorted(gap_breaks | nan_rows | {len(frame)})
    for bp in breakpoints:
        seg_end = bp  # exclusive
        seg_len = seg_end - segment_start
        if seg_len >= sequence_length:
            for s in range(segment_start, seg_end - sequence_length + 1, stride):
                e = s + sequence_length
                X.append(values[s:e])
                meta.append(
                    SequenceMeta(
                        start_timestamp=ts[s].to_pydatetime(),
                        end_timestamp=ts[e - 1].to_pydatetime(),
                        end_index=e - 1,
                    )
                )
        segment_start = bp + 1 if bp in nan_rows else bp

    if not X:
        raise InsufficientDataError("No valid sequences could be built (gaps or missing values).")
    return np.stack(X), meta
