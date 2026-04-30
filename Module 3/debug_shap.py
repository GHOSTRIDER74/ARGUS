import numpy as np
from drift_explainer import explain_drift
from preprocessor import preprocess
from data_generator import generate_pcb_data

df = generate_pcb_data(n_samples=2000, drift_start=1200)
X_windows, scaler, labels = preprocess(df, window_size=30)
shap_vals, drift_idx, feat_names = explain_drift(X_windows, labels, n_background=20)

print(f"type(shap_vals): {type(shap_vals)}")
if isinstance(shap_vals, list):
    print(f"len(shap_vals): {len(shap_vals)}")
    print(f"shap_vals[0].shape: {shap_vals[0].shape}")
    if len(shap_vals) > 1:
        print(f"shap_vals[1].shape: {shap_vals[1].shape}")
else:
    print(f"shap_vals.shape: {shap_vals.shape}")
    print(f"shap_vals: {shap_vals}")

mean_shap = np.abs(shap_vals[1]).mean(axis=0) if isinstance(shap_vals, list) else np.abs(shap_vals).mean(axis=0)
print(f"mean_shap shape: {mean_shap.shape}")
print(f"feat_names len: {len(feat_names)}")
