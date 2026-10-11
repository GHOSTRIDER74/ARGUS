"""
ARGUS Module 4 — Impact & Financial Analysis
Calculates yield loss, financial impact (scrap, operational, downtime),
and throughput degradation from drift events and telemetry anomalies.
"""

import numpy as np
import pandas as pd
from pathlib import Path
from typing import Optional, Dict, List, Any
from dataclasses import dataclass, asdict

# ── Cost Constants (from the project spec) ──
SCRAP_COST_PER_UNIT = 500.0        # $500 per failed unit
ENERGY_COST_PER_KWH = 0.15         # $0.15/kWh operational
DOWNTIME_COST_PER_HOUR = 2500.0    # $2,500/hr estimated downtime cost
THROUGHPUT_UNITS_PER_HOUR = 120     # Normal throughput

# ── Paths ──
MODULE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = MODULE_DIR.parent.parent
DATA_PATH = PROJECT_ROOT / "data" / "processed" / "secom_processed.csv"


@dataclass
class ImpactReport:
    """Structured impact analysis report for a drift event."""
    event_id: str
    machine_id: str
    stage: str
    drift_severity: float
    # Yield
    total_units: int
    defective_units: int
    yield_loss_pct: float
    # Financial
    scrap_cost: float
    operational_energy_cost: float
    downtime_cost: float
    total_estimated_loss: float
    loss_range_low: float
    loss_range_high: float
    # Throughput
    throughput_loss_pct: float
    units_lost: int
    # Energy
    energy_loss_kwh: float

    def to_dict(self) -> dict:
        return asdict(self)


class ImpactCalculator:
    """
    Calculates operational and financial impact from drift events.
    Uses the LCA/impact columns from the preprocessed SECOM dataset.
    """

    def __init__(self, data_path: Optional[str] = None):
        self._path = Path(data_path) if data_path else DATA_PATH
        self._df: Optional[pd.DataFrame] = None
        self._load()

    def _load(self):
        """Load processed dataset for aggregate impact calculations."""
        if self._path.exists():
            self._df = pd.read_csv(self._path)
            self._df.columns = self._df.columns.astype(str)

    def calculate_event_impact(
        self,
        machine_id: str = "ETCH-01",
        stage: str = "Plasma Etch",
        drift_severity: float = 0.5,
        affected_records: int = 100,
        energy_loss_kwh: float = 0.0,
    ) -> ImpactReport:
        """
        Calculate the full impact report for a single drift event.
        drift_severity: 0.0 (none) to 1.0 (catastrophic)
        """
        # Yield impact — severity drives defect rate
        base_defect_rate = 0.0104  # SECOM baseline ~1.04% failure
        amplified_rate = base_defect_rate + (drift_severity * 0.15)  # up to ~16% at max
        defective_units = int(affected_records * amplified_rate)
        yield_loss = round(amplified_rate * 100, 2)

        # Financial impact
        scrap = defective_units * SCRAP_COST_PER_UNIT
        energy_cost = energy_loss_kwh * ENERGY_COST_PER_KWH

        # Downtime estimation based on severity
        downtime_hours = drift_severity * 2.5  # 0-2.5 hours
        downtime_cost = downtime_hours * DOWNTIME_COST_PER_HOUR

        total_loss = scrap + energy_cost + downtime_cost
        loss_range_low = total_loss * 0.85
        loss_range_high = total_loss * 1.25

        # Throughput impact
        throughput_loss = drift_severity * 25.0  # up to 25% throughput loss
        units_lost = int(THROUGHPUT_UNITS_PER_HOUR * downtime_hours * (throughput_loss / 100))

        event_id = f"EVT-{machine_id}-{int(drift_severity * 1000):04d}"

        return ImpactReport(
            event_id=event_id,
            machine_id=machine_id,
            stage=stage,
            drift_severity=round(drift_severity, 4),
            total_units=affected_records,
            defective_units=defective_units,
            yield_loss_pct=yield_loss,
            scrap_cost=round(scrap, 2),
            operational_energy_cost=round(energy_cost, 2),
            downtime_cost=round(downtime_cost, 2),
            total_estimated_loss=round(total_loss, 2),
            loss_range_low=round(loss_range_low, 2),
            loss_range_high=round(loss_range_high, 2),
            throughput_loss_pct=round(throughput_loss, 2),
            units_lost=units_lost,
            energy_loss_kwh=round(energy_loss_kwh, 4),
        )

    def get_aggregate_impact(self) -> dict:
        """
        Calculate aggregate financial and yield impact from the full dataset.
        Uses the pre-computed columns from preprocessing.py.
        """
        if self._df is None:
            return {"error": "Dataset not loaded"}

        result = {
            "total_records": len(self._df),
        }

        # Aggregate from pre-computed columns
        if "total_impact_cost_usd" in self._df.columns:
            result["total_impact_cost"] = round(float(self._df["total_impact_cost_usd"].sum()), 2)
            result["avg_impact_cost"] = round(float(self._df["total_impact_cost_usd"].mean()), 2)
            result["max_impact_cost"] = round(float(self._df["total_impact_cost_usd"].max()), 2)

        if "scrap_cost_usd" in self._df.columns:
            result["total_scrap_cost"] = round(float(self._df["scrap_cost_usd"].sum()), 2)
            result["scrap_events"] = int((self._df["scrap_cost_usd"] > 0).sum())

        if "operational_cost_usd" in self._df.columns:
            result["total_operational_cost"] = round(float(self._df["operational_cost_usd"].sum()), 2)

        if "energy_loss_kwh" in self._df.columns:
            result["total_energy_loss_kwh"] = round(float(self._df["energy_loss_kwh"].sum()), 2)
            result["avg_energy_loss_kwh"] = round(float(self._df["energy_loss_kwh"].mean()), 4)

        if "Pass/Fail" in self._df.columns:
            failures = int((self._df["Pass/Fail"] == 1).sum())
            result["total_failures"] = failures
            result["failure_rate"] = round(failures / len(self._df) * 100, 2)
            result["yield_rate"] = round((1 - failures / len(self._df)) * 100, 2)

        return result

    def get_impact_timeseries(self, window: int = 50) -> List[dict]:
        """Return rolling impact metrics as a time series for charting."""
        if self._df is None:
            return []

        records = []
        cost_col = "total_impact_cost_usd" if "total_impact_cost_usd" in self._df.columns else None
        energy_col = "energy_loss_kwh" if "energy_loss_kwh" in self._df.columns else None

        for i in range(0, len(self._df), window):
            chunk = self._df.iloc[i:i + window]
            entry = {"index": i, "window_size": len(chunk)}

            if cost_col:
                entry["avg_cost"] = round(float(chunk[cost_col].mean()), 4)
                entry["total_cost"] = round(float(chunk[cost_col].sum()), 2)

            if energy_col:
                entry["avg_energy_loss"] = round(float(chunk[energy_col].mean()), 4)

            if "Pass/Fail" in chunk.columns:
                entry["failure_count"] = int(chunk["Pass/Fail"].sum())
                entry["failure_rate"] = round(
                    chunk["Pass/Fail"].sum() / len(chunk) * 100, 2
                )

            records.append(entry)

        return records


# ── Module singleton ──
_calculator: Optional[ImpactCalculator] = None


def get_impact_calculator() -> ImpactCalculator:
    global _calculator
    if _calculator is None:
        _calculator = ImpactCalculator()
    return _calculator


if __name__ == "__main__":
    calc = ImpactCalculator()
    print("=== Aggregate Impact ===")
    print(calc.get_aggregate_impact())
    print("\n=== Event Impact (severity=0.7) ===")
    report = calc.calculate_event_impact(drift_severity=0.7, energy_loss_kwh=45.0)
    print(report.to_dict())
