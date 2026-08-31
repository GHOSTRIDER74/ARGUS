"""Loader for the config-driven stage/parameter definitions."""
import json
from functools import lru_cache

from pydantic import BaseModel

from app.core.config import get_settings


class ParameterConfig(BaseModel):
    name: str
    unit: str
    target: float
    lower: float
    upper: float
    sigma: float


class StageConfig(BaseModel):
    name: str
    display_name: str
    machine_prefix: str
    production_rate_per_hour: float
    stage_duration_min: float
    energy_kwh_per_hour: float
    material_consumption_per_hour: float
    chemical_consumption_per_hour: float
    parameters: list[ParameterConfig]

    def parameter(self, name: str) -> ParameterConfig:
        for p in self.parameters:
            if p.name == name:
                return p
        raise KeyError(f"Parameter '{name}' not defined for stage '{self.name}'")


class StageCatalog(BaseModel):
    config_version: str
    stages: list[StageConfig]

    @property
    def stage_names(self) -> list[str]:
        return [s.name for s in self.stages]

    def stage(self, name: str) -> StageConfig:
        for s in self.stages:
            if s.name == name:
                return s
        raise KeyError(f"Stage '{name}' is not defined in the stage configuration")


@lru_cache
def load_stage_catalog() -> StageCatalog:
    path = get_settings().stage_config_path
    with open(path, encoding="utf-8") as fh:
        raw = json.load(fh)
    return StageCatalog(config_version=raw["config_version"], stages=raw["stages"])
