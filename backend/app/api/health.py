"""Health endpoints."""

from __future__ import annotations

from fastapi import APIRouter

from app import __version__
from app.api.deps import ScrapersDep, SettingsDep

router = APIRouter()


@router.get("/health")
async def health(settings: SettingsDep, scrapers: ScrapersDep) -> dict[str, object]:
    return {
        "status": "ok",
        "version": __version__,
        "scraper_mode": settings.scraper_mode.value,
        "available_modes": sorted(m.value for m in scrapers),
        "claude_enabled": settings.claude_enabled,
    }
