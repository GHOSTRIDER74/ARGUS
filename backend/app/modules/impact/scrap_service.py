"""Scrap allocation + scrap cost breakdown (Module 3).

Only INCREMENTAL drift-caused defects are allocated here — baseline defects are
never counted as drift impact. Accumulated processing cost covers all completed
stages up to and including the drifting stage (configured stage_costs).
"""
from app.modules.impact.config import ParameterImpactRule, ResolvedProduction
from app.modules.impact.tracing import step


def allocate_scrap(additional_defective_units: float, rule: ParameterImpactRule) -> tuple[float, list[dict]]:
    scrap_units = additional_defective_units * rule.scrap_fraction
    return scrap_units, [
        step(
            "scrap_units",
            "additional_defective_units * scrap_fraction",
            {"additional_defective_units": additional_defective_units, "scrap_fraction": rule.scrap_fraction},
            scrap_units,
        )
    ]


def scrap_cost(scrap_units: float, prod: ResolvedProduction) -> tuple[dict, list[dict]]:
    material = scrap_units * prod.material_cost_per_unit
    processing = scrap_units * prod.accumulated_processing_cost_per_unit
    disposal = scrap_units * prod.scrap_disposal_cost_per_unit
    total = material + processing + disposal

    values = {
        "scrap_material_cost": material,
        "scrap_processing_cost": processing,
        "scrap_disposal_cost": disposal,
        "total_scrap_cost": total,
        "scrap_material_quantity": scrap_units,
    }
    steps = [
        step(
            "scrap_material_cost",
            "scrap_units * material_cost_per_unit",
            {"scrap_units": scrap_units, "material_cost_per_unit": prod.material_cost_per_unit},
            material,
        ),
        step(
            "scrap_processing_cost",
            "scrap_units * accumulated_processing_cost_per_unit (sum of completed stage costs)",
            {
                "scrap_units": scrap_units,
                "accumulated_processing_cost_per_unit": prod.accumulated_processing_cost_per_unit,
            },
            processing,
        ),
        step(
            "scrap_disposal_cost",
            "scrap_units * scrap_disposal_cost_per_unit",
            {"scrap_units": scrap_units, "scrap_disposal_cost_per_unit": prod.scrap_disposal_cost_per_unit},
            disposal,
        ),
        step(
            "total_scrap_cost",
            "scrap_material_cost + scrap_processing_cost + scrap_disposal_cost",
            {"scrap_material_cost": material, "scrap_processing_cost": processing, "scrap_disposal_cost": disposal},
            total,
        ),
    ]
    return values, steps
