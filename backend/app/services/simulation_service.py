"""Simulation service: generate synthetic datasets and register them."""
import json
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.constants import DATASET_STATUS_UPLOADED, SOURCE_SYNTHETIC
from app.core.logging import get_logger
from app.models import Dataset
from app.modules.digital_twin.simulator import generate_dataset
from app.schemas.simulation import SimulationConfig

logger = get_logger(__name__)


def run_simulation(db: Session, config: SimulationConfig) -> dict:
    """Generate synthetic data, save CSV + ground truth, register dataset."""
    settings = get_settings()
    df, ground_truth = generate_dataset(config)

    settings.generated_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    csv_path = settings.generated_dir / f"{stamp}_{config.name}.csv"
    df.to_csv(csv_path, index=False)

    gt_path = csv_path.with_suffix(".ground_truth.json")
    gt_path.write_text(json.dumps(ground_truth, indent=2), encoding="utf-8")

    ts = df["timestamp"]
    ds = Dataset(
        name=config.name,
        source_type=SOURCE_SYNTHETIC,
        original_filename=csv_path.name,
        stage_name=None,
        start_timestamp=ts.min().to_pydatetime(),
        end_timestamp=ts.max().to_pydatetime(),
        row_count=len(df),
        status=DATASET_STATUS_UPLOADED,
        meta={
            "file_path": str(csv_path),
            "ground_truth_file": str(gt_path),
            "ground_truth": ground_truth,
            "simulation_config": config.model_dump(),
            "is_simulated": True,
        },
    )
    db.add(ds)
    db.commit()
    db.refresh(ds)
    logger.info("Generated synthetic dataset %s (%d rows)", ds.id, len(df))

    return {
        "dataset_id": ds.id,
        "name": config.name,
        "row_count": len(df),
        "file_path": str(csv_path),
        "ground_truth": ground_truth,
        "config": config,
    }
