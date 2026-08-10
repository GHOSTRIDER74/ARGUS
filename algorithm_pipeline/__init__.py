"""Standalone algorithm execution layer for ARGUS Module 1 + Module 2.

Reuses the existing implementations in backend/app/modules (data_engineering,
drift_detection, digital_twin) without FastAPI, React, PostgreSQL or Docker.
"""
import sys
from pathlib import Path

# Make the existing backend package ("app.*") importable without installation.
_BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))
