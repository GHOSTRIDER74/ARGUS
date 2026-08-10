"""Model artifact storage: trained_models/drift_detection/<model_id>/..."""
import json
import uuid
from pathlib import Path

import joblib
import torch

from app.core.config import get_settings
from app.modules.drift_detection.exceptions import ModelNotFoundError
from app.modules.drift_detection.lstm_autoencoder import LSTMAutoencoder


def new_model_id() -> str:
    return uuid.uuid4().hex[:12]


def artifact_dir(model_id: str, create: bool = False) -> Path:
    settings = get_settings()
    d = settings.models_dir / "drift_detection" / model_id
    if create:
        d.mkdir(parents=True, exist_ok=True)
    return d


def save_artifacts(
    model_id: str,
    model: LSTMAutoencoder,
    scaler,
    metadata: dict,
    feature_names: list[str],
    training_history: dict,
    threshold_info: dict,
) -> Path:
    d = artifact_dir(model_id, create=True)
    torch.save({"state_dict": model.state_dict(), "config": model.config_dict()}, d / "model.pt")
    joblib.dump(scaler, d / "scaler.joblib")
    (d / "metadata.json").write_text(json.dumps(metadata, indent=2, default=str), encoding="utf-8")
    (d / "feature_names.json").write_text(json.dumps(feature_names, indent=2), encoding="utf-8")
    (d / "training_history.json").write_text(json.dumps(training_history, indent=2), encoding="utf-8")
    (d / "threshold.json").write_text(json.dumps(threshold_info, indent=2), encoding="utf-8")
    return d


def load_artifacts(model_id: str) -> tuple[LSTMAutoencoder, object, dict, list[str], dict]:
    """Returns (model, scaler, metadata, feature_names, threshold_info)."""
    d = artifact_dir(model_id)
    if not (d / "model.pt").exists():
        raise ModelNotFoundError(f"Artifacts for model '{model_id}' not found at {d}")
    payload = torch.load(d / "model.pt", map_location="cpu", weights_only=False)
    model = LSTMAutoencoder(**payload["config"])
    model.load_state_dict(payload["state_dict"])
    model.eval()
    scaler = joblib.load(d / "scaler.joblib")
    metadata = json.loads((d / "metadata.json").read_text(encoding="utf-8"))
    feature_names = json.loads((d / "feature_names.json").read_text(encoding="utf-8"))
    threshold_info = json.loads((d / "threshold.json").read_text(encoding="utf-8"))
    return model, scaler, metadata, feature_names, threshold_info


def delete_artifacts(model_id: str) -> None:
    import shutil

    d = artifact_dir(model_id)
    if d.exists():
        shutil.rmtree(d)
