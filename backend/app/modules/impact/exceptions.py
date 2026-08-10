"""Module 3 domain exceptions."""


class ImpactError(Exception):
    """Base class for Module 3 errors."""


class MissingImpactRuleError(ImpactError):
    """No impact rule configured for the requested stage/parameter."""


class InvalidImpactConfigError(ImpactError):
    """Impact-rule or production configuration failed validation."""


class InvalidAnalysisPeriodError(ImpactError):
    """No usable analysis period could be determined."""
