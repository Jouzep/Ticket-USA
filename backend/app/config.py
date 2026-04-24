"""Application settings, loaded from environment variables."""

from __future__ import annotations

from enum import Enum
from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class ScraperMode(str, Enum):
    MOCK = "mock"
    REAL = "real"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_env: str = "development"
    log_level: str = "INFO"

    allowed_origins: str = "http://localhost:5173,http://localhost:3000,http://localhost:3001"
    # Regex fallback — covers any *.up.railway.app frontend without hardcoding
    allowed_origin_regex: str = r"https://.*\.up\.railway\.app"

    scraper_mode: ScraperMode = ScraperMode.MOCK
    browser_pool_size: int = Field(default=3, ge=1, le=10)
    scraper_page_timeout: int = Field(default=20, ge=5, le=120)
    scraper_navigation_timeout: int = Field(default=30, ge=5, le=120)

    max_tickets_per_job: int = Field(default=500, ge=1, le=10_000)
    job_ttl_seconds: int = Field(default=3600, ge=60)
    sse_heartbeat_interval: int = Field(default=15, ge=5, le=60)
    max_concurrent_scrapes: int = Field(default=5, ge=1, le=20)

    anthropic_api_key: str = ""
    claude_model: str = "claude-sonnet-4-6"
    claude_max_tokens: int = 1024

    @field_validator("allowed_origins")
    @classmethod
    def _strip_origins(cls, v: str) -> str:
        return ",".join(o.strip() for o in v.split(",") if o.strip())

    @property
    def origins_list(self) -> list[str]:
        return [o for o in self.allowed_origins.split(",") if o]

    @property
    def claude_enabled(self) -> bool:
        return bool(self.anthropic_api_key.strip())


@lru_cache
def get_settings() -> Settings:
    return Settings()
