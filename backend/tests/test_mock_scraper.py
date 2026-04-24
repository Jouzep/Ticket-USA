from datetime import date

from app.models.schemas import TicketInput
from app.scraper.base import ScrapeOutcome
from app.scraper.mock_scraper import MockScraper


def _ticket(tid: str = "B24H011196") -> TicketInput:
    return TicketInput(
        ticket_id=tid, first_name="JESUS", last_name="PARRA", dob=date(1998, 10, 16)
    )


async def test_mock_returns_response():
    scraper = MockScraper(seed=42, base_delay=0.0)
    response = await scraper.scrape(_ticket())
    assert response.ticket_id == "B24H011196"
    assert response.outcome in ScrapeOutcome


async def test_mock_is_deterministic():
    s1 = MockScraper(seed=42, base_delay=0.0)
    s2 = MockScraper(seed=42, base_delay=0.0)
    r1 = await s1.scrape(_ticket("ABC123"))
    r2 = await s2.scrape(_ticket("ABC123"))
    assert r1.outcome == r2.outcome
    if r1.outcome == ScrapeOutcome.FOUND:
        assert r1.result is not None and r2.result is not None
        assert r1.result.fine_amount == r2.result.fine_amount


async def test_mock_distribution_reasonable():
    scraper = MockScraper(seed=1, base_delay=0.0)
    outcomes = []
    for i in range(50):
        r = await scraper.scrape(_ticket(f"T{i:04d}"))
        outcomes.append(r.outcome)
    # Most should be FOUND (~85%)
    found = sum(1 for o in outcomes if o == ScrapeOutcome.FOUND)
    assert found >= 30
