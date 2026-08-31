-- =====================================================================
-- ARGUS — Module 2 PostgreSQL schema (digital twin + drift detection)
-- Run this yourself AFTER schema.sql, e.g.:
--   psql -U <user> -d argus -f backend/app/database/schema_module2.sql
-- =====================================================================

CREATE TABLE IF NOT EXISTS model_versions (
    id                     BIGSERIAL PRIMARY KEY,
    model_id               VARCHAR(32)  NOT NULL UNIQUE,
    model_name             VARCHAR(255) NOT NULL,
    model_type             VARCHAR(50)  NOT NULL,
    version                INTEGER      NOT NULL DEFAULT 1,
    dataset_id             BIGINT REFERENCES datasets(id) ON DELETE SET NULL,
    stage_name             VARCHAR(100) NOT NULL,
    machine_scope          VARCHAR(100) NOT NULL,
    framework              VARCHAR(100),
    feature_names          JSONB,
    sequence_length        INTEGER,
    training_configuration JSONB,
    metrics                JSONB,
    model_path             VARCHAR(512),
    scaler_path            VARCHAR(512),
    threshold              DOUBLE PRECISION,
    status                 VARCHAR(50) NOT NULL DEFAULT 'trained',
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_model_versions_scope
    ON model_versions (machine_scope, stage_name);

CREATE TABLE IF NOT EXISTS training_runs (
    id                   BIGSERIAL PRIMARY KEY,
    model_version_id     BIGINT NOT NULL REFERENCES model_versions(id) ON DELETE CASCADE,
    dataset_id           BIGINT REFERENCES datasets(id) ON DELETE SET NULL,
    status               VARCHAR(50) NOT NULL DEFAULT 'completed',
    started_at           TIMESTAMPTZ,
    completed_at         TIMESTAMPTZ,
    epochs_completed     INTEGER,
    best_validation_loss DOUBLE PRECISION,
    training_history     JSONB,
    error_message        TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_training_runs_model
    ON training_runs (model_version_id);

CREATE TABLE IF NOT EXISTS digital_twin_states (
    id                   BIGSERIAL PRIMARY KEY,
    machine_id           VARCHAR(100) NOT NULL,
    stage_name           VARCHAR(100) NOT NULL,
    dataset_id           BIGINT REFERENCES datasets(id) ON DELETE SET NULL,
    state_timestamp      TIMESTAMPTZ,
    batch_id             VARCHAR(100),
    parameter_values     JSONB,
    target_values        JSONB,
    operating_limits     JSONB,
    cusum_score          DOUBLE PRECISION,
    lstm_score           DOUBLE PRECISION,
    hybrid_score         DOUBLE PRECISION,
    health_score         DOUBLE PRECISION,
    status               VARCHAR(50),
    drift_type           VARCHAR(50),
    root_cause_parameter VARCHAR(100),
    prediction_summary   JSONB,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_twin_states_machine
    ON digital_twin_states (machine_id, stage_name);

CREATE TABLE IF NOT EXISTS drift_events (
    id                   BIGSERIAL PRIMARY KEY,
    dataset_id           BIGINT REFERENCES datasets(id) ON DELETE SET NULL,
    machine_id           VARCHAR(100) NOT NULL,
    stage_name           VARCHAR(100) NOT NULL,
    detected_at          TIMESTAMPTZ,
    estimated_start_time TIMESTAMPTZ,
    resolved_at          TIMESTAMPTZ,
    drift_type           VARCHAR(50),
    direction            VARCHAR(10),
    cusum_score          DOUBLE PRECISION,
    lstm_score           DOUBLE PRECISION,
    hybrid_score         DOUBLE PRECISION,
    severity_score       DOUBLE PRECISION,
    severity_level       VARCHAR(20),
    health_score         DOUBLE PRECISION,
    confidence           DOUBLE PRECISION,
    primary_parameter    VARCHAR(100),
    affected_parameters  JSONB,
    detection_status     VARCHAR(50),
    status               VARCHAR(20) NOT NULL DEFAULT 'open',
    model_id             VARCHAR(32),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_drift_events_machine
    ON drift_events (machine_id, stage_name, status);

CREATE TABLE IF NOT EXISTS drift_explanations (
    id                    BIGSERIAL PRIMARY KEY,
    drift_event_id        BIGINT NOT NULL REFERENCES drift_events(id) ON DELETE CASCADE,
    explanation_method    VARCHAR(100),
    primary_parameter     VARCHAR(100),
    feature_contributions JSONB,
    explanation_text      TEXT,
    confidence            DOUBLE PRECISION,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_drift_explanations_event
    ON drift_explanations (drift_event_id);

CREATE TABLE IF NOT EXISTS drift_forecasts (
    id                      BIGSERIAL PRIMARY KEY,
    drift_event_id          BIGINT NOT NULL REFERENCES drift_events(id) ON DELETE CASCADE,
    parameter_name          VARCHAR(100),
    forecast_method         VARCHAR(50),
    forecast_horizon_hours  INTEGER,
    forecast_values         JSONB,
    threshold_crossing_time TIMESTAMPTZ,
    confidence_bounds       JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_drift_forecasts_event
    ON drift_forecasts (drift_event_id);
