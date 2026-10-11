"""
ARGUS Module 1 — Ingestion / Telemetry Streamer
Reads the processed SECOM dataset and simulates real-time telemetry streaming.
Provides batch access and row-by-row streaming with configurable speed.
"""

import pandas as pd
import numpy as np
import time
from pathlib import Path
from typing import Optional, Generator

# ── Paths ──
MODULE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = MODULE_DIR.parent.parent
DATA_PATH = PROJECT_ROOT / "data" / "processed" / "secom_processed.csv"

# ── Core Feature Schema ──
CORE_FEATURES = ["rf_power", "etch_rate", "chamber_pressure", "etchant_gas_flow"]
LCA_FEATURES = ["energy_loss_kwh", "co2_emission_kg"]
IMPACT_FEATURES = ["operational_cost_usd", "scrap_cost_usd", "total_impact_cost_usd"]
LABEL_COL = "Pass/Fail"
TIME_COL = "Time"


class TelemetryStreamer:
    """
    Simulates a real-time telemetry feed from the SECOM processed dataset.
    Acts as the data source for all downstream ARGUS modules.
    """

    def __init__(self, data_path: Optional[str] = None):
        self._path = Path(data_path) if data_path else DATA_PATH
        self._df: Optional[pd.DataFrame] = None
        self._cursor: int = 0
        self._start_time: Optional[float] = None
        self._load()

    def _load(self):
        """Load and validate the processed dataset."""
        if not self._path.exists():
            raise FileNotFoundError(
                f"Processed dataset not found at {self._path}. "
                "Run EDA/preprocessing.py first."
            )
        self._df = pd.read_csv(self._path)

        # Parse time column if present
        if TIME_COL in self._df.columns:
            self._df[TIME_COL] = pd.to_datetime(self._df[TIME_COL], errors="coerce")

        # Ensure column names are strings
        self._df.columns = self._df.columns.astype(str)
        self._cursor = 0
        self._start_time = time.time()

    @property
    def total_records(self) -> int:
        return len(self._df)

    @property
    def columns(self) -> list:
        return list(self._df.columns)

    @property
    def cursor_position(self) -> int:
        return self._cursor

    def reset(self):
        """Reset the stream cursor to the beginning."""
        self._cursor = 0
        self._start_time = time.time()

    def get_batch(self, start: int = 0, end: Optional[int] = None) -> pd.DataFrame:
        """Return a batch slice of the dataset."""
        if end is None:
            end = len(self._df)
        return self._df.iloc[start:end].copy()

    def get_full_dataset(self) -> pd.DataFrame:
        """Return the entire dataset."""
        return self._df.copy()

    def next_record(self) -> Optional[dict]:
        """Return the next record as a dictionary, advancing the cursor."""
        if self._cursor >= len(self._df):
            return None
        record = self._df.iloc[self._cursor].to_dict()
        record["_stream_index"] = self._cursor
        record["_stream_timestamp"] = time.time() - (self._start_time or time.time())
        self._cursor += 1
        return record

    def stream(self, delay_ms: float = 100, limit: Optional[int] = None) -> Generator[dict, None, None]:
        """
        Generator that yields records with a configurable delay.
        delay_ms: milliseconds between records (simulates stream speed).
        limit: max records to stream (None = all remaining).
        """
        count = 0
        while True:
            record = self.next_record()
            if record is None:
                break
            yield record
            count += 1
            if limit and count >= limit:
                break
            time.sleep(delay_ms / 1000.0)

    def get_summary_stats(self) -> dict:
        """Return summary statistics for the dataset."""
        stats = {
            "total_records": len(self._df),
            "total_features": len(self._df.columns),
            "cursor_position": self._cursor,
            "core_features": [c for c in CORE_FEATURES if c in self._df.columns],
            "lca_features": [c for c in LCA_FEATURES if c in self._df.columns],
            "impact_features": [c for c in IMPACT_FEATURES if c in self._df.columns],
        }

        # Pass/Fail distribution
        if LABEL_COL in self._df.columns:
            vc = self._df[LABEL_COL].value_counts().to_dict()
            stats["label_distribution"] = {str(k): int(v) for k, v in vc.items()}
            stats["failure_rate"] = float(
                self._df[LABEL_COL].sum() / len(self._df)
            )

        # Core feature ranges
        feature_stats = {}
        for col in CORE_FEATURES:
            if col in self._df.columns:
                feature_stats[col] = {
                    "mean": round(float(self._df[col].mean()), 4),
                    "std": round(float(self._df[col].std()), 4),
                    "min": round(float(self._df[col].min()), 4),
                    "max": round(float(self._df[col].max()), 4),
                }
        stats["feature_stats"] = feature_stats

        return stats


# ── Module-level singleton for import convenience ──
_streamer: Optional[TelemetryStreamer] = None


def get_streamer() -> TelemetryStreamer:
    """Get or create the global streamer instance."""
    global _streamer
    if _streamer is None:
        _streamer = TelemetryStreamer()
    return _streamer


if __name__ == "__main__":
    s = TelemetryStreamer()
    print(f"Loaded {s.total_records} records, {len(s.columns)} columns")
    print(f"Summary: {s.get_summary_stats()}")
    # Stream first 5 records
    for rec in s.stream(delay_ms=50, limit=5):
        print(f"  Record {rec['_stream_index']}: rf_power={rec.get('rf_power', 'N/A'):.4f}")
