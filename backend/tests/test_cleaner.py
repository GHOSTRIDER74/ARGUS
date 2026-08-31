"""Unit tests for cleaning, resampling and quality scoring."""
import numpy as np
import pandas as pd

from app.modules.data_engineering.cleaner import clean_dataframe, compute_quality_score
from app.schemas.dataset import PreprocessConfig


def test_duplicates_removed(sample_long_df):
    df = pd.concat([sample_long_df, sample_long_df.iloc[:10]], ignore_index=True)
    clean, report = clean_dataframe(df, PreprocessConfig(resample_interval="1min"))
    assert report["duplicate_rows_removed"] == 10
    assert len(clean) == len(sample_long_df)


def test_sorted_chronologically(sample_long_df):
    shuffled = sample_long_df.sample(frac=1.0, random_state=1)
    clean, _ = clean_dataframe(shuffled, PreprocessConfig(resample_interval="1min"))
    ts = clean["timestamp"]
    assert ts.is_monotonic_increasing


def test_linear_interpolation_fills_gaps(sample_long_df):
    df = sample_long_df.copy()
    df.loc[df.index[10:13], "parameter_value"] = np.nan
    clean, report = clean_dataframe(
        df, PreprocessConfig(resample_interval="1min", interpolation="linear", max_ffill_gap=5)
    )
    assert report["missing_values_after"] == 0
    assert report["values_interpolated"] >= 3


def test_no_interpolation_when_disabled(sample_long_df):
    df = sample_long_df.copy()
    df.loc[df.index[10:13], "parameter_value"] = np.nan
    _, report = clean_dataframe(df, PreprocessConfig(resample_interval="1min", interpolation="none"))
    assert report["missing_values_after"] == 3


def test_resampling_to_5min(sample_long_df):
    clean, _ = clean_dataframe(sample_long_df, PreprocessConfig(resample_interval="5min"))
    # 120 one-minute points -> 24 five-minute buckets
    assert len(clean) == 24


def test_outlier_labelled_not_dropped(sample_long_df):
    df = sample_long_df.copy()
    df.loc[df.index[50], "parameter_value"] = 1e6
    clean, report = clean_dataframe(df, PreprocessConfig(resample_interval="1min", outlier_zscore=4.0))
    assert report["outliers_labelled"] >= 1
    assert len(clean) == len(sample_long_df)  # nothing silently dropped


def test_quality_score_perfect_data(sample_long_df):
    clean, _ = clean_dataframe(sample_long_df, PreprocessConfig(resample_interval="1min"))
    q = compute_quality_score(clean)
    assert q["quality_score"] > 95
    assert q["completeness"] == 1.0


def test_quality_score_degrades_with_missing(sample_long_df):
    df = sample_long_df.copy()
    df.loc[df.index[:40], "parameter_value"] = np.nan
    q_bad = compute_quality_score(df)
    q_good = compute_quality_score(sample_long_df)
    assert q_bad["quality_score"] < q_good["quality_score"]


def test_quality_score_empty():
    q = compute_quality_score(pd.DataFrame(columns=["timestamp", "machine_id", "stage_name", "parameter_name", "parameter_value"]))
    assert q["quality_score"] == 0.0
