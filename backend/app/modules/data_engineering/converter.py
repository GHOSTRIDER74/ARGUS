"""Convert wide-format sensor CSVs (one column per parameter) to the standard long format."""
import pandas as pd

ID_COLUMNS = [
    "timestamp",
    "batch_id",
    "wafer_id",
    "machine_id",
    "stage_name",
    "production_rate",
    "stage_duration",
    "energy_kwh",
    "material_consumption",
    "chemical_consumption",
    "quality_score",
    "defect_label",
]


def wide_to_long(df: pd.DataFrame, value_columns: list[str] | None = None) -> pd.DataFrame:
    """Melt a wide dataframe into the standard long format.

    value_columns: parameter columns to melt. Defaults to every column not in
    ID_COLUMNS. Requires at least 'timestamp' plus one value column.
    """
    if "timestamp" not in df.columns:
        raise ValueError("wide_to_long requires a 'timestamp' column")

    id_cols = [c for c in ID_COLUMNS if c in df.columns]
    if value_columns is None:
        value_columns = [c for c in df.columns if c not in id_cols]
    if not value_columns:
        raise ValueError("No parameter columns found to melt")

    long_df = df.melt(
        id_vars=id_cols,
        value_vars=value_columns,
        var_name="parameter_name",
        value_name="parameter_value",
    )
    if "machine_id" not in long_df.columns:
        long_df["machine_id"] = "UNKNOWN-01"
    if "stage_name" not in long_df.columns:
        long_df["stage_name"] = "unknown"
    return long_df
