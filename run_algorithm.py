"""Run the complete ARGUS Module 1 + Module 2 algorithm workflow standalone.

Usage:
    python run_algorithm.py                       # uses algorithm_config.yaml
    python run_algorithm.py --config my_run.yaml

Requires only the backend Python environment (pandas/torch/sklearn) — no
FastAPI server, React frontend, PostgreSQL database or Docker.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from algorithm_pipeline.pipeline import run_pipeline  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="ARGUS standalone algorithm pipeline")
    parser.add_argument(
        "--config",
        "-c",
        default=str(Path(__file__).resolve().parent / "algorithm_config.yaml"),
        help="Path to the YAML/JSON pipeline configuration file.",
    )
    args = parser.parse_args()
    run_pipeline(args.config)


if __name__ == "__main__":
    main()
