"""Unit tests for the dataset validator."""
import pandas as pd

from app.modules.data_engineering.validator import validate_dataframe


def test_valid_dataframe_passes(sample_long_df):
    is_valid, issues = validate_dataframe(sample_long_df, known_stages=["etching"])
    assert is_valid
    assert not any(i.severity == "error" for i in issues)


def test_missing_required_columns_fails():
    df = pd.DataFrame({"timestamp": ["2026-01-01"], "foo": [1]})
    is_valid, issues = validate_dataframe(df)
    assert not is_valid
    assert any(i.code == "missing_columns" for i in issues)


def test_empty_dataframe_fails(sample_long_df):
    is_valid, issues = validate_dataframe(sample_long_df.iloc[0:0])
    assert not is_valid
    assert any(i.code == "empty_file" for i in issues)


def test_bad_timestamps_detected(sample_long_df):
    df = sample_long_df.copy().astype({"timestamp": "object"})
    df.loc[df.index[:5], "timestamp"] = "not-a-date"
    is_valid, issues = validate_dataframe(df)
    assert not is_valid
    issue = next(i for i in issues if i.code == "invalid_timestamps")
    assert issue.count == 5


def test_non_numeric_values_detected(sample_long_df):
    df = sample_long_df.copy().astype({"parameter_value": "object"})
    df.loc[df.index[:3], "parameter_value"] = "abc"
    is_valid, issues = validate_dataframe(df)
    assert not is_valid
    assert any(i.code == "non_numeric_values" for i in issues)


def test_missing_values_are_warning_not_error(sample_long_df):
    df = sample_long_df.copy()
    df.loc[df.index[:4], "parameter_value"] = None
    is_valid, issues = validate_dataframe(df)
    assert is_valid  # warnings do not invalidate
    assert any(i.code == "missing_values" for i in issues)


def test_unknown_stage_warns(sample_long_df):
    df = sample_long_df.copy()
    df["stage_name"] = "mystery_stage"
    is_valid, issues = validate_dataframe(df, known_stages=["etching"])
    assert is_valid
    assert any(i.code == "unknown_stage_names" for i in issues)


def test_negative_energy_fails(sample_long_df):
    df = sample_long_df.copy()
    df.loc[df.index[0], "energy_kwh"] = -5.0
    is_valid, issues = validate_dataframe(df)
    assert not is_valid
    assert any(i.code == "negative_energy_kwh" for i in issues)


def test_duplicate_rows_warn(sample_long_df):
    df = pd.concat([sample_long_df, sample_long_df.iloc[:10]], ignore_index=True)
    is_valid, issues = validate_dataframe(df)
    assert is_valid
    assert any(i.code == "duplicate_rows" for i in issues)


def test_inverted_limits_fail(sample_long_df):
    df = sample_long_df.copy()
    df.loc[df.index[0], "lower_operating_limit"] = 100.0
    is_valid, issues = validate_dataframe(df)
    assert not is_valid
    assert any(i.code == "inverted_limits" for i in issues)
