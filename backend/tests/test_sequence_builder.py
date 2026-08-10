"""Unit tests for the sequence builder."""
import numpy as np
import pandas as pd
import pytest

from app.modules.drift_detection.exceptions import InsufficientDataError
from app.modules.drift_detection.sequence_builder import build_sequences, pivot_readings


def _wide(n=100, freq="1min", features=("a", "b")):
    idx = pd.date_range("2026-01-01", periods=n, freq=freq, tz="UTC")
    rng = np.random.default_rng(0)
    return pd.DataFrame({f: rng.normal(0, 1, n) for f in features}, index=idx)


def test_shapes_and_metadata():
    df = _wide(100)
    X, meta = build_sequences(df, ["a", "b"], sequence_length=10, stride=1)
    assert X.shape == (91, 10, 2)
    assert len(meta) == 91
    assert meta[0].start_timestamp == df.index[0].to_pydatetime()
    assert meta[0].end_timestamp == df.index[9].to_pydatetime()
    assert meta[-1].end_index == 99


def test_stride():
    df = _wide(100)
    X, _ = build_sequences(df, ["a", "b"], sequence_length=10, stride=5)
    assert X.shape[0] == 19


def test_gap_breaks_sequences():
    df = _wide(100)
    # introduce a 60-minute hole after row 49
    idx = list(df.index[:50]) + [t + pd.Timedelta(hours=1) for t in df.index[50:]]
    df.index = pd.DatetimeIndex(idx)
    X, meta = build_sequences(df, ["a", "b"], sequence_length=10, stride=1)
    # no window may span the gap
    for m in meta:
        span = (m.end_timestamp - m.start_timestamp).total_seconds()
        assert span <= 9 * 60


def test_nan_rows_break_sequences():
    df = _wide(50)
    df.iloc[25, 0] = np.nan
    X, meta = build_sequences(df, ["a", "b"], sequence_length=10, stride=1)
    assert not np.isnan(X).any()
    for m in meta:
        assert m.end_index != 25


def test_insufficient_data_raises():
    df = _wide(5)
    with pytest.raises(InsufficientDataError):
        build_sequences(df, ["a", "b"], sequence_length=10)


def test_missing_feature_raises():
    df = _wide(50)
    with pytest.raises(InsufficientDataError):
        build_sequences(df, ["a", "zzz"], sequence_length=10)


def test_pivot_readings():
    long_df = pd.DataFrame(
        {
            "timestamp": ["2026-01-01T00:00:00Z"] * 2 + ["2026-01-01T00:01:00Z"] * 2,
            "parameter_name": ["p1", "p2", "p1", "p2"],
            "parameter_value": [1.0, 10.0, 2.0, 20.0],
        }
    )
    wide = pivot_readings(long_df)
    assert list(wide.columns) == ["p1", "p2"]
    assert wide.shape == (2, 2)
    assert wide["p2"].iloc[1] == 20.0
