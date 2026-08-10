"""Shared constants for the ARGUS data pipeline (standard long-format schema)."""

# Minimum columns an uploaded CSV must contain to be accepted.
REQUIRED_COLUMNS: list[str] = [
    "timestamp",
    "machine_id",
    "stage_name",
    "parameter_name",
    "parameter_value",
]

# Full standard long-format sensor schema (section 12 of the project spec).
STANDARD_COLUMNS: list[str] = [
    "timestamp",
    "batch_id",
    "wafer_id",
    "machine_id",
    "stage_name",
    "parameter_name",
    "parameter_value",
    "target_value",
    "lower_operating_limit",
    "upper_operating_limit",
    "unit",
    "production_rate",
    "stage_duration",
    "energy_kwh",
    "material_consumption",
    "chemical_consumption",
    "quality_score",
    "defect_label",
]

# Columns that must never be negative when present.
NON_NEGATIVE_COLUMNS: list[str] = [
    "energy_kwh",
    "material_consumption",
    "chemical_consumption",
    "production_rate",
    "stage_duration",
]

DATASET_STATUS_UPLOADED = "uploaded"
DATASET_STATUS_VALIDATED = "validated"
DATASET_STATUS_PREPROCESSED = "preprocessed"
DATASET_STATUS_FAILED = "failed"

SOURCE_UPLOAD = "upload"
SOURCE_SYNTHETIC = "synthetic"

# Resample interval aliases exposed to the API.
RESAMPLE_INTERVALS: dict[str, str] = {
    "1s": "1s",
    "1min": "1min",
    "5min": "5min",
}
