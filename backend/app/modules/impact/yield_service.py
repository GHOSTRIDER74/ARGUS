"""Yield calculations (Module 3).

Distinguishes percentage POINTS (baseline% - predicted%) from RELATIVE yield
degradation (points / baseline% * 100). Full float precision kept internally;
rounding happens only in the display layer.
"""
from app.modules.impact.tracing import step


def compute_yield(baseline_yield_percent: float, adjusted_defect_probability: float) -> tuple[dict, list[dict]]:
    baseline_rate = baseline_yield_percent / 100.0
    predicted_rate = max(0.0, baseline_rate - adjusted_defect_probability)
    predicted_percent = predicted_rate * 100.0
    loss_points = baseline_yield_percent - predicted_percent
    relative_degradation = (loss_points / baseline_yield_percent * 100.0) if baseline_yield_percent > 0 else 0.0

    values = {
        "baseline_yield_percent": baseline_yield_percent,
        "baseline_yield_rate": baseline_rate,
        "predicted_yield_rate": predicted_rate,
        "predicted_yield_percent": predicted_percent,
        "yield_loss_percentage_points": loss_points,
        "relative_yield_degradation_percent": relative_degradation,
    }
    steps = [
        step(
            "predicted_yield_rate",
            "max(0, baseline_yield_percent / 100 - adjusted_defect_probability)",
            {
                "baseline_yield_percent": baseline_yield_percent,
                "adjusted_defect_probability": adjusted_defect_probability,
            },
            predicted_rate,
        ),
        step(
            "yield_loss_percentage_points",
            "baseline_yield_percent - predicted_yield_percent",
            {"baseline_yield_percent": baseline_yield_percent, "predicted_yield_percent": predicted_percent},
            loss_points,
        ),
        step(
            "relative_yield_degradation_percent",
            "yield_loss_percentage_points / baseline_yield_percent * 100",
            {"yield_loss_percentage_points": loss_points, "baseline_yield_percent": baseline_yield_percent},
            relative_degradation,
        ),
    ]
    return values, steps
