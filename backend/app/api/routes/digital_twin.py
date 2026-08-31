"""Digital twin state APIs."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.drift import DigitalTwinState
from app.modules.digital_twin import twin_service
from app.schemas.drift import TwinStateOut

router = APIRouter(prefix="/digital-twin", tags=["digital-twin"])


@router.get("/state", response_model=list[TwinStateOut])
def all_states(db: Session = Depends(get_db)) -> list[DigitalTwinState]:
    return twin_service.get_states(db)


@router.get("/state/{machine_id}", response_model=list[TwinStateOut])
def machine_states(machine_id: str, db: Session = Depends(get_db)) -> list[DigitalTwinState]:
    states = twin_service.get_states(db, machine_id=machine_id)
    if not states:
        raise HTTPException(status_code=404, detail=f"No twin state for machine {machine_id}")
    return states


@router.get("/state/{machine_id}/{stage_name}", response_model=TwinStateOut)
def machine_stage_state(machine_id: str, stage_name: str, db: Session = Depends(get_db)) -> DigitalTwinState:
    states = twin_service.get_states(db, machine_id=machine_id, stage_name=stage_name)
    if not states:
        raise HTTPException(status_code=404, detail=f"No twin state for {machine_id}/{stage_name}")
    return states[0]


@router.get("/history", response_model=list[TwinStateOut])
def history(
    machine_id: str | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
) -> list[DigitalTwinState]:
    q = select(DigitalTwinState).order_by(DigitalTwinState.id.desc()).limit(min(limit, 1000))
    if machine_id:
        q = q.where(DigitalTwinState.machine_id == machine_id)
    return list(db.scalars(q))
