"""Async Playwright browser pool with crash recovery.

Pages are reused across scrapes for ~5× speedup over per-request browser launches.
On exception, the page is closed and a fresh one is created before being returned.

Stealth init script is applied per-page at creation, eliminating any race on
shared "stealth_applied" flags.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from playwright.async_api import Browser, Error as PlaywrightError, Page, Playwright, async_playwright

logger = logging.getLogger(__name__)

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/130.0.0.0 Safari/537.36"
)

_STEALTH_INIT_JS = """
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
Object.defineProperty(navigator, 'plugins',   { get: () => [1, 2, 3, 4, 5] });
Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
window.chrome = { runtime: {} };
"""


class BrowserPool:
    def __init__(self, size: int = 3, *, stealth: bool = True) -> None:
        self._size = size
        self._pool: asyncio.Queue[Page] = asyncio.Queue()
        self._playwright: Playwright | None = None
        self._browser: Browser | None = None
        self._stealth = stealth
        self._started = False

    async def startup(self) -> None:
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        for _ in range(self._size):
            page = await self._fresh_page()
            await self._pool.put(page)
        self._started = True
        logger.info("Browser pool started", extra={"size": self._size})

    async def _fresh_page(self) -> Page:
        if self._browser is None:
            raise RuntimeError("Browser not initialized")
        context = await self._browser.new_context(user_agent=_USER_AGENT)
        page = await context.new_page()
        if self._stealth:
            await page.add_init_script(_STEALTH_INIT_JS)
        return page

    @asynccontextmanager
    async def acquire(self) -> AsyncIterator[Page]:
        if not self._started:
            raise RuntimeError("BrowserPool not started")
        page = await self._pool.get()
        crashed = False
        try:
            yield page
        except (PlaywrightError, asyncio.TimeoutError):
            crashed = True
            raise
        finally:
            if crashed:
                await self._recycle(page)
            else:
                await self._pool.put(page)

    async def _recycle(self, page: Page) -> None:
        try:
            await page.context.close()
        except PlaywrightError as exc:
            logger.debug("Page close on crash failed", exc_info=exc)
        try:
            replacement = await self._fresh_page()
        except PlaywrightError as exc:
            logger.error("Failed to create replacement page", exc_info=exc)
            return
        await self._pool.put(replacement)

    async def shutdown(self) -> None:
        if self._browser:
            try:
                await self._browser.close()
            except PlaywrightError as exc:
                logger.debug("Browser close error", exc_info=exc)
        if self._playwright:
            try:
                await self._playwright.stop()
            except PlaywrightError as exc:
                logger.debug("Playwright stop error", exc_info=exc)
        self._started = False
        logger.info("Browser pool shut down")
