"""Configuration loading for the standalone algorithm pipeline.

Reuses the existing pydantic config models — nothing algorithmic is redefined
here, and no machine/stage/parameter names are hard-coded.
"""
import json
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, model_validator

from app.modules.drift_detection.config import (
    DEFAULT_SEQUENCE_LENGTH,
    DEFAULT_STRIDE,
    DEFAULT_THRESHOLD_PERCENTILE,
    BaselineSelection,
    CusumConfig,
    HybridConfig,
    LSTMModelConfig,
    PersistenceConfig,
)
from app.schemas.dataset import PreprocessConfig
from app.schemas.simulation import SimulationConfig


class DataSection(BaseModel):
    """Where the input data comes from: an existing CSV or the simulator."""

    source: Literal["csv", "synthetic"] = "synthetic"
    csv_path: str | None = None
    wide_format: bool = False
    ground_truth_path: str | None = None
    simulation: SimulationConfig | None = None

    @model_validator(mode="after")
    def _check(self) -> "DataSection":
        if self.source == "csv" and not self.csv_path:
            raise ValueError("data.source='csv' requires data.csv_path")
        return self


class TargetSection(BaseModel):
    """One machine/stage scope to train and detect on."""

    machine_id: str
    stage_name: str


class TrainingSection(BaseModel):
    existing_model_id: str | None = None  # reuse saved artifacts instead of training
    features: list[str] | None = None
    sequence_length: int = DEFAULT_SEQUENCE_LENGTH
    stride: int = DEFAULT_STRIDE
    threshold_percentile: float = DEFAULT_THRESHOLD_PERCENTILE
    baseline_selection: BaselineSelection = BaselineSelection()
    lstm: LSTMModelConfig = LSTMModelConfig()


class DetectionSection(BaseModel):
    start_time: str | None = None
    end_time: str | None = None
    cusum: CusumConfig = CusumConfig()
    hybrid: HybridConfig = HybridConfig()
    persistence: PersistenceConfig = PersistenceConfig()


class OutputSection(BaseModel):
    results_dir: str = "results"
    save_cleaned_data: bool = False


class Module3Section(BaseModel):
    """Optional operational/financial impact step (disabled by default)."""

    enabled: bool = False
    analysis_period_hours: float | None = None  # None => elapsed drift duration
    downtime_hours: float = 0.0
    impact_rule_file: str | None = None  # None => backend/app/config/impact_rules.json
    production_configuration_file: str | None = None  # None => backend/app/config/production_config.json


class PipelineConfig(BaseModel):
    name: str = "argus-algorithm-run"
    data: DataSection = DataSection()
    preprocessing: PreprocessConfig = PreprocessConfig()
    # empty targets => run for every machine/stage pair found in the data
    targets: list[TargetSection] = []
    training: TrainingSection = TrainingSection()
    detection: DetectionSection = DetectionSection()
    module3: Module3Section = Module3Section()
    output: OutputSection = OutputSection()


def load_config(path: str | Path) -> PipelineConfig:
    """Load a YAML or JSON pipeline configuration file."""
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Config file not found: {p}")
    text = p.read_text(encoding="utf-8")
    raw = yaml.safe_load(text) if p.suffix.lower() in (".yaml", ".yml") else json.loads(text)
    return PipelineConfig.model_validate(raw or {})
