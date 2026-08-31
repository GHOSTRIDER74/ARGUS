"""Custom exceptions for the drift-detection module."""


class DriftDetectionError(Exception):
    """Base error for drift detection."""


class InsufficientDataError(DriftDetectionError):
    """Raised when there is not enough (healthy) data to train or detect."""


class ModelNotFoundError(DriftDetectionError):
    """Raised when a requested model version or artifact is missing."""
