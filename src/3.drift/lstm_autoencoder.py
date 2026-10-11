import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

class LSTMAutoencoder(nn.Module):
    def __init__(self, n_features, hidden_dim=32, n_layers=1):
        super().__init__()
        self.encoder = nn.LSTM(n_features, hidden_dim, n_layers, batch_first=True)
        self.decoder = nn.LSTM(hidden_dim, n_features, n_layers, batch_first=True)

    def forward(self, x):
        # x: (batch, window, features)
        _, (h, _) = self.encoder(x)
        # Repeat hidden state across window length for decoder input
        context = h[-1].unsqueeze(1).repeat(1, x.size(1), 1)
        out, _ = self.decoder(context)
        return out


def train_autoencoder(X_normal, epochs=20, batch_size=64, lr=1e-3):
    """Train on normal (pre-drift) windows only."""
    tensor = torch.tensor(X_normal)
    loader = DataLoader(TensorDataset(tensor), batch_size=batch_size, shuffle=True)

    model = LSTMAutoencoder(n_features=X_normal.shape[2])
    optimiser = torch.optim.Adam(model.parameters(), lr=lr)
    criterion = nn.MSELoss()

    model.train()
    for epoch in range(epochs):
        total_loss = 0
        for (batch,) in loader:
            optimiser.zero_grad()
            recon = model(batch)
            loss = criterion(recon, batch)
            loss.backward()
            optimiser.step()
            total_loss += loss.item()
        if (epoch + 1) % 5 == 0:
            print(f"Epoch {epoch+1}/{epochs}  loss={total_loss/len(loader):.5f}")

    return model


def score_windows(model, X_all):
    """Return per-window reconstruction error (higher = more anomalous)."""
    model.eval()
    tensor = torch.tensor(X_all)
    with torch.no_grad():
        recon = model(tensor)
    errors = ((recon - tensor) ** 2).mean(dim=(1, 2)).numpy()
    return errors


def get_lstm_alerts(errors, threshold_percentile=95, normal_cutoff=1000):
    """
    Threshold set at percentile of normal-window errors.
    normal_cutoff: how many windows are considered "normal" for threshold fitting.
    """
    threshold = np.percentile(errors[:normal_cutoff], threshold_percentile)
    alerts = (errors > threshold).astype(int)
    print(f"LSTM AE threshold: {threshold:.5f}")
    return alerts, threshold