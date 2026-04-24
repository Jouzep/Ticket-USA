"""FastAPI application entrypoint."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api import health, jobs, stream
from app.config import ScraperMode, get_settings
from app.core.job_store import JobStore
from app.scraper.base import BaseScraper
from app.scraper.mock_scraper import MockScraper

logger = logging.getLogger(__name__)


def _setup_logging(level: str) -> None:
    logging.basicConfig(
        level=level.upper(),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    _setup_logging(settings.log_level)
    logger.info(
        "backend.startup",
        extra={
            "version": __version__,
            "mode": settings.scraper_mode.value,
            "claude_enabled": settings.claude_enabled,
        },
    )

    store = JobStore(ttl_seconds=settings.job_ttl_seconds)
    await store.start_sweeper(interval_seconds=300)
    app.state.job_store = store

    # Mock is always available (no external deps)
    scrapers: dict[ScraperMode, BaseScraper] = {
        ScraperMode.MOCK: MockScraper(seed=42),
    }
    app.state.browser_pool = None

    # Real DMV scraper — only when explicitly enabled (Playwright is heavy)
    if settings.scraper_mode == ScraperMode.REAL:
        from app.scraper.browser_pool import BrowserPool
        from app.scraper.dmv_scraper import DmvScraper

        pool = BrowserPool(size=settings.browser_pool_size)
        await pool.startup()
        app.state.browser_pool = pool
        scrapers[ScraperMode.REAL] = DmvScraper(
            pool=pool,
            page_timeout_ms=settings.scraper_page_timeout * 1000,
        )

    app.state.scrapers = scrapers
    # Keep `scraper` set to the "default" picked in config so existing code
    # that still uses the singleton keeps working.
    app.state.scraper = scrapers.get(settings.scraper_mode, scrapers[ScraperMode.MOCK])

    try:
        yield
    finally:
        logger.info("backend.shutdown")
        await store.stop_sweeper()
        if app.state.browser_pool is not None:
            await app.state.browser_pool.shutdown()


def create_app() -> FastAPI:
    """Application factory — preferred over module-level globals for testability."""
    settings = get_settings()
    app = FastAPI(
        title="WINIT NY Parking Ticket Tracker",
        version=__version__,
        description="Real-time async scraping pipeline with SSE streaming.",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.origins_list,
        allow_origin_regex=settings.allowed_origin_regex or None,
        allow_credentials=True,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["X-Job-Id"],
    )
    app.include_router(health.router)
    app.include_router(jobs.router)
    app.include_router(stream.router)

    @app.get("/")
    async def root() -> dict[str, str]:
        return {
            "service": "winit-backend",
            "version": __version__,
            "docs": "/docs",
        }

    return app


app = create_app()
