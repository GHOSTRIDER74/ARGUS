"""Fixtures for the standalone algorithm-pipeline tests.

Isolates model artifacts and data dirs in a temp folder BEFORE any app import,
and makes the repo root (algorithm_pipeline package) importable.
"""
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

_tmp = tempfile.mkdtemp(prefix="argus_pipeline_test_")
os.environ["MODELS_DIR"] = str(Path(_tmp) / "trained_models")
os.environ["DATA_DIR"] = str(Path(_tmp) / "data")
