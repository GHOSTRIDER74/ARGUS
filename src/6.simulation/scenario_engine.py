"""
ARGUS Module 6 — Simulation / Scenario Engine
What-if scenario testing and synthetic data generation.
Generates semiconductor process telemetry with configurable drift injection.
"""

import numpy as np
import pandas as pd
from typing import Optional, Dict, List
from dataclasses import dataclass, asdict
from enum import Enum


class DriftType(str, Enum):
    NONE = "none"
    GRADUAL = "gradual"
    SUDDEN = "sudden"
    CYCLICAL = "cyclical"


# ── Default process parameter profiles ──
PARAM_PROFILES = {
    "rf_power": {"mean": 0.0, "std": 1.0, "unit": "W (normalized)"},
    "etch_rate": {"mean": 0.0, "std": 1.0, "unit": "nm/min (normalized)"},
    "chamber_pressure": {"mean": 0.0, "std": 1.0, "unit": "mTorr (normalized)"},
    "etchant_gas_flow": {"mean": 0.0, "std": 1.0, "unit": "sccm (normalized)"},
}


@dataclass
class SimulationConfig:
    """Configuration for a synthetic data generation run."""
    n_samples: int = 1000
    drift_type: str = "none"
    drift_onset: int = 500          # timestep where drift begins
    drift_magnitude: float = 0.04   # drift rate per step (fraction of std)
    target_parameter: str = "rf_power"
    drift_direction: str = "positive"   # positive or negative
    seed: int = 42
    include_noise: bool = True
    noise_scale: float = 1.0

    def to_dict(self) -> dict:
        return asdict(self)


class ScenarioEngine:
    """
    Generates synthetic semiconductor process telemetry with
    configurable drift injection for what-if analysis.
    """

    def __init__(self):
        self._last_result: Optional[pd.DataFrame] = None
        self._last_config: Optional[SimulationConfig] = None

    def generate(self, config: Optional[SimulationConfig] = None) -> pd.DataFrame:
        """Generate synthetic telemetry data based on configuration."""
        if config is None:
            config = SimulationConfig()

        self._last_config = config
        np.random.seed(config.seed)

        t = np.arange(config.n_samples)
        data = {}

        for param, profile in PARAM_PROFILES.items():
            mu = profile["mean"]
            sigma = profile["std"] * config.noise_scale

            # Base signal
            signal = np.random.normal(mu, sigma, config.n_samples)

            # Inject drift into the target parameter
            if param == config.target_parameter and config.drift_type != DriftType.NONE.value:
                drift = self._compute_drift(
                    t, config.drift_type, config.drift_onset,
                    config.drift_magnitude, sigma, config.drift_direction,
                )
                signal += drift

            data[param] = signal

        df = pd.DataFrame(data)
        df["timestep"] = t
        df["step"] = t
        df["drift_injected"] = t >= config.drift_onset if config.drift_type != "none" else False

        # Add LCA columns
        rf_median = np.median(data["rf_power"][:config.drift_onset]) if config.drift_onset > 0 else 0
        df["energy_loss_kwh"] = np.abs(df["rf_power"] - rf_median) * 0.05
        df["co2_emission_kg"] = df["energy_loss_kwh"] * 0.42

        # Add impact columns
        failure_prob = 0.01 + np.where(
            df["drift_injected"],
            np.clip((t - config.drift_onset) * 0.0001, 0, 0.15),
            0
        )
        df["Pass/Fail"] = np.random.binomial(1, failure_prob)
        df["operational_cost_usd"] = df["energy_loss_kwh"] * 0.15
        df["scrap_cost_usd"] = df["Pass/Fail"] * 500
        df["total_impact_cost_usd"] = df["operational_cost_usd"] + df["scrap_cost_usd"]

        self._last_result = df
        return df

    def _compute_drift(
        self, t: np.ndarray, drift_type: str, onset: int,
        magnitude: float, sigma: float, direction: str,
    ) -> np.ndarray:
        """Compute the drift signal based on type."""
        n = len(t)
        drift = np.zeros(n)
        sign = 1.0 if direction == "positive" else -1.0

        if drift_type == DriftType.GRADUAL.value:
            # Linear ramp after onset
            mask = t >= onset
            drift[mask] = sign * (t[mask] - onset) * magnitude * sigma

        elif drift_type == DriftType.SUDDEN.value:
            # Step change at onset
            mask = t >= onset
            drift[mask] = sign * magnitude * sigma * 50  # immediate shift

        elif drift_type == DriftType.CYCLICAL.value:
            # Sinusoidal drift after onset
            mask = t >= onset
            period = max(50, (n - onset) // 4)
            drift[mask] = sign * magnitude * sigma * 20 * np.sin(
                2 * np.pi * (t[mask] - onset) / period
            )

        return drift

    def get_last_result(self) -> Optional[pd.DataFrame]:
        return self._last_result

    def get_last_config(self) -> Optional[dict]:
        return self._last_config.to_dict() if self._last_config else None

    def get_available_parameters(self) -> List[dict]:
        return [
            {"name": k, **v} for k, v in PARAM_PROFILES.items()
        ]

    def get_available_drift_types(self) -> List[str]:
        return [d.value for d in DriftType]

    def run_what_if(self, configs: List[SimulationConfig]) -> List[dict]:
        """Run multiple scenarios and return comparison summaries."""
        results = []
        for cfg in configs:
            df = self.generate(cfg)
            summary = {
                "config": cfg.to_dict(),
                "total_failures": int(df["Pass/Fail"].sum()),
                "failure_rate": round(float(df["Pass/Fail"].mean() * 100), 2),
                "total_energy_loss": round(float(df["energy_loss_kwh"].sum()), 2),
                "total_co2": round(float(df["co2_emission_kg"].sum()), 2),
                "total_impact_cost": round(float(df["total_impact_cost_usd"].sum()), 2),
                "mean_rf_power_post_drift": round(
                    float(df.loc[df["drift_injected"], "rf_power"].mean())
                    if df["drift_injected"].any() else 0.0, 4
                ),
            }
            results.append(summary)
        return results


# ── Module singleton ──
_engine: Optional[ScenarioEngine] = None


def get_scenario_engine() -> ScenarioEngine:
    global _engine
    if _engine is None:
        _engine = ScenarioEngine()
    return _engine


if __name__ == "__main__":
    engine = ScenarioEngine()
    cfg = SimulationConfig(
        n_samples=500, drift_type="gradual",
        drift_onset=200, drift_magnitude=0.05,
        target_parameter="rf_power",
    )
    df = engine.generate(cfg)
    print(f"Generated {len(df)} records")
    print(f"Failures: {df['Pass/Fail'].sum()}")
    print(f"Total impact: ${df['total_impact_cost_usd'].sum():.2f}")
    print(df.head())
