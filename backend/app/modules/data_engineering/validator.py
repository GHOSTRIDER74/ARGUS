"""Dataset validation. Produces a human-readable report; never silently drops rows."""
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from app.core.constants import NON_NEGATIVE_COLUMNS, REQUIRED_COLUMNS
from app.schemas.dataset import ValidationIssue


def validate_dataframe(
    df: pd.DataFrame, known_stages: list[str] | None = None
) -> tuple[bool, list[ValidationIssue]]:
    """Run all validation checks. Returns (is_valid, issues).

    'error' issues make the dataset invalid; 'warning' issues do not.
    """
    issues: list[ValidationIssue] = []

    # --- required columns ---
    missing_cols = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing_cols:
        issues.append(
            ValidationIssue(
                severity="error",
                code="missing_columns",
                message=f"Missing required columns: {', '.join(missing_cols)}",
                count=len(missing_cols),
            )
        )
        return False, issues  # further checks are meaningless

    if df.empty:
        issues.append(
            ValidationIssue(severity="error", code="empty_file", message="File contains no data rows")
        )
        return False, issues

    # --- timestamp parsing ---
    ts = pd.to_datetime(df["timestamp"], errors="coerce", utc=True, format="mixed")
    bad_ts = int(ts.isna().sum())
    if bad_ts:
        issues.append(
            ValidationIssue(
                severity="error",
                code="invalid_timestamps",
                message=f"{bad_ts} rows have unparseable timestamps",
                count=bad_ts,
            )
        )

    # --- numeric parameter values ---
    values = pd.to_numeric(df["parameter_value"], errors="coerce")
    bad_vals = int(values.isna().sum() - df["parameter_value"].isna().sum())
    if bad_vals > 0:
        issues.append(
            ValidationIssue(
                severity="error",
                code="non_numeric_values",
                message=f"{bad_vals} rows have non-numeric parameter_value",
                count=bad_vals,
            )
        )
    missing_vals = int(df["parameter_value"].isna().sum())
    if missing_vals:
        issues.append(
            ValidationIssue(
                severity="warning",
                code="missing_values",
                message=f"{missing_vals} rows have missing parameter_value (can be interpolated during preprocessing)",
                count=missing_vals,
            )
        )
    if np.isinf(values.dropna()).any():
        n_inf = int(np.isinf(values.dropna()).sum())
        issues.append(
            ValidationIssue(
                severity="error",
                code="infinite_values",
                message=f"{n_inf} rows have infinite parameter_value",
                count=n_inf,
            )
        )

    # --- missing identifiers ---
    for col in ("machine_id", "stage_name", "parameter_name"):
        n = int(df[col].isna().sum() + (df[col].astype(str).str.strip() == "").sum())
        if n:
            issues.append(
                ValidationIssue(
                    severity="error",
                    code=f"missing_{col}",
                    message=f"{n} rows have missing {col}",
                    count=n,
                )
            )
    if "batch_id" in df.columns:
        n = int(df["batch_id"].isna().sum())
        if n:
            issues.append(
                ValidationIssue(
                    severity="warning",
                    code="missing_batch_id",
                    message=f"{n} rows have missing batch_id",
                    count=n,
                )
            )

    # --- unknown stage names ---
    if known_stages:
        unknown = sorted(set(df["stage_name"].dropna().astype(str)) - set(known_stages))
        if unknown:
            issues.append(
                ValidationIssue(
                    severity="warning",
                    code="unknown_stage_names",
                    message=(
                        f"Stage names not in configuration: {', '.join(unknown)}. "
                        "Add them to stages.json if they are real stages."
                    ),
                    count=len(unknown),
                )
            )

    # --- duplicates ---
    n_dup_rows = int(df.duplicated().sum())
    if n_dup_rows:
        issues.append(
            ValidationIssue(
                severity="warning",
                code="duplicate_rows",
                message=f"{n_dup_rows} fully duplicated rows (removed during preprocessing)",
                count=n_dup_rows,
            )
        )
    key_cols = ["timestamp", "machine_id", "stage_name", "parameter_name"]
    n_dup_readings = int(df.duplicated(subset=key_cols).sum()) - n_dup_rows
    if n_dup_readings > 0:
        issues.append(
            ValidationIssue(
                severity="warning",
                code="duplicate_readings",
                message=f"{n_dup_readings} conflicting duplicate sensor readings (same timestamp/machine/stage/parameter with different values)",
                count=n_dup_readings,
            )
        )

    # --- negative values in physically non-negative columns ---
    for col in NON_NEGATIVE_COLUMNS:
        if col in df.columns:
            n = int((pd.to_numeric(df[col], errors="coerce") < 0).sum())
            if n:
                issues.append(
                    ValidationIssue(
                        severity="error",
                        code=f"negative_{col}",
                        message=f"{n} rows have negative {col}",
                        count=n,
                    )
                )

    # --- operating-limit sanity ---
    if {"lower_operating_limit", "upper_operating_limit"}.issubset(df.columns):
        lo = pd.to_numeric(df["lower_operating_limit"], errors="coerce")
        hi = pd.to_numeric(df["upper_operating_limit"], errors="coerce")
        n = int((lo > hi).sum())
        if n:
            issues.append(
                ValidationIssue(
                    severity="error",
                    code="inverted_limits",
                    message=f"{n} rows have lower_operating_limit > upper_operating_limit",
                    count=n,
                )
            )

    # --- per-series timestamp ordering & sampling regularity ---
    if bad_ts == 0:
        tmp = df.assign(_ts=ts).sort_values("_ts")
        non_monotonic = 0
        irregular_series = 0
        for _, g in df.assign(_ts=ts).groupby(["machine_id", "stage_name", "parameter_name"], sort=False):
            s = g["_ts"]
            if not s.is_monotonic_increasing:
                non_monotonic += 1
            deltas = s.sort_values().diff().dropna()
            if len(deltas) > 3 and deltas.nunique() > 1:
                mode = deltas.mode().iloc[0]
                if (deltas != mode).mean() > 0.05:
                    irregular_series += 1
        if non_monotonic:
            issues.append(
                ValidationIssue(
                    severity="warning",
                    code="non_monotonic_timestamps",
                    message=f"{non_monotonic} sensor series are not in chronological order (sorted during preprocessing)",
                    count=non_monotonic,
                )
            )
        if irregular_series:
            issues.append(
                ValidationIssue(
                    severity="warning",
                    code="irregular_sampling",
                    message=f"{irregular_series} sensor series have >5% unexpected sampling intervals (resampling recommended)",
                    count=irregular_series,
                )
            )
        del tmp

    is_valid = not any(i.severity == "error" for i in issues)
    return is_valid, issues


def build_report_dict(is_valid: bool, issues: list[ValidationIssue], total_rows: int) -> dict:
    return {
        "is_valid": is_valid,
        "total_rows": total_rows,
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "issues": [i.model_dump() for i in issues],
    }
