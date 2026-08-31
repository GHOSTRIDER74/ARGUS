"""Dataset service: upload, validation, preprocessing, summaries, deletion."""
import re
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.constants import (
    DATASET_STATUS_FAILED,
    DATASET_STATUS_PREPROCESSED,
    DATASET_STATUS_UPLOADED,
    DATASET_STATUS_VALIDATED,
    REQUIRED_COLUMNS,
    SOURCE_UPLOAD,
)
from app.core.logging import get_logger
from app.models import Dataset, PreprocessingRun, SensorReading
from app.modules.data_engineering.cleaner import clean_dataframe, compute_quality_score
from app.modules.data_engineering.converter import wide_to_long
from app.modules.data_engineering.features import engineer_features
from app.modules.data_engineering.stage_catalog import load_stage_catalog
from app.modules.data_engineering.validator import build_report_dict, validate_dataframe
from app.schemas.dataset import PreprocessConfig

logger = get_logger(__name__)


def _safe_name(name: str) -> str:
    """Sanitise a filename: strip paths, keep alphanumerics/dash/underscore/dot."""
    name = Path(name).name
    return re.sub(r"[^A-Za-z0-9._-]", "_", name) or "upload.csv"


def save_upload(db: Session, filename: str, content: bytes, wide_format: bool = False) -> Dataset:
    """Persist an uploaded CSV to disk and register a dataset row."""
    settings = get_settings()
    settings.raw_dir.mkdir(parents=True, exist_ok=True)

    safe = _safe_name(filename)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    path = settings.raw_dir / f"{stamp}_{safe}"
    path.write_bytes(content)

    try:
        df = pd.read_csv(path)
    except Exception as exc:
        path.unlink(missing_ok=True)
        raise ValueError(f"File is not a readable CSV: {exc}") from exc

    if wide_format or not set(REQUIRED_COLUMNS).issubset(df.columns):
        try:
            df = wide_to_long(df)
            long_path = path.with_suffix(".long.csv")
            df.to_csv(long_path, index=False)
            path = long_path
        except ValueError:
            pass  # leave as-is; validation will report missing columns

    ts = pd.to_datetime(df.get("timestamp"), errors="coerce", utc=True, format="mixed")
    stages = df["stage_name"].dropna().unique().tolist() if "stage_name" in df.columns else []

    ds = Dataset(
        name=safe,
        source_type=SOURCE_UPLOAD,
        original_filename=filename,
        stage_name=stages[0] if len(stages) == 1 else None,
        start_timestamp=ts.min().to_pydatetime() if ts is not None and ts.notna().any() else None,
        end_timestamp=ts.max().to_pydatetime() if ts is not None and ts.notna().any() else None,
        row_count=len(df),
        status=DATASET_STATUS_UPLOADED,
        meta={"file_path": str(path)},
    )
    db.add(ds)
    db.commit()
    db.refresh(ds)
    logger.info("Uploaded dataset %s (%d rows) -> %s", ds.id, ds.row_count, path)
    return ds


def load_dataset_frame(ds: Dataset) -> pd.DataFrame:
    """Load a dataset's CSV from disk using the stored file path."""
    path = Path((ds.meta or {}).get("file_path", ""))
    if not path.exists():
        raise FileNotFoundError(f"Data file for dataset {ds.id} not found: {path}")
    return pd.read_csv(path)


def get_dataset(db: Session, dataset_id: int) -> Dataset | None:
    return db.get(Dataset, dataset_id)


def list_datasets(db: Session) -> list[Dataset]:
    return list(db.scalars(select(Dataset).order_by(Dataset.created_at.desc())))


def validate_dataset(db: Session, ds: Dataset) -> dict:
    df = load_dataset_frame(ds)
    catalog = load_stage_catalog()
    is_valid, issues = validate_dataframe(df, known_stages=catalog.stage_names)
    report = build_report_dict(is_valid, issues, len(df))

    ds.status = DATASET_STATUS_VALIDATED if is_valid else DATASET_STATUS_FAILED
    meta = dict(ds.meta or {})
    meta["validation_report"] = report
    ds.meta = meta
    db.commit()
    return report


def preprocess_dataset(db: Session, ds: Dataset, config: PreprocessConfig) -> dict:
    """Clean, resample, engineer features, score quality, and store readings."""
    settings = get_settings()
    df = load_dataset_frame(ds)
    input_rows = len(df)
    missing_before = int(pd.to_numeric(df.get("parameter_value"), errors="coerce").isna().sum())

    clean_df, clean_report = clean_dataframe(df, config)

    feature_file = None
    if config.generate_features:
        feat_df = engineer_features(clean_df, config)
        settings.processed_dir.mkdir(parents=True, exist_ok=True)
        feature_path = settings.processed_dir / f"dataset_{ds.id}_features.csv"
        feat_df.to_csv(feature_path, index=False)
        feature_file = str(feature_path)

    quality = compute_quality_score(clean_df)

    # store cleaned readings in DB (replace any previous readings for this dataset)
    db.execute(delete(SensorReading).where(SensorReading.dataset_id == ds.id))
    records = clean_df.dropna(subset=["parameter_value"])
    mappings = [
        {
            "dataset_id": ds.id,
            "timestamp": r.timestamp.to_pydatetime() if hasattr(r.timestamp, "to_pydatetime") else r.timestamp,
            "batch_id": getattr(r, "batch_id", None),
            "wafer_id": getattr(r, "wafer_id", None),
            "machine_id": r.machine_id,
            "stage_name": r.stage_name,
            "parameter_name": r.parameter_name,
            "parameter_value": float(r.parameter_value),
            "target_value": float(r.target_value) if getattr(r, "target_value", None) is not None and not pd.isna(getattr(r, "target_value", np.nan)) else None,
            "unit": getattr(r, "unit", None) if isinstance(getattr(r, "unit", None), str) else None,
            "quality_score": float(r.quality_score) if getattr(r, "quality_score", None) is not None and not pd.isna(getattr(r, "quality_score", np.nan)) else None,
        }
        for r in records.itertuples(index=False)
    ]
    if mappings:
        db.bulk_insert_mappings(SensorReading, mappings)

    run = PreprocessingRun(
        dataset_id=ds.id,
        configuration=config.model_dump(),
        input_rows=input_rows,
        output_rows=len(clean_df),
        missing_values_before=missing_before,
        missing_values_after=clean_report["missing_values_after"],
        status="completed",
        report={**clean_report, **quality},
    )
    db.add(run)

    ds.status = DATASET_STATUS_PREPROCESSED
    ds.row_count = len(clean_df)
    ds.quality_score = quality["quality_score"]
    meta = dict(ds.meta or {})
    meta["quality"] = quality
    meta["missing_by_column"] = {c: int(clean_df[c].isna().sum()) for c in clean_df.columns}
    if feature_file:
        meta["feature_file"] = feature_file
    ds.meta = meta
    db.commit()
    db.refresh(run)

    return {
        "dataset_id": ds.id,
        "run_id": run.id,
        "input_rows": input_rows,
        "output_rows": len(clean_df),
        "missing_values_before": missing_before,
        "missing_values_after": clean_report["missing_values_after"],
        "quality_score": quality["quality_score"],
        "feature_file": feature_file,
        "report": {**clean_report, **quality},
    }


def dataset_summary(db: Session, ds: Dataset) -> dict:
    rows = db.execute(
        select(
            SensorReading.stage_name,
            SensorReading.machine_id,
            SensorReading.parameter_name,
            func.count(SensorReading.id),
            func.avg(SensorReading.parameter_value),
            func.min(SensorReading.parameter_value),
            func.max(SensorReading.parameter_value),
        )
        .where(SensorReading.dataset_id == ds.id)
        .group_by(SensorReading.stage_name, SensorReading.machine_id, SensorReading.parameter_name)
    ).all()

    statistics = {
        f"{stage}/{param}": {
            "count": int(cnt),
            "mean": round(float(avg), 4) if avg is not None else 0.0,
            "min": round(float(mn), 4) if mn is not None else 0.0,
            "max": round(float(mx), 4) if mx is not None else 0.0,
        }
        for stage, machine, param, cnt, avg, mn, mx in rows
    }
    return {
        "dataset_id": ds.id,
        "row_count": ds.row_count,
        "stages": sorted({r[0] for r in rows}),
        "machines": sorted({r[1] for r in rows}),
        "parameters": sorted({r[2] for r in rows}),
        "start_timestamp": ds.start_timestamp,
        "end_timestamp": ds.end_timestamp,
        "statistics": statistics,
    }


def quality_report(ds: Dataset) -> dict:
    meta = ds.meta or {}
    q = meta.get("quality")
    if not q:
        raise ValueError("Dataset has not been preprocessed yet; run preprocessing first.")
    return {
        "dataset_id": ds.id,
        "quality_score": q["quality_score"],
        "completeness": q["completeness"],
        "validity": q["validity"],
        "uniqueness": q["uniqueness"],
        "timeliness": q["timeliness"],
        "missing_by_column": meta.get("missing_by_column", {}),
        "details": meta.get("validation_report", {}),
    }


def delete_dataset(db: Session, ds: Dataset) -> None:
    meta = ds.meta or {}
    for key in ("file_path", "feature_file"):
        p = meta.get(key)
        if p:
            Path(p).unlink(missing_ok=True)
    db.execute(delete(SensorReading).where(SensorReading.dataset_id == ds.id))
    db.execute(delete(PreprocessingRun).where(PreprocessingRun.dataset_id == ds.id))
    db.delete(ds)
    db.commit()
    logger.info("Deleted dataset %s", ds.id)
