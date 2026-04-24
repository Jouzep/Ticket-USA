"""Real DMV scraper for process.dmv.ny.gov/WebSummonsInquiry/.

⚠️  Reality check (2026-04 confirmed by exploration):
   The DMV site is fronted by F5 BIG-IP / TSPD with multi-layer anti-bot:
     1. JS challenge (canvas fingerprint + obfuscated worker)
     2. Post-challenge IP reputation gate (returns ERR_EMPTY_RESPONSE)
     3. Headless browser fingerprint detection (TLS JA3, automation flags)

   Defeating it reliably requires residential proxies and hand-crafted
   stealth. That's out of scope for this challenge — the brief explicitly
   permits mocking when the target site blocks ("provided SSE logic is sound").

   Stealth is applied per-page at pool creation (see BrowserPool). This
   scraper detects every known block pattern and gracefully reports
   `CAPTCHA_BLOCKED` so the orchestrator can keep streaming.
"""

from __future__ import annotations

import logging

from bs4 import BeautifulSoup
from playwright.async_api import Error as PlaywrightError
from playwright.async_api import Page
from playwright.async_api import TimeoutError as PlaywrightTimeoutError

from app.models.schemas import TicketInput, TicketResult, TicketStatus
from app.scraper.base import ScrapeOutcome, ScrapeResponse
from app.scraper.browser_pool import BrowserPool

logger = logging.getLogger(__name__)

DMV_URL = "https://process.dmv.ny.gov/WebSummonsInquiry/"
DEFAULT_PAGE_TIMEOUT_MS = 20_000

# Markers that indicate the page hasn't actually loaded the form
BLOCK_MARKERS = (
    "Please enable JavaScript",
    "support ID",
    "bobcmn",
    "ERR_EMPTY_RESPONSE",
    "Cette page ne fonctionne pas",
)


class DmvScraper:
    def __init__(
        self,
        pool: BrowserPool,
        page_timeout_ms: int = DEFAULT_PAGE_TIMEOUT_MS,
    ):
        self._pool = pool
        self._timeout = page_timeout_ms

    async def scrape(self, ticket: TicketInput) -> ScrapeResponse:
        async with self._pool.acquire() as page:
            try:
                await page.goto(
                    DMV_URL, timeout=self._timeout, wait_until="domcontentloaded"
                )
            except (PlaywrightError, PlaywrightTimeoutError) as exc:
                logger.warning(
                    "DMV navigation failed",
                    extra={"ticket_id": ticket.ticket_id, "error": str(exc)},
                )
                return ScrapeResponse(
                    outcome=ScrapeOutcome.ERROR,
                    ticket_id=ticket.ticket_id,
                    error=f"navigation_failed: {type(exc).__name__}",
                )

            try:
                await page.wait_for_load_state("networkidle", timeout=self._timeout)
            except PlaywrightTimeoutError:
                # Networkidle is best-effort; carry on with whatever loaded
                pass

            html = await page.content()
            block_reason = self._detect_block(html)
            if block_reason:
                logger.info(
                    "DMV blocked",
                    extra={"ticket_id": ticket.ticket_id, "reason": block_reason},
                )
                return ScrapeResponse(
                    outcome=ScrapeOutcome.CAPTCHA_BLOCKED,
                    ticket_id=ticket.ticket_id,
                    error=block_reason,
                )

            if await self._has_captcha(page):
                return ScrapeResponse(
                    outcome=ScrapeOutcome.CAPTCHA_BLOCKED,
                    ticket_id=ticket.ticket_id,
                    error="CAPTCHA challenge detected",
                )

            try:
                if not await self._click_no_license(page):
                    return ScrapeResponse(
                        outcome=ScrapeOutcome.ERROR,
                        ticket_id=ticket.ticket_id,
                        error="no_license_option_not_found",
                    )

                if not await self._fill_form(page, ticket):
                    return ScrapeResponse(
                        outcome=ScrapeOutcome.ERROR,
                        ticket_id=ticket.ticket_id,
                        error="form_fields_not_found",
                    )

                await page.click("button[type=submit], input[type=submit]")
                await page.wait_for_load_state("networkidle", timeout=self._timeout)

                final_html = await page.content()
                if self._detect_block(final_html):
                    return ScrapeResponse(
                        outcome=ScrapeOutcome.CAPTCHA_BLOCKED,
                        ticket_id=ticket.ticket_id,
                        error="blocked_after_submit",
                    )
                return self._parse(final_html, ticket)

            except (PlaywrightError, PlaywrightTimeoutError) as exc:
                logger.warning(
                    "DMV scrape failed",
                    extra={"ticket_id": ticket.ticket_id, "error": str(exc)},
                )
                return ScrapeResponse(
                    outcome=ScrapeOutcome.ERROR,
                    ticket_id=ticket.ticket_id,
                    error=f"{type(exc).__name__}: {exc}",
                )

    def _detect_block(self, html: str) -> str | None:
        if not html or len(html) < 200:
            return "empty_response"
        for marker in BLOCK_MARKERS:
            if marker in html:
                return f"anti_bot_marker: {marker[:40]}"
        return None

    async def _has_captcha(self, page: Page) -> bool:
        for sel in (
            "iframe[src*='recaptcha']",
            "iframe[src*='hcaptcha']",
            "div.g-recaptcha",
            "[name*='captcha' i]",
        ):
            if await page.locator(sel).count():
                return True
        return False

    async def _click_no_license(self, page: Page) -> bool:
        candidates = (
            "text=No, I do not have a NY State license",
            "text=No, I do not have a NY State driver license",
            "input[value*='No' i][type='radio']",
        )
        for sel in candidates:
            try:
                loc = page.locator(sel).first
                if await loc.count():
                    await loc.click(timeout=3000)
                    return True
            except (PlaywrightError, PlaywrightTimeoutError):
                continue
        return False

    async def _fill_form(self, page: Page, ticket: TicketInput) -> bool:
        try:
            await page.fill(
                "input[name*='ticket' i], input[id*='ticket' i], input[name*='summons' i]",
                ticket.ticket_id,
                timeout=3000,
            )
            await page.fill(
                "input[name*='last' i], input[id*='last' i]",
                ticket.last_name,
                timeout=3000,
            )
            await page.fill(
                "input[name*='dob' i], input[name*='birth' i], input[id*='dob' i]",
                ticket.dob.strftime("%m/%d/%Y"),
                timeout=3000,
            )
        except (PlaywrightError, PlaywrightTimeoutError) as exc:
            logger.debug("Form fill failed", exc_info=exc)
            return False
        return True

    def _parse(self, html: str, ticket: TicketInput) -> ScrapeResponse:
        soup = BeautifulSoup(html, "lxml")
        text = soup.get_text(" ", strip=True).lower()

        if any(kw in text for kw in ("no record", "not found", "no summons")):
            return ScrapeResponse(
                outcome=ScrapeOutcome.NOT_FOUND, ticket_id=ticket.ticket_id
            )

        result = TicketResult(
            ticket_id=ticket.ticket_id,
            summons_number=ticket.ticket_id,
            status=TicketStatus.UNKNOWN,
        )
        return ScrapeResponse(
            outcome=ScrapeOutcome.FOUND, ticket_id=ticket.ticket_id, result=result
        )

    async def close(self) -> None:
        await self._pool.shutdown()
