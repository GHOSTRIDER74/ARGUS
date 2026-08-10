"""Data access for the standalone pipeline: CSV files or the existing simulator.

No database involved — everything stays in memory as pandas DataFrames.
"""
import json
from pathlib import Path

import pandas as pd

from app.core.constants import REQUIRED_COLUMNS
from app.modules.data_engineering.converter import wide_to_long
from app.modules.digital_twin.simulator import generate_dataset
from app.modules.drift_detection.exceptions import InsufficientDataError
from app.modules.drift_detection.sequence_builder import pivot_readings
from app.schemas.simulation import SimulationConfig

from algorithm_pipeline.config_loader import DataSection


def load_data(cfg: DataSection) -> tuple[pd.DataFrame, list[dict]]:
    """Load or generate a long-format dataset. Returns (long_df, ground_truth)."""
    if cfg.source == "csv":
        df = pd.read_csv(cfg.csv_path)
        if cfg.wide_format or not set(REQUIRED_COLUMNS).issubset(df.columns):
            df = wide_to_long(df)
        ground_truth: list[dict] = []
        if cfg.ground_truth_path:
            ground_truth = json.loads(Path(cfg.ground_truth_path).read_text(encoding="utf-8"))
        return df, ground_truth

    return generate_dataset(cfg.simulation or SimulationConfig())


def discover_targets(long_df: pd.DataFrame) -> list[tuple[str, str]]:
    """All (machine_id, stage_name) pairs present in the data."""
    pairs = long_df[["machine_id", "stage_name"]].dropna().drop_duplicates()
    return [(str(r.machine_id), str(r.stage_name)) for r in pairs.itertuples(index=False)]


def wide_frame_for(
    clean_df: pd.DataFrame, machine_id: str, stage_name: str
) -> tuple[pd.DataFrame, dict]:
    """Pivot cleaned readings for one machine/stage into a wide feature table.

    Mirrors training_service.load_wide_frame but works on an in-memory frame
    (readings without a parameter_value are excluded, as in the DB flow).
    Also returns per-parameter info (target, unit) collected from the readings.
    """
    scoped = clean_df[
        (clean_df["machine_id"] == machine_id) & (clean_df["stage_name"] == stage_name)
    ].dropna(subset=["parameter_value"])
    if scoped.empty:
        raise InsufficientDataError(
            f"No cleaned readings for machine={machine_id}, stage={stage_name}."
        )

    param_info: dict[str, dict] = {}
    for name, g in scoped.groupby("parameter_name"):
        target = None
        unit = None
        if "target_value" in g.columns and g["target_value"].notna().any():
            target = float(g["target_value"].dropna().iloc[0])
        if "unit" in g.columns and g["unit"].notna().any():
            unit = str(g["unit"].dropna().iloc[0])
        param_info[str(name)] = {"target": target, "unit": unit}

    wide = pivot_readings(scoped[["timestamp", "parameter_name", "parameter_value"]])
    return wide, param_info
