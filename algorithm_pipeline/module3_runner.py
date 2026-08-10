"""Module 3 runner for the standalone pipeline (no database).

Thin orchestration only: builds the Module 2 impact-input contract dict from
the detection result and calls the backend compute_impact() — no formulas are
duplicated here.
"""
from app.modules.impact.config import load_impact_rules, load_production_config
from app.modules.impact.exceptions import ImpactError
from app.modules.impact.impact_service import compute_impact

from algorithm_pipeline.config_loader import Module3Section


def _impact_input_from_detection(detection_result: dict, machine_id: str, stage_name: str) -> dict:
    """Mirror of the /drift/events/{id}/impact-input contract, built from the
    in-memory detection result instead of persisted rows."""
    root_cause = detection_result.get("root_cause") or {}
    forecast = detection_result.get("forecast") or {}
    severity = detection_result.get("severity") or {}
    return {
        "drift_event_id": 0,  # standalone run: no persisted event
        "dataset_id": 0,
        "machine_id": machine_id,
        "stage_name": stage_name,
        "primary_parameter": root_cause.get("parameter_name") or "",
        "current_value": root_cause.get("current_value"),
        "baseline_value": root_cause.get("baseline_value"),
        "target_value": root_cause.get("target_value"),
        "deviation_percent": root_cause.get("deviation_percent"),
        "drift_type": detection_result.get("drift_type"),
        "direction": detection_result.get("direction"),
        "severity_score": severity.get("score"),
        "confidence": detection_result.get("confidence"),
        "detected_at": detection_result.get("timestamp"),
        "estimated_start_time": detection_result.get("estimated_start_time"),
        "predicted_values": forecast.get("points") or [],
        "affected_parameters": detection_result.get("affected_parameters") or [],
    }


def run_module3(
    detection_result: dict, machine_id: str, stage_name: str, cfg: Module3Section
) -> dict | None:
    """Compute impact for a detection result. Returns None when disabled or
    when no impact can be calculated (reason is embedded in the dict)."""
    if not cfg.enabled:
        return None
    if not detection_result.get("drift_detected"):
        return {"skipped": True, "reason": "no confirmed drift for this target"}

    rules = load_impact_rules(cfg.impact_rule_file)
    production = load_production_config(cfg.production_configuration_file)
    impact_input = _impact_input_from_detection(detection_result, machine_id, stage_name)
    try:
        return compute_impact(
            impact_input,
            rules,
            production,
            analysis_period_hours=cfg.analysis_period_hours,
            downtime_hours=cfg.downtime_hours,
        )
    except ImpactError as exc:
        return {"skipped": True, "reason": str(exc)}
