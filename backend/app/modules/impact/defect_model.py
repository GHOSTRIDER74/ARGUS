"""Defect-probability models (Module 3).

Two configurable models (impact_rules.json, demonstration coefficients):

  logistic:  z = intercept + c_dev*|deviation%| + c_dur*duration_h + c_sev*severity
             p = 1 / (1 + exp(-z)), clamped to [0, 1]
  piecewise: banded lookup on |deviation%|

Confidence adjustment (applied exactly ONCE, here and nowhere else):
  adjusted = raw * confidence   (missing confidence => no adjustment)
"""
import math

from app.modules.impact.config import LogisticCoefficients, ParameterImpactRule, PiecewiseBand


def _clamp01(p: float) -> float:
    return max(0.0, min(1.0, p))


def logistic_probability(
    abs_deviation_percent: float,
    drift_duration_hours: float,
    severity_score: float,
    coeffs: LogisticCoefficients,
) -> float:
    z = (
        coeffs.intercept
        + coeffs.deviation * abs_deviation_percent
        + coeffs.duration_hours * drift_duration_hours
        + coeffs.severity * severity_score
    )
    # guard exp overflow for extreme z
    if z >= 0:
        p = 1.0 / (1.0 + math.exp(-min(z, 500.0)))
    else:
        ez = math.exp(max(z, -500.0))
        p = ez / (1.0 + ez)
    return _clamp01(p)


def piecewise_probability(abs_deviation_percent: float, bands: list[PiecewiseBand]) -> float:
    open_band: PiecewiseBand | None = None
    for band in bands:
        if band.max_abs_deviation_percent is None:
            open_band = band
            continue
        if abs_deviation_percent <= band.max_abs_deviation_percent:
            return _clamp01(band.additional_defect_probability)
    if open_band is not None:
        return _clamp01(open_band.additional_defect_probability)
    return _clamp01(bands[-1].additional_defect_probability)


def raw_defect_probability(
    rule: ParameterImpactRule,
    abs_deviation_percent: float,
    drift_duration_hours: float,
    severity_score: float,
) -> float:
    if rule.impact_model == "logistic":
        assert rule.logistic_coefficients is not None  # enforced by config validation
        return logistic_probability(
            abs_deviation_percent, drift_duration_hours, severity_score, rule.logistic_coefficients
        )
    assert rule.piecewise_bands is not None
    return piecewise_probability(abs_deviation_percent, rule.piecewise_bands)


def adjust_for_confidence(raw_probability: float, confidence: float | None) -> float:
    """Single documented confidence application: p_adj = p_raw * confidence."""
    if confidence is None:
        return _clamp01(raw_probability)
    return _clamp01(raw_probability * _clamp01(confidence))
