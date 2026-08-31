"""ARGUS composite health score (0-100) for a machine/stage digital twin.

Documented formula (all weights configurable via HealthWeights):

    health = 100
             - hybrid_score x anomaly_penalty_scale            (default x40)
             - severity_score x severity_penalty_scale         (default x0.30)
             - min(n_affected x 5, 15)                         (affected parameters)
             - min(persistence_ratio x 15, 15)                 (drift persistence)
    clamped to [0, 100].

This is an ARGUS-specific composite score, not an industry-standard metric.
"""
from app.modules.drift_detection.config import HealthWeights

STATUS_BANDS = [
    (90, "healthy"),
    (70, "warning"),
    (40, "degraded"),
    (0, "critical"),
]


def compute_health_score(
    hybrid_score: float,
    severity_score: float,
    n_affected_parameters: int,
    persistence_ratio: float,
    weights: HealthWeights | None = None,
) -> dict:
    w = weights or HealthWeights()
    anomaly_penalty = min(max(hybrid_score, 0.0), 1.0) * w.anomaly_penalty_scale
    severity_penalty = max(severity_score, 0.0) * w.severity_penalty_scale
    affected_penalty = min(
        n_affected_parameters * w.affected_parameter_penalty_per_param,
        w.affected_parameter_penalty_max,
    )
    persistence_penalty = min(persistence_ratio * w.persistence_penalty_max, w.persistence_penalty_max)

    score = 100.0 - anomaly_penalty - severity_penalty - affected_penalty - persistence_penalty
    score = float(max(0.0, min(100.0, score)))
    return {
        "health_score": round(score, 1),
        "band": health_band(score),
        "penalties": {
            "anomaly": round(anomaly_penalty, 1),
            "severity": round(severity_penalty, 1),
            "affected_parameters": round(affected_penalty, 1),
            "persistence": round(persistence_penalty, 1),
        },
    }


def health_band(score: float) -> str:
    for bound, name in STATUS_BANDS:
        if score >= bound:
            return name
    return "critical"
