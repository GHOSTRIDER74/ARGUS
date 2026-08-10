"""Module 2 API routes: model training/registry, detection, drift events."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.database.session import get_db
from app.models.drift import DriftEvent, DriftExplanation, DriftForecast, ModelVersion
from app.modules.drift_detection import detection_service, drift_event_service, model_registry
from app.modules.drift_detection.exceptions import InsufficientDataError, ModelNotFoundError
from app.modules.drift_detection.training_service import train_model
from app.modules.impact.impact_input import build_impact_input
from app.schemas.drift import (
    DetectRequest,
    DriftEventOut,
    DriftImpactInput,
    ModelVersionOut,
    TrainRequest,
    TrainResult,
)

router = APIRouter(prefix="/drift", tags=["drift-detection"])
logger = get_logger(__name__)


# ---------- models ----------

@router.post("/models/train", response_model=TrainResult, status_code=201)
def train(req: TrainRequest, db: Session = Depends(get_db)) -> dict:
    try:
        return train_model(
            db,
            dataset_id=req.dataset_id,
            machine_id=req.machine_id,
            stage_name=req.stage_name,
            features=req.features,
            sequence_length=req.sequence_length,
            stride=req.stride,
            baseline_selection=req.baseline_selection,
            model_config=req.model_config_options,
            threshold_percentile=req.threshold_percentile,
        )
    except InsufficientDataError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/models", response_model=list[ModelVersionOut])
def list_models(db: Session = Depends(get_db)) -> list[ModelVersion]:
    return list(db.scalars(select(ModelVersion).order_by(ModelVersion.created_at.desc())))


@router.get("/models/{model_id}", response_model=ModelVersionOut)
def get_model(model_id: str, db: Session = Depends(get_db)) -> ModelVersion:
    mv = db.scalar(select(ModelVersion).where(ModelVersion.model_id == model_id))
    if mv is None:
        raise HTTPException(status_code=404, detail=f"Model {model_id} not found")
    return mv


@router.post("/models/{model_id}/activate", response_model=ModelVersionOut)
def activate_model(model_id: str, db: Session = Depends(get_db)) -> ModelVersion:
    mv = db.scalar(select(ModelVersion).where(ModelVersion.model_id == model_id))
    if mv is None:
        raise HTTPException(status_code=404, detail=f"Model {model_id} not found")
    siblings = db.scalars(
        select(ModelVersion).where(
            ModelVersion.machine_scope == mv.machine_scope,
            ModelVersion.stage_name == mv.stage_name,
            ModelVersion.status == "active",
        )
    )
    for s in siblings:
        s.status = "trained"
    mv.status = "active"
    db.commit()
    db.refresh(mv)
    return mv


@router.delete("/models/{model_id}", status_code=204)
def delete_model(model_id: str, db: Session = Depends(get_db)) -> None:
    mv = db.scalar(select(ModelVersion).where(ModelVersion.model_id == model_id))
    if mv is None:
        raise HTTPException(status_code=404, detail=f"Model {model_id} not found")
    model_registry.delete_artifacts(model_id)
    db.delete(mv)
    db.commit()


# ---------- detection ----------

@router.post("/detect")
def detect(req: DetectRequest, db: Session = Depends(get_db)) -> dict:
    try:
        return detection_service.run_detection(
            db,
            dataset_id=req.dataset_id,
            machine_id=req.machine_id,
            stage_name=req.stage_name,
            model_id=req.model_id,
            start_time=req.start_time,
            end_time=req.end_time,
            persist_results=req.persist_results,
            cusum_config=req.cusum,
            hybrid_config=req.hybrid,
            persistence_config=req.persistence,
        )
    except ModelNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except InsufficientDataError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


# ---------- events ----------

def _get_event_or_404(db: Session, event_id: int) -> DriftEvent:
    event = db.get(DriftEvent, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail=f"Drift event {event_id} not found")
    return event


@router.get("/events", response_model=list[DriftEventOut])
def list_events(
    machine_id: str | None = None,
    stage_name: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
) -> list[DriftEvent]:
    q = select(DriftEvent).order_by(DriftEvent.created_at.desc())
    if machine_id:
        q = q.where(DriftEvent.machine_id == machine_id)
    if stage_name:
        q = q.where(DriftEvent.stage_name == stage_name)
    if status:
        q = q.where(DriftEvent.status == status)
    return list(db.scalars(q))


@router.get("/events/{event_id}", response_model=DriftEventOut)
def get_event(event_id: int, db: Session = Depends(get_db)) -> DriftEvent:
    return _get_event_or_404(db, event_id)


@router.get("/events/{event_id}/explanation")
def get_event_explanation(event_id: int, db: Session = Depends(get_db)) -> dict:
    _get_event_or_404(db, event_id)
    exp = db.scalar(
        select(DriftExplanation)
        .where(DriftExplanation.drift_event_id == event_id)
        .order_by(DriftExplanation.created_at.desc())
        .limit(1)
    )
    if exp is None:
        raise HTTPException(status_code=404, detail="No explanation stored for this event")
    return {
        "drift_event_id": event_id,
        "explanation_method": exp.explanation_method,
        "primary_parameter": exp.primary_parameter,
        "feature_contributions": exp.feature_contributions,
        "explanation_text": exp.explanation_text,
        "confidence": exp.confidence,
        "created_at": exp.created_at,
    }


@router.get("/events/{event_id}/forecast")
def get_event_forecast(event_id: int, db: Session = Depends(get_db)) -> dict:
    _get_event_or_404(db, event_id)
    fc = db.scalar(
        select(DriftForecast)
        .where(DriftForecast.drift_event_id == event_id)
        .order_by(DriftForecast.created_at.desc())
        .limit(1)
    )
    if fc is None:
        raise HTTPException(status_code=404, detail="No forecast stored for this event")
    return {
        "drift_event_id": event_id,
        "parameter_name": fc.parameter_name,
        "forecast_method": fc.forecast_method,
        "forecast_values": fc.forecast_values,
        "threshold_crossing_time": fc.threshold_crossing_time,
        "confidence_bounds": fc.confidence_bounds,
        "created_at": fc.created_at,
    }


@router.get("/events/{event_id}/impact-input", response_model=DriftImpactInput)
def get_event_impact_input(event_id: int, db: Session = Depends(get_db)) -> DriftImpactInput:
    """Stable Module 3 contract — construction shared with the impact engine."""
    return build_impact_input(db, _get_event_or_404(db, event_id))


@router.post("/events/{event_id}/acknowledge", response_model=DriftEventOut)
def acknowledge(event_id: int, db: Session = Depends(get_db)) -> DriftEvent:
    return drift_event_service.acknowledge_event(db, _get_event_or_404(db, event_id))


@router.post("/events/{event_id}/resolve", response_model=DriftEventOut)
def resolve(event_id: int, false_positive: bool = False, db: Session = Depends(get_db)) -> DriftEvent:
    return drift_event_service.resolve_event(db, _get_event_or_404(db, event_id), false_positive)
