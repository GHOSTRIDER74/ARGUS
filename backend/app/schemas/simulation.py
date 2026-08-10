"""Pydantic schemas for the synthetic data simulator."""
from typing import Literal

from pydantic import BaseModel, Field

DriftType = Literal[
    "linear",
    "exponential",
    "sudden_shift",
    "variance_increase",
    "sensor_bias",
    "sensor_dropout",
    "spike",
    "cyclic",
]


class DriftSpec(BaseModel):
    """One injected drift on a single stage parameter."""

    stage_name: str
    parameter_name: str
    drift_type: DriftType = "linear"
    start_fraction: float = Field(default=0.5, ge=0.0, le=1.0, description="Start of drift as a fraction of the timeline.")
    magnitude_sigmas: float = Field(default=3.0, description="Drift magnitude at the end of the timeline, in units of the parameter's sigma.")
    direction: Literal["up", "down"] = "up"


class SimulationConfig(BaseModel):
    name: str = "synthetic-run"
    n_batches: int = Field(default=4, ge=1)
    wafers_per_batch: int = Field(default=25, ge=1)
    duration_hours: float = Field(default=24.0, gt=0)
    sampling_interval_seconds: int = Field(default=60, ge=1)
    stages: list[str] | None = Field(default=None, description="Subset of configured stages; None = all.")
    noise_level: float = Field(default=1.0, ge=0.0, description="Multiplier on each parameter's sigma.")
    seed: int = 42
    seasonal_variation: bool = False
    degradation_rate: float = Field(default=0.0, ge=0.0, description="Slow health decay in sigmas per 24 h applied to all parameters.")
    drifts: list[DriftSpec] = []


class SimulationResult(BaseModel):
    dataset_id: int
    name: str
    row_count: int
    file_path: str
    ground_truth: list[dict]
    config: SimulationConfig
