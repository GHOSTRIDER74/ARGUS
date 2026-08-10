"""Financial aggregation (Module 3).

total_financial_impact = total_scrap_cost + total_rework_cost
                       + estimated_lost_production_value + downtime_cost

Double-count prevention (documented in calculation notes):
- material cost appears only in scrap cost, never in lost production value;
- processing cost appears only in scrap cost;
- downtime cost is included only when downtime_hours is explicitly supplied;
- reworked units stay in lost production value by default (conservative demo
  simplification); set credit_reworked_units_in_lost_value=true to credit them.
"""
from app.modules.impact.config import ResolvedProduction
from app.modules.impact.tracing import step


def lost_production_value(
    throughput_loss_units: float, rework_units: float, prod: ResolvedProduction
) -> tuple[float, list[dict], list[str]]:
    notes: list[str] = []
    units = throughput_loss_units
    if prod.credit_reworked_units_in_lost_value:
        units = max(0.0, throughput_loss_units - rework_units)
        notes.append(
            "Reworked units were credited back into lost production value "
            "(credit_reworked_units_in_lost_value=true)."
        )
    else:
        notes.append(
            "Reworked units are conservatively still counted in lost production value for the "
            "analysis period; recovered value is not credited back (demo simplification)."
        )
    value = units * prod.product_value_per_good_unit
    steps = [
        step(
            "estimated_lost_production_value",
            "lost_units * product_value_per_good_unit",
            {"lost_units": units, "product_value_per_good_unit": prod.product_value_per_good_unit},
            value,
        )
    ]
    return value, steps, notes


def downtime_cost(downtime_hours: float, prod: ResolvedProduction) -> tuple[float, list[dict], list[str]]:
    if downtime_hours <= 0:
        return 0.0, [], ["Downtime cost excluded: no downtime_hours supplied in the request."]
    cost = downtime_hours * prod.downtime_cost_per_hour
    steps = [
        step(
            "downtime_cost",
            "downtime_hours * downtime_cost_per_hour",
            {"downtime_hours": downtime_hours, "downtime_cost_per_hour": prod.downtime_cost_per_hour},
            cost,
        )
    ]
    return cost, steps, ["Downtime cost included because downtime_hours was explicitly supplied."]


def total_financial_impact(
    total_scrap_cost: float,
    total_rework_cost: float,
    estimated_lost_production_value: float,
    downtime_cost_value: float,
) -> tuple[float, list[dict]]:
    total = total_scrap_cost + total_rework_cost + estimated_lost_production_value + downtime_cost_value
    steps = [
        step(
            "total_financial_impact",
            "total_scrap_cost + total_rework_cost + estimated_lost_production_value + downtime_cost",
            {
                "total_scrap_cost": total_scrap_cost,
                "total_rework_cost": total_rework_cost,
                "estimated_lost_production_value": estimated_lost_production_value,
                "downtime_cost": downtime_cost_value,
            },
            total,
        )
    ]
    return total, steps
