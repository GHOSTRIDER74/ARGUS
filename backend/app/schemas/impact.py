"""Pydantic schemas for Module 3 (operational & financial impact)."""
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ImpactCalculateRequest(BaseModel):
    drift_event_id: int
    analysis_period_hours: float | None = Field(default=None, gt=0)
    production_configuration_id: int | None = None
    impact_rule_version_id: int | None = None
    downtime_hours: float = Field(default=0.0, ge=0)
    persist_result: bool = True


class CalculationStep(BaseModel):
    name: str
    formula: str
    inputs: dict[str, Any]
    result: Any


class DefectProbabilityOut(BaseModel):
    raw: float
    confidence_adjusted: float
    confidence_adjustment: str
    abs_deviation_percent: float
    severity_score: float
    confidence: float | None


class OperationalOut(BaseModel):
    baseline_yield_percent: float
    predicted_yield_percent: float
    yield_loss_percentage_points: float
    relative_yield_degradation_percent: float
    total_units: float
    baseline_good_units: float
    predicted_good_units: float
    additional_defective_units: float
    baseline_expected_defective_units: float
    rework_units: float
    scrap_units: float
    throughput_loss_units: float
    throughput_loss_percent: float
    lost_good_units_per_hour: float


class FinancialOut(BaseModel):
    scrap_material_cost: float
    scrap_processing_cost: float
    scrap_disposal_cost: float
    total_scrap_cost: float
    rework_labour_cost: float
    rework_energy_cost: float
    rework_material_cost: float
    total_rework_cost: float
    estimated_lost_production_value: float
    downtime_cost: float
    total_financial_impact: float
    currency: str


class UncertaintyOut(BaseModel):
    best_case: float
    expected_case: float
    worst_case: float
    confidence: float
    uncertainty_width: float
    assumption_version: str
    note: str


class ResourceQuantitiesOut(BaseModel):
    rework_energy_kwh: float
    rework_material_quantity: float
    scrap_material_quantity: float


class ImpactResult(BaseModel):
    impact_id: int | None
    financial_impact_id: int | None = None
    drift_event_id: int
    dataset_id: int | None
    machine_id: str
    stage_name: str
    primary_parameter: str | None
    analysis_period_hours: float
    analysis_period_source: str | None
    drift_duration_hours: float | None
    impact_model: str | None
    quality_metric: str | None
    impact_rule_version: str | None
    production_config_version: str | None = None
    is_demo_configuration: bool
    disclaimer: str | None
    defect_probability: DefectProbabilityOut | None
    operational: OperationalOut | None
    financial: FinancialOut | None
    uncertainty: UncertaintyOut | None
    resource_quantities: ResourceQuantitiesOut | None
    calculation_notes: list[str] | None
    calculation_breakdown: list[CalculationStep] | None
    created_at: datetime | None = None


class ImpactListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    drift_event_id: int
    dataset_id: int | None
    machine_id: str
    stage_name: str
    primary_parameter: str | None
    analysis_period_hours: float
    adjusted_defect_probability: float | None
    predicted_yield_percent: float | None
    yield_loss_percentage_points: float | None
    additional_defective_units: float | None
    scrap_units: float | None
    rework_units: float | None
    throughput_loss_units: float | None
    total_financial_impact: float | None = None
    currency: str | None = None
    created_at: datetime


class ProductionConfigurationBody(BaseModel):
    name: str
    stage_name: str
    machine_id: str | None = None
    currency: str
    baseline_yield_percent: float = Field(gt=0, le=100)
    units_per_hour: float = Field(gt=0)
    wafers_per_batch: int | None = None
    dies_per_wafer: int | None = None
    product_value_per_good_unit: float = Field(ge=0)
    material_cost_per_unit: float = Field(ge=0)
    downtime_cost_per_hour: float = Field(ge=0)
    configuration: dict = Field(
        description="Full production-config document (same schema as production_config.json)."
    )
    is_demo: bool = True
    active: bool = True


class ProductionConfigurationOut(ProductionConfigurationBody):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime | None
