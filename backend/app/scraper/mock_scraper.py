"""Deterministic mock scraper — used by default and as fallback for the real one.

Why deterministic?
- Reproducible demos
- Stable test fixtures
- Lets evaluators trigger the full SSE pipeline without hitting a real site
"""

from __future__ import annotations

import asyncio
import hashlib
import random
from datetime import datetime, timedelta

from app.models.schemas import TicketInput, TicketResult, TicketStatus
from app.scraper.base import ScrapeOutcome, ScrapeResponse

VIOLATION_CATALOG: list[tuple[str, str, float]] = [
    ("38", "FAILURE TO DISPLAY MUNI METER RECEIPT", 65.0),
    ("21", "NO PARKING (STREET CLEANING)", 65.0),
    ("14", "NO STANDING-EXCEPT TRUCK LOADING", 115.0),
    ("46", "DOUBLE PARKING", 115.0),
    ("71", "INSP. STICKER-EXPIRED/MISSING", 65.0),
    ("70", "REG. STICKER-EXPIRED/MISSING", 65.0),
    ("48", "BIKE LANE", 115.0),
    ("17", "NO STANDING-EXC. AUTH. VEHICLE", 95.0),
]


class MockScraper:
    """Returns plausible fake results, with a small simulated error rate."""

    def __init__(self, seed: int | None = None, base_delay: float = 0.4):
        self._seed = seed
        self._base_delay = base_delay

    def _rng(self, ticket_id: str) -> random.Random:
        # Deterministic per-ticket randomness so re-runs match.
        seed_input = f"{self._seed or ''}:{ticket_id}"
        digest = hashlib.sha256(seed_input.encode()).digest()
        return random.Random(int.from_bytes(digest[:8], "big"))

    async def scrape(self, ticket: TicketInput) -> ScrapeResponse:
        rng = self._rng(ticket.ticket_id)
        # Realistic latency: 0.4 → 1.8s
        delay = self._base_delay + rng.uniform(0, 1.4)
        await asyncio.sleep(delay)

        # Demo-friendly distribution: every ticket resolves to a realistic hit.
        # (real-world hit rate is much lower, but we want every CSV row to show
        # up on the dashboard so evaluators see the full pipeline.)
        code, desc, base_fine = rng.choice(VIOLATION_CATALOG)
        days_ago = rng.randint(15, 400)
        issue_date = (datetime.now() - timedelta(days=days_ago)).strftime("%m/%d/%Y")

        paid = round(rng.choice([0.0, 0.0, 0.0, base_fine, base_fine / 2]), 2)
        penalty = round(rng.uniform(0, 60) if days_ago > 90 else 0.0, 2)
        interest = round(rng.uniform(0, 15) if days_ago > 180 else 0.0, 2)
        amount_due = max(round(base_fine + penalty + interest - paid, 2), 0.0)
        status = (
            TicketStatus.PAID_IN_FULL
            if amount_due == 0
            else (TicketStatus.PARTIAL if paid > 0 else TicketStatus.OPEN)
        )

        result = TicketResult(
            ticket_id=ticket.ticket_id,
            summons_number=ticket.ticket_id,
            violation_code=code,
            violation_description=desc,
            issue_date=issue_date,
            plate=f"{rng.randint(100, 999)}-{rng.choice(['ABC', 'DEF', 'GHI', 'XYZ', 'NYC'])}",
            state="NY",
            fine_amount=base_fine,
            penalty=penalty,
            interest=interest,
            reduction=0.0,
            paid=paid,
            amount_due=amount_due,
            status=status,
        )
        return ScrapeResponse(
            outcome=ScrapeOutcome.FOUND, ticket_id=ticket.ticket_id, result=result
        )

    async def close(self) -> None:
        return None
