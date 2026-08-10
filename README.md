# ARGUS

**A Digital Twin–Based Framework for Process Drift Detection and Dynamic Life Cycle Sustainability Assessment** — for semiconductor / electronic manufacturing machines.

ARGUS ingests or simulates multi-stage manufacturing sensor data, detects gradual and sudden process drift, explains its causes, quantifies operational + financial impact, and dynamically updates sustainability (LCA) metrics.

> All simulated data and demonstration values are clearly labelled as such — they are not real factory measurements.

## Architecture

```
Data Sources → Acquisition & Validation → Preprocessing & Features
       → Digital Twin Simulator → Hybrid Drift Detection (CUSUM + LSTM AE)
       → Operational/Financial Impact ┬ Dynamic LCA
                                      → Decision Support → FastAPI → React Dashboard
```

## Repository Layout

```
run_algorithm.py       standalone CLI: full Module 1 + Module 2 workflow, no server needed
algorithm_config.yaml  configuration for the standalone pipeline
algorithm_pipeline/    thin orchestration layer reusing backend/app/modules
backend/          FastAPI application (Modules 1 + 2 + 3 implemented)
  app/config/     stages.json + impact_rules.json + production_config.json — config-driven catalogs
  app/database/   schema.sql + schema_module2.sql + schema_module3.sql — run these in YOUR PostgreSQL yourself
  tests/          pytest suite (application + algorithms)
frontend/         Vite + React + TypeScript + Tailwind dashboard
data/             raw / processed / generated / reference data files
trained_models/   saved drift-detection models (model.pt, scaler, metadata)
results/          standalone pipeline outputs (git-ignored)
tests/            standalone pipeline end-to-end test
docs/             module documentation
legacy_drift_prototype/  deprecated original prototype (historical reference only)
docker-compose.yml
```

## Module Status

| Module | Description | Status |
|---|---|---|
| Foundation | FastAPI, DB layer, React, Docker, health API | ✅ Done |
| Module 1 | Data acquisition & engineering | ✅ Done |
| Module 2 | Digital twin + hybrid drift detection | ✅ Integrated |
| Module 3 | Financial & operational impact | ✅ Integrated |
| Module 4 | Dynamic LCA engine | ⬜ Planned |
| Module 5 | Decision support + dashboard pages | ⬜ Planned |

## Setup

### 0. Standalone algorithm pipeline (no server, no database)

The complete Module 1 + Module 2 algorithm workflow can run on its own:

```bash
cd backend && python -m venv venv && venv\Scripts\activate && pip install -r requirements.txt && cd ..
python run_algorithm.py --config algorithm_config.yaml
```

It loads/generates a dataset, validates, preprocesses, builds the wide feature
table, selects a healthy baseline, trains (or loads) the LSTM Autoencoder, runs
CUSUM + hybrid scoring with persistence, classifies the drift, ranks root-cause
parameters, forecasts, computes the digital-twin health score, and writes
results + ground-truth evaluation metrics (precision/recall/F1, FPR/FNR,
detection delay, drift-start error) to `results/<timestamp>_<name>/`.
With `module3.enabled: true` it additionally converts the detected drift into
operational + financial impact (demo assumptions) and writes `impact_result.json`.
Everything is driven by `algorithm_config.yaml`; the algorithm formulas stay in
`backend/app/modules` and are shared with the FastAPI application.

### 1. Database (you manage PostgreSQL yourself)

```sql
-- in psql:
CREATE DATABASE argus;
```

```bash
psql -U <your_user> -d argus -f backend/app/database/schema.sql
psql -U <your_user> -d argus -f backend/app/database/schema_module2.sql
psql -U <your_user> -d argus -f backend/app/database/schema_module3.sql
```

### 2. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env         # then edit DATABASE_URL
uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs

> No `.env`? The backend falls back to a local SQLite file with auto-created tables — handy for a quick look, but use PostgreSQL for real work.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Dashboard: http://localhost:5173

### 4. Tests

```bash
cd backend
pytest
```

### 5. Docker (optional)

```bash
docker compose up --build
```

PostgreSQL is *not* containerised — the backend container reaches your host database via `host.docker.internal` (see [docker-compose.yml](docker-compose.yml)).

## Module 1 API (prefix `/api/v1`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness + DB check |
| POST | `/datasets/upload` | Upload CSV (`?wide_format=true` for wide files) |
| POST | `/datasets/{id}/validate` | Human-readable validation report |
| POST | `/datasets/{id}/preprocess` | Clean, resample, engineer features, store readings |
| GET | `/datasets` | List datasets |
| GET | `/datasets/{id}` | Dataset detail |
| GET | `/datasets/{id}/summary` | Per-parameter statistics |
| GET | `/datasets/{id}/quality-report` | Quality score breakdown |
| DELETE | `/datasets/{id}` | Delete dataset + files + readings |
| POST | `/simulation/generate` | Generate synthetic data with drift + ground truth |
| GET | `/simulation/stages` | Configured stage catalog |

## Module 2 API (prefix `/api/v1`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/drift/models/train` | Train LSTM Autoencoder on a preprocessed dataset |
| GET | `/drift/models` | Model registry (versions, thresholds, metrics) |
| POST | `/drift/models/{model_id}/activate` | Set active model for machine/stage |
| POST | `/drift/detect` | Hybrid CUSUM + LSTM detection, twin update, event creation |
| GET | `/drift/events` | Drift events (filter by machine/stage/status) |
| GET | `/drift/events/{id}/explanation` | Root-cause ranking |
| GET | `/drift/events/{id}/forecast` | Trend forecast + limit-crossing estimate |
| GET | `/drift/events/{id}/impact-input` | Stable contract for future Module 3 |
| POST | `/drift/events/{id}/acknowledge` · `/resolve` | Event lifecycle |
| GET | `/digital-twin/state` | Live machine/stage twin states + health score |

Full documentation: [docs/module-2-drift-detection.md](docs/module-2-drift-detection.md)

## Module 3 API (prefix `/api/v1`)

| Method | Path | Purpose |
|---|---|---|
| POST | `/impact/calculate` | Drift event → operational + financial impact (persist optional) |
| GET | `/impact` | List persisted impact assessments |
| GET | `/impact/{id}` | Full stored impact result |
| GET | `/impact/{id}/breakdown` | Traceable calculation steps + notes |
| GET | `/impact/by-drift/{event_id}` | Impacts for one drift event |
| GET/POST/PUT | `/impact/configurations` | Production/cost configuration management |

All impact coefficients and cost values are configuration-driven **demonstration assumptions**
(`impact_rules.json`, `production_config.json`, `is_demo=true`) — not calibrated fab or accounting
data. Full documentation: [docs/module-3-impact-model.md](docs/module-3-impact-model.md)

### Sample: generate a drifting dataset

```bash
curl -X POST http://localhost:8000/api/v1/simulation/generate \
  -H "Content-Type: application/json" \
  -d '{
    "name": "etch-pressure-drift",
    "duration_hours": 24,
    "sampling_interval_seconds": 60,
    "stages": ["etching"],
    "seed": 42,
    "drifts": [{
      "stage_name": "etching",
      "parameter_name": "chamber_pressure",
      "drift_type": "linear",
      "start_fraction": 0.5,
      "magnitude_sigmas": 6.0,
      "direction": "up"
    }]
  }'
```

## Configuration Notes

- **Stages/parameters** are fully config-driven in [backend/app/config/stages.json](backend/app/config/stages.json) — add any machine type there; no code changes needed.
- **Data quality score** = `100 × (0.4·completeness + 0.3·validity + 0.15·uniqueness + 0.15·timeliness)` (documented in `cleaner.py`).
- **Feature engineering is leakage-safe**: trailing windows and positive lags only; verified by an automated test.
- No credentials, thresholds, or costs are hard-coded — everything comes from `.env` or config files.

## Legacy Prototype (`legacy_drift_prototype/`)

The original standalone drift-detection pipeline (PyTorch LSTM Autoencoder + CUSUM + SHAP, PCB-oriented) is deprecated and retained for reference only — its logic now lives in the backend as Module 2. See [legacy_drift_prototype/README.md](legacy_drift_prototype/README.md).

## License

MIT
