"""Module 1 runner: validate -> clean -> quality score -> engineered features.

Thin orchestration over the existing data_engineering functions — no algorithm
formulas live here and no database is touched.
"""
import pandas as pd

from app.modules.data_engineering.cleaner import clean_dataframe, compute_quality_score
from app.modules.data_engineering.features import engineer_features
from app.modules.data_engineering.stage_catalog import load_stage_catalog
from app.modules.data_engineering.validator import build_report_dict, validate_dataframe
from app.schemas.dataset import PreprocessConfig


def run_module1(long_df: pd.DataFrame, config: PreprocessConfig) -> dict:
    """Run the full Module 1 workflow on a long-format dataframe.

    Returns validation report, cleaned dataframe, cleaning report, quality
    score and (optionally) the engineered feature table.
    Raises ValueError when validation reports blocking errors.
    """
    catalog = load_stage_catalog()
    is_valid, issues = validate_dataframe(long_df, known_stages=catalog.stage_names)
    validation_report = build_report_dict(is_valid, issues, len(long_df))
    if not is_valid:
        errors = "; ".join(i.message for i in issues if i.severity == "error")
        raise ValueError(f"Dataset failed validation: {errors}")

    clean_df, cleaning_report = clean_dataframe(long_df, config)
    features_df = engineer_features(clean_df, config) if config.generate_features else None
    quality = compute_quality_score(clean_df)

    return {
        "validation_report": validation_report,
        "clean_df": clean_df,
        "features_df": features_df,
        "cleaning_report": cleaning_report,
        "quality": quality,
    }
