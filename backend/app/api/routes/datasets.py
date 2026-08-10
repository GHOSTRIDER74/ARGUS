"""Dataset endpoints: upload, validate, preprocess, list, summary, quality, delete."""
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.logging import get_logger
from app.database.session import get_db
from app.models import Dataset
from app.schemas.dataset import (
    DatasetOut,
    DatasetSummary,
    PreprocessConfig,
    PreprocessResult,
    QualityReport,
    ValidationReport,
)
from app.services import dataset_service

router = APIRouter(prefix="/datasets", tags=["datasets"])
logger = get_logger(__name__)


def _get_or_404(db: Session, dataset_id: int) -> Dataset:
    ds = dataset_service.get_dataset(db, dataset_id)
    if ds is None:
        raise HTTPException(status_code=404, detail=f"Dataset {dataset_id} not found")
    return ds


@router.post("/upload", response_model=DatasetOut, status_code=201)
async def upload_dataset(
    file: UploadFile = File(...),
    wide_format: bool = Query(default=False, description="Set true for one-column-per-parameter CSVs"),
    db: Session = Depends(get_db),
) -> Dataset:
    settings = get_settings()
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted")
    content = await file.read()
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.max_upload_mb} MB limit")
    if not content.strip():
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    try:
        return dataset_service.save_upload(db, file.filename or "upload.csv", content, wide_format)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{dataset_id}/validate", response_model=ValidationReport)
def validate_dataset(dataset_id: int, db: Session = Depends(get_db)) -> dict:
    ds = _get_or_404(db, dataset_id)
    try:
        report = dataset_service.validate_dataset(db, ds)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=410, detail=str(exc)) from exc
    return {"dataset_id": ds.id, **report}


@router.post("/{dataset_id}/preprocess", response_model=PreprocessResult)
def preprocess_dataset(
    dataset_id: int, config: PreprocessConfig, db: Session = Depends(get_db)
) -> dict:
    ds = _get_or_404(db, dataset_id)
    try:
        return dataset_service.preprocess_dataset(db, ds, config)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=410, detail=str(exc)) from exc
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=422, detail=f"Preprocessing failed: {exc}") from exc


@router.get("", response_model=list[DatasetOut])
def list_datasets(db: Session = Depends(get_db)) -> list[Dataset]:
    return dataset_service.list_datasets(db)


@router.get("/{dataset_id}", response_model=DatasetOut)
def get_dataset(dataset_id: int, db: Session = Depends(get_db)) -> Dataset:
    return _get_or_404(db, dataset_id)


@router.get("/{dataset_id}/summary", response_model=DatasetSummary)
def get_summary(dataset_id: int, db: Session = Depends(get_db)) -> dict:
    ds = _get_or_404(db, dataset_id)
    return dataset_service.dataset_summary(db, ds)


@router.get("/{dataset_id}/quality-report", response_model=QualityReport)
def get_quality_report(dataset_id: int, db: Session = Depends(get_db)) -> dict:
    ds = _get_or_404(db, dataset_id)
    try:
        return dataset_service.quality_report(ds)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/{dataset_id}/series")
def get_series(
    dataset_id: int,
    machine_id: str,
    stage_name: str,
    parameter_name: str,
    limit: int = Query(default=2000, le=20000),
    db: Session = Depends(get_db),
) -> dict:
    """Time series of one parameter (for Module 2 charts)."""
    from sqlalchemy import select

    from app.models import SensorReading

    _get_or_404(db, dataset_id)
    rows = db.execute(
        select(SensorReading.timestamp, SensorReading.parameter_value, SensorReading.target_value)
        .where(
            SensorReading.dataset_id == dataset_id,
            SensorReading.machine_id == machine_id,
            SensorReading.stage_name == stage_name,
            SensorReading.parameter_name == parameter_name,
        )
        .order_by(SensorReading.timestamp)
        .limit(limit)
    ).all()
    if not rows:
        raise HTTPException(status_code=404, detail="No readings for that parameter")
    return {
        "dataset_id": dataset_id,
        "parameter_name": parameter_name,
        "timestamps": [r[0].isoformat() for r in rows],
        "values": [r[1] for r in rows],
        "target_value": rows[0][2],
    }


@router.delete("/{dataset_id}", status_code=204)
def delete_dataset(dataset_id: int, db: Session = Depends(get_db)) -> None:
    ds = _get_or_404(db, dataset_id)
    dataset_service.delete_dataset(db, ds)
