"""Unit tests for the synthetic simulator (drift injection, ground truth, reproducibility)."""
import numpy as np

from app.modules.digital_twin.simulator import generate_dataset
from app.schemas.simulation import DriftSpec, SimulationConfig


def _cfg(**kwargs) -> SimulationConfig:
    defaults = dict(
        name="t",
        duration_hours=2.0,
        sampling_interval_seconds=60,
        stages=["etching"],
        seed=7,
    )
    defaults.update(kwargs)
    return SimulationConfig(**defaults)


def test_shape_and_schema():
    df, gt = generate_dataset(_cfg())
    assert len(df) == 120 * 4  # 4 etching parameters x 120 samples
    for col in ["timestamp", "batch_id", "machine_id", "stage_name", "parameter_name", "parameter_value", "drift_label", "energy_kwh"]:
        assert col in df.columns
    assert gt == []  # no drifts injected


def test_reproducible_with_seed():
    df1, _ = generate_dataset(_cfg(seed=99))
    df2, _ = generate_dataset(_cfg(seed=99))
    assert np.allclose(df1["parameter_value"], df2["parameter_value"], equal_nan=True)


def test_different_seed_differs():
    df1, _ = generate_dataset(_cfg(seed=1))
    df2, _ = generate_dataset(_cfg(seed=2))
    assert not np.allclose(df1["parameter_value"], df2["parameter_value"], equal_nan=True)


def test_linear_drift_and_ground_truth():
    drift = DriftSpec(
        stage_name="etching",
        parameter_name="chamber_pressure",
        drift_type="linear",
        start_fraction=0.5,
        magnitude_sigmas=8.0,
        direction="up",
    )
    df, gt = generate_dataset(_cfg(drifts=[drift]))
    assert len(gt) == 1
    assert gt[0]["parameter_name"] == "chamber_pressure"
    assert gt[0]["start_index"] == 60

    series = df[df["parameter_name"] == "chamber_pressure"].sort_values("timestamp")
    pre = series.iloc[:60]["parameter_value"].mean()
    post = series.iloc[90:]["parameter_value"].mean()
    assert post > pre + 2.0  # clear upward shift (8 sigma at end, sigma=1.2)

    labels = series["drift_label"].to_numpy()
    assert labels[:60].sum() == 0
    assert labels[60:].all()


def test_sudden_shift_down():
    drift = DriftSpec(
        stage_name="etching",
        parameter_name="rf_power",
        drift_type="sudden_shift",
        start_fraction=0.5,
        magnitude_sigmas=5.0,
        direction="down",
    )
    df, _ = generate_dataset(_cfg(drifts=[drift]))
    s = df[df["parameter_name"] == "rf_power"].sort_values("timestamp")["parameter_value"]
    assert s.iloc[60:].mean() < s.iloc[:60].mean() - 10.0  # 5 sigma = 20 W


def test_sensor_dropout_produces_nans():
    drift = DriftSpec(
        stage_name="etching",
        parameter_name="etch_rate",
        drift_type="sensor_dropout",
        start_fraction=0.8,
    )
    df, _ = generate_dataset(_cfg(drifts=[drift]))
    s = df[df["parameter_name"] == "etch_rate"].sort_values("timestamp")["parameter_value"]
    assert s.iloc[:96].notna().all()
    assert s.iloc[96:].isna().all()


def test_unknown_stage_raises():
    import pytest

    with pytest.raises(KeyError):
        generate_dataset(_cfg(stages=["warp_drive"]))
