"""Module 2 integration test: the full Part 26 demonstration scenario.

Generate synthetic etching data with a gradual upward chamber-pressure drift
(Module 1) -> preprocess -> train LSTM AE on the healthy half -> detect ->
drift event + twin state persisted -> retrieve via APIs.

Uses a tiny model/dataset so the test stays fast.
"""
import pytest


@pytest.fixture(scope="module")
def demo_ids(client):
    """Generate + preprocess the drifting dataset once for all tests here."""
    cfg = {
        "name": "etch-pressure-drift-demo",
        "duration_hours": 6.0,
        "sampling_interval_seconds": 60,
        "stages": ["etching"],
        "seed": 42,
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
    }
    r = client.post("/api/v1/simulation/generate", json=cfg)
    assert r.status_code == 201, r.text
    dataset_id = r.json()["dataset_id"]

    r = client.post(f"/api/v1/datasets/{dataset_id}/preprocess", json={"resample_interval": "1min"})
    assert r.status_code == 200, r.text
    return {"dataset_id": dataset_id}


@pytest.fixture(scope="module")
def trained_model(client, demo_ids):
    req = {
        "dataset_id": demo_ids["dataset_id"],
        "stage_name": "etching",
        "machine_id": "ETCH-01",
        "sequence_length": 12,
        "baseline_selection": {"method": "ground_truth"},
        "model_config": {
            "hidden_size": 16,
            "latent_size": 8,
            "num_layers": 1,
            "dropout": 0.0,
            "epochs": 8,
            "batch_size": 32,
            "learning_rate": 0.005,
            "early_stopping_patience": 4,
        },
        "threshold_percentile": 97,
    }
    r = client.post("/api/v1/drift/models/train", json=req)
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["sequences_created"] > 20
    assert body["best_validation_loss"] > 0
    assert "chamber_pressure" in body["features_used"]
    return body


def test_model_registry_endpoints(client, trained_model):
    model_id = trained_model["model_id"]

    r = client.get("/api/v1/drift/models")
    assert any(m["model_id"] == model_id for m in r.json())

    r = client.get(f"/api/v1/drift/models/{model_id}")
    assert r.status_code == 200
    assert r.json()["stage_name"] == "etching"
    assert r.json()["threshold"] is not None

    r = client.post(f"/api/v1/drift/models/{model_id}/activate")
    assert r.status_code == 200
    assert r.json()["status"] == "active"


def test_detection_confirms_gradual_upward_drift(client, demo_ids, trained_model):
    r = client.post(
        "/api/v1/drift/detect",
        json={
            "dataset_id": demo_ids["dataset_id"],
            "machine_id": "ETCH-01",
            "stage_name": "etching",
            "model_id": trained_model["model_id"],
            "persist_results": True,
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()

    # drift must be confirmed and pressure identified as the primary parameter
    assert body["drift_detected"] is True
    assert body["status"] in ("confirmed_drift", "critical_anomaly")
    assert body["root_cause"]["parameter_name"] == "chamber_pressure"
    assert body["direction"] == "up"
    assert body["cusum"]["triggered"] and body["lstm"]["triggered"]
    assert body["severity"]["score"] > 20
    assert 0 <= body["health_score"] < 90
    assert body["estimated_start_time"] is not None
    assert body["event_id"] is not None

    # forecast should predict an upper-limit crossing for a rising trend
    assert body["forecast"]["forecast_method"] == "linear_trend"


def test_healthy_window_stays_healthy(client, demo_ids, trained_model):
    """Detection restricted to the pre-drift half must not confirm drift."""
    r = client.post(
        "/api/v1/drift/detect",
        json={
            "dataset_id": demo_ids["dataset_id"],
            "machine_id": "ETCH-01",
            "stage_name": "etching",
            "model_id": trained_model["model_id"],
            "end_time": "2026-01-01T02:30:00Z",  # drift starts at hour 3
            "persist_results": False,
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] in ("healthy", "warning")
    assert r.json()["drift_detected"] is False


def test_event_apis_and_lifecycle(client, demo_ids):
    r = client.get("/api/v1/drift/events", params={"machine_id": "ETCH-01"})
    assert r.status_code == 200
    events = r.json()
    assert len(events) == 1  # persistence: one active event, not one per window
    event = events[0]
    assert event["severity_level"] in ("minor", "low", "moderate", "high", "critical")

    event_id = event["id"]
    r = client.get(f"/api/v1/drift/events/{event_id}/explanation")
    assert r.status_code == 200
    exp = r.json()
    assert exp["primary_parameter"] == "chamber_pressure"
    assert "associated" in exp["explanation_text"]
    assert len(exp["feature_contributions"]) >= 1

    r = client.get(f"/api/v1/drift/events/{event_id}/forecast")
    assert r.status_code == 200
    assert r.json()["parameter_name"] == "chamber_pressure"

    # Module 3 contract
    r = client.get(f"/api/v1/drift/events/{event_id}/impact-input")
    assert r.status_code == 200
    impact = r.json()
    assert impact["primary_parameter"] == "chamber_pressure"
    assert impact["severity_score"] is not None

    # lifecycle
    r = client.post(f"/api/v1/drift/events/{event_id}/acknowledge")
    assert r.json()["status"] == "acknowledged"
    r = client.post(f"/api/v1/drift/events/{event_id}/resolve")
    assert r.json()["status"] == "resolved"
    assert r.json()["resolved_at"] is not None


def test_digital_twin_state(client):
    r = client.get("/api/v1/digital-twin/state/ETCH-01/etching")
    assert r.status_code == 200
    state = r.json()
    assert state["machine_id"] == "ETCH-01"
    assert state["health_score"] is not None
    assert state["parameter_values"] and "chamber_pressure" in state["parameter_values"]
    assert state["root_cause_parameter"] == "chamber_pressure"
    assert state["operating_limits"]["chamber_pressure"]["upper"] == 72.0

    r = client.get("/api/v1/digital-twin/state")
    assert any(s["machine_id"] == "ETCH-01" for s in r.json())


def test_detect_without_model_404(client, demo_ids):
    r = client.post(
        "/api/v1/drift/detect",
        json={"dataset_id": demo_ids["dataset_id"], "machine_id": "GHOST-01", "stage_name": "etching"},
    )
    assert r.status_code == 404
