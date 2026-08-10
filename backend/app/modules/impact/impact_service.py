"""Module 3 orchestrator: drift impact-input -> operational + financial impact.

Pure calculation lives in compute_impact() (no DB, reused by the standalone
pipeline). calculate_for_event() wraps it with contract retrieval and
persistence. No Module 2 detection logic is duplicated or recalculated here.

Rounding policy: full float precision internally; this module rounds only when
building the response (2 decimals for money/units, 4 for probabilities/rates).
"""
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.models.drift import DriftEvent
from app.models.impact import FinancialImpact, OperationalImpact
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
from app.modules.impact.config import ImpactRules, ProductionConfig
from app.modules.impact.exceptions import InvalidAnalysisPeriodError
from app.modules.impact.impact_input import build_impact_input
from app.modules.impact.tracing import step

logger = get_logger(__name__)


def _as_dt(value) -> datetime | None:
    if value is None or isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def _aware(dt: datetime | None) -> datetime | None:
    if dt is not None and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _r(value: float | None, digits: int = 2) -> float | None:
    return None if value is None else round(float(value), digits)


def resolve_analysis_period(
    analysis_period_hours: float | None,
    estimated_start_time,
    detected_at,
) -> tuple[float, str]:
    """Explicit period > elapsed drift duration > error. Never a silent default."""
    if analysis_period_hours is not None:
        if analysis_period_hours <= 0:
            raise InvalidAnalysisPeriodError("analysis_period_hours must be > 0")
        return float(analysis_period_hours), "explicit_request"

    start = _aware(_as_dt(estimated_start_time))
    if start is not None:
        end = _aware(_as_dt(detected_at)) or datetime.now(timezone.utc)
        hours = (end - start).total_seconds() / 3600.0
        if hours > 0:
            return hours, "drift_duration"

    raise InvalidAnalysisPeriodError(
        "No analysis period could be determined: provide analysis_period_hours explicitly "
        "or use a drift event with a valid estimated_start_time."
    )


def compute_impact(
    impact_input: dict,
    rules: ImpactRules,
    production: ProductionConfig,
    *,
    analysis_period_hours: float | None = None,
    downtime_hours: float = 0.0,
) -> dict:
    """Pure Module 3 calculation from a Module 2 impact-input contract dict."""
    stage_name = impact_input["stage_name"]
    parameter = impact_input["primary_parameter"]
    confidence = impact_input.get("confidence")
    severity = float(impact_input.get("severity_score") or 0.0)

    rule = quality_mapping.resolve_rule(rules, stage_name, parameter)
    prod = production.production_for(stage_name)

    notes: list[str] = []
    breakdown: list[dict] = []

    # --- analysis period + drift duration ---
    period, period_source = resolve_analysis_period(
        analysis_period_hours, impact_input.get("estimated_start_time"), impact_input.get("detected_at")
    )
    try:
        drift_duration, _ = resolve_analysis_period(
            None, impact_input.get("estimated_start_time"), impact_input.get("detected_at")
        )
    except InvalidAnalysisPeriodError:
        drift_duration = period
        notes.append("Drift duration unavailable; the analysis period is used in the defect model.")

    # --- deviation basis ---
    deviation_percent = impact_input.get("deviation_percent")
    if deviation_percent is None:
        current, baseline = impact_input.get("current_value"), impact_input.get("baseline_value")
        if current is not None and baseline not in (None, 0):
            deviation_percent = (current - baseline) / abs(baseline) * 100.0
            notes.append("deviation_percent was derived from current_value and baseline_value.")
        else:
            deviation_percent = 0.0
            notes.append("No deviation information available; deviation treated as 0%.")
    abs_deviation = abs(float(deviation_percent))

    # --- defect probability (confidence applied exactly once) ---
    raw_p = defect_model.raw_defect_probability(rule, abs_deviation, drift_duration, severity)
    adjusted_p = defect_model.adjust_for_confidence(raw_p, confidence)
    if rule.impact_model == "logistic":
        c = rule.logistic_coefficients
        formula = "1 / (1 + exp(-(intercept + c_dev*|deviation%| + c_dur*duration_h + c_sev*severity)))"
        inputs = {
            "intercept": c.intercept,
            "deviation_coefficient": c.deviation,
            "duration_coefficient": c.duration_hours,
            "severity_coefficient": c.severity,
            "abs_deviation_percent": abs_deviation,
            "drift_duration_hours": drift_duration,
            "severity_score": severity,
        }
    else:
        formula = "piecewise band lookup on |deviation%|"
        inputs = {"abs_deviation_percent": abs_deviation}
    breakdown.append(step("raw_defect_probability", formula, inputs, round(raw_p, 6)))
    breakdown.append(
        step(
            "confidence_adjusted_defect_probability",
            "raw_defect_probability * confidence",
            {"raw_defect_probability": round(raw_p, 6), "confidence": confidence},
            round(adjusted_p, 6),
        )
    )

    # --- yield / production / throughput ---
    yield_vals, y_steps = yield_service.compute_yield(prod.baseline_yield_percent, adjusted_p)
    thr_vals, t_steps = throughput_service.compute_throughput(
        prod.units_per_hour, period, yield_vals["baseline_yield_rate"], yield_vals["predicted_yield_rate"]
    )
    breakdown += y_steps + t_steps

    # --- scrap / rework (incremental drift-caused defects only) ---
    rework_units, r_alloc_steps = rework_service.allocate_rework(thr_vals["additional_defective_units"], rule)
    scrap_units, s_alloc_steps = scrap_service.allocate_scrap(thr_vals["additional_defective_units"], rule)
    scrap_costs, s_steps = scrap_service.scrap_cost(scrap_units, prod)
    rework_costs, r_steps = rework_service.rework_cost(rework_units, prod)
    breakdown += r_alloc_steps + s_alloc_steps + s_steps + r_steps

    # --- financial ---
    lpv, lpv_steps, lpv_notes = financial_service.lost_production_value(
        thr_vals["throughput_loss_units"], rework_units, prod
    )
    dt_cost, dt_steps, dt_notes = financial_service.downtime_cost(downtime_hours, prod)
    total, total_steps = financial_service.total_financial_impact(
        scrap_costs["total_scrap_cost"], rework_costs["total_rework_cost"], lpv, dt_cost
    )
    breakdown += lpv_steps + dt_steps + total_steps
    notes += lpv_notes + dt_notes
    notes.append(
        "Double-count prevention: material and processing costs appear only in scrap cost; "
        "lost production value uses product value only; downtime cost only when supplied."
    )

    # --- uncertainty ---
    unc_vals, u_steps = uncertainty_service.uncertainty_bounds(total, confidence, rules.uncertainty, rules.version)
    breakdown += u_steps

    baseline_expected_defects = thr_vals["total_units"] * (1.0 - yield_vals["baseline_yield_rate"])

    return {
        "impact_id": None,  # filled after persistence
        "drift_event_id": impact_input.get("drift_event_id"),
        "dataset_id": impact_input.get("dataset_id"),
        "machine_id": impact_input.get("machine_id"),
        "stage_name": stage_name,
        "primary_parameter": parameter,
        "analysis_period_hours": _r(period, 4),
        "analysis_period_source": period_source,
        "drift_duration_hours": _r(drift_duration, 4),
        "impact_model": rule.impact_model,
        "quality_metric": rule.quality_metric,
        "impact_rule_version": rules.version,
        "production_config_version": production.version,
        "is_demo_configuration": rules.is_demo or production.is_demo,
        "disclaimer": rules.disclaimer,
        "defect_probability": {
            "raw": _r(raw_p, 6),
            "confidence_adjusted": _r(adjusted_p, 6),
            "confidence_adjustment": rules.confidence_adjustment,
            "abs_deviation_percent": _r(abs_deviation, 4),
            "severity_score": _r(severity, 2),
            "confidence": confidence,
        },
        "operational": {
            "baseline_yield_percent": _r(yield_vals["baseline_yield_percent"], 4),
            "predicted_yield_percent": _r(yield_vals["predicted_yield_percent"], 4),
            "yield_loss_percentage_points": _r(yield_vals["yield_loss_percentage_points"], 4),
            "relative_yield_degradation_percent": _r(yield_vals["relative_yield_degradation_percent"], 4),
            "total_units": _r(thr_vals["total_units"]),
            "baseline_good_units": _r(thr_vals["baseline_good_units"]),
            "predicted_good_units": _r(thr_vals["predicted_good_units"]),
            "additional_defective_units": _r(thr_vals["additional_defective_units"]),
            "baseline_expected_defective_units": _r(baseline_expected_defects),
            "rework_units": _r(rework_units),
            "scrap_units": _r(scrap_units),
            "throughput_loss_units": _r(thr_vals["throughput_loss_units"]),
            "throughput_loss_percent": _r(thr_vals["throughput_loss_percent"], 4),
            "lost_good_units_per_hour": _r(thr_vals["lost_good_units_per_hour"]),
        },
        "financial": {
            "scrap_material_cost": _r(scrap_costs["scrap_material_cost"]),
            "scrap_processing_cost": _r(scrap_costs["scrap_processing_cost"]),
            "scrap_disposal_cost": _r(scrap_costs["scrap_disposal_cost"]),
            "total_scrap_cost": _r(scrap_costs["total_scrap_cost"]),
            "rework_labour_cost": _r(rework_costs["rework_labour_cost"]),
            "rework_energy_cost": _r(rework_costs["rework_energy_cost"]),
            "rework_material_cost": _r(rework_costs["rework_material_cost"]),
            "total_rework_cost": _r(rework_costs["total_rework_cost"]),
            "estimated_lost_production_value": _r(lpv),
            "downtime_cost": _r(dt_cost),
            "total_financial_impact": _r(total),
            "currency": prod.currency,
        },
        "uncertainty": {
            "best_case": _r(unc_vals["best_case"]),
            "expected_case": _r(unc_vals["expected_case"]),
            "worst_case": _r(unc_vals["worst_case"]),
            "confidence": _r(unc_vals["confidence"], 4),
            "uncertainty_width": _r(unc_vals["uncertainty_width"], 4),
            "assumption_version": unc_vals["assumption_version"],
            "note": unc_vals["note"],
        },
        "resource_quantities": {
            "rework_energy_kwh": _r(rework_costs["rework_energy_kwh"]),
            "rework_material_quantity": _r(rework_costs["rework_material_quantity"]),
            "scrap_material_quantity": _r(scrap_costs["scrap_material_quantity"]),
        },
        "calculation_notes": notes,
        "calculation_breakdown": breakdown,
    }


def persist_impact(db: Session, result: dict) -> tuple[OperationalImpact, FinancialImpact]:
    op = OperationalImpact(
        drift_event_id=result["drift_event_id"],
        dataset_id=result["dataset_id"] or None,
        machine_id=result["machine_id"],
        stage_name=result["stage_name"],
        primary_parameter=result["primary_parameter"],
        analysis_period_hours=result["analysis_period_hours"],
        raw_defect_probability=result["defect_probability"]["raw"],
        adjusted_defect_probability=result["defect_probability"]["confidence_adjusted"],
        baseline_yield_percent=result["operational"]["baseline_yield_percent"],
        predicted_yield_percent=result["operational"]["predicted_yield_percent"],
        yield_loss_percentage_points=result["operational"]["yield_loss_percentage_points"],
        total_units=result["operational"]["total_units"],
        additional_defective_units=result["operational"]["additional_defective_units"],
        rework_units=result["operational"]["rework_units"],
        scrap_units=result["operational"]["scrap_units"],
        throughput_loss_units=result["operational"]["throughput_loss_units"],
        calculation_details={
            "operational": result["operational"],
            "defect_probability": result["defect_probability"],
            "impact_model": result["impact_model"],
            "quality_metric": result["quality_metric"],
            "impact_rule_version": result["impact_rule_version"],
            "production_config_version": result["production_config_version"],
            "is_demo_configuration": result["is_demo_configuration"],
            "analysis_period_source": result["analysis_period_source"],
            "drift_duration_hours": result["drift_duration_hours"],
            "resource_quantities": result["resource_quantities"],
            "calculation_notes": result["calculation_notes"],
            "calculation_breakdown": result["calculation_breakdown"],
            "disclaimer": result["disclaimer"],
        },
    )
    db.add(op)
    db.flush()

    fin = FinancialImpact(
        operational_impact_id=op.id,
        currency=result["financial"]["currency"],
        scrap_material_cost=result["financial"]["scrap_material_cost"],
        scrap_processing_cost=result["financial"]["scrap_processing_cost"],
        scrap_disposal_cost=result["financial"]["scrap_disposal_cost"],
        total_scrap_cost=result["financial"]["total_scrap_cost"],
        rework_labour_cost=result["financial"]["rework_labour_cost"],
        rework_energy_cost=result["financial"]["rework_energy_cost"],
        rework_material_cost=result["financial"]["rework_material_cost"],
        total_rework_cost=result["financial"]["total_rework_cost"],
        estimated_lost_production_value=result["financial"]["estimated_lost_production_value"],
        downtime_cost=result["financial"]["downtime_cost"],
        total_financial_impact=result["financial"]["total_financial_impact"],
        best_case_cost=result["uncertainty"]["best_case"],
        expected_case_cost=result["uncertainty"]["expected_case"],
        worst_case_cost=result["uncertainty"]["worst_case"],
        confidence=result["uncertainty"]["confidence"],
        calculation_details={"financial": result["financial"], "uncertainty": result["uncertainty"]},
    )
    db.add(fin)
    db.commit()
    db.refresh(op)
    db.refresh(fin)
    return op, fin


def calculate_for_event(
    db: Session,
    event: DriftEvent,
    rules: ImpactRules,
    production: ProductionConfig,
    *,
    analysis_period_hours: float | None = None,
    downtime_hours: float = 0.0,
    persist_result: bool = True,
) -> dict:
    """Retrieve the Module 2 impact-input contract, compute and optionally persist."""
    impact_input = build_impact_input(db, event).model_dump()
    result = compute_impact(
        impact_input,
        rules,
        production,
        analysis_period_hours=analysis_period_hours,
        downtime_hours=downtime_hours,
    )
    if persist_result:
        op, fin = persist_impact(db, result)
        result["impact_id"] = op.id
        result["financial_impact_id"] = fin.id
        logger.info("Persisted impact %s for drift event %s", op.id, event.id)
    return result


def stored_impact_response(op: OperationalImpact, fin: FinancialImpact | None) -> dict:
    """Rebuild the full response shape from persisted rows."""
    details = op.calculation_details or {}
    fin_details = (fin.calculation_details or {}) if fin else {}
    return {
        "impact_id": op.id,
        "financial_impact_id": fin.id if fin else None,
        "drift_event_id": op.drift_event_id,
        "dataset_id": op.dataset_id,
        "machine_id": op.machine_id,
        "stage_name": op.stage_name,
        "primary_parameter": op.primary_parameter,
        "analysis_period_hours": op.analysis_period_hours,
        "analysis_period_source": details.get("analysis_period_source"),
        "drift_duration_hours": details.get("drift_duration_hours"),
        "impact_model": details.get("impact_model"),
        "quality_metric": details.get("quality_metric"),
        "impact_rule_version": details.get("impact_rule_version"),
        "production_config_version": details.get("production_config_version"),
        "is_demo_configuration": details.get("is_demo_configuration", True),
        "disclaimer": details.get("disclaimer"),
        "defect_probability": details.get("defect_probability"),
        "operational": details.get("operational"),
        "financial": fin_details.get("financial") if fin else None,
        "uncertainty": fin_details.get("uncertainty") if fin else None,
        "resource_quantities": details.get("resource_quantities"),
        "calculation_notes": details.get("calculation_notes"),
        "calculation_breakdown": details.get("calculation_breakdown"),
        "created_at": op.created_at,
    }
