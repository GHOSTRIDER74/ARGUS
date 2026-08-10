"""Drift-event lifecycle: creation with persistence rules, update, acknowledge, resolve."""
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.drift import DriftEvent, DriftExplanation, DriftForecast


def get_open_event(db: Session, dataset_id: int, machine_id: str, stage_name: str) -> DriftEvent | None:
    return db.scalar(
        select(DriftEvent).where(
            DriftEvent.dataset_id == dataset_id,
            DriftEvent.machine_id == machine_id,
            DriftEvent.stage_name == stage_name,
            DriftEvent.status.in_(["open", "acknowledged"]),
        )
    )


def create_or_update_event(db: Session, dataset_id: int, machine_id: str, stage_name: str, payload: dict) -> DriftEvent:
    """One active event per machine/stage/dataset — updated until it resolves."""
    event = get_open_event(db, dataset_id, machine_id, stage_name)
    created = event is None
    if created:
        event = DriftEvent(
            dataset_id=dataset_id,
            machine_id=machine_id,
            stage_name=stage_name,
            detected_at=datetime.now(timezone.utc),
            status="open",
        )
        db.add(event)

    for key, value in payload.items():
        setattr(event, key, value)
    db.flush()
    return event


def save_explanation(db: Session, event_id: int, explanation: dict, confidence: float) -> DriftExplanation:
    exp = DriftExplanation(
        drift_event_id=event_id,
        explanation_method=explanation["explanation_method"],
        primary_parameter=explanation["primary_parameter"],
        feature_contributions=explanation["contributions"],
        explanation_text=explanation["explanation_text"],
        confidence=confidence,
    )
    db.add(exp)
    db.flush()
    return exp


def save_forecast(db: Session, event_id: int, parameter_name: str, forecast: dict) -> DriftForecast:
    crossing = forecast.get("threshold_crossing_time")
    fc = DriftForecast(
        drift_event_id=event_id,
        parameter_name=parameter_name,
        forecast_method=forecast.get("forecast_method"),
        forecast_horizon_hours=max((p["horizon_hours"] for p in forecast.get("points", [])), default=None),
        forecast_values=forecast.get("points"),
        threshold_crossing_time=datetime.fromisoformat(crossing) if crossing else None,
        confidence_bounds={
            "residual_std": forecast.get("residual_std"),
            "assumptions": forecast.get("assumptions"),
        },
    )
    db.add(fc)
    db.flush()
    return fc


def acknowledge_event(db: Session, event: DriftEvent) -> DriftEvent:
    event.status = "acknowledged"
    db.commit()
    return event


def resolve_event(db: Session, event: DriftEvent, false_positive: bool = False) -> DriftEvent:
    event.status = "false_positive" if false_positive else "resolved"
    event.resolved_at = datetime.now(timezone.utc)
    db.commit()
    return event
