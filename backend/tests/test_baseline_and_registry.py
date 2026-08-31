"""Unit tests for baseline selection and the model registry (save/load round-trip)."""
import numpy as np
import pandas as pd
import pytest
import torch
from sklearn.preprocessing import StandardScaler

from app.modules.drift_detection import model_registry
from app.modules.drift_detection.baseline_service import select_baseline
from app.modules.drift_detection.config import BaselineSelection
from app.modules.drift_detection.exceptions import InsufficientDataError, ModelNotFoundError
from app.modules.drift_detection.lstm_autoencoder import LSTMAutoencoder, reconstruction_errors


def _wide(n=400):
    idx = pd.date_range("2026-01-01", periods=n, freq="1min", tz="UTC")
    rng = np.random.default_rng(0)
    return pd.DataFrame({"a": rng.normal(0, 1, n), "b": rng.normal(5, 1, n)}, index=idx)


# ---------- baseline selection ----------

def test_fraction_baseline():
    df = _wide(400)
    baseline, summary = select_baseline(df, BaselineSelection(method="fraction", fraction=0.5))
    assert summary["healthy_rows"] == 200
    assert baseline.index.max() < df.index[200]


def test_ground_truth_baseline_cuts_before_drift():
    df = _wide(400)
    meta = {
        "ground_truth": [
            {
                "stage_name": "etching",
                "machine_id": "ETCH-01",
                "parameter_name": "a",
                "start_timestamp": df.index[250].isoformat(),
            }
        ]
    }
    baseline, summary = select_baseline(
        df, BaselineSelection(method="ground_truth"), meta, "ETCH-01", "etching"
    )
    assert summary["healthy_rows"] == 250


def test_ground_truth_without_drift_uses_all():
    df = _wide(300)
    baseline, summary = select_baseline(
        df, BaselineSelection(method="ground_truth"), {"ground_truth": []}, "M-01", "etching"
    )
    assert summary["healthy_rows"] == 300


def test_time_range_baseline():
    df = _wide(400)
    sel = BaselineSelection(
        method="time_range",
        start_time=df.index[0].isoformat(),
        end_time=df.index[150].isoformat(),
    )
    _, summary = select_baseline(df, sel)
    assert summary["healthy_rows"] == 151


def test_too_small_baseline_rejected():
    df = _wide(400)
    with pytest.raises(InsufficientDataError):
        select_baseline(df, BaselineSelection(method="fraction", fraction=0.1))


def test_too_many_missing_rejected():
    df = _wide(400)
    df.loc[df.index[:200], "a"] = np.nan
    with pytest.raises(InsufficientDataError):
        select_baseline(df, BaselineSelection(method="fraction", fraction=1.0))


# ---------- LSTM shape + registry round-trip ----------

def test_lstm_shape():
    model = LSTMAutoencoder(n_features=3, hidden_size=8, latent_size=4)
    x = torch.randn(5, 12, 3)
    out = model(x)
    assert out.shape == (5, 12, 3)


def test_reconstruction_errors_shapes():
    model = LSTMAutoencoder(n_features=2, hidden_size=8, latent_size=4)
    X = np.random.default_rng(0).normal(0, 1, (7, 10, 2)).astype(np.float32)
    seq_errs, feat_errs = reconstruction_errors(model, X)
    assert seq_errs.shape == (7,)
    assert feat_errs.shape == (7, 2)
    assert (seq_errs >= 0).all()


def test_registry_save_load_roundtrip():
    model = LSTMAutoencoder(n_features=2, hidden_size=8, latent_size=4)
    scaler = StandardScaler().fit(np.random.default_rng(1).normal(0, 1, (50, 2)))
    model_id = model_registry.new_model_id()
    model_registry.save_artifacts(
        model_id,
        model,
        scaler,
        metadata={"model_id": model_id, "sequence_length": 10},
        feature_names=["a", "b"],
        training_history={"train_loss": [0.5], "val_loss": [0.6]},
        threshold_info={"threshold": 0.1, "percentile": 99},
    )
    loaded, loaded_scaler, meta, features, thr = model_registry.load_artifacts(model_id)
    assert features == ["a", "b"]
    assert thr["threshold"] == 0.1
    assert meta["sequence_length"] == 10

    # identical outputs after round-trip (eval mode disables dropout)
    model.eval()
    x = torch.randn(3, 10, 2)
    with torch.no_grad():
        assert torch.allclose(model(x), loaded(x), atol=1e-6)

    model_registry.delete_artifacts(model_id)
    with pytest.raises(ModelNotFoundError):
        model_registry.load_artifacts(model_id)
