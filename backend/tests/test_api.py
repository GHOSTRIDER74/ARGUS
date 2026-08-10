"""API integration tests: full upload -> validate -> preprocess -> summary -> delete flow."""
import io

import pandas as pd


def _csv_bytes(df: pd.DataFrame) -> bytes:
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    return buf.getvalue().encode()


def test_health(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert r.json()["database"] == "ok"


def test_stage_catalog_endpoint(client):
    r = client.get("/api/v1/simulation/stages")
    assert r.status_code == 200
    names = [s["name"] for s in r.json()["stages"]]
    assert {"cvd", "etching", "cmp", "reflow"}.issubset(names)


def test_upload_rejects_non_csv(client):
    r = client.post("/api/v1/datasets/upload", files={"file": ("x.txt", b"hello", "text/plain")})
    assert r.status_code == 400


def test_upload_rejects_empty(client):
    r = client.post("/api/v1/datasets/upload", files={"file": ("x.csv", b"", "text/csv")})
    assert r.status_code == 400


def test_full_pipeline_flow(client, sample_long_df):
    # upload
    r = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("sample.csv", _csv_bytes(sample_long_df), "text/csv")},
    )
    assert r.status_code == 201, r.text
    ds_id = r.json()["id"]
    assert r.json()["row_count"] == len(sample_long_df)

    # validate
    r = client.post(f"/api/v1/datasets/{ds_id}/validate")
    assert r.status_code == 200, r.text
    assert r.json()["is_valid"] is True

    # preprocess
    r = client.post(
        f"/api/v1/datasets/{ds_id}/preprocess",
        json={"resample_interval": "1min", "interpolation": "linear", "generate_features": True},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["output_rows"] > 0
    assert body["quality_score"] > 90

    # summary
    r = client.get(f"/api/v1/datasets/{ds_id}/summary")
    assert r.status_code == 200
    assert "etching/chamber_pressure" in r.json()["statistics"]

    # quality report
    r = client.get(f"/api/v1/datasets/{ds_id}/quality-report")
    assert r.status_code == 200
    assert r.json()["quality_score"] > 90

    # list
    r = client.get("/api/v1/datasets")
    assert any(d["id"] == ds_id for d in r.json())

    # delete
    r = client.delete(f"/api/v1/datasets/{ds_id}")
    assert r.status_code == 204
    assert client.get(f"/api/v1/datasets/{ds_id}").status_code == 404


def test_quality_report_before_preprocess_conflicts(client, sample_long_df):
    r = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("s2.csv", _csv_bytes(sample_long_df), "text/csv")},
    )
    ds_id = r.json()["id"]
    r = client.get(f"/api/v1/datasets/{ds_id}/quality-report")
    assert r.status_code == 409
    client.delete(f"/api/v1/datasets/{ds_id}")


def test_simulation_generate_and_preprocess(client):
    cfg = {
        "name": "sim-test",
        "duration_hours": 1.0,
        "sampling_interval_seconds": 60,
        "stages": ["etching"],
        "seed": 42,
        "drifts": [
            {
                "stage_name": "etching",
                "parameter_name": "chamber_pressure",
                "drift_type": "linear",
                "start_fraction": 0.5,
                "magnitude_sigmas": 6.0,
                "direction": "up",
            }
        ],
    }
    r = client.post("/api/v1/simulation/generate", json=cfg)
    assert r.status_code == 201, r.text
    body = r.json()
    ds_id = body["dataset_id"]
    assert body["row_count"] == 60 * 4
    assert len(body["ground_truth"]) == 1

    r = client.post(f"/api/v1/datasets/{ds_id}/preprocess", json={"resample_interval": "1min"})
    assert r.status_code == 200, r.text
    client.delete(f"/api/v1/datasets/{ds_id}")


def test_simulation_rejects_unknown_stage(client):
    r = client.post("/api/v1/simulation/generate", json={"name": "bad", "stages": ["nope"]})
    assert r.status_code == 422


def test_simulation_rejects_unknown_parameter(client):
    r = client.post(
        "/api/v1/simulation/generate",
        json={
            "name": "bad2",
            "stages": ["etching"],
            "drifts": [{"stage_name": "etching", "parameter_name": "ghost_param"}],
        },
    )
    assert r.status_code == 422


def test_404_for_missing_dataset(client):
    assert client.get("/api/v1/datasets/999999").status_code == 404
    assert client.post("/api/v1/datasets/999999/validate").status_code == 404
