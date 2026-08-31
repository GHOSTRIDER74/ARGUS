"""Unit tests for leakage-safe feature engineering."""
import numpy as np

from app.modules.data_engineering.features import engineer_features
from app.schemas.dataset import PreprocessConfig

CFG = PreprocessConfig(rolling_window=10, lags=[1, 5])


def test_feature_columns_created(sample_long_df):
    out = engineer_features(sample_long_df, CFG)
    for col in [
        "rolling_mean",
        "rolling_std",
        "rolling_min",
        "rolling_max",
        "ema",
        "first_diff",
        "pct_change",
        "rolling_slope",
        "deviation_from_target",
        "normalised_deviation",
        "cumulative_deviation",
        "lag_1",
        "lag_5",
        "energy_per_unit",
        "chemical_per_unit",
    ]:
        assert col in out.columns, f"missing feature column {col}"


def test_no_future_leakage(sample_long_df):
    """Changing FUTURE values must not change features at earlier timestamps."""
    base = engineer_features(sample_long_df, CFG)
    modified = sample_long_df.copy()
    modified.loc[modified.index[100:], "parameter_value"] += 1000.0
    out = engineer_features(modified, CFG)

    check_cols = ["rolling_mean", "rolling_std", "ema", "rolling_slope", "lag_1", "cumulative_deviation"]
    a = base.iloc[:100][check_cols].to_numpy(dtype=float)
    b = out.iloc[:100][check_cols].to_numpy(dtype=float)
    assert np.allclose(a, b, equal_nan=True), "features before t=100 changed when only future values changed"


def test_lag_is_strictly_past(sample_long_df):
    out = engineer_features(sample_long_df, CFG)
    vals = out["parameter_value"].to_numpy()
    lag1 = out["lag_1"].to_numpy()
    assert np.isnan(lag1[0])
    assert np.allclose(lag1[1:], vals[:-1], equal_nan=True)


def test_deviation_from_target(sample_long_df):
    out = engineer_features(sample_long_df, CFG)
    expected = out["parameter_value"] - 65.0
    assert np.allclose(out["deviation_from_target"], expected)
