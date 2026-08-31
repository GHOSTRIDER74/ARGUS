"""Training pipeline: Module 1 dataset -> baseline -> scaler -> sequences -> LSTM AE."""
import platform
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from sklearn.preprocessing import StandardScaler
from sqlalchemy import select
from sqlalchemy.orm import Session
from torch.utils.data import DataLoader, TensorDataset

from app.core.logging import get_logger
from app.models import Dataset, SensorReading
from app.models.drift import ModelVersion, TrainingRun
from app.modules.drift_detection import model_registry
from app.modules.drift_detection.baseline_service import select_baseline
from app.modules.drift_detection.config import (
    BaselineSelection,
    DEFAULT_SEQUENCE_LENGTH,
    DEFAULT_STRIDE,
    DEFAULT_THRESHOLD_PERCENTILE,
    LSTMModelConfig,
    MIN_SEQUENCES,
)
from app.modules.drift_detection.exceptions import InsufficientDataError
from app.modules.drift_detection.lstm_autoencoder import LSTMAutoencoder, reconstruction_errors
from app.modules.drift_detection.sequence_builder import build_sequences, pivot_readings

logger = get_logger(__name__)


def load_wide_frame(
    db: Session, dataset_id: int, machine_id: str, stage_name: str
) -> tuple[pd.DataFrame, dict]:
    """Load cleaned Module 1 readings and pivot to a wide feature table.

    Also returns per-parameter info (target, unit) collected from the readings.
    """
    rows = db.execute(
        select(
            SensorReading.timestamp,
            SensorReading.parameter_name,
            SensorReading.parameter_value,
            SensorReading.target_value,
            SensorReading.unit,
        )
        .where(
            SensorReading.dataset_id == dataset_id,
            SensorReading.machine_id == machine_id,
            SensorReading.stage_name == stage_name,
        )
        .order_by(SensorReading.timestamp)
    ).all()
    if not rows:
        raise InsufficientDataError(
            f"No preprocessed readings for dataset={dataset_id}, machine={machine_id}, "
            f"stage={stage_name}. Run Module 1 preprocessing first."
        )
    long_df = pd.DataFrame(rows, columns=["timestamp", "parameter_name", "parameter_value", "target_value", "unit"])
    param_info: dict[str, dict] = {}
    for name, g in long_df.groupby("parameter_name"):
        param_info[str(name)] = {
            "target": float(g["target_value"].dropna().iloc[0]) if g["target_value"].notna().any() else None,
            "unit": g["unit"].dropna().iloc[0] if g["unit"].notna().any() else None,
        }
    return pivot_readings(long_df), param_info


def train_from_frame(
    wide: pd.DataFrame,
    param_info: dict,
    machine_id: str,
    stage_name: str,
    dataset_meta: dict | None = None,
    dataset_id: int | None = None,
    features: list[str] | None = None,
    sequence_length: int = DEFAULT_SEQUENCE_LENGTH,
    stride: int = DEFAULT_STRIDE,
    baseline_selection: BaselineSelection | None = None,
    model_config: LSTMModelConfig | None = None,
    threshold_percentile: float = DEFAULT_THRESHOLD_PERCENTILE,
) -> dict:
    """Pure training pipeline on an in-memory wide frame (no database).

    Trains the LSTM Autoencoder, fits the anomaly threshold and saves
    file-system artifacts. Returns everything callers need, including
    internal objects (prefixed '_') used by the DB-persisting wrapper.
    """
    cfg = model_config or LSTMModelConfig()
    baseline_selection = baseline_selection or BaselineSelection()

    feature_names = features or [c for c in wide.columns if wide[c].dtype.kind in "fc"]
    missing = [f for f in feature_names if f not in wide.columns]
    if missing:
        raise InsufficientDataError(f"Requested features missing from data: {', '.join(missing)}")

    baseline, baseline_summary = select_baseline(
        wide[feature_names], baseline_selection, dataset_meta, machine_id, stage_name
    )

    # chronological split of the HEALTHY baseline: 70% train / 15% val / 15% threshold-fit
    n = len(baseline)
    train_df = baseline.iloc[: int(n * 0.70)]
    val_df = baseline.iloc[int(n * 0.70) : int(n * 0.85)]
    test_df = baseline.iloc[int(n * 0.85) :]

    scaler = StandardScaler()
    scaler.fit(train_df.to_numpy(dtype=np.float64))

    def _sequences(df: pd.DataFrame) -> np.ndarray:
        scaled = pd.DataFrame(
            scaler.transform(df.to_numpy(dtype=np.float64)), index=df.index, columns=feature_names
        )
        X, _ = build_sequences(scaled, feature_names, sequence_length, stride)
        return X.astype(np.float32)

    try:
        X_train, X_val, X_test = _sequences(train_df), _sequences(val_df), _sequences(test_df)
    except InsufficientDataError as exc:
        raise InsufficientDataError(f"Baseline too small for sequence_length={sequence_length}: {exc}") from exc
    if len(X_train) < MIN_SEQUENCES:
        raise InsufficientDataError(
            f"Only {len(X_train)} training sequences; need at least {MIN_SEQUENCES}."
        )

    # --- torch training with early stopping ---
    torch.manual_seed(42)
    model = LSTMAutoencoder(
        n_features=len(feature_names),
        hidden_size=cfg.hidden_size,
        latent_size=cfg.latent_size,
        num_layers=cfg.num_layers,
        dropout=cfg.dropout,
    )
    optimiser = torch.optim.Adam(model.parameters(), lr=cfg.learning_rate)
    criterion = nn.MSELoss()
    loader = DataLoader(
        TensorDataset(torch.tensor(X_train)), batch_size=cfg.batch_size, shuffle=True
    )
    val_tensor = torch.tensor(X_val)

    history: dict[str, list[float]] = {"train_loss": [], "val_loss": []}
    best_val = float("inf")
    best_state = None
    patience_left = cfg.early_stopping_patience
    started_at = datetime.now(timezone.utc)

    for epoch in range(cfg.epochs):
        model.train()
        total = 0.0
        for (batch,) in loader:
            optimiser.zero_grad()
            loss = criterion(model(batch), batch)
            loss.backward()
            optimiser.step()
            total += loss.item() * len(batch)
        train_loss = total / len(X_train)

        model.eval()
        with torch.no_grad():
            val_loss = criterion(model(val_tensor), val_tensor).item()
        history["train_loss"].append(round(train_loss, 6))
        history["val_loss"].append(round(val_loss, 6))

        if val_loss < best_val - 1e-7:
            best_val = val_loss
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
            patience_left = cfg.early_stopping_patience
        else:
            patience_left -= 1
            if patience_left <= 0:
                logger.info("Early stopping at epoch %d", epoch + 1)
                break

    if best_state is not None:
        model.load_state_dict(best_state)
    model.eval()

    # --- anomaly threshold from healthy hold-out errors ---
    holdout = np.concatenate([X_val, X_test]) if len(X_test) else X_val
    seq_errs, _ = reconstruction_errors(model, holdout)
    threshold = float(np.percentile(seq_errs, threshold_percentile))
    threshold_info = {
        "threshold": threshold,
        "percentile": threshold_percentile,
        "healthy_error_mean": float(seq_errs.mean()),
        "healthy_error_std": float(seq_errs.std()),
        "healthy_error_max": float(seq_errs.max()),
    }

    baseline_stats = {
        f: {"mean": float(train_df[f].mean()), "std": float(train_df[f].std())}
        for f in feature_names
    }

    model_id = model_registry.new_model_id()
    completed_at = datetime.now(timezone.utc)
    metadata = {
        "model_id": model_id,
        "model_type": "lstm_autoencoder",
        "dataset_id": dataset_id,
        "machine_id": machine_id,
        "stage_name": stage_name,
        "feature_names": feature_names,
        "sequence_length": sequence_length,
        "stride": stride,
        "baseline": baseline_summary,
        "baseline_stats": baseline_stats,
        "parameter_info": param_info,
        "model_config": cfg.model_dump(),
        "threshold": threshold_info,
        "framework": f"torch-{torch.__version__}",
        "python": platform.python_version(),
        "training_start": started_at.isoformat(),
        "training_end": completed_at.isoformat(),
    }
    path = model_registry.save_artifacts(
        model_id, model, scaler, metadata, feature_names, history, threshold_info
    )

    logger.info("Trained drift model %s (val_loss=%.6f, threshold=%.6f)", model_id, best_val, threshold)
    return {
        "model_id": model_id,
        "features_used": feature_names,
        "sequences_created": int(len(X_train) + len(X_val) + len(X_test)),
        "baseline": baseline_summary,
        "best_validation_loss": best_val,
        "epochs_completed": len(history["train_loss"]),
        "threshold": threshold_info,
        "_metadata": metadata,
        "_history": history,
        "_artifact_path": path,
        "_started_at": started_at,
        "_completed_at": completed_at,
        "_model_config": cfg,
        "_sequence_length": sequence_length,
    }


def train_model(
    db: Session,
    dataset_id: int,
    machine_id: str,
    stage_name: str,
    features: list[str] | None = None,
    sequence_length: int = DEFAULT_SEQUENCE_LENGTH,
    stride: int = DEFAULT_STRIDE,
    baseline_selection: BaselineSelection | None = None,
    model_config: LSTMModelConfig | None = None,
    threshold_percentile: float = DEFAULT_THRESHOLD_PERCENTILE,
) -> dict:
    """Full training pipeline (DB-backed). Returns a summary with the model_version id."""
    dataset = db.get(Dataset, dataset_id)
    if dataset is None:
        raise InsufficientDataError(f"Dataset {dataset_id} does not exist.")

    wide, param_info = load_wide_frame(db, dataset_id, machine_id, stage_name)
    trained = train_from_frame(
        wide,
        param_info,
        machine_id,
        stage_name,
        dataset_meta=dataset.meta,
        dataset_id=dataset_id,
        features=features,
        sequence_length=sequence_length,
        stride=stride,
        baseline_selection=baseline_selection,
        model_config=model_config,
        threshold_percentile=threshold_percentile,
    )
    model_id = trained["model_id"]
    feature_names = trained["features_used"]
    baseline_summary = trained["baseline"]
    best_val = trained["best_validation_loss"]
    threshold_info = trained["threshold"]
    history = trained["_history"]
    path = trained["_artifact_path"]
    started_at = trained["_started_at"]
    completed_at = trained["_completed_at"]
    cfg = trained["_model_config"]

    version_count = db.scalar(
        select(ModelVersion.id).where(
            ModelVersion.stage_name == stage_name, ModelVersion.machine_scope == machine_id
        ).limit(1)
    )
    mv = ModelVersion(
        model_id=model_id,
        model_name=f"{stage_name}-{machine_id}-lstm_ae",
        model_type="lstm_autoencoder",
        version=1 if version_count is None else db.scalar(
            select(ModelVersion.version).where(
                ModelVersion.stage_name == stage_name, ModelVersion.machine_scope == machine_id
            ).order_by(ModelVersion.version.desc()).limit(1)
        ) + 1,
        dataset_id=dataset_id,
        stage_name=stage_name,
        machine_scope=machine_id,
        framework=f"torch-{torch.__version__}",
        feature_names=feature_names,
        sequence_length=sequence_length,
        training_configuration=cfg.model_dump(),
        metrics={"best_validation_loss": best_val, **threshold_info},
        model_path=str(path / "model.pt"),
        scaler_path=str(path / "scaler.joblib"),
        threshold=threshold_info["threshold"],
        status="trained",
    )
    db.add(mv)
    db.flush()
    run = TrainingRun(
        model_version_id=mv.id,
        dataset_id=dataset_id,
        status="completed",
        started_at=started_at,
        completed_at=completed_at,
        epochs_completed=len(history["train_loss"]),
        best_validation_loss=best_val,
        training_history=history,
    )
    db.add(run)
    db.commit()
    db.refresh(mv)

    return {
        "model_id": model_id,
        "model_version_db_id": mv.id,
        "version": mv.version,
        "features_used": feature_names,
        "sequences_created": trained["sequences_created"],
        "baseline": baseline_summary,
        "best_validation_loss": best_val,
        "epochs_completed": len(history["train_loss"]),
        "threshold": threshold_info,
    }
