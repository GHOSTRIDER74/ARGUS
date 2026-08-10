"""Hybrid drift scoring: combine CUSUM and LSTM detector outputs."""
from app.modules.drift_detection.config import HybridConfig

STATUS_HEALTHY = "healthy"
STATUS_WARNING = "warning"
STATUS_CONFIRMED = "confirmed_drift"
STATUS_CRITICAL = "critical_anomaly"


def normalise_lstm_score(error: float, threshold: float) -> float:
    """Map reconstruction error to [0, 1]; 0.5 exactly at the anomaly threshold."""
    if threshold <= 0:
        return 0.0
    return min(error / (2.0 * threshold), 1.0)


def combine(
    cusum_score: float,
    lstm_score: float,
    cusum_triggered: bool,
    lstm_triggered: bool,
    config: HybridConfig | None = None,
    persistence_ratio: float = 0.0,
) -> dict:
    """Weighted hybrid score + status decision.

    hybrid = cusum_weight x cusum_score + lstm_weight x lstm_score  (all in [0,1])
    Status: none triggered -> healthy; one -> warning; both -> confirmed_drift;
    hybrid above critical_score -> critical_anomaly.
    """
    cfg = config or HybridConfig()
    total_w = cfg.cusum_weight + cfg.lstm_weight
    hybrid = (cfg.cusum_weight * cusum_score + cfg.lstm_weight * lstm_score) / (total_w or 1.0)

    if cusum_triggered and lstm_triggered:
        status = STATUS_CONFIRMED
    elif cusum_triggered or lstm_triggered:
        status = STATUS_WARNING
    else:
        status = STATUS_HEALTHY
    if hybrid >= cfg.critical_score:
        status = STATUS_CRITICAL

    # confidence: detector agreement + persistence of the signal
    confidence = 0.4 + 0.2 * cusum_triggered + 0.2 * lstm_triggered + 0.2 * min(persistence_ratio, 1.0)
    return {
        "cusum_score": round(cusum_score, 4),
        "lstm_score": round(lstm_score, 4),
        "hybrid_score": round(hybrid, 4),
        "cusum_triggered": cusum_triggered,
        "lstm_triggered": lstm_triggered,
        "status": status,
        "confidence": round(min(confidence, 0.99), 3),
    }
