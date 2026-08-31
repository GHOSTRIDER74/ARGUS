/** TypeScript interfaces mirroring backend Pydantic schemas. */

export interface Dataset {
  id: number;
  name: string;
  source_type: "upload" | "synthetic";
  original_filename: string | null;
  stage_name: string | null;
  start_timestamp: string | null;
  end_timestamp: string | null;
  row_count: number;
  status: string;
  quality_score: number | null;
  created_at: string;
}

export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  count: number;
}

export interface ValidationReport {
  dataset_id: number;
  is_valid: boolean;
  total_rows: number;
  issues: ValidationIssue[];
  checked_at: string;
}

export interface PreprocessResult {
  dataset_id: number;
  run_id: number;
  input_rows: number;
  output_rows: number;
  missing_values_before: number;
  missing_values_after: number;
  quality_score: number;
  feature_file: string | null;
  report: Record<string, unknown>;
}

export interface DatasetSummary {
  dataset_id: number;
  row_count: number;
  stages: string[];
  machines: string[];
  parameters: string[];
  start_timestamp: string | null;
  end_timestamp: string | null;
  statistics: Record<string, { count: number; mean: number; min: number; max: number }>;
}

export interface QualityReport {
  dataset_id: number;
  quality_score: number;
  completeness: number;
  validity: number;
  uniqueness: number;
  timeliness: number;
  missing_by_column: Record<string, number>;
  details: Record<string, unknown>;
}

export interface StageParameter {
  name: string;
  unit: string;
  target: number;
  lower: number;
  upper: number;
  sigma: number;
}

export interface Stage {
  name: string;
  display_name: string;
  machine_prefix: string;
  parameters: StageParameter[];
}

export interface DriftSpec {
  stage_name: string;
  parameter_name: string;
  drift_type: string;
  start_fraction: number;
  magnitude_sigmas: number;
  direction: "up" | "down";
}

export interface SimulationConfig {
  name: string;
  duration_hours: number;
  sampling_interval_seconds: number;
  stages: string[] | null;
  seed: number;
  drifts: DriftSpec[];
}

// ---------- Module 2 ----------

export interface TwinState {
  id: number;
  machine_id: string;
  stage_name: string;
  dataset_id: number | null;
  state_timestamp: string | null;
  parameter_values: Record<string, number> | null;
  target_values: Record<string, number | null> | null;
  operating_limits: Record<string, { lower: number | null; upper: number | null }> | null;
  cusum_score: number | null;
  lstm_score: number | null;
  hybrid_score: number | null;
  health_score: number | null;
  status: string | null;
  drift_type: string | null;
  root_cause_parameter: string | null;
  prediction_summary: Record<string, unknown> | null;
  updated_at: string | null;
}

export interface DriftEventItem {
  id: number;
  dataset_id: number | null;
  machine_id: string;
  stage_name: string;
  detected_at: string | null;
  estimated_start_time: string | null;
  resolved_at: string | null;
  drift_type: string | null;
  direction: string | null;
  cusum_score: number | null;
  lstm_score: number | null;
  hybrid_score: number | null;
  severity_score: number | null;
  severity_level: string | null;
  health_score: number | null;
  confidence: number | null;
  primary_parameter: string | null;
  affected_parameters: string[] | null;
  detection_status: string | null;
  status: string;
  model_id: string | null;
  created_at: string;
}

export interface FeatureContribution {
  parameter_name: string;
  contribution: number;
  reconstruction_error: number;
  current_value: number | null;
  baseline_value: number | null;
  target_value: number | null;
  unit: string | null;
  deviation_percent: number | null;
  direction: string | null;
  cusum_triggered: boolean;
}

export interface EventExplanation {
  drift_event_id: number;
  explanation_method: string;
  primary_parameter: string;
  feature_contributions: FeatureContribution[];
  explanation_text: string;
  confidence: number;
}

export interface ForecastPoint {
  horizon_hours: number;
  timestamp: string;
  predicted_value: number;
  lower_bound: number;
  upper_bound: number;
}

export interface EventForecast {
  drift_event_id: number;
  parameter_name: string;
  forecast_method: string;
  forecast_values: ForecastPoint[];
  threshold_crossing_time: string | null;
}

export interface ModelVersionItem {
  id: number;
  model_id: string;
  model_name: string;
  model_type: string;
  version: number;
  dataset_id: number | null;
  stage_name: string;
  machine_scope: string;
  framework: string | null;
  feature_names: string[] | null;
  sequence_length: number | null;
  metrics: Record<string, number> | null;
  threshold: number | null;
  status: string;
  created_at: string;
}

export interface SeriesResponse {
  dataset_id: number;
  parameter_name: string;
  timestamps: string[];
  values: (number | null)[];
  target_value: number | null;
}

export interface DetectionResult {
  status: string;
  drift_detected: boolean;
  drift_type: string;
  hybrid_score: number;
  health_score: number;
  event_id: number | null;
  severity: { score: number; level: string };
  root_cause: FeatureContribution;
}

// ---------- Module 3 ----------

export interface CalculationStep {
  name: string;
  formula: string;
  inputs: Record<string, unknown>;
  result: unknown;
}

export interface ImpactOperational {
  baseline_yield_percent: number;
  predicted_yield_percent: number;
  yield_loss_percentage_points: number;
  relative_yield_degradation_percent: number;
  total_units: number;
  baseline_good_units: number;
  predicted_good_units: number;
  additional_defective_units: number;
  baseline_expected_defective_units: number;
  rework_units: number;
  scrap_units: number;
  throughput_loss_units: number;
  throughput_loss_percent: number;
  lost_good_units_per_hour: number;
}

export interface ImpactFinancial {
  scrap_material_cost: number;
  scrap_processing_cost: number;
  scrap_disposal_cost: number;
  total_scrap_cost: number;
  rework_labour_cost: number;
  rework_energy_cost: number;
  rework_material_cost: number;
  total_rework_cost: number;
  estimated_lost_production_value: number;
  downtime_cost: number;
  total_financial_impact: number;
  currency: string;
}

export interface ImpactUncertainty {
  best_case: number;
  expected_case: number;
  worst_case: number;
  confidence: number;
  uncertainty_width: number;
  assumption_version: string;
  note: string;
}

export interface ImpactResult {
  impact_id: number | null;
  drift_event_id: number;
  dataset_id: number | null;
  machine_id: string;
  stage_name: string;
  primary_parameter: string | null;
  analysis_period_hours: number;
  analysis_period_source: string | null;
  drift_duration_hours: number | null;
  impact_model: string | null;
  quality_metric: string | null;
  impact_rule_version: string | null;
  production_config_version: string | null;
  is_demo_configuration: boolean;
  disclaimer: string | null;
  defect_probability: {
    raw: number;
    confidence_adjusted: number;
    confidence_adjustment: string;
    abs_deviation_percent: number;
    severity_score: number;
    confidence: number | null;
  } | null;
  operational: ImpactOperational | null;
  financial: ImpactFinancial | null;
  uncertainty: ImpactUncertainty | null;
  resource_quantities: Record<string, number> | null;
  calculation_notes: string[] | null;
  calculation_breakdown: CalculationStep[] | null;
}

export interface ImpactListItem {
  id: number;
  drift_event_id: number;
  dataset_id: number | null;
  machine_id: string;
  stage_name: string;
  primary_parameter: string | null;
  analysis_period_hours: number;
  adjusted_defect_probability: number | null;
  predicted_yield_percent: number | null;
  yield_loss_percentage_points: number | null;
  additional_defective_units: number | null;
  scrap_units: number | null;
  rework_units: number | null;
  throughput_loss_units: number | null;
  total_financial_impact: number | null;
  currency: string | null;
  created_at: string;
}

export interface ImpactBreakdown {
  impact_id: number;
  drift_event_id: number;
  impact_rule_version: string | null;
  is_demo_configuration: boolean;
  calculation_notes: string[];
  calculation_breakdown: CalculationStep[];
}
