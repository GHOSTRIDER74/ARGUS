"""Pydantic schemas for Module 2 (drift detection, digital twin, models)."""
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.modules.drift_detection.config import (
    BaselineSelection,
    CusumConfig,
    DEFAULT_SEQUENCE_LENGTH,
    DEFAULT_STRIDE,
    DEFAULT_THRESHOLD_PERCENTILE,
    HybridConfig,
    LSTMModelConfig,
    PersistenceConfig,
)


class TrainRequest(BaseModel):
    dataset_id: int
    stage_name: str
    machine_id: str
    features: list[str] | None = None
    sequence_length: int = Field(default=DEFAULT_SEQUENCE_LENGTH, ge=5)
    stride: int = Field(default=DEFAULT_STRIDE, ge=1)
    baseline_selection: BaselineSelection = BaselineSelection()
    model_config_options: LSTMModelConfig = Field(default_factory=LSTMModelConfig, alias="model_config")
    threshold_percentile: float = Field(default=DEFAULT_THRESHOLD_PERCENTILE, gt=50, le=100)

    model_config = ConfigDict(populate_by_name=True, protected_namespaces=())


class TrainResult(BaseModel):
    model_id: str
    model_version_db_id: int
    version: int
    features_used: list[str]
    sequences_created: int
    baseline: dict
    best_validation_loss: float
    epochs_completed: int
    threshold: dict

    model_config = ConfigDict(protected_namespaces=())


class ModelVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: int
    model_id: str
    model_name: str
    model_type: str
    version: int
    dataset_id: int | None
    stage_name: str
    machine_scope: str
    framework: str | None
    feature_names: list | None
    sequence_length: int | None
    metrics: dict | None
    threshold: float | None
    status: str
    created_at: datetime


class DetectRequest(BaseModel):
    dataset_id: int
    machine_id: str
    stage_name: str
    model_id: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    persist_results: bool = True
    cusum: CusumConfig = CusumConfig()
    hybrid: HybridConfig = HybridConfig()
    persistence: PersistenceConfig = PersistenceConfig()

    model_config = ConfigDict(protected_namespaces=())


class DriftEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: int
    dataset_id: int | None
    machine_id: str
    stage_name: str
    detected_at: datetime | None
    estimated_start_time: datetime | None
    resolved_at: datetime | None
    drift_type: str | None
    direction: str | None
    cusum_score: float | None
    lstm_score: float | None
    hybrid_score: float | None
    severity_score: float | None
    severity_level: str | None
    health_score: float | None
    confidence: float | None
    primary_parameter: str | None
    affected_parameters: list | None
    detection_status: str | None
    status: str
    model_id: str | None
    created_at: datetime


class TwinStateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    machine_id: str
    stage_name: str
    dataset_id: int | None
    state_timestamp: datetime | None
    batch_id: str | None
    parameter_values: dict | None
    target_values: dict | None
    operating_limits: dict | None
    cusum_score: float | None
    lstm_score: float | None
    hybrid_score: float | None
    health_score: float | None
    status: str | None
    drift_type: str | None
    root_cause_parameter: str | None
    prediction_summary: dict | None
    updated_at: datetime | None


class DriftImpactInput(BaseModel):
    """Stable output contract consumed by future Module 3 (financial impact).

    Module 3 is NOT implemented yet — this schema only defines the interface.
    """

    drift_event_id: int
    dataset_id: int
    machine_id: str
    stage_name: str
    primary_parameter: str
    current_value: float | None
    baseline_value: float | None
    target_value: float | None
    deviation_percent: float | None
    drift_type: str | None
    direction: str | None
    severity_score: float | None
    confidence: float | None
    detected_at: datetime | None
    estimated_start_time: datetime | None
    predicted_values: list[dict[str, Any]] = []
    affected_parameters: list[str] = []
