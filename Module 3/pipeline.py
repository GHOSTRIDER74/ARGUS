import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec

from data_generator import generate_pcb_data
from preprocessor import preprocess, FEATURE_COLS
from cusum_detector import run_cusum
from lstm_autoencoder import train_autoencoder, score_windows, get_lstm_alerts
from drift_explainer import explain_drift

WINDOW_SIZE = 30
DRIFT_START = 1200

def run():
    # ── Step 1: Generate data ──
    print("Generating PCB process data...")
    df = generate_pcb_data(n_samples=2000, drift_start=DRIFT_START)

    # ── Step 2: Preprocess ──
    print("Preprocessing...")
    X_windows, scaler, labels = preprocess(df, window_size=WINDOW_SIZE)
    n_normal = DRIFT_START - WINDOW_SIZE
    X_normal = X_windows[:n_normal]

    # ── Step 3a: CUSUM ──
    print("Running CUSUM...")
    cusum_df = run_cusum(df)

    # ── Step 3b: LSTM Autoencoder ──
    print("Training LSTM Autoencoder on normal windows...")
    model = train_autoencoder(X_normal, epochs=20)
    errors = score_windows(model, X_windows)
    lstm_alerts, threshold = get_lstm_alerts(errors, normal_cutoff=n_normal)

    # ── Step 4: Fuse signals ──
    cusum_alerts = cusum_df["cusum_any_alert"].values[:len(lstm_alerts)]
    fused_alerts = np.clip(cusum_alerts + lstm_alerts, 0, 1)

    # ── Step 5: SHAP explanation ──
    shap_vals, drift_idx, feat_names = explain_drift(X_windows, labels)

    # ── Step 6: Visualise ──
    fig = plt.figure(figsize=(14, 10))
    gs = gridspec.GridSpec(3, 2, figure=fig, hspace=0.45, wspace=0.35)

    t = df["timestep"].values
    ax1 = fig.add_subplot(gs[0, :])
    for col in FEATURE_COLS:
        normed = (df[col] - df[col].mean()) / df[col].std()
        ax1.plot(t, normed, alpha=0.6, linewidth=0.8, label=col)
    ax1.axvline(DRIFT_START, color="red", linestyle="--", linewidth=1.2, label="Drift injected")
    ax1.set_title("PCB process parameters (normalised)")
    ax1.legend(fontsize=7, ncol=2)
    ax1.set_xlabel("Timestep")

    ax2 = fig.add_subplot(gs[1, 0])
    ax2.plot(cusum_df["cusum_any_alert"].values, color="#378ADD", linewidth=0.8)
    ax2.axvline(DRIFT_START, color="red", linestyle="--", linewidth=1.0)
    ax2.set_title("CUSUM alerts")
    ax2.set_xlabel("Timestep")

    ax3 = fig.add_subplot(gs[1, 1])
    ax3.plot(errors, color="#7F77DD", linewidth=0.8)
    ax3.axhline(threshold, color="red", linestyle="--", linewidth=1.0, label="Threshold")
    ax3.axvline(n_normal, color="orange", linestyle="--", linewidth=1.0, label="Drift start")
    ax3.set_title("LSTM AE reconstruction error")
    ax3.legend(fontsize=8)
    ax3.set_xlabel("Window index")

    ax4 = fig.add_subplot(gs[2, 0])
    ax4.plot(fused_alerts, color="#1D9E75", linewidth=0.8)
    ax4.axvline(DRIFT_START, color="red", linestyle="--", linewidth=1.0)
    ax4.set_title("Fused drift alert (CUSUM + LSTM AE)")
    ax4.set_xlabel("Timestep / Window")

    if shap_vals is not None:
        ax5 = fig.add_subplot(gs[2, 1])
        if isinstance(shap_vals, list):
            mean_shap = np.abs(shap_vals[1]).mean(axis=0)
        elif len(shap_vals.shape) == 3:
            mean_shap = np.abs(shap_vals[:, :, 1]).mean(axis=0)
        else:
            mean_shap = np.abs(shap_vals).mean(axis=0)
        bars = ax5.barh(feat_names, mean_shap, color="#D85A30")
        ax5.set_title("SHAP: mean |attribution| per parameter")
        ax5.set_xlabel("Mean |SHAP value|")
        ax5.invert_yaxis()

    plt.suptitle("ARGUS — Module 3: Drift Detection Engine", fontsize=13, y=1.01)
    plt.savefig("argus_module3_output.png", dpi=150, bbox_inches="tight")
    print("Saved: argus_module3_output.png")
    plt.show()


if __name__ == "__main__":
    run()