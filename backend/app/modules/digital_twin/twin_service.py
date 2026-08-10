"""Digital twin state persistence: one live state row per (machine, stage, dataset)."""
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.drift import DigitalTwinState


def upsert_state(
    db: Session,
    machine_id: str,
    stage_name: str,
    dataset_id: int | None,
    state_timestamp: datetime | None,
    parameter_values: dict,
    target_values: dict,
    operating_limits: dict,
    cusum_score: float,
    lstm_score: float,
    hybrid_score: float,
    health_score: float,
    status: str,
    drift_type: str | None,
    root_cause_parameter: str | None,
    prediction_summary: dict | None,
    batch_id: str | None = None,
) -> DigitalTwinState:
    state = db.scalar(
        select(DigitalTwinState).where(
            DigitalTwinState.machine_id == machine_id,
            DigitalTwinState.stage_name == stage_name,
            DigitalTwinState.dataset_id == dataset_id,
        )
    )
    if state is None:
        state = DigitalTwinState(machine_id=machine_id, stage_name=stage_name, dataset_id=dataset_id)
        db.add(state)

    state.state_timestamp = state_timestamp
    state.batch_id = batch_id
    state.parameter_values = parameter_values
    state.target_values = target_values
    state.operating_limits = operating_limits
    state.cusum_score = cusum_score
    state.lstm_score = lstm_score
    state.hybrid_score = hybrid_score
    state.health_score = health_score
    state.status = status
    state.drift_type = drift_type
    state.root_cause_parameter = root_cause_parameter
    state.prediction_summary = prediction_summary
    db.flush()
    return state


def get_states(
    db: Session, machine_id: str | None = None, stage_name: str | None = None
) -> list[DigitalTwinState]:
    q = select(DigitalTwinState).order_by(DigitalTwinState.updated_at.desc().nullslast(), DigitalTwinState.id.desc())
    if machine_id:
        q = q.where(DigitalTwinState.machine_id == machine_id)
    if stage_name:
        q = q.where(DigitalTwinState.stage_name == stage_name)
    return list(db.scalars(q))
