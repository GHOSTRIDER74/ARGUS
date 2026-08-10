"""Pydantic schemas for datasets, validation and preprocessing."""
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class DatasetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    source_type: str
    original_filename: str | None = None
    stage_name: str | None = None
    start_timestamp: datetime | None = None
    end_timestamp: datetime | None = None
    row_count: int
    status: str
    quality_score: float | None = None
    created_at: datetime


class ValidationIssue(BaseModel):
    severity: Literal["error", "warning"]
    code: str
    message: str
    count: int = 0


class ValidationReport(BaseModel):
    dataset_id: int
    is_valid: bool
    total_rows: int
    issues: list[ValidationIssue]
    checked_at: datetime


class PreprocessConfig(BaseModel):
    """User-controllable preprocessing options."""

    resample_interval: str = Field(
        default="1min",
        description="Pandas offset alias: '1s', '1min', '5min' or any custom alias like '30s'.",
    )
    interpolation: Literal["linear", "ffill", "none"] = "linear"
    max_ffill_gap: int = Field(default=5, ge=0, description="Max consecutive gaps to forward-fill.")
    outlier_zscore: float = Field(default=4.0, gt=0, description="|z| above which a point is labelled an outlier.")
    generate_features: bool = True
    rolling_window: int = Field(default=20, ge=2)
    lags: list[int] = Field(default=[1, 5, 10])


class PreprocessResult(BaseModel):
    dataset_id: int
    run_id: int
    input_rows: int
    output_rows: int
    missing_values_before: int
    missing_values_after: int
    quality_score: float
    feature_file: str | None = None
    report: dict[str, Any]


class DatasetSummary(BaseModel):
    dataset_id: int
    row_count: int
    stages: list[str]
    machines: list[str]
    parameters: list[str]
    start_timestamp: datetime | None
    end_timestamp: datetime | None
    statistics: dict[str, dict[str, float]]


class QualityReport(BaseModel):
    dataset_id: int
    quality_score: float
    completeness: float
    validity: float
    uniqueness: float
    timeliness: float
    missing_by_column: dict[str, int]
    details: dict[str, Any]
