"""Module 3 API routes: impact calculation, retrieval, production configurations.

Business calculations live in app.modules.impact — this file only wires
requests to the service layer.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.database.session import get_db
from app.models.drift import DriftEvent
from app.models.impact import FinancialImpact, ImpactRuleVersion, OperationalImpact, ProductionConfiguration
from app.modules.impact import impact_service
from app.modules.impact.config import (
    load_impact_rules,
    load_production_config,
    parse_impact_rules,
    parse_production_config,
)
from app.modules.impact.exceptions import (
    InvalidAnalysisPeriodError,
    InvalidImpactConfigError,
    MissingImpactRuleError,
)
from app.schemas.impact import (
    ImpactCalculateRequest,
    ImpactListItem,
    ImpactResult,
    ProductionConfigurationBody,
    ProductionConfigurationOut,
)

router = APIRouter(prefix="/impact", tags=["impact"])
logger = get_logger(__name__)


def _resolve_rules(db: Session, rule_version_id: int | None):
    if rule_version_id is None:
        return load_impact_rules()
    row = db.get(ImpactRuleVersion, rule_version_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f"Impact rule version {rule_version_id} not found")
    return parse_impact_rules(row.configuration)


def _resolve_production(db: Session, configuration_id: int | None):
    if configuration_id is None:
        return load_production_config()
    row = db.get(ProductionConfiguration, configuration_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f"Production configuration {configuration_id} not found")
    return parse_production_config(row.configuration)


@router.post("/calculate", response_model=ImpactResult, status_code=201)
def calculate(req: ImpactCalculateRequest, db: Session = Depends(get_db)) -> dict:
    event = db.get(DriftEvent, req.drift_event_id)
    if event is None:
        raise HTTPException(status_code=404, detail=f"Drift event {req.drift_event_id} not found")
    rules = _resolve_rules(db, req.impact_rule_version_id)
    production = _resolve_production(db, req.production_configuration_id)
    try:
        return impact_service.calculate_for_event(
            db,
            event,
            rules,
            production,
            analysis_period_hours=req.analysis_period_hours,
            downtime_hours=req.downtime_hours,
            persist_result=req.persist_result,
        )
    except MissingImpactRuleError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except InvalidAnalysisPeriodError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except InvalidImpactConfigError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


# ---------- production configurations (declared before /{impact_id}) ----------

@router.get("/configurations", response_model=list[ProductionConfigurationOut])
def list_configurations(db: Session = Depends(get_db)) -> list[ProductionConfiguration]:
    return list(db.scalars(select(ProductionConfiguration).order_by(ProductionConfiguration.created_at.desc())))


@router.post("/configurations", response_model=ProductionConfigurationOut, status_code=201)
def create_configuration(body: ProductionConfigurationBody, db: Session = Depends(get_db)) -> ProductionConfiguration:
    try:
        parse_production_config(body.configuration)  # validate the full document up front
    except InvalidImpactConfigError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    row = ProductionConfiguration(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/configurations/{configuration_id}", response_model=ProductionConfigurationOut)
def update_configuration(
    configuration_id: int, body: ProductionConfigurationBody, db: Session = Depends(get_db)
) -> ProductionConfiguration:
    row = db.get(ProductionConfiguration, configuration_id)
    if row is None:
        raise HTTPException(status_code=404, detail=f"Production configuration {configuration_id} not found")
    try:
        parse_production_config(body.configuration)
    except InvalidImpactConfigError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    for key, value in body.model_dump().items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row


# ---------- retrieval ----------

def _list_item(op: OperationalImpact, fin: FinancialImpact | None) -> dict:
    item = ImpactListItem.model_validate(op).model_dump()
    if fin is not None:
        item["total_financial_impact"] = fin.total_financial_impact
        item["currency"] = fin.currency
    return item


def _financial_for(db: Session, operational_impact_id: int) -> FinancialImpact | None:
    return db.scalar(
        select(FinancialImpact)
        .where(FinancialImpact.operational_impact_id == operational_impact_id)
        .order_by(FinancialImpact.created_at.desc())
        .limit(1)
    )


@router.get("/by-drift/{drift_event_id}", response_model=list[ImpactListItem])
def list_by_drift(drift_event_id: int, db: Session = Depends(get_db)) -> list[dict]:
    ops = db.scalars(
        select(OperationalImpact)
        .where(OperationalImpact.drift_event_id == drift_event_id)
        .order_by(OperationalImpact.created_at.desc())
    )
    return [_list_item(op, _financial_for(db, op.id)) for op in ops]


@router.get("", response_model=list[ImpactListItem])
def list_impacts(
    machine_id: str | None = None,
    stage_name: str | None = None,
    db: Session = Depends(get_db),
) -> list[dict]:
    q = select(OperationalImpact).order_by(OperationalImpact.created_at.desc())
    if machine_id:
        q = q.where(OperationalImpact.machine_id == machine_id)
    if stage_name:
        q = q.where(OperationalImpact.stage_name == stage_name)
    return [_list_item(op, _financial_for(db, op.id)) for op in db.scalars(q)]


def _get_impact_or_404(db: Session, impact_id: int) -> OperationalImpact:
    op = db.get(OperationalImpact, impact_id)
    if op is None:
        raise HTTPException(status_code=404, detail=f"Impact {impact_id} not found")
    return op


@router.get("/{impact_id}", response_model=ImpactResult)
def get_impact(impact_id: int, db: Session = Depends(get_db)) -> dict:
    op = _get_impact_or_404(db, impact_id)
    return impact_service.stored_impact_response(op, _financial_for(db, op.id))


@router.get("/{impact_id}/breakdown")
def get_impact_breakdown(impact_id: int, db: Session = Depends(get_db)) -> dict:
    op = _get_impact_or_404(db, impact_id)
    details = op.calculation_details or {}
    return {
        "impact_id": op.id,
        "drift_event_id": op.drift_event_id,
        "impact_rule_version": details.get("impact_rule_version"),
        "is_demo_configuration": details.get("is_demo_configuration", True),
        "calculation_notes": details.get("calculation_notes", []),
        "calculation_breakdown": details.get("calculation_breakdown", []),
    }
