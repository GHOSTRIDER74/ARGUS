"""Two-sided CUSUM detector, refactored from the legacy prototype.

For a standardised observation x[t] (baseline mean/std supplied by caller):

    S_pos[t] = max(0, S_pos[t-1] + x[t] - k)
    S_neg[t] = min(0, S_neg[t-1] + x[t] + k)

A drift signal fires when |S| crosses the decision threshold h.
k and h are configured per parameter — no single universal threshold.
"""
from dataclasses import dataclass, field
from datetime import datetime

import numpy as np


@dataclass
class CusumResult:
    parameter_name: str
    positive_cusum: float
    negative_cusum: float
    threshold: float
    signal: bool
    direction: str | None  # 'up' | 'down' | None
    estimated_start_time: datetime | None
    first_alarm_time: datetime | None
    normalised_score: float
    positive_series: np.ndarray = field(repr=False, default=None)
    negative_series: np.ndarray = field(repr=False, default=None)


class CusumDetector:
    """Stateful two-sided CUSUM for one parameter."""

    def __init__(self, k: float = 0.5, h: float = 5.0) -> None:
        self.k = k
        self.h = h
        self.reset()

    def reset(self) -> None:
        self.s_pos = 0.0
        self.s_neg = 0.0

    def update(self, x_std: float) -> tuple[float, float, bool]:
        """Streaming update with one standardised observation."""
        self.s_pos = max(0.0, self.s_pos + x_std - self.k)
        self.s_neg = min(0.0, self.s_neg + x_std + self.k)
        return self.s_pos, self.s_neg, (self.s_pos > self.h or -self.s_neg > self.h)

    def detect(
        self,
        values: np.ndarray,
        timestamps: list[datetime] | None,
        baseline_mean: float,
        baseline_std: float,
        parameter_name: str = "",
    ) -> CusumResult:
        """Batch detection over a full series."""
        self.reset()
        std = baseline_std if baseline_std > 1e-12 else 1e-12
        x = (np.asarray(values, dtype=float) - baseline_mean) / std

        n = len(x)
        s_pos = np.zeros(n)
        s_neg = np.zeros(n)
        first_alarm_idx: int | None = None
        for i in range(n):
            if np.isnan(x[i]):
                s_pos[i] = s_pos[i - 1] if i else 0.0
                s_neg[i] = s_neg[i - 1] if i else 0.0
                continue
            prev_p = s_pos[i - 1] if i else 0.0
            prev_n = s_neg[i - 1] if i else 0.0
            s_pos[i] = max(0.0, prev_p + x[i] - self.k)
            s_neg[i] = min(0.0, prev_n + x[i] + self.k)
            if first_alarm_idx is None and (s_pos[i] > self.h or -s_neg[i] > self.h):
                first_alarm_idx = i

        signal = first_alarm_idx is not None
        direction = None
        est_start = None
        first_alarm_time = None
        if signal:
            direction = "up" if s_pos[first_alarm_idx] > -s_neg[first_alarm_idx] else "down"
            series = s_pos if direction == "up" else -s_neg
            # estimated drift start = last time the statistic was zero before the alarm
            zeros = np.where(series[: first_alarm_idx + 1] <= 1e-12)[0]
            start_idx = int(zeros[-1]) if len(zeros) else 0
            if timestamps is not None:
                est_start = timestamps[start_idx]
                first_alarm_time = timestamps[first_alarm_idx]

        max_stat = float(max(s_pos.max(initial=0.0), (-s_neg).max(initial=0.0)))
        normalised = min(max_stat / (2.0 * self.h), 1.0)

        self.s_pos, self.s_neg = float(s_pos[-1]) if n else 0.0, float(s_neg[-1]) if n else 0.0
        return CusumResult(
            parameter_name=parameter_name,
            positive_cusum=float(s_pos[-1]) if n else 0.0,
            negative_cusum=float(s_neg[-1]) if n else 0.0,
            threshold=self.h,
            signal=signal,
            direction=direction,
            estimated_start_time=est_start,
            first_alarm_time=first_alarm_time,
            normalised_score=round(normalised, 4),
            positive_series=s_pos,
            negative_series=s_neg,
        )
