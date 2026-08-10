"""Config-driven synthetic process simulator with drift injection and ground truth.

Drift types supported (section 16 of the spec):
linear, exponential, sudden_shift, variance_increase, sensor_bias,
sensor_dropout, spike, cyclic — plus multiple simultaneous drifts via
several DriftSpec entries.
"""
import numpy as np
import pandas as pd

from app.modules.data_engineering.stage_catalog import StageCatalog, load_stage_catalog
from app.schemas.simulation import DriftSpec, SimulationConfig


def _drift_offsets(spec: DriftSpec, n: int, sigma: float, rng: np.random.Generator) -> tuple[np.ndarray, np.ndarray]:
    """Return (additive offset array, drift-active boolean array) for one drift spec."""
    start = int(spec.start_fraction * n)
    sign = 1.0 if spec.direction == "up" else -1.0
    magnitude = spec.magnitude_sigmas * sigma * sign
    offset = np.zeros(n)
    active = np.zeros(n, dtype=bool)
    span = max(n - start, 1)
    idx = np.arange(n)

    if spec.drift_type == "linear":
        offset[start:] = magnitude * (idx[start:] - start) / span
    elif spec.drift_type == "exponential":
        frac = (idx[start:] - start) / span
        offset[start:] = magnitude * (np.expm1(3.0 * frac) / np.expm1(3.0))
    elif spec.drift_type == "sudden_shift":
        offset[start:] = magnitude
    elif spec.drift_type == "variance_increase":
        extra = np.abs(spec.magnitude_sigmas) * sigma
        offset[start:] = rng.normal(0.0, extra, n - start)
    elif spec.drift_type == "sensor_bias":
        offset[start:] = magnitude
    elif spec.drift_type == "sensor_dropout":
        offset[start:] = np.nan  # handled by caller: NaN means dropped reading
    elif spec.drift_type == "spike":
        width = max(int(0.01 * n), 3)
        offset[start : start + width] = magnitude * 3.0
        active_slice = np.zeros(n, dtype=bool)
        active_slice[start : start + width] = True
        return offset, active_slice
    elif spec.drift_type == "cyclic":
        period = max(span // 6, 10)
        offset[start:] = magnitude * np.sin(2.0 * np.pi * (idx[start:] - start) / period)

    active[start:] = True
    return offset, active


def generate_dataset(
    config: SimulationConfig, catalog: StageCatalog | None = None
) -> tuple[pd.DataFrame, list[dict]]:
    """Generate a long-format synthetic dataset.

    Returns (dataframe, ground_truth) where ground_truth records the exact
    injected drifts (stage, parameter, type, start index/time) for later
    model evaluation.
    """
    catalog = catalog or load_stage_catalog()
    rng = np.random.default_rng(config.seed)

    stage_names = config.stages or catalog.stage_names
    n = int(config.duration_hours * 3600 / config.sampling_interval_seconds)
    if n < 2:
        raise ValueError("Simulation produces fewer than 2 samples; increase duration.")

    timestamps = pd.date_range(
        start=pd.Timestamp("2026-01-01", tz="UTC"),
        periods=n,
        freq=pd.Timedelta(seconds=config.sampling_interval_seconds),
    )

    # batch / wafer allocation: timeline evenly split into batches, wafers cycle
    batch_idx = np.minimum((np.arange(n) * config.n_batches) // n, config.n_batches - 1)
    wafer_idx = (np.arange(n) % config.wafers_per_batch) + 1

    hours_elapsed = np.arange(n) * config.sampling_interval_seconds / 3600.0
    interval_hours = config.sampling_interval_seconds / 3600.0

    frames: list[pd.DataFrame] = []
    ground_truth: list[dict] = []

    for stage_name in stage_names:
        stage = catalog.stage(stage_name)
        machine_id = f"{stage.machine_prefix}-01"
        drift_specs = [d for d in config.drifts if d.stage_name == stage_name]

        stage_drift_active = np.zeros(n, dtype=bool)

        for param in stage.parameters:
            sigma = param.sigma * config.noise_level
            values = rng.normal(param.target, sigma, n)

            if config.seasonal_variation:
                values += 0.5 * param.sigma * np.sin(2.0 * np.pi * hours_elapsed / 24.0)
            if config.degradation_rate > 0:
                values += config.degradation_rate * param.sigma * hours_elapsed / 24.0

            param_active = np.zeros(n, dtype=bool)
            for spec in (d for d in drift_specs if d.parameter_name == param.name):
                offset, active = _drift_offsets(spec, n, param.sigma, rng)
                values = values + offset  # NaN offsets => dropped readings
                param_active |= active
                start_i = int(spec.start_fraction * n)
                ground_truth.append(
                    {
                        "stage_name": stage_name,
                        "machine_id": machine_id,
                        "parameter_name": param.name,
                        "drift_type": spec.drift_type,
                        "direction": spec.direction,
                        "magnitude_sigmas": spec.magnitude_sigmas,
                        "start_index": start_i,
                        "start_timestamp": timestamps[min(start_i, n - 1)].isoformat(),
                    }
                )
            stage_drift_active |= param_active

            frames.append(
                pd.DataFrame(
                    {
                        "timestamp": timestamps,
                        "batch_id": [f"B{int(b) + 1:03d}" for b in batch_idx],
                        "wafer_id": [f"W{int(w):03d}" for w in wafer_idx],
                        "machine_id": machine_id,
                        "stage_name": stage_name,
                        "parameter_name": param.name,
                        "parameter_value": values,
                        "target_value": param.target,
                        "lower_operating_limit": param.lower,
                        "upper_operating_limit": param.upper,
                        "unit": param.unit,
                        "drift_label": param_active.astype(int),
                    }
                )
            )

        # stage-level resource columns attached to every parameter row of this stage
        energy = rng.normal(
            stage.energy_kwh_per_hour * interval_hours,
            0.03 * stage.energy_kwh_per_hour * interval_hours,
            n,
        ).clip(min=0)
        material = np.full(n, stage.material_consumption_per_hour * interval_hours)
        chemical = np.full(n, stage.chemical_consumption_per_hour * interval_hours)
        # drift degrades quality and slightly raises resource use
        quality = np.where(stage_drift_active, rng.uniform(0.75, 0.95, n), rng.uniform(0.93, 1.0, n))
        energy = np.where(stage_drift_active, energy * 1.08, energy)
        chemical = np.where(stage_drift_active, chemical * 1.05, chemical)

        stage_mask_start = len(frames) - len(stage.parameters)
        for f in frames[stage_mask_start:]:
            f["production_rate"] = stage.production_rate_per_hour
            f["stage_duration"] = stage.stage_duration_min
            f["energy_kwh"] = energy
            f["material_consumption"] = material
            f["chemical_consumption"] = chemical
            f["quality_score"] = quality
            f["defect_label"] = (quality < 0.85).astype(int)

    df = pd.concat(frames, ignore_index=True)
    # sensor_dropout produced NaNs — keep them (they represent lost readings)
    df = df.sort_values(["stage_name", "parameter_name", "timestamp"]).reset_index(drop=True)
    return df, ground_truth
