"""
ARGUS Module 5 — Dynamic LCA / Carbon Tracker
Calculates environmental footprint: energy loss (kWh) and CO2 emissions (kg)
derived from rf_power deviations. Tracks efficiency against historical baselines.
"""

import numpy as np
import pandas as pd
from pathlib import Path
from typing import Optional, Dict, List
from dataclasses import dataclass, asdict

# ── LCA Constants (from preprocessing.py) ──
ENERGY_CONVERSION_FACTOR = 0.05   # kWh per unit rf_power deviation
CO2_EMISSION_FACTOR = 0.42        # kg CO2 per kWh (grid average)
BASELINE_EFFICIENCY = 0.95        # 95% baseline energy efficiency

MODULE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = MODULE_DIR.parent.parent
DATA_PATH = PROJECT_ROOT / "data" / "processed" / "secom_processed.csv"


@dataclass
class LCASnapshot:
    """A single LCA measurement point."""
    index: int
    energy_loss_kwh: float
    co2_emission_kg: float
    rf_power_deviation: float
    efficiency: float
    cumulative_energy_kwh: float
    cumulative_co2_kg: float

    def to_dict(self) -> dict:
        return asdict(self)


class CarbonTracker:
    """
    Tracks real-time carbon footprint and energy efficiency
    using rf_power deviations from the SECOM processed dataset.
    """

    def __init__(self, data_path: Optional[str] = None):
        self._path = Path(data_path) if data_path else DATA_PATH
        self._df: Optional[pd.DataFrame] = None
        self._baseline_rf_power: float = 0.0
        self._cumulative_energy: float = 0.0
        self._cumulative_co2: float = 0.0
        self._history: List[LCASnapshot] = []
        self._load()

    def _load(self):
        if not self._path.exists():
            return
        self._df = pd.read_csv(self._path)
        self._df.columns = self._df.columns.astype(str)

        if "rf_power" in self._df.columns:
            self._baseline_rf_power = float(self._df["rf_power"].median())

        # Pre-compute LCA snapshots from dataset
        self._build_history()

    def _build_history(self):
        """Build the complete LCA history from the dataset."""
        if self._df is None:
            return

        cum_energy = 0.0
        cum_co2 = 0.0

        for i, row in self._df.iterrows():
            energy = float(row.get("energy_loss_kwh", 0))
            co2 = float(row.get("co2_emission_kg", 0))
            rf_dev = energy / ENERGY_CONVERSION_FACTOR if ENERGY_CONVERSION_FACTOR else 0
            efficiency = max(0, BASELINE_EFFICIENCY - (rf_dev * 0.02))

            cum_energy += energy
            cum_co2 += co2

            snap = LCASnapshot(
                index=int(i),
                energy_loss_kwh=round(energy, 6),
                co2_emission_kg=round(co2, 6),
                rf_power_deviation=round(rf_dev, 6),
                efficiency=round(efficiency, 4),
                cumulative_energy_kwh=round(cum_energy, 4),
                cumulative_co2_kg=round(cum_co2, 4),
            )
            self._history.append(snap)

        self._cumulative_energy = cum_energy
        self._cumulative_co2 = cum_co2

    def get_current_summary(self) -> dict:
        """Return aggregate LCA summary."""
        if self._df is None:
            return {"error": "Dataset not loaded"}

        result = {
            "total_records": len(self._df),
            "baseline_rf_power": round(self._baseline_rf_power, 4),
            "total_energy_loss_kwh": round(self._cumulative_energy, 4),
            "total_co2_emissions_kg": round(self._cumulative_co2, 4),
        }

        if "energy_loss_kwh" in self._df.columns:
            result["avg_energy_loss_kwh"] = round(float(self._df["energy_loss_kwh"].mean()), 6)
            result["max_energy_loss_kwh"] = round(float(self._df["energy_loss_kwh"].max()), 6)

        if "co2_emission_kg" in self._df.columns:
            result["avg_co2_emission_kg"] = round(float(self._df["co2_emission_kg"].mean()), 6)
            result["max_co2_emission_kg"] = round(float(self._df["co2_emission_kg"].max()), 6)

        # Efficiency stats
        if self._history:
            efficiencies = [s.efficiency for s in self._history]
            result["avg_efficiency"] = round(np.mean(efficiencies), 4)
            result["min_efficiency"] = round(min(efficiencies), 4)
            result["current_efficiency"] = self._history[-1].efficiency

        return result

    def get_timeseries(self, downsample: int = 1) -> List[dict]:
        """Return LCA timeseries for charting, optionally downsampled."""
        return [s.to_dict() for s in self._history[::downsample]]

    def get_efficiency_baseline(self, window: int = 50) -> List[dict]:
        """Return rolling efficiency against historical baseline."""
        records = []
        for i in range(0, len(self._history), window):
            chunk = self._history[i:i + window]
            avg_eff = np.mean([s.efficiency for s in chunk])
            avg_energy = np.mean([s.energy_loss_kwh for s in chunk])
            avg_co2 = np.mean([s.co2_emission_kg for s in chunk])
            records.append({
                "index": i,
                "window_size": len(chunk),
                "avg_efficiency": round(avg_eff, 4),
                "baseline_efficiency": BASELINE_EFFICIENCY,
                "avg_energy_loss_kwh": round(avg_energy, 6),
                "avg_co2_emission_kg": round(avg_co2, 6),
                "gap": round(BASELINE_EFFICIENCY - avg_eff, 4),
            })
        return records

    def calculate_for_record(self, record: dict) -> dict:
        """Calculate LCA metrics for a single telemetry record."""
        energy = float(record.get("energy_loss_kwh", 0))
        co2 = float(record.get("co2_emission_kg", 0))
        rf_dev = energy / ENERGY_CONVERSION_FACTOR if ENERGY_CONVERSION_FACTOR else 0
        efficiency = max(0, BASELINE_EFFICIENCY - (rf_dev * 0.02))

        return {
            "energy_loss_kwh": round(energy, 6),
            "co2_emission_kg": round(co2, 6),
            "rf_power_deviation": round(rf_dev, 6),
            "efficiency": round(efficiency, 4),
        }


# ── Module singleton ──
_tracker: Optional[CarbonTracker] = None


def get_carbon_tracker() -> CarbonTracker:
    global _tracker
    if _tracker is None:
        _tracker = CarbonTracker()
    return _tracker


if __name__ == "__main__":
    ct = CarbonTracker()
    print("=== LCA Summary ===")
    summary = ct.get_current_summary()
    for k, v in summary.items():
        print(f"  {k}: {v}")
    print(f"\n  Timeseries points: {len(ct.get_timeseries())}")
    print(f"  Efficiency baselines: {len(ct.get_efficiency_baseline())}")
