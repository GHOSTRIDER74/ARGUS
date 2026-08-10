# Module 3 — Operational & Financial Impact Modelling

Converts a confirmed Module 2 drift event into measurable operational and financial impact. Every value is calculated from configuration — nothing is random, and every result carries a traceable calculation breakdown.

> **Demo-assumption warning:** all shipped coefficients and cost values (`impact_rules.json`, `production_config.json`) are **demonstration assumptions** (`is_demo: true`). They are not learned from real fab data and are not accounting figures. Replace them with plant-calibrated values before using results for real decisions.

## Scope

Implemented: quality-impact mapping, defect probability (piecewise + logistic), baseline/predicted yield, yield loss (percentage points **and** relative degradation), additional defective units, scrap/rework allocation, throughput loss, scrap cost (material + accumulated processing + disposal), rework cost (labour + energy + material), estimated lost production value, optional downtime cost, total financial impact, best/expected/worst estimates, persistence, APIs, optional standalone execution, tests, two frontend pages.

Not implemented (out of scope by design): dynamic LCA, CO₂/emissions, maintenance recommendations, repair-vs-continue scenarios, alerting, decision-support scoring.

## Input contract

Module 3 consumes **only** the existing Module 2 contract (`GET /api/v1/drift/events/{event_id}/impact-input`, schema `DriftImpactInput` in `backend/app/schemas/drift.py`):

`drift_event_id, dataset_id, machine_id, stage_name, primary_parameter, current_value, baseline_value, target_value, deviation_percent, drift_type, direction, severity_score, confidence, detected_at, estimated_start_time, predicted_values, affected_parameters`

The contract construction is shared (`app/modules/impact/impact_input.py`) between the Module 2 route and the impact engine. Module 3 never recalculates CUSUM, LSTM, hybrid score, severity, or root cause.

## Configuration

### `backend/app/config/impact_rules.json` (drift → defect mapping)

Per stage/parameter (only stages/parameters that exist in `stages.json`):

- `quality_metric` — which quality characteristic the parameter drives
- `impact_model` — `"logistic"` or `"piecewise"`
- `logistic_coefficients` — `intercept`, `deviation`, `duration_hours`, `severity`
- `piecewise_bands` — `|deviation%|` bands → additional defect probability (`max_abs_deviation_percent: null` = open-ended top band)
- `reworkable_fraction` + `scrap_fraction` (validated to sum to 1)

Global: `version`, `is_demo`, `disclaimer`, `confidence_adjustment`, `uncertainty` model.

### `backend/app/config/production_config.json` (production & costs)

- `defaults`: `labour_cost_per_hour`, `electricity_cost_per_kwh`, `downtime_cost_per_hour`, `scrap_disposal_cost_per_unit`, `rework_time_hours_per_unit`, `rework_energy_kwh_per_unit`, `rework_material_cost_per_unit`, `credit_reworked_units_in_lost_value`
- `stage_order` + `stage_costs`: per-stage processing cost; **accumulated processing cost** = sum of costs of all completed stages up to and including the drifting stage (e.g. scrap after etching = cvd 100 + etching 150 = 250)
- Per stage: `baseline_yield_percent`, `units_per_hour` (aligned with `production_rate_per_hour` in `stages.json`), `wafers_per_batch`, `dies_per_wafer`, `product_value_per_good_unit`, `material_cost_per_unit`, plus optional overrides of any default

Stored configurations: rows in `impact_rule_versions` / `production_configurations` hold complete config documents (same schemas) and can be selected per calculation via `impact_rule_version_id` / `production_configuration_id`.

## Analysis period

1. Explicit `analysis_period_hours` (must be > 0), else
2. elapsed drift duration = `estimated_start_time` → `detected_at` (or now), else
3. **reject** (`422`) — never a silent 24 h default.

The logistic defect model always uses the *drift duration* for its duration term; production quantities use the *analysis period*.

## Formulas

### Defect probability

- Logistic: `z = intercept + c_dev·|deviation%| + c_dur·drift_duration_h + c_sev·severity`, `p_raw = 1/(1+e^(−z))`, clamped to [0, 1] (overflow-guarded).
- Piecewise: band lookup on `|deviation%|` (boundaries inclusive).
- **Confidence adjustment (applied exactly once, documented in the output):** `p_adj = p_raw × confidence`; missing confidence leaves the probability unchanged (uncertainty then uses `missing_confidence_default`).

### Yield

```
baseline_yield_rate  = baseline_yield_percent / 100
predicted_yield_rate = max(0, baseline_yield_rate − p_adj)
yield_loss_percentage_points        = baseline% − predicted%
relative_yield_degradation_percent  = points / baseline% × 100
```

### Production & throughput

```
total_units                = units_per_hour × analysis_period_hours
baseline_good_units        = total_units × baseline_yield_rate
predicted_good_units       = total_units × predicted_yield_rate
additional_defective_units = max(0, baseline_good − predicted_good)   ← incremental drift impact only
throughput_loss_units      = baseline_good − predicted_good
throughput_loss_percent    = loss / baseline_good × 100
lost_good_units_per_hour   = loss / analysis_period_hours
```

Baseline defects are reported separately (`baseline_expected_defective_units`) and never counted as drift impact.

### Scrap / rework

```
rework_units = additional_defective_units × reworkable_fraction
scrap_units  = additional_defective_units × scrap_fraction        (fractions sum to 1)

scrap_cost   = scrap_units × (material_cost + accumulated_processing_cost + disposal_cost)   (3 components)
rework_cost  = labour (units × h/unit × cost/h) + energy (units × kWh/unit × cost/kWh) + material (units × cost/unit)
```

`rework_energy_kwh`, `rework_material_quantity`, `scrap_material_quantity` are reported for later reuse by Module 4 (no emissions computed here).

### Financial total

```
estimated_lost_production_value = throughput_loss_units × product_value_per_good_unit
downtime_cost                   = downtime_hours × downtime_cost_per_hour   (only when downtime_hours supplied)
total_financial_impact          = total_scrap_cost + total_rework_cost + lost_production_value + downtime_cost
```

Double-count prevention (also emitted in `calculation_notes`): material/processing costs appear only in scrap cost; lost production value uses product value only; downtime only when requested. By default reworked units remain in lost production value (conservative demo simplification); set `credit_reworked_units_in_lost_value: true` to credit them back.

### Uncertainty

```
uncertainty_width = base_uncertainty + confidence_penalty × (1 − confidence)
best_case  = max(0, expected × (1 − width))
worst_case = expected × (1 + width)
```

Heuristic demonstration bounds, not calibrated intervals. Confidence, width, and assumption version are stored with the result.

## Traceability

Every response contains `calculation_breakdown`: steps with `name`, human-readable `formula`, `inputs`, `result` (no executable code), plus `calculation_notes` explaining inclusions/exclusions.

## Database (see `backend/app/database/schema_module3.sql` — run manually on PostgreSQL)

- `impact_rule_versions` — versioned impact-rule documents (`configuration` JSONB, `is_demo`, `active`)
- `production_configurations` — named production/cost configs (headline columns + full `configuration` JSONB)
- `operational_impacts` — per calculation: probabilities, yields, units, `calculation_details` JSONB (breakdown, notes, versions)
- `financial_impacts` — cost components, totals, best/expected/worst, confidence (FK → `operational_impacts`)

SQLite fallback works automatically via `FlexJSON` (JSONB ↔ JSON).

## APIs (prefix `/api/v1`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/impact/calculate` | Full workflow: load event → impact-input contract → rules/production config → calculate → persist (optional) |
| GET | `/impact` | List persisted impacts (filter `machine_id`, `stage_name`) |
| GET | `/impact/{impact_id}` | Full stored result |
| GET | `/impact/{impact_id}/breakdown` | Calculation breakdown + notes only |
| GET | `/impact/by-drift/{drift_event_id}` | Impacts for one drift event |
| GET | `/impact/configurations` | List production configurations |
| POST | `/impact/configurations` | Create (full config document validated) |
| PUT | `/impact/configurations/{id}` | Update |

`POST /impact/calculate` body: `{drift_event_id, analysis_period_hours?, production_configuration_id?, impact_rule_version_id?, downtime_hours?, persist_result}` — the service retrieves the Module 2 impact input internally.

(`POST /impact/project` was intentionally not added — forecast-based projection is not implemented/tested.)

## Standalone pipeline

Optional, disabled by default, no database required:

```yaml
module3:
  enabled: true                      # default false
  analysis_period_hours: null        # null = elapsed drift duration
  downtime_hours: 0.0
  impact_rule_file: null             # null = backend/app/config/impact_rules.json
  production_configuration_file: null
```

`algorithm_pipeline/module3_runner.py` builds the impact-input contract dict from the in-memory detection result and calls the same backend `compute_impact()` — no formulas duplicated. Output: `results/<stamp>_<name>/impact_result.json`; skipped (with reason) when no drift is confirmed.

## Tests

- `backend/tests/test_impact_calculations.py` — unit tests: logistic/piecewise/clamping, confidence adjustment, yield & percentage points vs relative degradation, production quantities, fraction validation, allocation, scrap/rework cost breakdowns, accumulated processing cost, lost production value, downtime inclusion rules, total & double-count prevention, uncertainty ordering/clamping, missing stage/parameter rules, invalid config, zero/critical drift, zero analysis period.
- `backend/tests/test_module3_integration.py` — drift event → impact-input contract → calculate → persist → retrieval APIs → configuration CRUD.
- `tests/test_algorithm_pipeline.py` — standalone Module 1 → 2 → 3 → `impact_result.json`.

## Known limitations

- Impact coefficients are demonstration assumptions; the drift-to-defect mapping is configurable, not universally valid.
- Financial output is an estimate, not an accounting result; estimated lost production value is not automatically lost revenue.
- Uncertainty bounds are heuristic scenario factors, not statistical intervals.
- Module 3 computes no environmental impact and recommends no maintenance action (Modules 4/5).
- Real fab validation requires historical quality and cost records.
