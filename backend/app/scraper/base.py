"""Scraper protocol — all scrapers must implement this."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Protocol

from app.models.schemas import TicketInput, TicketResult


class ScrapeOutcome(str, Enum):
    FOUND = "found"
    NOT_FOUND = "not_found"
    ERROR = "error"
    CAPTCHA_BLOCKED = "captcha_blocked"


@dataclass(slots=True)
class ScrapeResponse:
    outcome: ScrapeOutcome
    ticket_id: str
    result: TicketResult | None = None
    error: str | None = None


class BaseScraper(Protocol):
    """Interface every concrete scraper implementation must satisfy."""

    async def scrape(self, ticket: TicketInput) -> ScrapeResponse: ...

    async def close(self) -> None: ...
