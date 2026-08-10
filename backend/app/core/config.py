"""Application configuration loaded from environment variables / .env."""
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Central runtime configuration. All values overridable via .env."""

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    app_name: str = "ARGUS"
    api_v1_prefix: str = "/api/v1"

    # SQLite fallback lets the app and tests run without PostgreSQL.
    database_url: str = f"sqlite:///{BACKEND_DIR / 'argus_dev.db'}"
    auto_create_tables: bool = True

    cors_origins: str = "http://localhost:5173"

    data_dir: Path = BACKEND_DIR.parent / "data"
    models_dir: Path = BACKEND_DIR.parent / "trained_models"
    max_upload_mb: int = 100
    log_level: str = "INFO"

    stage_config_path: Path = Path(__file__).resolve().parents[1] / "config" / "stages.json"
    impact_rules_path: Path = Path(__file__).resolve().parents[1] / "config" / "impact_rules.json"
    production_config_path: Path = Path(__file__).resolve().parents[1] / "config" / "production_config.json"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def raw_dir(self) -> Path:
        return self.data_dir / "raw"

    @property
    def processed_dir(self) -> Path:
        return self.data_dir / "processed"

    @property
    def generated_dir(self) -> Path:
        return self.data_dir / "generated"


@lru_cache
def get_settings() -> Settings:
    return Settings()
