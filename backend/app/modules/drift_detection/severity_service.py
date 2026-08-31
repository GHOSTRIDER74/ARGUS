"""Severity scoring (0-100) with a transparent component breakdown.

severity = 0.35*hybrid + 0.25*deviation + 0.15*persistence
         + 0.10*affected_features + 0.15*forecast          (weights configurable)
Each component is normalised to 0-100 as documented below.
"""
from app.modules.drift_detection.config import SeverityWeights, severity_level


def compute_severity(
    hybrid_score: float,
    deviation_percent: float,
    persistence_ratio: float,
    n_affected: int,
    n_total_features: int,
    hours_to_limit_crossing: float | None,
    weights: SeverityWeights | None = None,
) -> dict:
    """Returns severity score, level and per-component breakdown.

    Components (each 0-100):
      hybrid       = hybrid_score x 100
      deviation    = |deviation%| scaled so 20% deviation = 100
      persistence  = fraction of analysed windows that were anomalous x 100
      affected     = affected/total features x 100
      forecast     = urgency of predicted operating-limit crossing
                     (<=1h -> 100, >=48h or none -> 0, linear in between)
    """
    w = weights or SeverityWeights()

    hybrid_c = min(hybrid_score * 100.0, 100.0)
    deviation_c = min(abs(deviation_percent) / 20.0 * 100.0, 100.0)
    persistence_c = min(persistence_ratio * 100.0, 100.0)
    affected_c = min((n_affected / n_total_features if n_total_features else 0.0) * 100.0, 100.0)
    if hours_to_limit_crossing is None:
        forecast_c = 0.0
    else:
        forecast_c = max(0.0, min(100.0, (48.0 - hours_to_limit_crossing) / 47.0 * 100.0))

    score = (
        w.hybrid * hybrid_c
        + w.deviation * deviation_c
        + w.persistence * persistence_c
        + w.affected_features * affected_c
        + w.forecast * forecast_c
    )
    score = float(max(0.0, min(100.0, score)))
    return {
        "score": round(score, 1),
        "level": severity_level(score),
        "components": {
            "hybrid": round(hybrid_c, 1),
            "deviation": round(deviation_c, 1),
            "persistence": round(persistence_c, 1),
            "affected_features": round(affected_c, 1),
            "forecast": round(forecast_c, 1),
        },
        "weights": w.model_dump(),
    }
