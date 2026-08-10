# Module 2 — Digital Twin & Hybrid Drift Detection

## Overview

Module 2 consumes preprocessed Module 1 datasets and detects gradual + sudden
process drift with a hybrid of statistical (CUSUM) and deep-learning (PyTorch
LSTM Autoencoder) detectors. Results are persisted as drift events, root-cause
explanations, forecasts, and a live digital-twin state per machine/stage.

```
Module 1 dataset (sensor_readings)
  → pivot to wide feature table          sequence_builder.pivot_readings
  → healthy-baseline selection           baseline_service (ground_truth | time_range | fraction)
  → chronological 70/15/15 split, scaler fit on train only
  → sequences [n, seq_len, features]     sequence_builder.build_sequences (leakage-safe, gap-aware)
  → LSTM AE training w/ early stopping   training_service
  → detection                            detection_service
      CUSUM per parameter + LSTM reconstruction error
      → hybrid score & status → persistence gate → severity → root cause
      → forecast → health score → twin update → drift event
```

## Key formulas

### CUSUM (two-sided, per parameter)
For standardised observation `x[t]` (using training-baseline mean/std):

```
S_pos[t] = max(0, S_pos[t-1] + x[t] - k)      k = allowance (default 0.5)
S_neg[t] = min(0, S_neg[t-1] + x[t] + k)      h = decision threshold (default 5)
signal when S_pos > h or -S_neg > h
normalised_score = min(max_statistic / 2h, 1)
```
Estimated drift start = last time the winning statistic was zero before the
first alarm. `k`/`h` are configurable per request — no universal threshold.

### LSTM Autoencoder
`input [B,T,F] → LSTM encoder → linear latent → repeat → LSTM decoder → linear head`.
Hidden/latent size, layers, dropout, epochs, batch size, LR, patience all
configurable. Trained on healthy sequences only; chronological split; scaler
(StandardScaler) fitted on training data only and saved with the model.

- sequence error = mean((x − x̂)²) over time+features
- per-feature error = mean over time of (x − x̂)² per feature
- anomaly threshold = configurable percentile (default 99) of healthy hold-out errors
- normalised LSTM score = min(error / 2·threshold, 1) → 0.5 at the threshold

### Hybrid score & status
```
hybrid = 0.4 × cusum_norm + 0.6 × lstm_norm     (weights configurable)
neither triggered → healthy;  one → warning;  both → confirmed_drift
hybrid ≥ 0.9 → critical_anomaly
```
Persistence gate: confirmation additionally requires ≥ N consecutive anomalous
windows (default 5) — a single anomalous timestamp never creates an event.
One active event per machine/stage/dataset is updated until resolved
(states: open → acknowledged → resolved / false_positive).

### Severity (0–100)
```
severity = 0.35·hybrid + 0.25·deviation + 0.15·persistence
         + 0.10·affected_features + 0.15·forecast
```
Components each normalised to 0–100 (deviation: 20% dev = 100; forecast:
crossing ≤1 h = 100, ≥48 h = 0). Levels: minor ≤20 < low ≤40 < moderate ≤60 <
high ≤80 < critical.

### ARGUS composite health score (0–100)
```
health = 100 − hybrid×40 − severity×0.30 − min(n_affected×5, 15) − min(persistence×15, 15)
```
Bands: 90–100 healthy · 70–89 warning · 40–69 degraded · 0–39 critical.
This is an ARGUS-specific composite, **not** an industry-standard metric.

### Root-cause explanation
Per-feature reconstruction error over the anomalous windows, boosted ×1.25
when that parameter's CUSUM also triggered, normalised into contributions.
Explanations are *associations*, not causal proof — the generated wording says
"most strongly associated with", never "caused".

### Forecasting
Linear trend fit on the most recent ≤240 points of the root-cause parameter.
Predictions at +1/6/12/24 h with ±1.96σ residual bounds and estimated
operating-limit crossing time (limits come from `stages.json`). Isolated in
`forecasting_service.py` so a stronger model can replace it.

### Drift-type classification (transparent heuristics)
sensor_fault (NaN burst / stuck value) · temporary_spike (short burst then
recovery) · sudden_shift (abrupt jump + sustained mean shift) ·
variance_increase (std ↑, mean ≈ baseline) · gradual_linear (persistent
anomaly + consistent slope) · unknown_anomaly.

## Model artifacts

```
trained_models/drift_detection/<model_id>/
  model.pt  scaler.joblib  metadata.json  feature_names.json
  training_history.json  threshold.json
```
Metadata includes dataset/machine/stage scope, features, baseline stats and
window, config, threshold, framework versions — models are identified by DB
rows (`model_versions`), never by file names alone.

## Database tables

`model_versions`, `training_runs`, `digital_twin_states`, `drift_events`,
`drift_explanations`, `drift_forecasts` — DDL in
[backend/app/database/schema_module2.sql](../backend/app/database/schema_module2.sql)
(run manually in your PostgreSQL, like Module 1's schema.sql).

## APIs (prefix /api/v1)

| Method | Path | Purpose |
|---|---|---|
| POST | /drift/models/train | Train an LSTM AE on a Module 1 dataset |
| GET | /drift/models · /drift/models/{id} | Registry |
| POST | /drift/models/{id}/activate | Mark active for its machine/stage |
| DELETE | /drift/models/{id} | Delete model + artifacts |
| POST | /drift/detect | Full detection workflow |
| GET | /drift/events (+/{id}, /explanation, /forecast) | Event queries |
| GET | /drift/events/{id}/impact-input | **Stable Module 3 contract** (no financial logic) |
| POST | /drift/events/{id}/acknowledge · /resolve | Lifecycle |
| GET | /digital-twin/state (+/{machine}, /{machine}/{stage}, /history) | Twin state |
| GET | /datasets/{id}/series | Parameter time series for charts |

## Known limitations

- Explanation uses per-feature reconstruction error, not deep SHAP; a SHAP
  surrogate model is a possible future addition.
- Forecasting is linear-trend only (by design, replaceable service).
- Cyclic-instability drift type is not yet classified (falls into unknown).
- Full detector benchmark report (static vs CUSUM vs LSTM vs hybrid) is not
  yet automated; ground-truth start comparison is covered in integration tests.
- Streaming/real-time ingestion is out of scope for now — detection runs on
  stored datasets.
