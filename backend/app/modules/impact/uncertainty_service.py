"""Best/expected/worst-case estimates (Module 3).

Configurable model (impact_rules.json -> uncertainty):

  uncertainty_width = base_uncertainty + confidence_penalty * (1 - confidence)
  best_case  = max(0, expected * (1 - width))
  worst_case = expected * (1 + width)

Heuristic demonstration bounds — not calibrated confidence intervals.
"""
from app.modules.impact.config import UncertaintyModel
from app.modules.impact.tracing import step


def uncertainty_bounds(
    expected_cost: float, confidence: float | None, model: UncertaintyModel, rule_version: str
) -> tuple[dict, list[dict]]:
    conf = model.missing_confidence_default if confidence is None else max(0.0, min(1.0, confidence))
    width = model.base_uncertainty + model.confidence_penalty * (1.0 - conf)
    best = max(0.0, expected_cost * (1.0 - width))
    worst = expected_cost * (1.0 + width)

    values = {
        "best_case": best,
        "expected_case": expected_cost,
        "worst_case": worst,
        "confidence": conf,
        "uncertainty_width": width,
        "assumption_version": rule_version,
        "note": "Heuristic demonstration bounds — not calibrated confidence intervals.",
    }
    steps = [
        step(
            "uncertainty_width",
            "base_uncertainty + confidence_penalty * (1 - confidence)",
            {
                "base_uncertainty": model.base_uncertainty,
                "confidence_penalty": model.confidence_penalty,
                "confidence": conf,
            },
            width,
        ),
        step(
            "best_case / worst_case",
            "max(0, expected * (1 - width)) / expected * (1 + width)",
            {"expected_case": expected_cost, "uncertainty_width": width},
            {"best_case": best, "worst_case": worst},
        ),
    ]
    return values, steps
