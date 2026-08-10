"""Builds the Module 2 -> Module 3 impact-input contract for a drift event.

This is the same construction previously done inline in the
/drift/events/{id}/impact-input route — extracted so the impact engine and the
API share one implementation. No detection logic lives here.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.drift import DriftEvent, DriftExplanation, DriftForecast
from app.schemas.drift import DriftImpactInput


def build_impact_input(db: Session, event: DriftEvent) -> DriftImpactInput:
    exp = db.scalar(
        select(DriftExplanation).where(DriftExplanation.drift_event_id == event.id)
        .order_by(DriftExplanation.created_at.desc()).limit(1)
    )
    fc = db.scalar(
        select(DriftForecast).where(DriftForecast.drift_event_id == event.id)
        .order_by(DriftForecast.created_at.desc()).limit(1)
    )
    primary = (exp.feature_contributions or [{}])[0] if exp else {}
    return DriftImpactInput(
        drift_event_id=event.id,
        dataset_id=event.dataset_id or 0,
        machine_id=event.machine_id,
        stage_name=event.stage_name,
        primary_parameter=event.primary_parameter or "",
        current_value=primary.get("current_value"),
        baseline_value=primary.get("baseline_value"),
        target_value=primary.get("target_value"),
        deviation_percent=primary.get("deviation_percent"),
        drift_type=event.drift_type,
        direction=event.direction,
        severity_score=event.severity_score,
        confidence=event.confidence,
        detected_at=event.detected_at,
        estimated_start_time=event.estimated_start_time,
        predicted_values=fc.forecast_values or [] if fc else [],
        affected_parameters=event.affected_parameters or [],
    )
