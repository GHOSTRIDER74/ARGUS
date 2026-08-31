"""Configuration models + loaders for Module 3 (impact rules & production/cost config).

Everything is configuration-driven: no stage, parameter, coefficient, or cost
value is hard-coded in the calculation services. All shipped values are
DEMONSTRATION ASSUMPTIONS (is_demo=true in both JSON files).
"""
import json
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ValidationError, model_validator

from app.core.config import get_settings
from app.modules.impact.exceptions import InvalidImpactConfigError, MissingImpactRuleError


# ---------- impact rules (drift -> defect mapping) ----------

class LogisticCoefficients(BaseModel):
    intercept: float
    deviation: float
    duration_hours: float
    severity: float


class PiecewiseBand(BaseModel):
    max_abs_deviation_percent: float | None  # None = open-ended top band
    additional_defect_probability: float


class ParameterImpactRule(BaseModel):
    quality_metric: str
    impact_model: Literal["logistic", "piecewise"]
    logistic_coefficients: LogisticCoefficients | None = None
    piecewise_bands: list[PiecewiseBand] | None = None
    reworkable_fraction: float
    scrap_fraction: float

    @model_validator(mode="after")
    def _check(self) -> "ParameterImpactRule":
        if abs(self.reworkable_fraction + self.scrap_fraction - 1.0) > 1e-6:
            raise ValueError("reworkable_fraction + scrap_fraction must equal 1")
        if self.impact_model == "logistic" and self.logistic_coefficients is None:
            raise ValueError("logistic impact_model requires logistic_coefficients")
        if self.impact_model == "piecewise" and not self.piecewise_bands:
            raise ValueError("piecewise impact_model requires piecewise_bands")
        return self


class StageImpactRules(BaseModel):
    parameters: dict[str, ParameterImpactRule]


class UncertaintyModel(BaseModel):
    description: str = ""
    base_uncertainty: float
    confidence_penalty: float
    missing_confidence_default: float = 0.5


class ImpactRules(BaseModel):
    version: str
    is_demo: bool
    disclaimer: str = ""
    confidence_adjustment: Literal["multiply_probability"] = "multiply_probability"
    uncertainty: UncertaintyModel
    stages: dict[str, StageImpactRules]

    def rule_for(self, stage_name: str, parameter_name: str) -> ParameterImpactRule:
        stage = self.stages.get(stage_name)
        if stage is None:
            raise MissingImpactRuleError(
                f"No impact rules configured for stage '{stage_name}' (impact_rules.json)"
            )
        rule = stage.parameters.get(parameter_name)
        if rule is None:
            raise MissingImpactRuleError(
                f"No impact rule configured for parameter '{parameter_name}' "
                f"in stage '{stage_name}' (impact_rules.json)"
            )
        return rule


# ---------- production / cost configuration ----------

class CostDefaults(BaseModel):
    labour_cost_per_hour: float
    electricity_cost_per_kwh: float
    downtime_cost_per_hour: float
    scrap_disposal_cost_per_unit: float
    rework_time_hours_per_unit: float
    rework_energy_kwh_per_unit: float
    rework_material_cost_per_unit: float
    credit_reworked_units_in_lost_value: bool = False


class StageProduction(BaseModel):
    baseline_yield_percent: float
    units_per_hour: float
    wafers_per_batch: int | None = None
    dies_per_wafer: int | None = None
    product_value_per_good_unit: float
    material_cost_per_unit: float
    # optional per-stage overrides of the defaults
    labour_cost_per_hour: float | None = None
    electricity_cost_per_kwh: float | None = None
    downtime_cost_per_hour: float | None = None
    scrap_disposal_cost_per_unit: float | None = None
    rework_time_hours_per_unit: float | None = None
    rework_energy_kwh_per_unit: float | None = None
    rework_material_cost_per_unit: float | None = None


class ResolvedProduction(BaseModel):
    """Stage production config with defaults merged in — what the services consume."""

    stage_name: str
    currency: str
    baseline_yield_percent: float
    units_per_hour: float
    wafers_per_batch: int | None
    dies_per_wafer: int | None
    product_value_per_good_unit: float
    material_cost_per_unit: float
    labour_cost_per_hour: float
    electricity_cost_per_kwh: float
    downtime_cost_per_hour: float
    scrap_disposal_cost_per_unit: float
    rework_time_hours_per_unit: float
    rework_energy_kwh_per_unit: float
    rework_material_cost_per_unit: float
    credit_reworked_units_in_lost_value: bool
    accumulated_processing_cost_per_unit: float


class ProductionConfig(BaseModel):
    version: str
    is_demo: bool
    currency: str
    disclaimer: str = ""
    rounding_policy: str = ""
    defaults: CostDefaults
    stage_order: list[str]
    stage_costs: dict[str, float]
    stages: dict[str, StageProduction]

    def accumulated_processing_cost(self, stage_name: str) -> float:
        """Sum of per-stage processing costs for all completed stages up to and
        including the given stage (per stage_order)."""
        if stage_name not in self.stage_order:
            return self.stage_costs.get(stage_name, 0.0)
        idx = self.stage_order.index(stage_name)
        return sum(self.stage_costs.get(s, 0.0) for s in self.stage_order[: idx + 1])

    def production_for(self, stage_name: str) -> ResolvedProduction:
        stage = self.stages.get(stage_name)
        if stage is None:
            raise MissingImpactRuleError(
                f"No production configuration for stage '{stage_name}' (production_config.json)"
            )
        d = self.defaults
        return ResolvedProduction(
            stage_name=stage_name,
            currency=self.currency,
            baseline_yield_percent=stage.baseline_yield_percent,
            units_per_hour=stage.units_per_hour,
            wafers_per_batch=stage.wafers_per_batch,
            dies_per_wafer=stage.dies_per_wafer,
            product_value_per_good_unit=stage.product_value_per_good_unit,
            material_cost_per_unit=stage.material_cost_per_unit,
            labour_cost_per_hour=stage.labour_cost_per_hour if stage.labour_cost_per_hour is not None else d.labour_cost_per_hour,
            electricity_cost_per_kwh=stage.electricity_cost_per_kwh if stage.electricity_cost_per_kwh is not None else d.electricity_cost_per_kwh,
            downtime_cost_per_hour=stage.downtime_cost_per_hour if stage.downtime_cost_per_hour is not None else d.downtime_cost_per_hour,
            scrap_disposal_cost_per_unit=stage.scrap_disposal_cost_per_unit if stage.scrap_disposal_cost_per_unit is not None else d.scrap_disposal_cost_per_unit,
            rework_time_hours_per_unit=stage.rework_time_hours_per_unit if stage.rework_time_hours_per_unit is not None else d.rework_time_hours_per_unit,
            rework_energy_kwh_per_unit=stage.rework_energy_kwh_per_unit if stage.rework_energy_kwh_per_unit is not None else d.rework_energy_kwh_per_unit,
            rework_material_cost_per_unit=stage.rework_material_cost_per_unit if stage.rework_material_cost_per_unit is not None else d.rework_material_cost_per_unit,
            credit_reworked_units_in_lost_value=d.credit_reworked_units_in_lost_value,
            accumulated_processing_cost_per_unit=self.accumulated_processing_cost(stage_name),
        )


# ---------- loaders ----------

def parse_impact_rules(raw: dict) -> ImpactRules:
    try:
        return ImpactRules(**raw)
    except ValidationError as exc:
        raise InvalidImpactConfigError(f"Invalid impact rules configuration: {exc}") from exc


def parse_production_config(raw: dict) -> ProductionConfig:
    try:
        return ProductionConfig(**raw)
    except ValidationError as exc:
        raise InvalidImpactConfigError(f"Invalid production configuration: {exc}") from exc


def _read_json(path: str | Path) -> dict:
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


@lru_cache
def _default_impact_rules() -> ImpactRules:
    return parse_impact_rules(_read_json(get_settings().impact_rules_path))


@lru_cache
def _default_production_config() -> ProductionConfig:
    return parse_production_config(_read_json(get_settings().production_config_path))


def load_impact_rules(path: str | Path | None = None) -> ImpactRules:
    return _default_impact_rules() if path is None else parse_impact_rules(_read_json(path))


def load_production_config(path: str | Path | None = None) -> ProductionConfig:
    return _default_production_config() if path is None else parse_production_config(_read_json(path))
