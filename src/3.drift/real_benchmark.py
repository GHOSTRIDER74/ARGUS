"""
ARGUS real benchmark
====================
Measures drift-detection performance on the processed SECOM data with a
*trained* LSTM autoencoder and the same rules the report describes.
Nothing here is simulated or hard-coded: every number is computed.

Protocol
--------
* Data      : data/processed/secom_processed.csv, the 4 etch channels
              (rf_power, etch_rate, chamber_pressure, etchant_gas_flow).
* Baseline  : records 0-499. Re-standardised with baseline mean/std only.
              LSTM-AE trained on windows ending before record 400; tau_99 is
              the 99th percentile of reconstruction error on held-out baseline
              windows ending in 400-499.
* Scenarios : 3 drift types x 4 target channels x 3 onsets (800, 1000, 1200)
              = 36 injected scenarios, repeated for each LSTM training seed.
                gradual : + (t - onset) * 0.04 sigma
                sudden  : + 3.0 sigma
                cyclical: + 1.5 sigma * sin(2 pi (t - onset) / 50)
* Windows   : W = 30, stride 1. The window ending at t is "drift" if t >= onset.
              Evaluation covers every window ending at t >= 500.
* Detectors : EWMA   (lambda 0.2, L 3.0, any channel)
              CUSUM  (absolute-deviation, k 1.2, h 15, decay 0.75/0.95,
                      max over channels, as in 2.twin/state_manager.py)
              LSTM-AE(error > tau_99)
              ARGUS  (CUSUM OR LSTM-AE)
* Metrics   : F1 over evaluation windows; FAR = % of pre-onset windows flagged;
              latency = windows from onset to the first alarm (detected
              scenarios only); detection rate = % of scenarios detected.

Run:  python src/3.drift/real_benchmark.py [--seeds 3] [--epochs 20]
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import torch

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
from lstm_autoencoder import LSTMAutoencoder  # noqa: E402

DATA_PATH = PROJECT_ROOT / "data" / "processed" / "secom_processed.csv"
OUT_PATH = PROJECT_ROOT / "results" / "real_benchmark_results.json"

FEATURES = ["rf_power", "etch_rate", "chamber_pressure", "etchant_gas_flow"]
W = 30
TRAIN_END = 400        # LSTM trains on windows ending before this record
BASELINE_END = 500     # baseline stats, tau calibration, CUSUM/EWMA reference
ONSETS = [800, 1000, 1200]
DRIFT_TYPES = ["gradual", "sudden", "cyclical"]
CYCLE_T = 50

K, H = 1.2, 15.0
DECAY_NOMINAL, DECAY_DRIFT = 0.75, 0.95
EWMA_LAMBDA, EWMA_L = 0.2, 3.0
METHODS = ["EWMA", "CUSUM", "LSTM-AE", "ARGUS"]


# ── data ────────────────────────────────────────────────────────────────────

def load_series() -> np.ndarray:
    df = pd.read_csv(DATA_PATH, usecols=FEATURES)
    x = df[FEATURES].to_numpy(dtype=np.float64)
    mu = x[:BASELINE_END].mean(axis=0)
    sd = x[:BASELINE_END].std(axis=0) + 1e-9
    return (x - mu) / sd          # baseline sigma is 1 for every channel


def inject(z: np.ndarray, kind: str, channel: int, onset: int) -> np.ndarray:
    out = z.copy()
    t = np.arange(len(z))
    m = t >= onset
    if kind == "gradual":
        out[m, channel] += (t[m] - onset) * 0.04
    elif kind == "sudden":
        out[m, channel] += 3.0
    elif kind == "cyclical":
        out[m, channel] += 1.5 * np.sin(2 * np.pi * (t[m] - onset) / CYCLE_T)
    return out


def windows(z: np.ndarray) -> np.ndarray:
    """Stride-1 windows; row i is the window ending at record i + W - 1."""
    idx = np.arange(W)[None, :] + np.arange(len(z) - W + 1)[:, None]
    return z[idx].astype(np.float32)


# ── detectors (all return a 0/1 alarm per record) ───────────────────────────

def cusum_alarms(z: np.ndarray) -> np.ndarray:
    s = np.zeros(z.shape[1])
    out = np.zeros(len(z), dtype=int)
    for t in range(len(z)):
        dev = np.abs(z[t])
        lam = np.where(dev < K, DECAY_NOMINAL, DECAY_DRIFT)
        s = np.maximum(0.0, s * lam + dev - K)
        out[t] = int(s.max() > H)
    return out


def ewma_alarms(z: np.ndarray) -> np.ndarray:
    limit = EWMA_L * np.sqrt(EWMA_LAMBDA / (2 - EWMA_LAMBDA))
    e = np.zeros(z.shape[1])
    out = np.zeros(len(z), dtype=int)
    for t in range(len(z)):
        e = EWMA_LAMBDA * z[t] + (1 - EWMA_LAMBDA) * e
        out[t] = int(np.any(np.abs(e) > limit))
    return out


def train_lstm(z: np.ndarray, seed: int, epochs: int):
    torch.manual_seed(seed)
    np.random.seed(seed)
    win = windows(z)
    end = np.arange(len(win)) + W - 1
    train = torch.tensor(win[end < TRAIN_END])
    calib = torch.tensor(win[(end >= TRAIN_END) & (end < BASELINE_END)])

    model = LSTMAutoencoder(n_features=len(FEATURES), hidden_dim=32)
    opt = torch.optim.Adam(model.parameters(), lr=1e-3)
    loss_fn = torch.nn.MSELoss()
    g = torch.Generator().manual_seed(seed)
    for _ in range(epochs):
        model.train()
        for b in torch.utils.data.DataLoader(train, batch_size=64, shuffle=True, generator=g):
            opt.zero_grad()
            loss = loss_fn(model(b), b)
            loss.backward()
            opt.step()

    tau = float(np.percentile(recon_errors(model, calib.numpy()), 99))
    return model, tau


def recon_errors(model, win: np.ndarray) -> np.ndarray:
    model.eval()
    with torch.no_grad():
        x = torch.tensor(win)
        return ((model(x) - x) ** 2).mean(dim=(1, 2)).numpy()


def lstm_alarms(model, tau: float, z: np.ndarray) -> np.ndarray:
    err = recon_errors(model, windows(z))
    out = np.zeros(len(z), dtype=int)
    out[W - 1:] = (err > tau).astype(int)
    return out


# ── metrics ─────────────────────────────────────────────────────────────────

def score(alarm: np.ndarray, onset: int) -> dict:
    t = np.arange(len(alarm))
    ev = t >= BASELINE_END
    a, y = alarm[ev], (t[ev] >= onset).astype(int)
    tp = int(((a == 1) & (y == 1)).sum())
    fp = int(((a == 1) & (y == 0)).sum())
    fn = int(((a == 0) & (y == 1)).sum())
    tn = int(((a == 0) & (y == 0)).sum())
    prec = tp / (tp + fp) if tp + fp else 0.0
    rec = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
    hits = np.flatnonzero(alarm[onset:])
    return {
        "f1": f1,
        "far_pct": 100.0 * fp / (fp + tn) if fp + tn else 0.0,
        "latency": float(hits[0]) if len(hits) else None,
    }


def summarise(rows: list) -> dict:
    lat = [r["latency"] for r in rows if r["latency"] is not None]
    f1 = [r["f1"] for r in rows]
    far = [r["far_pct"] for r in rows]
    return {
        "f1_mean": round(float(np.mean(f1)), 4), "f1_std": round(float(np.std(f1)), 4),
        "far_pct_mean": round(float(np.mean(far)), 2), "far_pct_std": round(float(np.std(far)), 2),
        "latency_mean": round(float(np.mean(lat)), 2) if lat else None,
        "latency_std": round(float(np.std(lat)), 2) if lat else None,
        "detection_rate_pct": round(100.0 * len(lat) / len(rows), 1),
        "n": len(rows),
    }


# ── main ────────────────────────────────────────────────────────────────────

def run(seeds: int = 3, epochs: int = 20) -> dict:
    z = load_series()
    rows = {m: [] for m in METHODS}
    by_type = {(m, d): [] for m in METHODS for d in DRIFT_TYPES}
    taus = []

    for seed in range(seeds):
        model, tau = train_lstm(z, seed, epochs)
        taus.append(tau)
        print(f"seed {seed}: tau_99 = {tau:.4f}")
        for kind in DRIFT_TYPES:
            for ch in range(len(FEATURES)):
                for onset in ONSETS:
                    zi = inject(z, kind, ch, onset)
                    c, l = cusum_alarms(zi), lstm_alarms(model, tau, zi)
                    alarms = {"EWMA": ewma_alarms(zi), "CUSUM": c,
                              "LSTM-AE": l, "ARGUS": np.maximum(c, l)}
                    for m, a in alarms.items():
                        r = score(a, onset)
                        rows[m].append(r)
                        by_type[(m, kind)].append(r)

    result = {
        "overall": {m: summarise(rows[m]) for m in METHODS},
        "by_drift_type": {d: {m: summarise(by_type[(m, d)]) for m in METHODS} for d in DRIFT_TYPES},
        "tau_99_per_seed": [round(t, 4) for t in taus],
        "config": {
            "data": str(DATA_PATH.relative_to(PROJECT_ROOT)), "features": FEATURES,
            "window": W, "stride": 1, "lstm_train_windows_end_before": TRAIN_END,
            "baseline_end": BASELINE_END, "onsets": ONSETS, "drift_types": DRIFT_TYPES,
            "cusum": {"k": K, "h": H, "decay": [DECAY_NOMINAL, DECAY_DRIFT], "form": "absolute deviation"},
            "ewma": {"lambda": EWMA_LAMBDA, "L": EWMA_L},
            "lstm": {"hidden": 32, "epochs": epochs, "batch": 64, "lr": 1e-3},
            "seeds": seeds, "scenarios_per_seed": len(DRIFT_TYPES) * len(FEATURES) * len(ONSETS),
        },
    }
    return result


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--seeds", type=int, default=3)
    ap.add_argument("--epochs", type=int, default=20)
    args = ap.parse_args()

    res = run(args.seeds, args.epochs)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(res, indent=2), encoding="utf-8")

    print(f"\n{'Method':<9}{'F1':>16}{'FAR %':>16}{'Latency (win)':>18}{'Detected':>10}")
    for m, s in res["overall"].items():
        lat = f"{s['latency_mean']} ± {s['latency_std']}" if s["latency_mean"] is not None else "-"
        print(f"{m:<9}{s['f1_mean']:>9.3f} ± {s['f1_std']:.3f}{s['far_pct_mean']:>9.2f} ± {s['far_pct_std']:<5.2f}"
              f"{lat:>18}{s['detection_rate_pct']:>9.1f}%")
    print(f"\nSaved: {OUT_PATH}")
