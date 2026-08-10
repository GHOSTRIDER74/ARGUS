"""Configurable defaults for the Module 2 drift-detection engine.

All values are overridable per API request; nothing here is a hidden constant.
"""
from pydantic import BaseModel, Field


class LSTMModelConfig(BaseModel):
    hidden_size: int = Field(default=64, ge=4)
    latent_size: int = Field(default=32, ge=2)
    num_layers: int = Field(default=1, ge=1)
    dropout: float = Field(default=0.1, ge=0.0, lt=1.0)
    epochs: int = Field(default=50, ge=1)
    batch_size: int = Field(default=32, ge=1)
    learning_rate: float = Field(default=1e-3, gt=0)
    early_stopping_patience: int = Field(default=7, ge=1)


class CusumConfig(BaseModel):
    k: float = Field(default=0.5, gt=0, description="Allowance / slack in standard deviations.")
    h: float = Field(default=5.0, gt=0, description="Decision threshold in standard deviations.")


class HybridConfig(BaseModel):
    cusum_weight: float = Field(default=0.4, ge=0.0, le=1.0)
    lstm_weight: float = Field(default=0.6, ge=0.0, le=1.0)
    critical_score: float = Field(
        default=0.9, description="Hybrid score above which status becomes critical_anomaly."
    )


class PersistenceConfig(BaseModel):
    min_consecutive_windows: int = Field(
        default=5, ge=1, description="Consecutive anomalous windows required to confirm drift."
    )


class SeverityWeights(BaseModel):
    """Severity = weighted sum of 0-100 components. Weights must sum to 1."""

    hybrid: float = 0.35
    deviation: float = 0.25
    persistence: float = 0.15
    affected_features: float = 0.10
    forecast: float = 0.15


class HealthWeights(BaseModel):
    """ARGUS composite health score penalties (documented in digital_twin/health_score.py)."""

    anomaly_penalty_scale: float = 40.0
    severity_penalty_scale: float = 0.30
    affected_parameter_penalty_per_param: float = 5.0
    affected_parameter_penalty_max: float = 15.0
    persistence_penalty_max: float = 15.0


class BaselineSelection(BaseModel):
    method: str = Field(
        default="ground_truth",
        description="'ground_truth' (synthetic labels), 'time_range', or 'fraction'.",
    )
    start_time: str | None = None
    end_time: str | None = None
    fraction: float = Field(default=0.6, gt=0.0, le=1.0)


DEFAULT_SEQUENCE_LENGTH = 30
DEFAULT_STRIDE = 1
DEFAULT_THRESHOLD_PERCENTILE = 99.0
MIN_BASELINE_ROWS = 100
MIN_SEQUENCES = 20
MAX_MISSING_FRACTION = 0.2
MAX_GAP_FACTOR = 3.0  # break sequences when time gap > factor x median interval

SEVERITY_LEVELS = [
    (20, "minor"),
    (40, "low"),
    (60, "moderate"),
    (80, "high"),
    (100, "critical"),
]


def severity_level(score: float) -> str:
    for bound, name in SEVERITY_LEVELS:
        if score <= bound:
            return name
    return "critical"
