"""Production quantities + throughput loss (Module 3)."""
from app.modules.impact.exceptions import InvalidAnalysisPeriodError
from app.modules.impact.tracing import step


def compute_throughput(
    units_per_hour: float,
    analysis_period_hours: float,
    baseline_yield_rate: float,
    predicted_yield_rate: float,
) -> tuple[dict, list[dict]]:
    if analysis_period_hours <= 0:
        raise InvalidAnalysisPeriodError("analysis_period_hours must be > 0")

    total_units = units_per_hour * analysis_period_hours
    baseline_good = total_units * baseline_yield_rate
    predicted_good = total_units * predicted_yield_rate
    additional_defective = max(0.0, baseline_good - predicted_good)
    throughput_loss_units = additional_defective  # baseline_good - predicted_good
    throughput_loss_percent = (throughput_loss_units / baseline_good * 100.0) if baseline_good > 0 else 0.0
    lost_per_hour = throughput_loss_units / analysis_period_hours

    values = {
        "total_units": total_units,
        "baseline_good_units": baseline_good,
        "predicted_good_units": predicted_good,
        "additional_defective_units": additional_defective,
        "throughput_loss_units": throughput_loss_units,
        "throughput_loss_percent": throughput_loss_percent,
        "lost_good_units_per_hour": lost_per_hour,
    }
    steps = [
        step(
            "total_units",
            "units_per_hour * analysis_period_hours",
            {"units_per_hour": units_per_hour, "analysis_period_hours": analysis_period_hours},
            total_units,
        ),
        step(
            "additional_defective_units",
            "max(0, total_units * baseline_yield_rate - total_units * predicted_yield_rate)",
            {
                "total_units": total_units,
                "baseline_yield_rate": baseline_yield_rate,
                "predicted_yield_rate": predicted_yield_rate,
            },
            additional_defective,
        ),
        step(
            "throughput_loss_percent",
            "throughput_loss_units / baseline_good_units * 100",
            {"throughput_loss_units": throughput_loss_units, "baseline_good_units": baseline_good},
            throughput_loss_percent,
        ),
        step(
            "lost_good_units_per_hour",
            "throughput_loss_units / analysis_period_hours",
            {"throughput_loss_units": throughput_loss_units, "analysis_period_hours": analysis_period_hours},
            lost_per_hour,
        ),
    ]
    return values, steps
