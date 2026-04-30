import shap
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier

FEATURE_COLS = [
    "reflow_temp_c",
    "solder_viscosity_pa",
    "etch_concentration",
    "inspection_defect_rate",
]

def explain_drift(X_windows, labels, n_background=200):
    """
    Trains a GBM on window-level features (mean per parameter across window),
    then uses SHAP KernelExplainer to attribute drift to specific parameters.
    Returns shap_values array and the fitted explainer.
    """
    # Reduce windows to mean feature vector per window
    X_flat = X_windows.mean(axis=1)  # (n_windows, n_features)

    clf = GradientBoostingClassifier(n_estimators=100, random_state=42)
    clf.fit(X_flat, labels)

    background = shap.sample(X_flat, n_background)
    explainer = shap.KernelExplainer(clf.predict_proba, background)

    # Only explain windows where drift was detected
    drift_idx = np.where(labels == 1)[0]
    if len(drift_idx) == 0:
        print("No drift windows to explain.")
        return None, None

    print(f"Running SHAP on {len(drift_idx)} drift windows...")
    shap_values = explainer.shap_values(X_flat[drift_idx], nsamples=100)

    return shap_values, drift_idx, FEATURE_COLS