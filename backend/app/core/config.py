from __future__ import annotations

from functools import cached_property
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    vision_model_path: Path = Field(
        Path(__file__).resolve().parents[2] / "models" / "best.onnx",
        validation_alias="SHELFMIND_VISION_MODEL_PATH",
    )
    vision_blur_threshold: float = Field(60.0, gt=0, validation_alias="SHELFMIND_VISION_BLUR_THRESHOLD")
    project_name: str = Field("Shelf Mind", validation_alias="SHELFMIND_PROJECT_NAME")
    supabase_project_id: str = Field("", validation_alias="SHELFMIND_SUPABASE_PROJECT_ID")
    supabase_url: str = Field("", validation_alias="SHELFMIND_SUPABASE_URL")
    supabase_region: str = Field("", validation_alias="SHELFMIND_SUPABASE_REGION")
    database_url: str = Field(
        "sqlite:///./shelfmind_local.db",
        validation_alias=AliasChoices("SHELFMIND_DATABASE_URL", "DATABASE_URL"),
    )
    supabase_publishable_key: str = Field("", validation_alias="SHELFMIND_SUPABASE_PUBLISHABLE_KEY")
    supabase_anon_key: str = Field("", validation_alias="SHELFMIND_SUPABASE_ANON_KEY")
    supabase_service_role_key: str = Field("", validation_alias="SHELFMIND_SUPABASE_SERVICE_ROLE_KEY")
    cors_origins: str = Field(
        "http://localhost:5174,http://127.0.0.1:5174,http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
        validation_alias="SHELFMIND_CORS_ORIGINS",
    )
    scenario_seed: int = Field(
        20260914,
        validation_alias=AliasChoices("SHELFMIND_SCENARIO_SEED", "SHELFMIND_DEMO_SEED"),
    )

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @cached_property
    def sqlalchemy_database_url(self) -> str:
        url = self.database_url.strip()
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+psycopg://", 1)
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+psycopg://", 1)
        return url

    @cached_property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @cached_property
    def is_sqlite(self) -> bool:
        return self.sqlalchemy_database_url.startswith("sqlite")


settings = Settings()
