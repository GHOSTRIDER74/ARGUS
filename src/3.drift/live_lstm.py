"""
Live LSTM-autoencoder scorer used by the digital twin (2.twin/state_manager.py).

The model is trained once on the same processed SECOM values the twin receives
(data/processed/secom_processed.csv, 4 etch channels), on windows ending before
record 400; tau_99 is the 99th percentile of reconstruction error on the held-out
normal windows of records 400-499. Model and threshold are saved to
trained_models/live_lstm/ and reused on the next start.
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
import torch

from lstm_autoencoder import LSTMAutoencoder

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_PATH = PROJECT_ROOT / "data" / "processed" / "secom_processed.csv"
MODEL_DIR = PROJECT_ROOT / "trained_models" / "live_lstm"

FEATURES = ["rf_power", "etch_rate", "chamber_pressure", "etchant_gas_flow"]
WINDOW = 30
TRAIN_END = 400      # windows ending before this record train the model
CALIB_END = 500      # windows ending in [TRAIN_END, CALIB_END) set tau_99


def _windows(x: np.ndarray) -> np.ndarray:
    idx = np.arange(WINDOW)[None, :] + np.arange(len(x) - WINDOW + 1)[:, None]
    return x[idx].astype(np.float32)


class LiveLSTM:
    """Scores one window of the etch stream; alarm when error > tau."""

    def __init__(self, model: LSTMAutoencoder, tau: float):
        self.model = model.eval()
        self.tau = float(tau)
        self.window = WINDOW
        self.features = FEATURES

    def score(self, window: np.ndarray):
        """window: (WINDOW, 4) array in FEATURES order.
        Returns (mean squared error, per-feature error dict)."""
        with torch.no_grad():
            x = torch.tensor(window[None].astype(np.float32))
            sq = ((self.model(x) - x) ** 2)[0].numpy()     # (WINDOW, 4)
        per_feature = dict(zip(self.features, sq.mean(axis=0).astype(float)))
        return float(sq.mean()), per_feature

    @classmethod
    def train(cls, data_path: Path = DATA_PATH, epochs: int = 20, seed: int = 0) -> "LiveLSTM":
        torch.manual_seed(seed)
        x = pd.read_csv(data_path, usecols=FEATURES)[FEATURES].to_numpy(dtype=np.float64)
        win = _windows(x)
        end = np.arange(len(win)) + WINDOW - 1
        train = torch.tensor(win[end < TRAIN_END])
        calib = torch.tensor(win[(end >= TRAIN_END) & (end < CALIB_END)])

        model = LSTMAutoencoder(n_features=len(FEATURES), hidden_dim=32)
        opt = torch.optim.Adam(model.parameters(), lr=1e-3)
        loss_fn = torch.nn.MSELoss()
        gen = torch.Generator().manual_seed(seed)
        for _ in range(epochs):
            model.train()
            for batch in torch.utils.data.DataLoader(train, batch_size=64, shuffle=True, generator=gen):
                opt.zero_grad()
                loss_fn(model(batch), batch).backward()
                opt.step()
        model.eval()
        with torch.no_grad():
            errs = ((model(calib) - calib) ** 2).mean(dim=(1, 2)).numpy()
        return cls(model, np.percentile(errs, 99))

    def save(self, folder: Path = MODEL_DIR):
        folder.mkdir(parents=True, exist_ok=True)
        torch.save(self.model.state_dict(), folder / "model.pt")
        (folder / "meta.json").write_text(json.dumps(
            {"tau_99": self.tau, "window": WINDOW, "features": FEATURES,
             "train_windows_end_before": TRAIN_END, "calibration_records": [TRAIN_END, CALIB_END - 1]}, indent=2))

    @classmethod
    def load_or_train(cls, folder: Path = MODEL_DIR) -> "LiveLSTM":
        meta, weights = folder / "meta.json", folder / "model.pt"
        if meta.exists() and weights.exists():
            model = LSTMAutoencoder(n_features=len(FEATURES), hidden_dim=32)
            model.load_state_dict(torch.load(weights, weights_only=True))
            return cls(model, json.loads(meta.read_text())["tau_99"])
        live = cls.train()
        live.save(folder)
        return live


if __name__ == "__main__":
    live = LiveLSTM.train()
    live.save()
    print(f"saved live LSTM to {MODEL_DIR}  tau_99 = {live.tau:.4f}")
