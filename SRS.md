# SOFTWARE REQUIREMENTS SPECIFICATION (SRS)
## Project: ARGUS (Autonomous Real-Time Gauge & Unified Surveillance System)
### Semiconductor Fab Digital Twin, Hybrid Drift Detection & Dynamic LCA Platform

---

**Document Version:** 2.0.0
**Standard Followed:** IEEE Std 830-1998 / ISO/IEC/IEEE 29148:2018 (structure)
**System Architecture:** Modular Python backend (FastAPI) + React single-page dashboard
**Date:** November 2026
**Status:** Final, Project Work Phase 2

**Changes from v1.0:**
- Live drift detection is now a hybrid of CUSUM and an LSTM autoencoder (§3.2, §4.2, FR-05 to FR-07).
- The LSTM threshold is recalibrated for the live twin (τ₉₉ = 1.02).
- The REST API listing is corrected to the 21 routes that exist (§5.1).
- Polling rates, thresholds and data notes are corrected to match the code.
- The benchmark now reports measured results instead of simulated ones.

---

## TABLE OF CONTENTS
1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [System Architecture & Module Specifications](#3-system-architecture--module-specifications)
4. [Mathematical & Algorithmic Foundations](#4-mathematical--algorithmic-foundations)
5. [Specific Requirements](#5-specific-requirements)
6. [Data Dictionary & Feature Schema](#6-data-dictionary--feature-schema)
7. [Verification & Validation](#7-verification--validation)
8. [Viva Q&A Guide](#8-viva-qa-guide)

---

## 1. INTRODUCTION

### 1.1 Purpose
This SRS defines the functional, algorithmic and architectural requirements of **ARGUS**. It is written for academic evaluation (viva voce), code review, and anyone extending the system.

### 1.2 Scope & Industrial Context
Semiconductor fabs process wafers through hundreds of tightly toleranced steps. A slow calibration drift (an RF generator, chamber vacuum, gas ratios) produces silent defects. That means scrap, unplanned downtime, and wasted energy.

ARGUS demonstrates an end-to-end monitoring system for this problem:
1. **Telemetry replay:** streams the real UCI SECOM fab dataset record by record, as if it were live.
2. **Digital twin:** keeps an in-memory model of 6 fab tools and their health.
3. **Hybrid drift detection:** combines adaptive CUSUM (per sensor) with an LSTM autoencoder (multivariate, etch tools) to raise warning and critical alerts.
4. **Explainability:** each alert names a root-cause sensor. Kernel SHAP explains offline detections.
5. **Impact & LCA:** converts deviations into cost (₹) and energy / CO₂ figures.
6. **What-if simulation:** injects synthetic gradual, sudden and cyclical drift to study detection.

**Out of scope:** connection to physical fab equipment, closed-loop control, multi-user authentication, and persistent storage of twin state (state is in memory and is reset on replay or restart).

### 1.3 Definitions & Acronyms
| Term | Definition |
| :--- | :--- |
| **SECOM** | UCI semiconductor manufacturing dataset: 1,567 production runs × 590 sensors + pass/fail label. |
| **Digital Twin** | In-memory software model of fab tools, updated from streamed telemetry. |
| **Drift** | A sustained shift of a process signal away from its normal behaviour. |
| **CUSUM** | Cumulative Sum control chart, a sequential change-detection statistic. |
| **LSTM-AE** | Long Short-Term Memory autoencoder, a sequence model trained to reconstruct normal windows. |
| **τ₉₉** | LSTM-AE alarm threshold: the 99th percentile of reconstruction error on held-out normal windows. |
| **SHAP** | SHapley Additive exPlanations, a feature-attribution method. |
| **LCA** | Life Cycle Assessment (ISO 14040/44). |
| **Scope 2 GHG** | Indirect emissions from purchased electricity. |
| **F1 / FAR** | Harmonic mean of precision and recall / false-alarm rate. |

### 1.4 References
- IEEE Std 830-1998, *Recommended Practice for Software Requirements Specifications*.
- ISO 14040:2006 & ISO 14044:2006, *Environmental management: Life cycle assessment*.
- GHG Protocol, *Scope 2 Guidance*.
- McCann, M., Johnston, A., *SECOM Data Set*, UCI Machine Learning Repository, 2008.
- Page, E. S. (1954), *Continuous Inspection Schemes*, Biometrika 41.
- Malhotra, P. et al. (2016), *LSTM-based Encoder-Decoder for Multi-sensor Anomaly Detection*, ICML Workshop.
- Lundberg, S. M., Lee, S.-I. (2017), *A Unified Approach to Interpreting Model Predictions*, NeurIPS.

### 1.5 Document Overview
- §2 describes the product and its environment.
- §3 specifies each module.
- §4 gives the algorithms and equations.
- §5 lists the interface, functional and non-functional requirements.
- §6 is the data dictionary.
- §7 describes how the requirements are verified.
- §8 is a viva preparation guide.

---

## 2. OVERALL DESCRIPTION

### 2.1 Product Perspective & Pipeline

```
[Raw SECOM: 1,567 runs × 590 sensors]  (data/raw, downloaded by scripts/prepare_data.py)
               │
               ▼
[EDA/preprocessing.py]  impute, select 20 sensors, assign process names, z-score
               │
               ▼  data/processed/secom_processed.csv
┌───────────────────────────────────────────────────────────────────────────┐
│                          ARGUS BACKEND (Python)                           │
│                                                                           │
│  [1. Ingestion]  cursor-based replay, 10 records/s requested by the UI   │
│        │                                                                  │
│        ▼                                                                  │
│  [2. Digital Twin]  6 MachineState objects ─┬─► CUSUM per sensor         │
│        │                                     └─► LSTM-AE on etch window   │
│        │                     hybrid rule ─► health, detected_by, events   │
│        │                                                                  │
│   [3. Drift]         [4. Impact]         [5. LCA]          [6. Simulation]│
│   live_lstm.py       scrap / downtime    kWh, kg CO2       gradual/sudden/│
│   real_benchmark.py  / energy cost       efficiency        cyclical       │
│   SHAP (offline)                                                          │
│        └──────────────────┴────────────────┴─────────────────┘            │
│                                   │                                       │
│                    [7. FastAPI REST, port 8000, 21 routes]                │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    ▼
                [8. React + Vite dashboard, port 5173, 7 pages]
```

### 2.2 Modelled Fab Tools
| Tool | Stage | Sensors |
| :--- | :--- | :--- |
| DEP-01 | Deposition | dep_temp, gas_flow_rate, film_thickness, chamber_vacuum |
| LITHO-01 | Lithography | focus_offset, exposure_dose, alignment_error, lens_temp |
| ETCH-01 | Plasma Etch A | rf_power, etch_rate, chamber_pressure, etchant_gas_flow |
| ETCH-02 | Plasma Etch B | same as ETCH-01 (receives alternate records) |
| CMP-01 | CMP Polish | pad_pressure, slurry_flow, rotation_speed, friction_coefficient |
| CLEAN-01 | Wet Clean | bath_temp, chemical_ph, rinse_flow, particle_count |

### 2.3 User Classes
- **Process engineers:** live tool health, per-sensor CUSUM, root cause, and event triage.
- **Sustainability managers:** energy loss, CO₂ and efficiency.
- **Operations managers:** cost of drift (scrap, downtime, energy).
- **Evaluators / developers:** benchmark results, API documentation (`/docs`), tests.

### 2.4 Operating Environment
- **Backend:** Python 3.10+ (Windows / Linux) with FastAPI, Uvicorn, PyTorch, scikit-learn, pandas, NumPy, SHAP.
- **Frontend:** React 19 + TypeScript, Vite, Tailwind CSS, Recharts, Three.js. Runs on current Chrome, Edge or Firefox.
- **Communication:** HTTP/1.1 REST with JSON. In development the Vite server proxies `/api` to the backend, so one port (5173) serves both.

### 2.5 Design & Implementation Constraints
- The SECOM sensors are anonymous, so the process names in §6 are labels assigned by the project.
- SECOM rows are not evenly spaced in time. The replay treats them as consecutive samples.
- Twin state is in memory. Restarting the API or pressing Replay starts from a clean state.
- The live LSTM-AE runs on CPU. Inference on one 30×4 window must stay within the per-batch latency budget (NFR-01).

---

## 3. SYSTEM ARCHITECTURE & MODULE SPECIFICATIONS

### 3.1 Module 1: Ingestion (`src/1.ingestion/streamer.py`)
- Loads `data/processed/secom_processed.csv` (1,567 records).
- Keeps a cursor. `next_record()` returns the next record with `_stream_index` and `_stream_timestamp`, or `None` at the end.
- Supports batch slicing, a summary, and `reset()`.

### 3.2 Module 2: Digital Twin (`src/2.twin/state_manager.py`)
- **`MachineState`** fields:
  - `machine_id`, `stage`, `health` (healthy / warning / critical / offline), `drift_pattern`.
  - `parameters`, `targets` (0.0 for z-scored data), `limits` (±2.0).
  - `cusum_scores`, `hybrid_score`, `drift_severity` ∈ [0, 1], `root_causes`.
  - `lstm_score`, `lstm_threshold`, `detected_by`, `records_processed`.
- **Routing:** every record updates DEP, LITHO, CMP and CLEAN. ETCH-01 and ETCH-02 take alternate records.
- **LSTM window:** consecutive etch records are kept in one shared window of length 30. Once it is full, every record is scored by the LSTM-AE, and the result is applied to the etcher receiving that record.
- **Hybrid health rule:** see §4.3.
- **Events:** a drift event is created when a tool leaves the healthy state. It records `root_cause`, `severity`, `confidence`, `detected_by`, `lstm_error` and `lstm_threshold`. The newest 100 events are kept.
- **Reset:** `StateManager.reset()` rebuilds all machines and clears the events and the LSTM window. It is called by `POST /api/telemetry/reset`.

### 3.3 Module 3: Drift Detection (`src/3.drift/`)
| File | Role |
| :--- | :--- |
| `live_lstm.py` | Live LSTM-AE (4 etch channels, W = 30, hidden 32). Trains on the processed CSV windows that end before record 400 and calibrates τ₉₉ on records 400–499. Saves to `trained_models/live_lstm/`. Trains automatically on first API start. |
| `cusum_detector.py`, `lstm_autoencoder.py`, `preprocessor.py`, `drift_explainer.py`, `data_generator.py`, `pipeline.py` | Offline Module 3 pipeline on synthetic etch data with a known drift onset: CUSUM + LSTM-AE fusion + SHAP plot. |
| `real_benchmark.py` | Measured benchmark of the detectors on injected drifts (F1, latency, false-alarm rate). Writes `results/real_benchmark_results.json`, which the API serves. |

### 3.4 Module 4: Impact (`src/4.impact/calculator.py`)
- **Rates:** scrap $500 per failed unit, energy $0.15/kWh, downtime $2,500/h, nominal throughput 120 units/h.
- **Ranges:** gives a conservative (85%) and an upper (125%) impact range.
- **Currency:** the dashboard converts to INR at ₹83.33/$ (₹41,665 per unit, ₹2,08,325/h, ₹12.50/kWh).
- **Coverage:** aggregates are computed over the whole dataset.

### 3.5 Module 5: LCA (`src/5.lca/carbon_tracker.py`)
- Energy loss is 0.05 kWh per unit of `rf_power` deviation.
- The grid factor is 0.42 kg CO₂e/kWh.
- The target efficiency is 95%. Efficiency degrades with the deviation (§4.5).

### 3.6 Module 6: What-If Simulation (`src/6.simulation/scenario_engine.py`)
- Generates synthetic trajectories with gradual, sudden or cyclical drift, using a configurable onset, magnitude and noise.
- Reports the CUSUM response and the projected failures, energy and cost.

### 3.7 Module 7: REST API (`src/7.api/main.py`)
- FastAPI with CORS enabled. Interactive documentation is at `/docs`.
- The 21 routes are listed in §5.1.

### 3.8 Module 8: Dashboard (`src/8.dashboard/`)
- **Shell:** dark theme, sidebar navigation, and a live API status with the measured round-trip time and replay progress.
- **Pages:**

| Page | Content |
| :--- | :--- |
| Digital Twin | KPI strip (fleet health, active alerts, detections by detector, LSTM error vs τ, stream position with pause/replay); production line in fab order with sparklines; selected-tool panel with per-sensor CUSUM meters (marks at 8 and 15), LSTM meter (mark at τ) and hybrid-score chart; live event feed tagged by detector. |
| Facility View 3D | Three.js model of the fab with tool health. |
| Drift & Diagnosis | Event triage table, root cause, detected-by, sensor time series, measured benchmark panel. |
| Impact & Financial | Cost breakdown and rolling impact chart (INR). |
| Sustainability / LCA | Energy loss, CO₂ and efficiency charts. |
| Models & Datasets | SECOM schema and statistics. |
| What-If Simulation | Scenario form and CUSUM response chart. |

---

## 4. MATHEMATICAL & ALGORITHMIC FOUNDATIONS

### 4.1 Adaptive CUSUM (live twin)
Inputs are already standardised, so the target is μ₀ = 0. For each sensor:

$$d_t = |x_t - \mu_0|$$

$$\lambda_t = \begin{cases} 0.75 & d_t < k \\ 0.95 & d_t \ge k \end{cases}$$

$$S_0 = 0, \qquad S_t = \max\left(0,\; \lambda_t S_{t-1} + d_t - k\right)$$

with allowance $k = 1.2$.
- A **limit violation** is counted when $|x_t| > 2$.
- The tool-level statistic is $S^{\max}_t = \max_j S_{t,j}$ over the tool's sensors.

### 4.2 LSTM Autoencoder (live, etch tools)
1. **Input:** a window $X \in \mathbb{R}^{W\times F}$ with $W = 30$ and $F = 4$ (`rf_power`, `etch_rate`, `chamber_pressure`, `etchant_gas_flow`).
2. **Encoder:** an LSTM (hidden size 32). Its final hidden state is repeated $W$ times.
3. **Decoder:** an LSTM mapping the repeated hidden state back to the 4 channels, giving $\hat X$.
4. **Training:** MSE on normal windows only, using Adam (learning rate $10^{-3}$), batch size 64, 20 epochs.
5. **Score:** $e_t = \frac{1}{WF}\sum_{i,j}(X_{ij}-\hat X_{ij})^2$. The per-feature errors give the LSTM root cause.
6. **Threshold:** $\tau_{99}$ = 99th percentile of $e$ on held-out normal windows (records 400–499) = **1.02** for the live model. The offline Module 3 model uses its own calibrated value (1.0765).

### 4.3 Hybrid Decision Rule
$$\text{LSTM}_{alarm} = e_t > \tau_{99}, \qquad \text{CUSUM}_{alarm} = S^{\max}_t > 8 \;\lor\; v_t \ge 1, \qquad \text{CUSUM}_{crit} = S^{\max}_t > 15 \;\lor\; v_t \ge 3$$

where $v_t$ is the number of limit violations.

| Health | Condition |
| :--- | :--- |
| **CRITICAL** | $\text{CUSUM}_{crit} \lor (\text{LSTM}_{alarm} \land \text{CUSUM}_{alarm})$ |
| **WARNING** | otherwise, $\text{CUSUM}_{alarm} \lor \text{LSTM}_{alarm}$ |
| **HEALTHY** | otherwise |

- **Hybrid score:**
  $$H_t = \max\!\left(S^{\max}_t,\; 15\,\frac{e_t}{\tau_{99}}\cdot\mathbb{1}[\text{LSTM}_{alarm}]\right)$$
  The LSTM error is scaled so that τ maps to the CUSUM critical level.
- **Severity:** $\min(1, H_t/25)$.
- **Detected by:** `CUSUM`, `LSTM-AE` or `CUSUM + LSTM-AE`.
- **Root cause:** the sensor(s) with the highest CUSUM. For an LSTM-only alarm, the sensor(s) with the largest share of the reconstruction error.

### 4.4 SHAP Attribution (offline)
A gradient-boosting classifier is trained to separate drift windows from normal windows. Kernel SHAP then attributes its output to the four etch features:

$$\phi_j = \sum_{S \subseteq \mathcal{F}\setminus\{j\}} \frac{|S|!\,(|\mathcal{F}|-|S|-1)!}{|\mathcal{F}|!}\,\big[f(S\cup\{j\}) - f(S)\big]$$

The feature with the largest mean $|\phi_j|$ is the primary root cause in the offline pipeline.

### 4.5 LCA Equations
$$E_t = |\text{RF}_t - \text{RF}_{base}| \times 0.05\ \text{kWh}, \qquad C_t = E_t \times 0.42\ \text{kg CO}_2\text{e}, \qquad \eta_t = \max\!\left(0,\; 0.95 - 0.02\,\frac{E_t}{0.05}\right)$$

### 4.6 Financial Equations
$$C_{scrap} = N_{defects}\times \$500, \qquad C_{energy} = \sum E_t \times \$0.15, \qquad C_{down} = (\text{severity}\times 2.5\,\text{h})\times \$2{,}500$$

$$\text{Loss} = C_{scrap}+C_{energy}+C_{down}, \qquad \text{Range} = [0.85\,\text{Loss},\; 1.25\,\text{Loss}]$$

---

## 5. SPECIFIC REQUIREMENTS

### 5.1 External Interface Requirements (REST, base `/api`)
| Method | Route | Purpose |
| :--- | :--- | :--- |
| GET | `/health` | Status, uptime, stream cursor, total records, queue depth, module status |
| GET | `/telemetry/summary` | Stream summary |
| GET | `/telemetry/batch` | Slice of records |
| GET | `/telemetry/stream` | Next N records from the cursor |
| POST | `/telemetry/reset` | Reset the stream **and** the digital twin |
| GET | `/twin/machines` | All 6 machine states |
| GET | `/twin/machines/{machine_id}` | One machine |
| GET | `/twin/facility` | Fleet summary (healthy / warning / critical counts) |
| POST | `/twin/ingest?count=N` | Feed N records (1–100) into the twin; returns ingested count and cursor |
| GET | `/drift/events` | Drift events (newest first) |
| GET | `/drift/timeseries/{parameter}` | Sensor series with limits |
| GET | `/drift/benchmark` | Measured benchmark results (404 until `real_benchmark.py` has been run) |
| GET | `/impact/aggregate` | Dataset-wide impact |
| GET | `/impact/timeseries` | Rolling impact |
| POST | `/impact/calculate` | Impact of one event |
| GET | `/lca/summary` | Energy, CO₂, efficiency |
| GET | `/lca/timeseries` | LCA series |
| GET | `/lca/efficiency` | Efficiency vs baseline |
| POST | `/simulation/generate` | Run a what-if scenario |
| GET | `/simulation/parameters` | Available parameters and drift types |
| GET | `/dataset/info` | SECOM dataset information |

### 5.2 Functional Requirements
| ID | Requirement |
| :--- | :--- |
| **FR-01** | The ingestion module shall replay the processed SECOM records in order and stop at the last record. |
| **FR-02** | The digital twin shall keep a state object for each of the 6 tools. |
| **FR-03** | The twin shall send alternate records to ETCH-01 and ETCH-02. |
| **FR-04** | The twin shall update an adaptive CUSUM per sensor with k = 1.2 and decay 0.75 / 0.95. |
| **FR-05** | The twin shall score each etch record with the LSTM-AE over the last 30 etch records once 30 are available. |
| **FR-06** | The twin shall raise WARNING when CUSUM > 8, a ±2σ violation occurs, or the LSTM error > τ₉₉. |
| **FR-07** | The twin shall raise CRITICAL when CUSUM > 15, at least 3 violations occur, or both detectors alarm together. |
| **FR-08** | Every drift event shall record the detecting method and a root-cause sensor. |
| **FR-09** | If the LSTM model cannot be loaded, the twin shall continue with CUSUM-only detection and log a warning. |
| **FR-10** | Resetting the telemetry stream shall also reset all twin state and events. |
| **FR-11** | The offline pipeline shall compute SHAP attributions for detected drift windows. |
| **FR-12** | The LCA module shall compute energy loss (kWh), CO₂ (0.42 kg/kWh) and efficiency against a 95% target. |
| **FR-13** | The impact module shall compute scrap, energy and downtime cost with an 85–125% range. |
| **FR-14** | The simulation module shall generate gradual, sudden and cyclical drift on request. |
| **FR-15** | The benchmark shall report measured F1, detection latency and false-alarm rate for each detector. |
| **FR-16** | The dashboard shall ingest 10 records/s while running, and allow pause and replay. |
| **FR-17** | The dashboard shall show, per tool, the health, CUSUM per sensor, LSTM error vs τ (etch tools) and detecting method. |
| **FR-18** | The dashboard shall be reachable from another device on the same network through a single port. |

### 5.3 Non-Functional Requirements
| ID | Category | Requirement |
| :--- | :--- | :--- |
| **NFR-01** | Performance | A 10-record ingest (CUSUM + LSTM-AE) shall complete well within the 1 s polling interval on a laptop CPU. |
| **NFR-02** | Reliability | The dashboard shall keep polling through transient API errors and show the API as offline instead of crashing. |
| **NFR-03** | Reproducibility | Data preparation, model training, benchmark and evaluation shall be runnable from scripts in the repository. |
| **NFR-04** | Explainability | 100% of drift events shall carry a root-cause sensor and the detecting method. |
| **NFR-05** | Maintainability | Modules 1–8 shall be separate packages with single responsibilities. |
| **NFR-06** | Testability | The hybrid rule shall be covered by unit tests that do not need a trained model. |
| **NFR-07** | Portability | The backend shall run on Windows and Linux. The dashboard shall build with `npm run build`. |
| **NFR-08** | Usability | Health states shall use consistent colour and text labels (healthy / warning / critical) across pages. |

---

## 6. DATA DICTIONARY & FEATURE SCHEMA

`data/processed/secom_processed.csv` holds 20 named sensors chosen from the 590 anonymous SECOM columns. It also keeps the remaining SECOM columns (unnamed), the `Pass/Fail` label, and per-record impact columns (cost in USD) used by the impact module. All sensor values are **z-scores** (mean 0, std 1 over the dataset). The process names and units below are **assigned by this project** to give each tool four interpretable channels. They are not the original SECOM sensor meanings.

| Feature | Tool | Nominal unit (assigned) | Description |
| :--- | :--- | :--- | :--- |
| `rf_power` | ETCH | W | Plasma generator power |
| `etch_rate` | ETCH | nm/min | Material removal rate |
| `chamber_pressure` | ETCH | mTorr | Chamber vacuum pressure |
| `etchant_gas_flow` | ETCH | sccm | Reactive gas flow |
| `dep_temp` | DEP | °C | Substrate temperature |
| `gas_flow_rate` | DEP | sccm | Precursor gas flow |
| `film_thickness` | DEP | Å | Deposited layer thickness |
| `chamber_vacuum` | DEP | Torr | Deposition chamber vacuum |
| `focus_offset` | LITHO | µm | Focal plane error |
| `exposure_dose` | LITHO | mJ/cm² | UV dose |
| `alignment_error` | LITHO | nm | Overlay error |
| `lens_temp` | LITHO | °C | Lens temperature |
| `pad_pressure` | CMP | psi | Polishing pad pressure |
| `slurry_flow` | CMP | mL/min | Slurry delivery rate |
| `rotation_speed` | CMP | rpm | Platen speed |
| `friction_coefficient` | CMP | – | Pad friction |
| `bath_temp` | CLEAN | °C | Wet bath temperature |
| `chemical_ph` | CLEAN | pH | Bath chemistry |
| `rinse_flow` | CLEAN | L/min | Rinse water flow |
| `particle_count` | CLEAN | count | Particles after clean |

---

## 7. VERIFICATION & VALIDATION

| Item | Method | Result |
| :--- | :--- | :--- |
| Hybrid rule (FR-05 to FR-09) | `pytest tests/test_hybrid_twin.py`: quiet data stays healthy; LSTM-only gives WARNING with LSTM root cause; both detectors give CRITICAL; CUSUM-only when the model is absent | 4/4 pass |
| Detection accuracy | `scripts/eval_live_twin.py`: 36 injected drifts replayed through the live twin | see table below |
| Detector benchmark (FR-15) | `src/3.drift/real_benchmark.py` | measured, served at `/api/drift/benchmark` |
| Replay & reset (FR-01, FR-10) | Full replay stops at 1,567. After a reset, all counters and events are 0 | pass |
| Build & lint (NFR-07) | GitHub Actions: flake8 (syntax / undefined names), pytest, `npm ci && npm run build` | CI workflow |

**Live twin evaluation (36 injected drifts):**

| Metric | CUSUM only | Hybrid |
| :--- | :--- | :--- |
| Warning F1 | 0.717 | 0.792 |
| Warning false-alarm rate | 18.8% | 34.8% |
| Critical F1 | 0.579 | 0.736 |
| Critical false-alarm rate | 0% | 6.1% |
| Critical drifts detected | 86.1% | 100% |
| Mean latency to critical | 93.0 records | 8.9 records |
| Cyclical-drift F1 | 0.405 | 0.71 |
| Alert rate on clean SECOM | 21.8% | 47.7% |

**Interpretation:** the hybrid improves F1, detects every critical drift, and is about 10× faster to reach critical. The cost is roughly double the warning-level alerts, because unmodified SECOM data already contains natural drift. Critical alerts stay selective (6.1% false-alarm rate).

---

## 8. VIVA Q&A GUIDE

**Q1. How is the digital twin implemented?**
`src/2.twin/state_manager.py` keeps one `MachineState` per tool, holding sensor values, ±2σ limits, CUSUM registers, the LSTM score and health. Each streamed record updates the relevant tools. The dashboard polls the API every second and draws the production line, meters and event feed.

**Q2. Is the stream real-time data?**
It is a replay of the real SECOM dataset, served one record at a time to imitate live telemetry. The dashboard requests 10 records per second. The stream ends at record 1,567, and Replay restarts the stream and the twin together.

**Q3. Which models detect drift live?**
Both of them:
- **Adaptive CUSUM** runs on every sensor of every tool.
- The **LSTM autoencoder** runs on the four etch channels over a 30-record window.

The hybrid rule in §4.3 combines them, and each alert states which method fired.

**Q4. Why combine CUSUM and an LSTM-AE?**
- CUSUM is cheap, per-sensor and interpretable. It is good for sustained shifts in one signal, but slow on repeating patterns.
- The LSTM-AE learns how the four etch channels normally move together. It catches multivariate and cyclical changes that CUSUM misses.

In our evaluation the hybrid raised cyclical-drift F1 from 0.405 to 0.71, and caught 100% of critical drifts instead of 86.1%.

**Q5. What does the hybrid cost?**
More warnings: the false-alarm rate rose from 18.8% to 34.8%, because SECOM itself drifts. We keep critical alerts strict, so a CRITICAL from the LSTM needs CUSUM to agree.

**Q6. How is τ chosen?**
It is the 99th percentile of reconstruction error on held-out normal windows (records 400–499), which is 1.02 for the live model. Normal data therefore crosses τ about 1% of the time.

**Q7. How is the root cause found?**
- **Live:** the sensor with the highest CUSUM. For an LSTM-only alarm, the sensor with the largest reconstruction error.
- **Offline:** Kernel SHAP on a gradient-boosting surrogate ranks the four etch features.

**Q8. Are the sensor names real?**
No. SECOM sensors are anonymous. We selected 20 columns and assigned process names so that each tool has four channels. The detection results do not depend on the names.

**Q9. How are LCA and cost computed?**
- **Energy:** 0.05 kWh per unit of RF deviation.
- **CO₂:** 0.42 kg per kWh.
- **Efficiency:** 95% target minus the degradation from deviation.
- **Cost:** scrap $500 per unit + energy $0.15/kWh + downtime $2,500/h, shown in INR on the dashboard.

---

**End of Software Requirements Specification**
