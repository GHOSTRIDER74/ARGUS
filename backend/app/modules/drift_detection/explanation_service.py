"""Root-cause explanation based on per-feature reconstruction error.

This is an association-based explanation, not causal proof. The wording
produced deliberately says "most strongly associated with", never "caused".
"""
import numpy as np


def explain(
    feature_names: list[str],
    feature_errors: np.ndarray,
    current_values: dict[str, float],
    baseline_stats: dict[str, dict],
    parameter_info: dict[str, dict],
    cusum_results: dict[str, dict] | None = None,
) -> dict:
    """Rank features by anomaly contribution.

    feature_errors: [n_windows, n_features] per-feature reconstruction errors of
    the anomalous windows (already filtered by the caller).
    Contribution = feature's share of the total mean reconstruction error,
    boosted slightly when that parameter's CUSUM also triggered.
    """
    mean_errors = feature_errors.mean(axis=0) if feature_errors.ndim == 2 else feature_errors
    boosts = np.ones(len(feature_names))
    if cusum_results:
        for i, f in enumerate(feature_names):
            if cusum_results.get(f, {}).get("signal"):
                boosts[i] = 1.25
    weighted = mean_errors * boosts
    total = weighted.sum() or 1.0
    contributions = weighted / total

    ranked = sorted(
        range(len(feature_names)), key=lambda i: contributions[i], reverse=True
    )
    items = []
    for i in ranked[:5]:
        name = feature_names[i]
        base = baseline_stats.get(name, {})
        info = parameter_info.get(name, {})
        current = current_values.get(name)
        baseline_mean = base.get("mean")
        deviation_pct = None
        direction = None
        if current is not None and baseline_mean not in (None, 0):
            deviation_pct = round((current - baseline_mean) / abs(baseline_mean) * 100.0, 2)
            direction = "up" if current > baseline_mean else "down"
        items.append(
            {
                "parameter_name": name,
                "contribution": round(float(contributions[i]), 4),
                "reconstruction_error": round(float(mean_errors[i]), 6),
                "current_value": current,
                "baseline_value": baseline_mean,
                "target_value": info.get("target"),
                "unit": info.get("unit"),
                "deviation_percent": deviation_pct,
                "direction": direction,
                "cusum_triggered": bool(cusum_results.get(name, {}).get("signal")) if cusum_results else False,
            }
        )

    primary = items[0] if items else None
    text = ""
    if primary:
        dev = (
            f" (current {primary['current_value']:.2f}, baseline {primary['baseline_value']:.2f}, "
            f"deviation {primary['deviation_percent']:+.1f}%)"
            if primary["deviation_percent"] is not None
            else ""
        )
        text = (
            f"The parameter most strongly associated with the current anomaly is "
            f"{primary['parameter_name']}{dev}. This is a statistical association "
            f"derived from reconstruction error, not proof of causation."
        )

    return {
        "explanation_method": "per_feature_reconstruction_error",
        "primary_parameter": primary["parameter_name"] if primary else None,
        "contributions": items,
        "explanation_text": text,
    }
