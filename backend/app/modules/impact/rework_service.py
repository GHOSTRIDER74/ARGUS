"""Rework allocation + rework cost breakdown (Module 3).

Also reports rework energy (kWh) and material quantities so Module 4 can later
reuse them. No emission/CO2 calculations here.
"""
from app.modules.impact.config import ParameterImpactRule, ResolvedProduction
from app.modules.impact.tracing import step


def allocate_rework(additional_defective_units: float, rule: ParameterImpactRule) -> tuple[float, list[dict]]:
    rework_units = additional_defective_units * rule.reworkable_fraction
    return rework_units, [
        step(
            "rework_units",
            "additional_defective_units * reworkable_fraction",
            {
                "additional_defective_units": additional_defective_units,
                "reworkable_fraction": rule.reworkable_fraction,
            },
            rework_units,
        )
    ]


def rework_cost(rework_units: float, prod: ResolvedProduction) -> tuple[dict, list[dict]]:
    labour = rework_units * prod.rework_time_hours_per_unit * prod.labour_cost_per_hour
    energy_kwh = rework_units * prod.rework_energy_kwh_per_unit
    energy = energy_kwh * prod.electricity_cost_per_kwh
    material = rework_units * prod.rework_material_cost_per_unit
    total = labour + energy + material

    values = {
        "rework_labour_cost": labour,
        "rework_energy_cost": energy,
        "rework_material_cost": material,
        "total_rework_cost": total,
        "rework_energy_kwh": energy_kwh,
        "rework_material_quantity": rework_units,
    }
    steps = [
        step(
            "rework_labour_cost",
            "rework_units * rework_time_hours_per_unit * labour_cost_per_hour",
            {
                "rework_units": rework_units,
                "rework_time_hours_per_unit": prod.rework_time_hours_per_unit,
                "labour_cost_per_hour": prod.labour_cost_per_hour,
            },
            labour,
        ),
        step(
            "rework_energy_cost",
            "rework_units * rework_energy_kwh_per_unit * electricity_cost_per_kwh",
            {
                "rework_units": rework_units,
                "rework_energy_kwh_per_unit": prod.rework_energy_kwh_per_unit,
                "electricity_cost_per_kwh": prod.electricity_cost_per_kwh,
            },
            energy,
        ),
        step(
            "rework_material_cost",
            "rework_units * rework_material_cost_per_unit",
            {"rework_units": rework_units, "rework_material_cost_per_unit": prod.rework_material_cost_per_unit},
            material,
        ),
        step(
            "total_rework_cost",
            "rework_labour_cost + rework_energy_cost + rework_material_cost",
            {"rework_labour_cost": labour, "rework_energy_cost": energy, "rework_material_cost": material},
            total,
        ),
    ]
    return values, steps
