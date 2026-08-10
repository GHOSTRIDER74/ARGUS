"""End-to-end test of the standalone algorithm pipeline (no API, no database)."""
import json
from pathlib import Path

import yaml

from algorithm_pipeline.pipeline import run_pipeline


def _config(results_dir: Path) -> dict:
    return {
        "name": "pipeline-e2e-test",
        "data": {
            "source": "synthetic",
            "simulation": {
                "name": "pipeline-test",
                "duration_hours": 6.0,
                "sampling_interval_seconds": 60,
                "stages": ["etching"],
                "seed": 7,
                "drifts": [
                    {
                        "stage_name": "etching",
                        "parameter_name": "chamber_pressure",
                        "drift_type": "linear",
                        "start_fraction": 0.5,
                        "magnitude_sigmas": 8.0,
                        "direction": "up",
                    }
                ],
            },
        },
        "preprocessing": {"resample_interval": "1min", "generate_features": False},
        "targets": [{"machine_id": "ETCH-01", "stage_name": "etching"}],
        "module3": {"enabled": True, "analysis_period_hours": 8.0},
        "training": {
            "sequence_length": 12,
            "threshold_percentile": 97.0,
            "baseline_selection": {"method": "ground_truth"},
            "lstm": {
                "hidden_size": 16,
                "latent_size": 8,
                "num_layers": 1,
                "dropout": 0.0,
                "epochs": 4,
                "batch_size": 32,
                "learning_rate": 0.005,
                "early_stopping_patience": 3,
            },
        },
        "output": {"results_dir": str(results_dir), "save_cleaned_data": False},
    }


def test_pipeline_end_to_end(tmp_path):
    results_dir = tmp_path / "results"
    cfg_path = tmp_path / "config.yaml"
    cfg_path.write_text(yaml.safe_dump(_config(results_dir)), encoding="utf-8")

    payload = run_pipeline(str(cfg_path))

    # Module 1 ran
    assert payload["module1"]["validation"]["is_valid"] is True
    assert payload["module1"]["quality"]["quality_score"] > 0

    # Module 2 trained + detected on the configured target
    assert len(payload["targets"]) == 1
    target = payload["targets"][0]
    assert target["machine_id"] == "ETCH-01"
    assert target["model_id"]
    detection = target["detection"]
    assert detection["status"] in (
        "healthy",
        "warning",
        "confirmed_drift",
        "critical_anomaly",
        "recovered",
    )
    assert detection["windows_analysed"] > 0
    assert "health_score" in detection
    assert "forecast" in detection

    # the strong injected drift must be detected
    assert detection["drift_detected"] is True
    assert detection["root_cause"]["parameter_name"] == "chamber_pressure"

    # evaluation against synthetic ground truth
    evaluation = target["evaluation"]
    assert evaluation["ground_truth_available"] is True
    for key in (
        "precision",
        "recall",
        "f1_score",
        "false_positive_rate",
        "false_negative_rate",
        "detection_delay_hours",
        "estimated_start_error_hours",
    ):
        assert key in evaluation
    assert evaluation["recall"] > 0.5

    # results written to disk
    out_dir = Path(payload["results_dir"])
    result_file = out_dir / "pipeline_result.json"
    eval_file = out_dir / "evaluation.json"
    assert result_file.exists() and eval_file.exists()
    saved = json.loads(result_file.read_text(encoding="utf-8"))
    assert saved["run_name"] == "pipeline-e2e-test"

    # Module 3 optional impact step ran and its output was saved
    impact = target["impact"]
    assert impact is not None and not impact.get("skipped")
    assert impact["is_demo_configuration"] is True
    assert impact["analysis_period_hours"] == 8.0
    assert impact["operational"]["additional_defective_units"] >= 0
    fin = impact["financial"]
    assert fin["total_financial_impact"] == round(
        fin["total_scrap_cost"] + fin["total_rework_cost"]
        + fin["estimated_lost_production_value"] + fin["downtime_cost"], 2
    )
    assert impact["uncertainty"]["best_case"] <= impact["uncertainty"]["worst_case"]
    assert impact["calculation_breakdown"]
    impact_file = out_dir / "impact_result.json"
    assert impact_file.exists()
    saved_impact = json.loads(impact_file.read_text(encoding="utf-8"))
    assert "ETCH-01/etching" in saved_impact
