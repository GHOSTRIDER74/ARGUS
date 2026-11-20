# ARGUS: Semiconductor Fab Digital Twin with Hybrid Drift Detection

ARGUS replays real semiconductor fab sensor data (the UCI **SECOM** dataset) as a live telemetry stream into a **digital twin** of six process tools. It flags **process drift** with a hybrid of **adaptive CUSUM** and an **LSTM autoencoder**, and it estimates the **financial** and **carbon** impact of that drift. Everything is shown on a React dashboard.

> Final-year project, Department of AI & DS, BMSCE (Project Work Phase 2).
> Full requirements: [SRS.md](SRS.md).

---

## How it works

```
SECOM CSV (1,567 runs) ─► 1.ingestion ─► 2.twin ─────────► 7.api (FastAPI :8000) ─► 8.dashboard (React :5173)
                          streamer       6 machines           21 REST routes          7 pages
                          (replay)       + hybrid detection
                                         (3.drift: CUSUM + LSTM-AE)
                                         4.impact (₹ cost) · 5.lca (kWh, CO₂) · 6.simulation (what-if)
```

1. **Ingestion** (`src/1.ingestion/streamer.py`): holds a cursor into the processed SECOM file and hands out the next N records on request. The dashboard pulls 10 records per second. The stream stops at record 1,567, and **Replay** resets the stream and the twin together.
2. **Digital twin** (`src/2.twin/state_manager.py`): six virtual tools in fab order (DEP-01, LITHO-01, ETCH-01, ETCH-02, CMP-01, CLEAN-01), each watching four sensors. The two etchers take alternate records.
3. **Hybrid drift detection** (`src/2.twin` + `src/3.drift/live_lstm.py`):
   - **CUSUM** per sensor: allowance k = 1.2, decay 0.75 when in control and 0.95 when out of control.
   - **LSTM autoencoder** on the last 30 etch records (4 channels). It alarms when the reconstruction error is above τ₉₉ = 1.02, the 99th percentile on normal data.
   - **WARNING** if CUSUM > 8, **or** any sensor is outside ±2σ, **or** the LSTM error is above τ.
   - **CRITICAL** if CUSUM > 15, **or** 3 or more sensors are outside ±2σ, **or** both detectors alarm together.
   - Every event records which detector fired (`CUSUM`, `LSTM-AE`, or `CUSUM + LSTM-AE`) and the root-cause sensor.
4. **Explainability** (`src/3.drift/drift_explainer.py`): Kernel SHAP on a gradient-boosting surrogate, run offline in the Module 3 pipeline.
5. **Impact** (`src/4.impact`) and **LCA** (`src/5.lca`): scrap, downtime and energy cost, plus wasted kWh and kg CO₂ (0.42 kg/kWh). These are computed over the whole dataset.
6. **What-if simulation** (`src/6.simulation`): injects gradual, sudden or cyclical drift into synthetic data and shows when CUSUM catches it.

### Accuracy of the hybrid rule

These results come from 36 injected drifts replayed through the live twin (`scripts/eval_live_twin.py`).

| Metric | CUSUM only | Hybrid |
|---|---|---|
| Critical drifts detected | 86.1% | **100%** |
| Mean time to critical alert | 93.0 records | **8.9 records** |
| Warning F1 | 0.717 | **0.792** |
| Cyclical-drift F1 | 0.405 | **0.71** |
| Warning false-alarm rate | **18.8%** | 34.8% |

The hybrid catches every critical drift, and catches it much sooner. The cost is more warning-level false alarms, because normal SECOM data already drifts.

---

## Project layout

```
.github/workflows/ci.yml   CI: lint + unit tests (Python), production build (dashboard)
EDA/preprocessing.py       raw SECOM -> data/processed/secom_processed.csv (20 named sensors, z-scored)
scripts/
  prepare_data.py          downloads SECOM from UCI and runs EDA/preprocessing.py
  eval_live_twin.py        CUSUM-only vs hybrid evaluation (writes results/live_twin_eval.json)
  generate_fig3_real.py    Fig. 3 of the paper from the real benchmark
src/
  1.ingestion/             telemetry replay
  2.twin/                  digital twin + hybrid health rule
  3.drift/                 CUSUM, LSTM-AE (offline + live), SHAP, real benchmark, Module 3 pipeline
  4.impact/  5.lca/  6.simulation/
  7.api/main.py            FastAPI backend
  8.dashboard/             React + Vite + Tailwind dashboard
tests/test_hybrid_twin.py  unit tests for the hybrid rule
figures/                   paper figures
```

`data/`, `results/` and `trained_models/` are generated locally and are not committed.

---

## Setup (first time)

You need **Python 3.10+** and **Node.js 20+**.

```powershell
git clone -b setup-project-hybrid https://github.com/GHOSTRIDER74/ARGUS.git
cd ARGUS
python -m venv venv
.\venv\Scripts\activate            # Linux/macOS: source venv/bin/activate
pip install -r requirements.txt

python scripts/prepare_data.py     # downloads SECOM and builds data/processed/secom_processed.csv

cd src/8.dashboard
npm install
cd ../..
```

## Run

Use two terminals from the project root.

```powershell
# Terminal 1: backend API on http://localhost:8000 (docs at /docs)
.\venv\Scripts\python.exe src/7.api/main.py
```

```powershell
# Terminal 2: dashboard on http://localhost:5173
cd src/8.dashboard
npm run dev
```

Open **http://localhost:5173** and go to **Digital Twin**.

The first time the API starts, it trains the live LSTM autoencoder (takes a few seconds) and saves it to `trained_models/live_lstm/`.

**Opening the dashboard from another device on the same Wi-Fi:** use `http://<this-pc-ip>:5173`. Vite listens on the LAN and forwards `/api` to the backend, so only port 5173 needs to be allowed through the firewall.

## Optional

```powershell
python src/3.drift/real_benchmark.py   # real CUSUM / EWMA / LSTM benchmark -> shown on the Drift page
python scripts/eval_live_twin.py       # CUSUM-only vs hybrid table above
python src/3.drift/pipeline.py         # offline Module 3 demo: CUSUM + LSTM-AE + SHAP plot
pytest tests -v                        # unit tests
```

## Notes on the data

SECOM has 590 anonymous sensor columns. The preprocessing keeps 20 of them and **gives them process names** (`rf_power`, `etch_rate`, `chamber_pressure`, …) so each tool in the twin has four meaningful channels. The names are labels chosen by this project, not the original sensor meanings. All values are standardised (z-scores), so 0 is nominal and ±2 is the control limit.
