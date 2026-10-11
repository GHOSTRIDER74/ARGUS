import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

FEATURE_COLS = ["rf_power", "etch_rate", "chamber_pressure", "etchant_gas_flow"]

def preprocess(df, window_size=30):
    scaler = StandardScaler()
    scaled = scaler.fit_transform(df[FEATURE_COLS].values)

    X_windows, labels = [], []
    for i in range(len(scaled) - window_size):
        X_windows.append(scaled[i : i + window_size])
        
        # In real data, a defect (Pass/Fail == 1) in the window flags it as an anomaly
        window_labels = df["Pass/Fail"].iloc[i : i + window_size]
        is_anomalous = int((window_labels == 1).any())
        labels.append(is_anomalous)

    return np.array(X_windows, dtype=np.float32), scaler, np.array(labels)