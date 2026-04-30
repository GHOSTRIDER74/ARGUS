import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

FEATURE_COLS = [
    "reflow_temp_c",
    "solder_viscosity_pa",
    "etch_concentration",
    "inspection_defect_rate",
]

def preprocess(df, window_size=30):
    """
    Normalises features and creates sliding windows for LSTM input.
    Returns:
        X_windows: (n_windows, window_size, n_features) array
        scaler: fitted StandardScaler for inverse transform
        labels: per-window drift ground truth
    """
    scaler = StandardScaler()
    scaled = scaler.fit_transform(df[FEATURE_COLS].values)

    X_windows, labels = [], []
    for i in range(len(scaled) - window_size):
        X_windows.append(scaled[i : i + window_size])
        # Label window as drifted if ANY step in it is drifted
        labels.append(int(df["drift_injected"].iloc[i : i + window_size].any()))

    return np.array(X_windows, dtype=np.float32), scaler, np.array(labels)