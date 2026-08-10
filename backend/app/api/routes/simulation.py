"""Synthetic data generation endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.modules.data_engineering.stage_catalog import load_stage_catalog
from app.schemas.simulation import SimulationConfig, SimulationResult
from app.services import simulation_service

router = APIRouter(prefix="/simulation", tags=["simulation"])


@router.post("/generate", response_model=SimulationResult, status_code=201)
def generate(config: SimulationConfig, db: Session = Depends(get_db)) -> dict:
    catalog = load_stage_catalog()
    unknown = set(config.stages or []) - set(catalog.stage_names)
    if unknown:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown stages: {', '.join(sorted(unknown))}. Configured: {', '.join(catalog.stage_names)}",
        )
    for d in config.drifts:
        try:
            catalog.stage(d.stage_name).parameter(d.parameter_name)
        except KeyError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
    try:
        return simulation_service.run_simulation(db, config)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/stages")
def get_stages() -> dict:
    """Expose the configured stage catalog to the frontend."""
    catalog = load_stage_catalog()
    return {
        "config_version": catalog.config_version,
        "stages": [s.model_dump() for s in catalog.stages],
    }
