"""Traceable calculation steps: human-readable formulas + inputs, never code."""


def step(name: str, formula: str, inputs: dict, result: float | dict) -> dict:
    return {"name": name, "formula": formula, "inputs": inputs, "result": result}
