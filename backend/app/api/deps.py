"""FastAPI dependencies — keep `request.app.state` reads at the edge only."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request

from app.config import ScraperMode, Settings, get_settings
from app.core.job_store import JobStore
from app.scraper.base import BaseScraper


def get_job_store(request: Request) -> JobStore:
    return request.app.state.job_store  # type: ignore[no-any-return]


def get_scraper(request: Request) -> BaseScraper:
    return request.app.state.scraper  # type: ignore[no-any-return]


def get_scrapers(request: Request) -> dict[ScraperMode, BaseScraper]:
    return request.app.state.scrapers  # type: ignore[no-any-return]


SettingsDep = Annotated[Settings, Depends(get_settings)]
JobStoreDep = Annotated[JobStore, Depends(get_job_store)]
ScraperDep = Annotated[BaseScraper, Depends(get_scraper)]
ScrapersDep = Annotated[dict[ScraperMode, BaseScraper], Depends(get_scrapers)]
