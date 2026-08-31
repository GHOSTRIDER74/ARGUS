"""Module 2 runner: training/loading, detection and ground-truth evaluation.

Thin orchestration over the existing drift_detection functions — the algorithm
formulas stay in backend/app/modules/drift_detection.
"""
import numpy as np
import pandas as pd

from app.modules.drift_detection import model_registry
from app.modules.drift_detection.detection_service import detect_from_frame
from app.modules.drift_detection.training_service import train_from_frame

from algorithm_pipeline.config_loader import DetectionSection, TrainingSection

Artifacts = tuple  # (model, scaler, metadata, feature_names, threshold_info)


def train_or_load(
    wide: pd.DataFrame,
    param_info: dict,
    machine_id: str,
    stage_name: str,
    ground_truth: list[dict],
    cfg: TrainingSection,
) -> tuple[str, Artifacts, dict]:
    """Train a new LSTM AE or load existing artifacts.

    Returns (model_id, artifacts, training_summary).
    """
    if cfg.existing_model_id:
        artifacts = model_registry.load_artifacts(cfg.existing_model_id)
        return cfg.existing_model_id, artifacts, {
            "model_id": cfg.existing_model_id,
            "reused_existing_model": True,
        }

    summary = train_from_frame(
        wide,
        param_info,
        machine_id,
        stage_name,
        dataset_meta={"ground_truth": ground_truth},
        features=cfg.features,
        sequence_length=cfg.sequence_length,
        stride=cfg.stride,
        baseline_selection=cfg.baseline_selection,
        model_config=cfg.lstm,
        threshold_percentile=cfg.threshold_percentile,
    )
    artifacts = model_registry.load_artifacts(summary["model_id"])
    public_summary = {k: v for k, v in summary.items() if not k.startswith("_")}
    return summary["model_id"], artifacts, public_summary


def detect(
    wide: pd.DataFrame,
    artifacts: Artifacts,
    model_id: str,
    machine_id: str,
    stage_name: str,
    cfg: DetectionSection,
) -> tuple[dict, dict]:
    """Run the full detection workflow on the wide frame. Returns (result, context)."""
    model, scaler, metadata, feature_names, threshold_info = artifacts
    return detect_from_frame(
        wide,
        model,
        scaler,
        metadata,
        feature_names,
        threshold_info,
        machine_id,
        stage_name,
        model_id,
        start_time=cfg.start_time,
        end_time=cfg.end_time,
        cusum_config=cfg.cusum,
        hybrid_config=cfg.hybrid,
        persistence_config=cfg.persistence,
    )


def evaluate_against_ground_truth(
    result: dict,
    context: dict,
    ground_truth: list[dict],
    machine_id: str,
    stage_name: str,
) -> dict:
    """Window-level evaluation against injected synthetic drift labels.

    A window is truly anomalous when its end timestamp is at/after the earliest
    injected drift start for this machine/stage. Predicted = the per-window
    anomaly flags produced by the detector.
    """
    flags = np.asarray(context["anomalous_flags"], dtype=bool)
    ends = pd.to_datetime(pd.Series(context["window_end_timestamps"]), utc=True)
    n = int(len(flags))

    relevant = [
        g
        for g in ground_truth
        if g.get("machine_id") == machine_id and g.get("stage_name") == stage_name
    ]
    if not relevant:
        fp = int(flags.sum())
        tn = n - fp
        return {
            "ground_truth_available": False,
            "windows": n,
            "note": "No injected drift for this scope; all windows should be healthy.",
            "false_positives": fp,
            "false_positive_rate": round(fp / n, 4) if n else None,
            "true_negatives": tn,
        }

    true_start = min(pd.to_datetime(g["start_timestamp"], utc=True) for g in relevant)
    truth = (ends >= true_start).to_numpy()

    tp = int((flags & truth).sum())
    fp = int((flags & ~truth).sum())
    fn = int((~flags & truth).sum())
    tn = int((~flags & ~truth).sum())

    precision = tp / (tp + fp) if (tp + fp) else None
    recall = tp / (tp + fn) if (tp + fn) else None
    if precision is None or recall is None:
        f1 = None
    elif precision + recall == 0:
        f1 = 0.0
    else:
        f1 = 2 * precision * recall / (precision + recall)
    fpr = fp / (fp + tn) if (fp + tn) else None
    fnr = fn / (fn + tp) if (fn + tp) else None

    detected_ends = ends[flags & truth]
    detection_delay_hours = (
        round(float((detected_ends.iloc[0] - true_start).total_seconds()) / 3600.0, 4)
        if len(detected_ends)
        else None
    )

    estimated_start = result.get("estimated_start_time")
    estimated_start_error_hours = (
        round(
            abs(float((pd.to_datetime(estimated_start, utc=True) - true_start).total_seconds()))
            / 3600.0,
            4,
        )
        if estimated_start
        else None
    )

    return {
        "ground_truth_available": True,
        "windows": n,
        "true_drift_start": true_start.isoformat(),
        "injected_drifts": [
            {k: g.get(k) for k in ("parameter_name", "drift_type", "direction", "start_timestamp")}
            for g in relevant
        ],
        "true_positives": tp,
        "false_positives": fp,
        "false_negatives": fn,
        "true_negatives": tn,
        "precision": round(precision, 4) if precision is not None else None,
        "recall": round(recall, 4) if recall is not None else None,
        "f1_score": round(f1, 4) if f1 is not None else None,
        "false_positive_rate": round(fpr, 4) if fpr is not None else None,
        "false_negative_rate": round(fnr, 4) if fnr is not None else None,
        "detection_delay_hours": detection_delay_hours,
        "estimated_start_error_hours": estimated_start_error_hours,
    }
