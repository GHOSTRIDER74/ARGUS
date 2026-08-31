"""Module 3 unit tests: defect probability, yield, allocation, costs, uncertainty,
configuration validation and edge cases. Pure calculations — no API, no DB."""
import math

import pytest
from pydantic import ValidationError

from app.modules.impact import (
    defect_model,
    financial_service,
    quality_mapping,
    rework_service,
    scrap_service,
    throughput_service,
    uncertainty_service,
    yield_service,
)
from app.modules.impact.config import (
    LogisticCoefficients,
    ParameterImpactRule,
    PiecewiseBand,
    UncertaintyModel,
    load_impact_rules,
    load_production_config,
)
from app.modules.impact.exceptions import InvalidAnalysisPeriodError, MissingImpactRuleError
from app.modules.impact.impact_service import compute_impact, resolve_analysis_period


RULES = load_impact_rules()
PRODUCTION = load_production_config()
ETCH_RULE = RULES.rule_for("etching", "chamber_pressure")
ETCH_PROD = PRODUCTION.production_for("etching")


def _piecewise_rule() -> ParameterImpactRule:
    return ParameterImpactRule(
        quality_metric="test_metric",
        impact_model="piecewise",
        piecewise_bands=[
            PiecewiseBand(max_abs_deviation_percent=2.0, additional_defect_probability=0.005),
            PiecewiseBand(max_abs_deviation_percent=5.0, additional_defect_probability=0.02),
            PiecewiseBand(max_abs_deviation_percent=10.0, additional_defect_probability=0.06),
            PiecewiseBand(max_abs_deviation_percent=None, additional_defect_probability=0.15),
        ],
        reworkable_fraction=0.4,
        scrap_fraction=0.6,
    )


# ---------- defect probability ----------

def test_logistic_probability_matches_formula():
    c = LogisticCoefficients(intercept=-4.0, deviation=0.18, duration_hours=0.05, severity=0.025)
    z = -4.0 + 0.18 * 11.21 + 0.05 * 3.0 + 0.025 * 72.0
    expected = 1.0 / (1.0 + math.exp(-z))
    assert defect_model.logistic_probability(11.21, 3.0, 72.0, c) == pytest.approx(expected)


def test_logistic_probability_clamped_between_0_and_1():
    c = LogisticCoefficients(intercept=1000.0, deviation=100.0, duration_hours=0.0, severity=0.0)
    assert defect_model.logistic_probability(1e6, 0.0, 0.0, c) <= 1.0
    c2 = LogisticCoefficients(intercept=-1000.0, deviation=0.0, duration_hours=0.0, severity=0.0)
    assert defect_model.logistic_probability(0.0, 0.0, 0.0, c2) >= 0.0


def test_piecewise_bands_selected_correctly():
    rule = _piecewise_rule()
    assert defect_model.piecewise_probability(1.0, rule.piecewise_bands) == 0.005
    assert defect_model.piecewise_probability(2.0, rule.piecewise_bands) == 0.005  # boundary inclusive
    assert defect_model.piecewise_probability(3.5, rule.piecewise_bands) == 0.02
    assert defect_model.piecewise_probability(7.0, rule.piecewise_bands) == 0.06
    assert defect_model.piecewise_probability(50.0, rule.piecewise_bands) == 0.15  # open-ended band


def test_confidence_adjustment_applied_once():
    assert defect_model.adjust_for_confidence(0.4, 0.5) == pytest.approx(0.2)
    assert defect_model.adjust_for_confidence(0.4, None) == pytest.approx(0.4)  # missing => unchanged
    assert defect_model.adjust_for_confidence(0.4, 1.5) == pytest.approx(0.4)  # confidence clamped


# ---------- yield ----------

def test_yield_calculation_and_percentage_points():
    vals, steps = yield_service.compute_yield(96.0, 0.06)
    assert vals["predicted_yield_percent"] == pytest.approx(90.0)
    assert vals["yield_loss_percentage_points"] == pytest.approx(6.0)
    assert vals["relative_yield_degradation_percent"] == pytest.approx(6.25)
    assert steps  # traceable


def test_yield_clamped_at_zero():
    vals, _ = yield_service.compute_yield(50.0, 0.9)
    assert vals["predicted_yield_percent"] == 0.0
    assert vals["yield_loss_percentage_points"] == pytest.approx(50.0)


# ---------- production quantity + throughput ----------

def test_production_quantities():
    vals, _ = throughput_service.compute_throughput(1000.0, 8.0, 0.96, 0.90)
    assert vals["total_units"] == pytest.approx(8000.0)
    assert vals["baseline_good_units"] == pytest.approx(7680.0)
    assert vals["predicted_good_units"] == pytest.approx(7200.0)
    assert vals["additional_defective_units"] == pytest.approx(480.0)
    assert vals["throughput_loss_units"] == pytest.approx(480.0)
    assert vals["throughput_loss_percent"] == pytest.approx(6.25)
    assert vals["lost_good_units_per_hour"] == pytest.approx(60.0)


def test_zero_analysis_period_rejected():
    with pytest.raises(InvalidAnalysisPeriodError):
        throughput_service.compute_throughput(1000.0, 0.0, 0.96, 0.9)
    with pytest.raises(InvalidAnalysisPeriodError):
        resolve_analysis_period(0.0, None, None)
    with pytest.raises(InvalidAnalysisPeriodError):
        resolve_analysis_period(None, None, None)  # nothing to derive from — no silent default


def test_analysis_period_from_drift_duration():
    hours, source = resolve_analysis_period(None, "2026-01-01T00:00:00+00:00", "2026-01-01T06:00:00+00:00")
    assert hours == pytest.approx(6.0)
    assert source == "drift_duration"
    hours, source = resolve_analysis_period(8.0, "2026-01-01T00:00:00+00:00", "2026-01-01T06:00:00+00:00")
    assert (hours, source) == (8.0, "explicit_request")


# ---------- scrap / rework allocation ----------

def test_fraction_validation():
    with pytest.raises(ValidationError):
        ParameterImpactRule(
            quality_metric="m",
            impact_model="piecewise",
            piecewise_bands=[PiecewiseBand(max_abs_deviation_percent=None, additional_defect_probability=0.1)],
            reworkable_fraction=0.5,
            scrap_fraction=0.6,  # sums to 1.1
        )


def test_allocation_conserves_units():
    rule = _piecewise_rule()
    rework, _ = rework_service.allocate_rework(480.0, rule)
    scrap, _ = scrap_service.allocate_scrap(480.0, rule)
    assert rework == pytest.approx(192.0)
    assert scrap == pytest.approx(288.0)
    assert rework + scrap == pytest.approx(480.0)


# ---------- costs ----------

def test_scrap_cost_breakdown_with_accumulated_processing():
    # etching accumulated processing = cvd(100) + etching(150) = 250
    assert PRODUCTION.accumulated_processing_cost("etching") == pytest.approx(250.0)
    assert PRODUCTION.accumulated_processing_cost("cmp") == pytest.approx(430.0)
    vals, steps = scrap_service.scrap_cost(100.0, ETCH_PROD)
    assert vals["scrap_material_cost"] == pytest.approx(100.0 * ETCH_PROD.material_cost_per_unit)
    assert vals["scrap_processing_cost"] == pytest.approx(100.0 * 250.0)
    assert vals["scrap_disposal_cost"] == pytest.approx(100.0 * ETCH_PROD.scrap_disposal_cost_per_unit)
    assert vals["total_scrap_cost"] == pytest.approx(
        vals["scrap_material_cost"] + vals["scrap_processing_cost"] + vals["scrap_disposal_cost"]
    )
    assert len(steps) == 4


def test_rework_cost_breakdown_and_energy_quantity():
    vals, _ = rework_service.rework_cost(50.0, ETCH_PROD)
    assert vals["rework_labour_cost"] == pytest.approx(
        50.0 * ETCH_PROD.rework_time_hours_per_unit * ETCH_PROD.labour_cost_per_hour
    )
    assert vals["rework_energy_kwh"] == pytest.approx(50.0 * ETCH_PROD.rework_energy_kwh_per_unit)
    assert vals["rework_energy_cost"] == pytest.approx(
        vals["rework_energy_kwh"] * ETCH_PROD.electricity_cost_per_kwh
    )
    assert vals["total_rework_cost"] == pytest.approx(
        vals["rework_labour_cost"] + vals["rework_energy_cost"] + vals["rework_material_cost"]
    )


def test_lost_production_value_and_downtime():
    value, _, notes = financial_service.lost_production_value(480.0, 192.0, ETCH_PROD)
    assert value == pytest.approx(480.0 * ETCH_PROD.product_value_per_good_unit)
    assert any("not credited back" in n for n in notes)

    dt, _, notes = financial_service.downtime_cost(0.0, ETCH_PROD)
    assert dt == 0.0
    assert any("excluded" in n for n in notes)
    dt, _, _ = financial_service.downtime_cost(2.0, ETCH_PROD)
    assert dt == pytest.approx(2.0 * ETCH_PROD.downtime_cost_per_hour)


def test_total_cost_is_sum_of_components_no_double_count():
    total, steps = financial_service.total_financial_impact(207360.0, 23040.0, 150000.0, 0.0)
    assert total == pytest.approx(380400.0)
    inputs = steps[0]["inputs"]
    assert set(inputs) == {
        "total_scrap_cost", "total_rework_cost", "estimated_lost_production_value", "downtime_cost",
    }


# ---------- uncertainty ----------

def test_uncertainty_bounds_ordering_and_width():
    model = UncertaintyModel(base_uncertainty=0.15, confidence_penalty=0.35)
    vals, _ = uncertainty_service.uncertainty_bounds(100000.0, 0.89, model, "demo-v1")
    expected_width = 0.15 + 0.35 * (1 - 0.89)
    assert vals["uncertainty_width"] == pytest.approx(expected_width)
    assert vals["best_case"] <= vals["expected_case"] <= vals["worst_case"]
    assert vals["best_case"] == pytest.approx(100000.0 * (1 - expected_width))
    assert vals["assumption_version"] == "demo-v1"


def test_uncertainty_best_case_clamped_non_negative():
    model = UncertaintyModel(base_uncertainty=0.9, confidence_penalty=0.5, missing_confidence_default=0.0)
    vals, _ = uncertainty_service.uncertainty_bounds(100.0, None, model, "demo-v1")
    assert vals["best_case"] == 0.0  # width > 1 clamps to zero


# ---------- rule lookup ----------

def test_missing_stage_and_parameter_rules():
    with pytest.raises(MissingImpactRuleError):
        quality_mapping.resolve_rule(RULES, "nonexistent_stage", "chamber_pressure")
    with pytest.raises(MissingImpactRuleError):
        quality_mapping.resolve_rule(RULES, "etching", "nonexistent_parameter")


def test_shipped_configs_are_demo_labelled():
    assert RULES.is_demo is True
    assert "DEMONSTRATION" in RULES.disclaimer
    assert PRODUCTION.is_demo is True
    assert "DEMONSTRATION" in PRODUCTION.disclaimer


# ---------- end-to-end pure computation ----------

def _impact_input(**overrides) -> dict:
    base = {
        "drift_event_id": 1,
        "dataset_id": 1,
        "machine_id": "ETCH-01",
        "stage_name": "etching",
        "primary_parameter": "chamber_pressure",
        "current_value": 72.4,
        "baseline_value": 65.1,
        "target_value": 65.0,
        "deviation_percent": 11.21,
        "drift_type": "gradual_linear",
        "direction": "up",
        "severity_score": 72.0,
        "confidence": 0.89,
        "detected_at": "2026-01-01T06:00:00+00:00",
        "estimated_start_time": "2026-01-01T03:00:00+00:00",
        "predicted_values": [],
        "affected_parameters": ["chamber_pressure"],
    }
    base.update(overrides)
    return base


def test_compute_impact_full_result():
    result = compute_impact(_impact_input(), RULES, PRODUCTION, analysis_period_hours=8.0)
    assert result["is_demo_configuration"] is True
    assert result["impact_rule_version"] == "demo-v1"
    assert result["analysis_period_source"] == "explicit_request"
    assert result["drift_duration_hours"] == pytest.approx(3.0)
    p = result["defect_probability"]
    assert 0.0 <= p["raw"] <= 1.0
    assert p["confidence_adjusted"] == pytest.approx(p["raw"] * 0.89, rel=1e-3)
    op = result["operational"]
    assert op["total_units"] == pytest.approx(150.0 * 8.0)
    assert op["rework_units"] + op["scrap_units"] == pytest.approx(op["additional_defective_units"], abs=0.02)
    fin = result["financial"]
    assert fin["total_financial_impact"] == pytest.approx(
        fin["total_scrap_cost"] + fin["total_rework_cost"]
        + fin["estimated_lost_production_value"] + fin["downtime_cost"],
        rel=1e-6, abs=0.05,
    )
    unc = result["uncertainty"]
    assert unc["best_case"] <= unc["expected_case"] <= unc["worst_case"]
    assert result["calculation_breakdown"], "breakdown must be traceable"
    for s in result["calculation_breakdown"]:
        assert {"name", "formula", "inputs", "result"} <= set(s)
    # negative costs are impossible
    for key, value in fin.items():
        if key != "currency":
            assert value >= 0.0


def test_compute_impact_zero_drift():
    result = compute_impact(
        _impact_input(deviation_percent=0.0, severity_score=0.0, confidence=1.0),
        RULES, PRODUCTION, analysis_period_hours=8.0,
    )
    # near-zero logistic tail only; everything stays small and non-negative
    assert result["defect_probability"]["raw"] < 0.05
    assert result["operational"]["scrap_units"] >= 0.0
    assert result["financial"]["total_financial_impact"] >= 0.0


def test_compute_impact_critical_drift_clamped():
    result = compute_impact(
        _impact_input(deviation_percent=500.0, severity_score=100.0),
        RULES, PRODUCTION, analysis_period_hours=8.0,
    )
    assert result["defect_probability"]["raw"] <= 1.0
    assert result["operational"]["predicted_yield_percent"] >= 0.0


def test_compute_impact_downtime_included_only_when_supplied():
    without = compute_impact(_impact_input(), RULES, PRODUCTION, analysis_period_hours=8.0)
    with_dt = compute_impact(_impact_input(), RULES, PRODUCTION, analysis_period_hours=8.0, downtime_hours=2.0)
    assert without["financial"]["downtime_cost"] == 0.0
    assert with_dt["financial"]["downtime_cost"] == pytest.approx(2.0 * ETCH_PROD.downtime_cost_per_hour)
    assert with_dt["financial"]["total_financial_impact"] > without["financial"]["total_financial_impact"]


def test_compute_impact_missing_rule_raises():
    with pytest.raises(MissingImpactRuleError):
        compute_impact(
            _impact_input(primary_parameter="unknown_param"), RULES, PRODUCTION, analysis_period_hours=8.0
        )
