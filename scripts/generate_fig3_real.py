"""
Fig. 3 from a real benchmark run (no simulated values).

Uses the same data, trained LSTM-AE, CUSUM and settings as
src/3.drift/real_benchmark.py, for one injected scenario:
  (a) the channel with the injected drift (baseline-standardised)
  (b) S_cusum = max over the 4 channels of the absolute-deviation CUSUM, with h
  (c) LSTM-AE reconstruction error per window, with tau_99 from this seed

Run:  python scripts/generate_fig3_real.py [--drift gradual] [--channel rf_power]
                                           [--onset 1000] [--seed 0]
"""

import argparse
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src" / "3.drift"))
import real_benchmark as rb  # noqa: E402


def cusum_stat(z: np.ndarray) -> np.ndarray:
    s = np.zeros(z.shape[1])
    out = np.zeros(len(z))
    for t in range(len(z)):
        dev = np.abs(z[t])
        lam = np.where(dev < rb.K, rb.DECAY_NOMINAL, rb.DECAY_DRIFT)
        s = np.maximum(0.0, s * lam + dev - rb.K)
        out[t] = s.max()
    return out


def first_after(alarm: np.ndarray, onset: int):
    hits = np.flatnonzero(alarm[onset:])
    return onset + int(hits[0]) if len(hits) else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--drift", default="gradual", choices=rb.DRIFT_TYPES)
    ap.add_argument("--channel", default="rf_power", choices=rb.FEATURES)
    ap.add_argument("--onset", type=int, default=1000)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--epochs", type=int, default=20)
    ap.add_argument("--out", default=str(ROOT / "figures" / "fig3_real_benchmark.png"))
    a = ap.parse_args()

    z = rb.load_series()
    ch = rb.FEATURES.index(a.channel)
    model, tau = rb.train_lstm(z, a.seed, a.epochs)
    zi = rb.inject(z, a.drift, ch, a.onset)

    s_cusum = cusum_stat(zi)
    err = np.full(len(zi), np.nan)
    err[rb.W - 1:] = rb.recon_errors(model, rb.windows(zi))
    c_alarm = (s_cusum > rb.H).astype(int)
    l_alarm = np.nan_to_num(err > tau).astype(int)
    c_first, l_first = first_after(c_alarm, a.onset), first_after(l_alarm, a.onset)

    t = np.arange(len(zi))
    ev = t >= rb.BASELINE_END
    pre = ev & (t < a.onset)

    plt.rcParams.update({"font.family": "serif", "font.serif": ["Times New Roman", "DejaVu Serif"],
                         "font.size": 9})
    fig, ax = plt.subplots(3, 1, figsize=(7.0, 6.2), sharex=True)

    ax[0].plot(t[ev], zi[ev, ch], lw=0.7, color="#444")
    ax[0].set_ylabel(f"{a.channel} (z)")
    ax[0].set_title(f"(a) Injected {a.drift} drift on {a.channel}, onset = record {a.onset}", loc="left")

    ax[1].plot(t[ev], s_cusum[ev], lw=0.9, color="#1f5fa8", label=r"$S_{cusum}$ (max over 4 channels)")
    ax[1].axhline(rb.H, ls="--", lw=0.9, color="#c0392b", label=f"h = {rb.H:g}")
    ax[1].set_ylabel("CUSUM statistic")
    ax[1].set_title("(b) Adaptive absolute-deviation CUSUM", loc="left")

    ax[2].plot(t[ev], err[ev], lw=0.9, color="#7b3fa0", label="Reconstruction error (MSE)")
    ax[2].axhline(tau, ls="--", lw=0.9, color="#c0392b", label=rf"$\tau_{{99}}$ = {tau:.3f}")
    ax[2].set_ylabel("LSTM-AE error")
    ax[2].set_xlabel("SECOM record index (window end, W = 30, stride 1)")
    ax[2].set_title("(c) LSTM autoencoder", loc="left")

    ax[1].set_yscale("symlog", linthresh=1.0)
    ax[1].set_ylim(0, s_cusum[ev].max() * 2)
    ax[2].set_yscale("log")
    pre_l = np.flatnonzero(l_alarm & pre)
    ax[2].scatter(t[pre_l], err[pre_l], s=3, color="#c0392b", zorder=3,
                  label=f"Pre-onset alarms ({100 * l_alarm[pre].mean():.1f}% of windows)")

    for i, (first, name) in enumerate([(None, ""), (c_first, "CUSUM"), (l_first, "LSTM-AE")]):
        ax[i].axvline(a.onset, color="#2e8b57", lw=1.0, label="Drift onset")
        if first is not None:
            ax[i].axvline(first, color="#e67e22", lw=1.0, ls=":",
                          label=f"First {name} alarm (+{first - a.onset} windows)")
        ax[i].legend(loc="upper left" if i == 0 else "lower right", fontsize=7,
                     frameon=True, framealpha=0.9, edgecolor="none")
        ax[i].grid(alpha=0.25, lw=0.5)

    fig.tight_layout()
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out, dpi=300)

    lat = lambda f: f"{f - a.onset} windows" if f is not None else "not detected"
    print(f"scenario: {a.drift} on {a.channel}, onset {a.onset}, seed {a.seed}")
    print(f"tau_99 = {tau:.4f}")
    print(f"CUSUM  : first alarm {lat(c_first)}, pre-onset alarm rate {100 * c_alarm[pre].mean():.1f}%")
    print(f"LSTM-AE: first alarm {lat(l_first)}, pre-onset alarm rate {100 * l_alarm[pre].mean():.1f}%")
    print(f"saved  : {out}")


if __name__ == "__main__":
    main()
