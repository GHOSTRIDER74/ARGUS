"""Quality-impact mapping: resolve which quality metric and defect model apply
to a drifting stage/parameter. Purely a configuration lookup — the mapping
lives in impact_rules.json, never in code."""
from app.modules.impact.config import ImpactRules, ParameterImpactRule


def resolve_rule(rules: ImpactRules, stage_name: str, parameter_name: str) -> ParameterImpactRule:
    """Raises MissingImpactRuleError when the stage or parameter is not configured."""
    return rules.rule_for(stage_name, parameter_name)
