"""End-to-end detection workflow (Part 18 of the Module 2 spec).

Module 1 readings -> scale -> sequences -> LSTM errors + per-parameter CUSUM
-> hybrid status with persistence -> severity, root cause, forecast, health
-> digital twin update -> drift event persistence.
"""
import numpy as np
import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.drift import ModelVersion
from app.modules.data_engineering.stage_catalog import load_stage_catalog
from app.modules.digital_twin import twin_service
from app.modules.digital_twin.health_score import compute_health_score
from app.modules.drift_detection import (
    drift_event_service,
    explanation_service,
    forecasting_service,
    model_registry,
)
from app.modules.drift_detection.config import CusumConfig, HybridConfig, PersistenceConfig
from app.modules.drift_detection.cusum_detector import CusumDetector
from app.modules.drift_detection.drift_classifier import classify_drift
from app.modules.drift_detection.exceptions import InsufficientDataError, ModelNotFoundError
from app.modules.drift_detection.hybrid_detector import (
    STATUS_CONFIRMED,
    STATUS_CRITICAL,
    STATUS_WARNING,
    combine,
    normalise_lstm_score,
)
from app.modules.drift_detection.lstm_autoencoder import reconstruction_errors
from app.modules.drift_detection.sequence_builder import build_sequences
from app.modules.drift_detection.severity_service import compute_severity
from app.modules.drift_detection.training_service import load_wide_frame

logger = get_logger(__name__)


def resolve_model(db: Session, model_id: str | None, machine_id: str, stage_name: str) -> ModelVersion:
    if model_id:
        mv = db.scalar(select(ModelVersion).where(ModelVersion.model_id == model_id))
        if mv is None:
            raise ModelNotFoundError(f"Model '{model_id}' not found.")
        return mv
    mv = db.scalar(
        select(ModelVersion)
        .where(ModelVersion.machine_scope == machine_id, ModelVersion.stage_name == stage_name)
        .order_by((ModelVersion.status == "active").desc(), ModelVersion.created_at.desc())
        .limit(1)
    )
    if mv is None:
        raise ModelNotFoundError(f"No trained model for machine={machine_id}, stage={stage_name}.")
    return mv


def _operating_limits(stage_name: str, feature_names: list[str]) -> dict[str, dict]:
    """Operating limits come from the config-driven stage catalog."""
    limits: dict[str, dict] = {}
    try:
        stage = load_stage_catalog().stage(stage_name)
    except KeyError:
        return {f: {"lower": None, "upper": None} for f in feature_names}
    for f in feature_names:
        try:
            p = stage.parameter(f)
            limits[f] = {"lower": p.lower, "upper": p.upper}
        except KeyError:
            limits[f] = {"lower": None, "upper": None}
    return limits


def detect_from_frame(
    wide: pd.DataFrame,
    model,
    scaler,
    metadata: dict,
    feature_names: list[str],
    threshold_info: dict,
    machine_id: str,
    stage_name: str,
    model_id: str,
    dataset_id: int | None = None,
    start_time: str | None = None,
    end_time: str | None = None,
    cusum_config: CusumConfig | None = None,
    hybrid_config: HybridConfig | None = None,
    persistence_config: PersistenceConfig | None = None,
) -> tuple[dict, dict]:
    """Pure detection workflow on an in-memory wide frame (no database).

    Returns (result, context). context carries per-window detail and the
    intermediate objects the DB-persisting wrapper and evaluation need.
    """
    cusum_cfg = cusum_config or CusumConfig()
    hybrid_cfg = hybrid_config or HybridConfig()
    persist_cfg = persistence_config or PersistenceConfig()

    threshold = threshold_info["threshold"]
    baseline_stats: dict = metadata["baseline_stats"]
    param_info: dict = metadata.get("parameter_info", {})
    seq_len = metadata["sequence_length"]

    if start_time:
        wide = wide[wide.index >= pd.to_datetime(start_time, utc=True)]
    if end_time:
        wide = wide[wide.index <= pd.to_datetime(end_time, utc=True)]
    if len(wide) < seq_len:
        raise InsufficientDataError(f"Only {len(wide)} rows in the analysis window; need >= {seq_len}.")

    frame = wide[feature_names]

    # --- LSTM inference ---
    scaled = pd.DataFrame(
        scaler.transform(frame.to_numpy(dtype=np.float64)), index=frame.index, columns=feature_names
    )
    # sequence_builder drops NaN rows; sensor dropouts are handled by CUSUM/classifier
    scaled_clean = scaled.dropna()
    X, seq_meta = build_sequences(scaled_clean, feature_names, seq_len, stride=1)
    # map positions in the NaN-free frame back to positions in the full frame
    clean_to_full = frame.index.get_indexer(scaled_clean.index)
    seq_errs, feat_errs = reconstruction_errors(model, X)
    lstm_flags = seq_errs > threshold

    # --- CUSUM per parameter (raw values standardised with training baseline stats) ---
    timestamps = [ts.to_pydatetime() for ts in frame.index]
    cusum_results: dict[str, dict] = {}
    for f in feature_names:
        stats = baseline_stats.get(f, {})
        det = CusumDetector(k=cusum_cfg.k, h=cusum_cfg.h)
        res = det.detect(
            frame[f].to_numpy(dtype=float),
            timestamps,
            baseline_mean=stats.get("mean", float(np.nanmean(frame[f]))),
            baseline_std=stats.get("std", float(np.nanstd(frame[f])) or 1.0),
            parameter_name=f,
        )
        cusum_results[f] = {
            "parameter_name": f,
            "positive_cusum": round(res.positive_cusum, 3),
            "negative_cusum": round(res.negative_cusum, 3),
            "threshold": res.threshold,
            "signal": res.signal,
            "direction": res.direction,
            "estimated_start_time": res.estimated_start_time.isoformat() if res.estimated_start_time else None,
            "normalised_score": res.normalised_score,
            "_series_max": np.maximum(res.positive_series, -res.negative_series),
        }

    # --- per-window anomaly flags for persistence ---
    cusum_any = np.zeros(len(frame), dtype=bool)
    for f in feature_names:
        cusum_any |= cusum_results[f]["_series_max"] > cusum_cfg.h
    window_cusum_flags = np.array([cusum_any[clean_to_full[m.end_index]] for m in seq_meta])
    anomalous = lstm_flags | window_cusum_flags
    both = lstm_flags & window_cusum_flags

    trailing_confirmed = _trailing_run(both)
    trailing_anomalous = _trailing_run(anomalous)
    persistence_ratio = float(anomalous.mean()) if len(anomalous) else 0.0
    # 'recovered' needs a real anomalous episode (not isolated blips) followed by a clean tail
    recovered = bool(
        len(anomalous) >= 5
        and not anomalous[-5:].any()
        and _longest_run(anomalous) >= persist_cfg.min_consecutive_windows
    )

    # --- current scores (final window) ---
    lstm_score_now = normalise_lstm_score(float(seq_errs[-1]), threshold)
    cusum_score_now = max((r["normalised_score"] for r in cusum_results.values()), default=0.0)
    lstm_triggered = bool(lstm_flags[-max(persist_cfg.min_consecutive_windows, 1):].any())
    cusum_triggered = any(r["signal"] for r in cusum_results.values())

    hybrid = combine(
        cusum_score_now, lstm_score_now, cusum_triggered, lstm_triggered, hybrid_cfg, persistence_ratio
    )
    # persistence gate: confirmation needs a sustained signal, not a single window
    if hybrid["status"] in (STATUS_CONFIRMED, STATUS_CRITICAL):
        if trailing_confirmed < persist_cfg.min_consecutive_windows and trailing_anomalous < persist_cfg.min_consecutive_windows:
            hybrid["status"] = STATUS_WARNING
    if recovered and hybrid["status"] != STATUS_CRITICAL:
        hybrid["status"] = "recovered" if anomalous.any() else hybrid["status"]

    # --- root cause ---
    anomalous_feat_errs = feat_errs[anomalous] if anomalous.any() else feat_errs[-persist_cfg.min_consecutive_windows:]
    current_values = {f: float(frame[f].dropna().iloc[-1]) for f in feature_names if frame[f].notna().any()}
    explanation = explanation_service.explain(
        feature_names, anomalous_feat_errs, current_values, baseline_stats, param_info, cusum_results
    )
    primary = explanation["primary_parameter"]
    affected = [
        c["parameter_name"]
        for c in explanation["contributions"]
        if c["cusum_triggered"] or c["contribution"] > 1.5 / max(len(feature_names), 1)
    ]

    # --- drift type + estimated start ---
    primary_stats = baseline_stats.get(primary, {})
    classification = classify_drift(
        frame[primary],
        primary_stats.get("mean", 0.0),
        primary_stats.get("std", 1.0),
        anomalous,
        recovered,
    ) if primary else {"drift_type": "unknown_anomaly", "confidence": 0.3, "rule": "no primary parameter"}
    estimated_start = cusum_results.get(primary, {}).get("estimated_start_time") if primary else None
    direction = cusum_results.get(primary, {}).get("direction") if primary else None
    if direction is None and primary:
        pc = next((c for c in explanation["contributions"] if c["parameter_name"] == primary), None)
        direction = pc.get("direction") if pc else None

    # --- forecast on the primary parameter ---
    limits = _operating_limits(stage_name, feature_names)
    forecast = (
        forecasting_service.forecast_parameter(
            frame[primary], limits.get(primary, {}).get("lower"), limits.get(primary, {}).get("upper")
        )
        if primary
        else {"forecast_method": "linear_trend", "insufficient_data": True, "points": []}
    )

    # --- severity + health ---
    primary_contrib = explanation["contributions"][0] if explanation["contributions"] else {}
    severity = compute_severity(
        hybrid["hybrid_score"],
        primary_contrib.get("deviation_percent") or 0.0,
        persistence_ratio,
        len(affected),
        len(feature_names),
        forecast.get("hours_to_threshold_crossing"),
    )
    health = compute_health_score(
        hybrid["hybrid_score"], severity["score"], len(affected), persistence_ratio
    )

    drift_detected = hybrid["status"] in (STATUS_CONFIRMED, STATUS_CRITICAL)

    result = {
        "dataset_id": dataset_id,
        "model_id": model_id,
        "machine_id": machine_id,
        "stage_name": stage_name,
        "timestamp": frame.index[-1].isoformat(),
        "status": hybrid["status"],
        "drift_detected": drift_detected,
        "drift_type": classification["drift_type"],
        "drift_type_rule": classification["rule"],
        "direction": direction,
        "estimated_start_time": estimated_start,
        "cusum": {
            "triggered": cusum_triggered,
            "score": cusum_score_now,
            "per_parameter": [
                {k: v for k, v in r.items() if not k.startswith("_")} for r in cusum_results.values()
            ],
        },
        "lstm": {
            "triggered": lstm_triggered,
            "reconstruction_error": round(float(seq_errs[-1]), 6),
            "threshold": round(threshold, 6),
            "normalised_score": round(lstm_score_now, 4),
        },
        "hybrid_score": hybrid["hybrid_score"],
        "confidence": hybrid["confidence"],
        "severity": severity,
        "root_cause": primary_contrib,
        "affected_parameters": affected,
        "explanation": explanation,
        "health": health,
        "health_score": health["health_score"],
        "forecast": forecast,
        "windows_analysed": int(len(seq_errs)),
        "anomalous_windows": int(anomalous.sum()),
        "persistence_ratio": round(persistence_ratio, 4),
        "event_id": None,
    }

    context = {
        "frame": frame,
        "current_values": current_values,
        "param_info": param_info,
        "limits": limits,
        "classification": classification,
        "forecast": forecast,
        "explanation": explanation,
        "primary": primary,
        "affected": affected,
        "direction": direction,
        "estimated_start": estimated_start,
        "hybrid": hybrid,
        "severity": severity,
        "health": health,
        "cusum_score_now": cusum_score_now,
        "lstm_score_now": lstm_score_now,
        "drift_detected": drift_detected,
        "anomalous_flags": anomalous,
        "window_end_timestamps": [m.end_timestamp for m in seq_meta],
        "sequence_errors": seq_errs,
    }

    logger.info(
        "Detection dataset=%s machine=%s stage=%s -> %s (hybrid=%.3f, severity=%.1f)",
        dataset_id, machine_id, stage_name, hybrid["status"], hybrid["hybrid_score"], severity["score"],
    )
    return result, context


def run_detection(
    db: Session,
    dataset_id: int,
    machine_id: str,
    stage_name: str,
    model_id: str | None = None,
    start_time: str | None = None,
    end_time: str | None = None,
    persist_results: bool = True,
    cusum_config: CusumConfig | None = None,
    hybrid_config: HybridConfig | None = None,
    persistence_config: PersistenceConfig | None = None,
) -> dict:
    """DB-backed detection: load model + readings, detect, persist twin/event rows."""
    mv = resolve_model(db, model_id, machine_id, stage_name)
    model, scaler, metadata, feature_names, threshold_info = model_registry.load_artifacts(mv.model_id)
    wide, _ = load_wide_frame(db, dataset_id, machine_id, stage_name)

    result, ctx = detect_from_frame(
        wide,
        model,
        scaler,
        metadata,
        feature_names,
        threshold_info,
        machine_id,
        stage_name,
        mv.model_id,
        dataset_id=dataset_id,
        start_time=start_time,
        end_time=end_time,
        cusum_config=cusum_config,
        hybrid_config=hybrid_config,
        persistence_config=persistence_config,
    )

    if persist_results:
        frame = ctx["frame"]
        param_info = ctx["param_info"]
        hybrid = ctx["hybrid"]
        forecast = ctx["forecast"]
        severity = ctx["severity"]
        drift_detected = ctx["drift_detected"]
        primary = ctx["primary"]
        classification = ctx["classification"]
        estimated_start = ctx["estimated_start"]
        twin_service.upsert_state(
            db,
            machine_id,
            stage_name,
            dataset_id,
            frame.index[-1].to_pydatetime(),
            ctx["current_values"],
            {f: param_info.get(f, {}).get("target") for f in feature_names},
            ctx["limits"],
            ctx["cusum_score_now"],
            ctx["lstm_score_now"],
            hybrid["hybrid_score"],
            ctx["health"]["health_score"],
            hybrid["status"],
            classification["drift_type"] if drift_detected else None,
            primary if drift_detected else None,
            {
                "threshold_crossing_time": forecast.get("threshold_crossing_time"),
                "forecast_method": forecast.get("forecast_method"),
            },
        )
        if drift_detected:
            event = drift_event_service.create_or_update_event(
                db,
                dataset_id,
                machine_id,
                stage_name,
                {
                    "estimated_start_time": pd.to_datetime(estimated_start).to_pydatetime() if estimated_start else None,
                    "drift_type": classification["drift_type"],
                    "direction": ctx["direction"],
                    "cusum_score": ctx["cusum_score_now"],
                    "lstm_score": ctx["lstm_score_now"],
                    "hybrid_score": hybrid["hybrid_score"],
                    "severity_score": severity["score"],
                    "severity_level": severity["level"],
                    "health_score": ctx["health"]["health_score"],
                    "confidence": hybrid["confidence"],
                    "primary_parameter": primary,
                    "affected_parameters": ctx["affected"],
                    "detection_status": hybrid["status"],
                    "model_id": mv.model_id,
                },
            )
            drift_event_service.save_explanation(db, event.id, ctx["explanation"], hybrid["confidence"])
            if primary and not forecast.get("insufficient_data"):
                drift_event_service.save_forecast(db, event.id, primary, forecast)
            result["event_id"] = event.id
        db.commit()

    return result


def _trailing_run(flags: np.ndarray) -> int:
    run = 0
    for f in flags[::-1]:
        if not f:
            break
        run += 1
    return run


def _longest_run(flags: np.ndarray) -> int:
    best = cur = 0
    for f in flags:
        cur = cur + 1 if f else 0
        best = max(best, cur)
    return best
