"""Configurable PyTorch LSTM Autoencoder (refactored from the legacy prototype).

Architecture:
    input [B, T, F] -> LSTM encoder -> latent (linear) -> repeat over T
    -> LSTM decoder -> linear reconstruction head -> output [B, T, F]
"""
import torch
import torch.nn as nn


class LSTMAutoencoder(nn.Module):
    def __init__(
        self,
        n_features: int,
        hidden_size: int = 64,
        latent_size: int = 32,
        num_layers: int = 1,
        dropout: float = 0.1,
    ) -> None:
        super().__init__()
        self.n_features = n_features
        self.hidden_size = hidden_size
        self.latent_size = latent_size
        self.num_layers = num_layers
        self.dropout_p = dropout

        lstm_dropout = dropout if num_layers > 1 else 0.0
        self.encoder = nn.LSTM(
            n_features, hidden_size, num_layers, batch_first=True, dropout=lstm_dropout
        )
        self.to_latent = nn.Linear(hidden_size, latent_size)
        self.decoder = nn.LSTM(
            latent_size, hidden_size, num_layers, batch_first=True, dropout=lstm_dropout
        )
        self.head = nn.Linear(hidden_size, n_features)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: [batch, seq_len, features]
        _, (h, _) = self.encoder(x)
        latent = self.dropout(self.to_latent(h[-1]))          # [B, latent]
        repeated = latent.unsqueeze(1).repeat(1, x.size(1), 1)  # [B, T, latent]
        decoded, _ = self.decoder(repeated)
        return self.head(decoded)                               # [B, T, F]

    def config_dict(self) -> dict:
        return {
            "n_features": self.n_features,
            "hidden_size": self.hidden_size,
            "latent_size": self.latent_size,
            "num_layers": self.num_layers,
            "dropout": self.dropout_p,
        }


def reconstruction_errors(
    model: LSTMAutoencoder, X: "torch.Tensor | object", batch_size: int = 256
) -> tuple["object", "object"]:
    """Sequence-level and per-feature reconstruction errors.

    Returns (sequence_errors [n], feature_errors [n, F]) as numpy arrays.
    sequence_error = mean((x - x_hat)^2) over time and features;
    feature_error[j] = mean over time of (x[:, :, j] - x_hat[:, :, j])^2.
    """
    import numpy as np

    model.eval()
    tensor = X if isinstance(X, torch.Tensor) else torch.tensor(X, dtype=torch.float32)
    seq_errs, feat_errs = [], []
    with torch.no_grad():
        for i in range(0, len(tensor), batch_size):
            batch = tensor[i : i + batch_size]
            recon = model(batch)
            sq = (recon - batch) ** 2
            seq_errs.append(sq.mean(dim=(1, 2)).numpy())
            feat_errs.append(sq.mean(dim=1).numpy())
    return np.concatenate(seq_errs), np.concatenate(feat_errs)
