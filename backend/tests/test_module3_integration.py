"""Module 3 integration test: drift event -> impact-input contract -> calculate
-> persistence -> retrieval APIs. Seeds a realistic drift event directly (the
full detection path is already covered by test_module2_integration.py)."""
from datetime import datetime, timezone

import pytest

from app.database.session import SessionLocal
from app.models.drift import DriftEvent, DriftExplanation, DriftForecast


@pytest.fixture(scope="module")
def drift_event_id(client) -> int:
    """Persist a confirmed etching chamber-pressure drift event with explanation + forecast."""
    db = SessionLocal()
    try:
        event = DriftEvent(
            dataset_id=None,
            machine_id="ETCH-01",
            stage_name="etching",
            detected_at=datetime(2026, 1, 1, 6, 0, tzinfo=timezone.utc),
            estimated_start_time=datetime(2026, 1, 1, 3, 0, tzinfo=timezone.utc),
            drift_type="gradual_linear",
            direction="up",
            cusum_score=0.9,
            lstm_score=0.85,
            hybrid_score=0.87,
            severity_score=72.0,
            severity_level="high",
            health_score=41.0,
            confidence=0.89,
            primary_parameter="chamber_pressure",
            affected_parameters=["chamber_pressure"],
            detection_status="confirmed_drift",
            status="open",
        )
        db.add(event)
        db.flush()
        db.add(
            DriftExplanation(
                drift_event_id=event.id,
                explanation_method="reconstruction_error_attribution",
                primary_parameter="chamber_pressure",
                feature_contributions=[
                    {
                        "parameter_name": "chamber_pressure",
                        "contribution": 0.85,
                        "current_value": 72.4,
                        "baseline_value": 65.1,
                        "target_value": 65.0,
                        "deviation_percent": 11.21,
                        "direction": "up",
                        "cusum_triggered": True,
                    }
                ],
                explanation_text="chamber_pressure drifted upward",
                confidence=0.89,
            )
        )
        db.add(
            DriftForecast(
                drift_event_id=event.id,
                parameter_name="chamber_pressure",
                forecast_method="linear_trend",
                forecast_horizon_hours=24,
                forecast_values=[
                    {"horizon_hours": 6, "predicted_value": 73.5, "lower_bound": 72.9, "upper_bound": 74.1}
                ],
            )
        )
        db.commit()
        return event.id
    finally:
        db.close()


def test_impact_input_contract_unchanged(client, drift_event_id):
    r = client.get(f"/api/v1/drift/events/{drift_event_id}/impact-input")
    assert r.status_code == 200, r.text
    body = r.json()
    for field in (
        "drift_event_id", "dataset_id", "machine_id", "stage_name", "primary_parameter",
        "current_value", "baseline_value", "target_value", "deviation_percent", "drift_type",
        "direction", "severity_score", "confidence", "detected_at", "estimated_start_time",
        "predicted_values", "affected_parameters",
    ):
        assert field in body
    assert body["primary_parameter"] == "chamber_pressure"
    assert body["deviation_percent"] == pytest.approx(11.21)


def test_calculate_persist_and_retrieve(client, drift_event_id):
    r = client.post(
        "/api/v1/impact/calculate",
        json={"drift_event_id": drift_event_id, "analysis_period_hours": 8, "persist_result": True},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    impact_id = body["impact_id"]
    assert impact_id is not None
    assert body["is_demo_configuration"] is True
    assert body["impact_rule_version"] == "demo-v1"
    assert body["impact_model"] == "logistic"
    assert body["quality_metric"] == "etch_uniformity"
    assert 0 < body["defect_probability"]["confidence_adjusted"] <= 1
    op = body["operational"]
    assert op["total_units"] == pytest.approx(150.0 * 8)
    assert op["scrap_units"] > 0 and op["rework_units"] > 0
    fin = body["financial"]
    assert fin["currency"] == "INR"
    assert fin["total_financial_impact"] > 0
    assert fin["downtime_cost"] == 0.0
    unc = body["uncertainty"]
    assert unc["best_case"] <= unc["expected_case"] <= unc["worst_case"]
    assert body["calculation_breakdown"]

    # list
    r = client.get("/api/v1/impact")
    assert r.status_code == 200
    assert any(i["id"] == impact_id for i in r.json())

    # detail
    r = client.get(f"/api/v1/impact/{impact_id}")
    assert r.status_code == 200
    detail = r.json()
    assert detail["financial"]["total_financial_impact"] == pytest.approx(fin["total_financial_impact"])
    assert detail["operational"]["scrap_units"] == pytest.approx(op["scrap_units"])

    # breakdown
    r = client.get(f"/api/v1/impact/{impact_id}/breakdown")
    assert r.status_code == 200
    bd = r.json()
    assert bd["calculation_breakdown"]
    names = {s["name"] for s in bd["calculation_breakdown"]}
    assert {"raw_defect_probability", "total_financial_impact"} <= names
    assert bd["calculation_notes"]

    # by drift event
    r = client.get(f"/api/v1/impact/by-drift/{drift_event_id}")
    assert r.status_code == 200
    assert any(i["id"] == impact_id for i in r.json())


def test_calculate_uses_drift_duration_when_no_period(client, drift_event_id):
    r = client.post("/api/v1/impact/calculate", json={"drift_event_id": drift_event_id, "persist_result": False})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["analysis_period_source"] == "drift_duration"
    assert body["analysis_period_hours"] == pytest.approx(3.0)
    assert body["impact_id"] is None  # not persisted


def test_calculate_with_downtime(client, drift_event_id):
    r = client.post(
        "/api/v1/impact/calculate",
        json={
            "drift_event_id": drift_event_id,
            "analysis_period_hours": 8,
            "downtime_hours": 2,
            "persist_result": False,
        },
    )
    assert r.status_code == 201
    assert r.json()["financial"]["downtime_cost"] > 0


def test_calculate_unknown_event_404(client):
    r = client.post("/api/v1/impact/calculate", json={"drift_event_id": 999999})
    assert r.status_code == 404


def test_calculate_invalid_period_422(client, drift_event_id):
    r = client.post(
        "/api/v1/impact/calculate", json={"drift_event_id": drift_event_id, "analysis_period_hours": 0}
    )
    assert r.status_code == 422  # rejected by schema validation (gt=0)


def test_production_configuration_crud_and_use(client, drift_event_id):
    # a full production-config document with higher costs
    doc = {
        "version": "custom-v1",
        "is_demo": True,
        "currency": "INR",
        "disclaimer": "DEMONSTRATION custom config",
        "defaults": {
            "labour_cost_per_hour": 2400.0,
            "electricity_cost_per_kwh": 10.0,
            "downtime_cost_per_hour": 60000.0,
            "scrap_disposal_cost_per_unit": 25.0,
            "rework_time_hours_per_unit": 0.2,
            "rework_energy_kwh_per_unit": 2.0,
            "rework_material_cost_per_unit": 60.0,
        },
        "stage_order": ["etching"],
        "stage_costs": {"etching": 300.0},
        "stages": {
            "etching": {
                "baseline_yield_percent": 95.0,
                "units_per_hour": 200.0,
                "product_value_per_good_unit": 800.0,
                "material_cost_per_unit": 700.0,
            }
        },
    }
    body = {
        "name": "custom-etching",
        "stage_name": "etching",
        "currency": "INR",
        "baseline_yield_percent": 95.0,
        "units_per_hour": 200.0,
        "product_value_per_good_unit": 800.0,
        "material_cost_per_unit": 700.0,
        "downtime_cost_per_hour": 60000.0,
        "configuration": doc,
        "is_demo": True,
    }
    r = client.post("/api/v1/impact/configurations", json=body)
    assert r.status_code == 201, r.text
    config_id = r.json()["id"]

    r = client.get("/api/v1/impact/configurations")
    assert any(c["id"] == config_id for c in r.json())

    body["name"] = "custom-etching-v2"
    r = client.put(f"/api/v1/impact/configurations/{config_id}", json=body)
    assert r.status_code == 200
    assert r.json()["name"] == "custom-etching-v2"

    # calculation with the stored configuration uses its version + volumes
    r = client.post(
        "/api/v1/impact/calculate",
        json={
            "drift_event_id": drift_event_id,
            "analysis_period_hours": 8,
            "production_configuration_id": config_id,
            "persist_result": False,
        },
    )
    assert r.status_code == 201, r.text
    result = r.json()
    assert result["production_config_version"] == "custom-v1"
    assert result["operational"]["total_units"] == pytest.approx(200.0 * 8)

    # invalid configuration document is rejected
    r = client.post("/api/v1/impact/configurations", json={**body, "configuration": {"bad": True}})
    assert r.status_code == 422
