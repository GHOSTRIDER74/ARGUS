"""
ARGUS Data Bootstrapper
Downloads the official UCI SECOM dataset and prepares data/processed/secom_processed.csv.
Or generates a synthetic starter dataset if --synthetic is passed.
"""

import os
import sys
import argparse
import urllib.request
from pathlib import Path
import subprocess

PROJECT_ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = PROJECT_ROOT / "data" / "raw"
PROCESSED_DIR = PROJECT_ROOT / "data" / "processed"

SECOM_DATA_URL = "https://archive.ics.uci.edu/ml/machine-learning-databases/secom/secom.data"
SECOM_LABELS_URL = "https://archive.ics.uci.edu/ml/machine-learning-databases/secom/secom_labels.data"

def download_file(url: str, dest: Path):
    print(f"Downloading {url} -> {dest} ...")
    urllib.request.urlretrieve(url, dest)
    print(f"Saved: {dest} ({dest.stat().st_size / (1024*1024):.2f} MB)")

def prepare_real_data():
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    secom_data = RAW_DIR / "secom.data"
    secom_labels = RAW_DIR / "secom_labels.data"

    if not secom_data.exists():
        download_file(SECOM_DATA_URL, secom_data)
    else:
        print(f"Found existing {secom_data}")

    if not secom_labels.exists():
        download_file(SECOM_LABELS_URL, secom_labels)
    else:
        print(f"Found existing {secom_labels}")

    print("\nRunning EDA/preprocessing.py...")
    eda_script = PROJECT_ROOT / "EDA" / "preprocessing.py"
    subprocess.run([sys.executable, str(eda_script)], check=True)
    print("\nReal SECOM dataset successfully processed and saved!")

def generate_synthetic_data(n_samples: int = 1567):
    import numpy as np
    import pandas as pd

    print(f"Generating synthetic SECOM-compatible dataset ({n_samples} samples)...")
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    out_file = PROCESSED_DIR / "secom_processed.csv"

    features = [
        "rf_power", "etch_rate", "chamber_pressure", "etchant_gas_flow",
        "dep_temp", "gas_flow_rate", "film_thickness", "chamber_vacuum",
        "pad_pressure", "slurry_flow", "rotation_speed", "friction_coefficient",
        "focus_offset", "exposure_dose", "alignment_error", "lens_temp",
        "bath_temp", "chemical_ph", "rinse_flow", "particle_count",
    ]

    np.random.seed(42)
    data = {feat: np.random.normal(0.0, 1.0, n_samples) for feat in features}
    
    # Generate dates
    dates = pd.date_range("2008-07-19 11:55:00", periods=n_samples, freq="15min")
    data["Time"] = dates

    # Failure labels (~5% failure rate)
    data["Pass/Fail"] = np.random.binomial(1, 0.05, n_samples)

    df = pd.DataFrame(data)
    target_rf_power = df["rf_power"].median()
    df["energy_loss_kwh"] = np.abs(df["rf_power"] - target_rf_power) * 0.05
    df["co2_emission_kg"] = df["energy_loss_kwh"] * 0.42
    df["operational_cost_usd"] = df["energy_loss_kwh"] * 0.15
    df["scrap_cost_usd"] = df["Pass/Fail"].apply(lambda x: 500 if x == 1 else 0)
    df["total_impact_cost_usd"] = df["operational_cost_usd"] + df["scrap_cost_usd"]

    df.to_csv(out_file, index=False)
    print(f"Synthetic dataset saved to {out_file}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Prepare ARGUS data")
    parser.add_argument("--synthetic", action="store_true", help="Generate synthetic data instead of downloading")
    args = parser.parse_args()

    if args.synthetic:
        generate_synthetic_data()
    else:
        try:
            prepare_real_data()
        except Exception as e:
            print(f"Error downloading or processing real data: {e}")
            print("Falling back to synthetic generation...")
            generate_synthetic_data()
