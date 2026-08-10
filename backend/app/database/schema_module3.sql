-- =====================================================================
-- ARGUS — Module 3 PostgreSQL schema (operational & financial impact)
-- Run this yourself AFTER schema.sql and schema_module2.sql, e.g.:
--   psql -U <user> -d argus -f backend/app/database/schema_module3.sql
-- =====================================================================

CREATE TABLE IF NOT EXISTS impact_rule_versions (
    id            BIGSERIAL PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    version       VARCHAR(50)  NOT NULL,
    description   TEXT,
    configuration JSONB NOT NULL,
    is_demo       BOOLEAN NOT NULL DEFAULT TRUE,
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS production_configurations (
    id                          BIGSERIAL PRIMARY KEY,
    name                        VARCHAR(255) NOT NULL,
    stage_name                  VARCHAR(100) NOT NULL,
    machine_id                  VARCHAR(100),
    currency                    VARCHAR(10)  NOT NULL,
    baseline_yield_percent      DOUBLE PRECISION NOT NULL,
    units_per_hour              DOUBLE PRECISION NOT NULL,
    wafers_per_batch            INTEGER,
    dies_per_wafer              INTEGER,
    product_value_per_good_unit DOUBLE PRECISION NOT NULL,
    material_cost_per_unit      DOUBLE PRECISION NOT NULL,
    downtime_cost_per_hour      DOUBLE PRECISION NOT NULL,
    configuration               JSONB NOT NULL,
    is_demo                     BOOLEAN NOT NULL DEFAULT TRUE,
    active                      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_production_configurations_stage
    ON production_configurations (stage_name);

CREATE TABLE IF NOT EXISTS operational_impacts (
    id                           BIGSERIAL PRIMARY KEY,
    drift_event_id               BIGINT NOT NULL REFERENCES drift_events(id) ON DELETE CASCADE,
    dataset_id                   BIGINT REFERENCES datasets(id) ON DELETE SET NULL,
    machine_id                   VARCHAR(100) NOT NULL,
    stage_name                   VARCHAR(100) NOT NULL,
    primary_parameter            VARCHAR(100),
    analysis_period_hours        DOUBLE PRECISION NOT NULL,
    raw_defect_probability       DOUBLE PRECISION,
    adjusted_defect_probability  DOUBLE PRECISION,
    baseline_yield_percent       DOUBLE PRECISION,
    predicted_yield_percent      DOUBLE PRECISION,
    yield_loss_percentage_points DOUBLE PRECISION,
    total_units                  DOUBLE PRECISION,
    additional_defective_units   DOUBLE PRECISION,
    rework_units                 DOUBLE PRECISION,
    scrap_units                  DOUBLE PRECISION,
    throughput_loss_units        DOUBLE PRECISION,
    calculation_details          JSONB,
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_operational_impacts_event
    ON operational_impacts (drift_event_id);
CREATE INDEX IF NOT EXISTS ix_operational_impacts_machine
    ON operational_impacts (machine_id, stage_name);

CREATE TABLE IF NOT EXISTS financial_impacts (
    id                              BIGSERIAL PRIMARY KEY,
    operational_impact_id           BIGINT NOT NULL REFERENCES operational_impacts(id) ON DELETE CASCADE,
    currency                        VARCHAR(10) NOT NULL,
    scrap_material_cost             DOUBLE PRECISION,
    scrap_processing_cost           DOUBLE PRECISION,
    scrap_disposal_cost             DOUBLE PRECISION,
    total_scrap_cost                DOUBLE PRECISION,
    rework_labour_cost              DOUBLE PRECISION,
    rework_energy_cost              DOUBLE PRECISION,
    rework_material_cost            DOUBLE PRECISION,
    total_rework_cost               DOUBLE PRECISION,
    estimated_lost_production_value DOUBLE PRECISION,
    downtime_cost                   DOUBLE PRECISION,
    total_financial_impact          DOUBLE PRECISION,
    best_case_cost                  DOUBLE PRECISION,
    expected_case_cost              DOUBLE PRECISION,
    worst_case_cost                 DOUBLE PRECISION,
    confidence                      DOUBLE PRECISION,
    calculation_details             JSONB,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS ix_financial_impacts_operational
    ON financial_impacts (operational_impact_id);
