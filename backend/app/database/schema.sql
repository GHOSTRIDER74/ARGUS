-- =====================================================================
-- ARGUS — Module 1 PostgreSQL schema
-- Run this yourself, e.g.:
--   psql -U <user> -d argus -f backend/app/database/schema.sql
-- Create the database first if needed:  CREATE DATABASE argus;
-- =====================================================================

CREATE TABLE IF NOT EXISTS datasets (
    id                BIGSERIAL PRIMARY KEY,
    name              VARCHAR(255)  NOT NULL,
    source_type       VARCHAR(50)   NOT NULL,           -- 'upload' | 'synthetic'
    original_filename VARCHAR(512),
    stage_name        VARCHAR(100),                      -- NULL = multi-stage dataset
    start_timestamp   TIMESTAMPTZ,
    end_timestamp     TIMESTAMPTZ,
    row_count         INTEGER       NOT NULL DEFAULT 0,
    status            VARCHAR(50)   NOT NULL DEFAULT 'uploaded',
    quality_score     DOUBLE PRECISION,
    meta              JSONB,                             -- sim config, ground-truth info, file paths
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sensor_readings (
    id              BIGSERIAL PRIMARY KEY,
    dataset_id      BIGINT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    timestamp       TIMESTAMPTZ  NOT NULL,
    batch_id        VARCHAR(100),
    wafer_id        VARCHAR(100),
    machine_id      VARCHAR(100) NOT NULL,
    stage_name      VARCHAR(100) NOT NULL,
    parameter_name  VARCHAR(100) NOT NULL,
    parameter_value DOUBLE PRECISION NOT NULL,
    target_value    DOUBLE PRECISION,
    unit            VARCHAR(50),
    quality_score   DOUBLE PRECISION,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_sensor_readings_dataset
    ON sensor_readings (dataset_id);
CREATE INDEX IF NOT EXISTS ix_sensor_readings_lookup
    ON sensor_readings (dataset_id, machine_id, stage_name, parameter_name, timestamp);

CREATE TABLE IF NOT EXISTS preprocessing_runs (
    id                    BIGSERIAL PRIMARY KEY,
    dataset_id            BIGINT NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    configuration         JSONB  NOT NULL,
    input_rows            INTEGER NOT NULL,
    output_rows           INTEGER NOT NULL,
    missing_values_before INTEGER NOT NULL DEFAULT 0,
    missing_values_after  INTEGER NOT NULL DEFAULT 0,
    status                VARCHAR(50) NOT NULL DEFAULT 'completed',
    report                JSONB,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_preprocessing_runs_dataset
    ON preprocessing_runs (dataset_id);
