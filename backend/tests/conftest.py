"""Shared pytest fixtures: isolated SQLite DB + temp data dirs per test session."""
import os
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

# Isolate config BEFORE importing the app
_tmp = tempfile.mkdtemp(prefix="argus_test_")
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_tmp) / 'test.db'}"
os.environ["AUTO_CREATE_TABLES"] = "true"
os.environ["DATA_DIR"] = str(Path(_tmp) / "data")
os.environ["MODELS_DIR"] = str(Path(_tmp) / "trained_models")

from fastapi.testclient import TestClient  # noqa: E402

from app.database.base import Base  # noqa: E402
from app.database.session import engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def sample_long_df() -> pd.DataFrame:
    """A small valid long-format dataframe with one series."""
    rng = np.random.default_rng(0)
    n = 120
    ts = pd.date_range("2026-01-01", periods=n, freq="1min", tz="UTC")
    return pd.DataFrame(
        {
            "timestamp": ts,
            "batch_id": "B001",
            "wafer_id": "W001",
            "machine_id": "ETCH-01",
            "stage_name": "etching",
            "parameter_name": "chamber_pressure",
            "parameter_value": rng.normal(65.0, 1.2, n),
            "target_value": 65.0,
            "lower_operating_limit": 58.0,
            "upper_operating_limit": 72.0,
            "unit": "mTorr",
            "production_rate": 150.0,
            "energy_kwh": rng.normal(0.66, 0.02, n).clip(min=0),
            "chemical_consumption": 0.05,
        }
    )
