"""End-to-end API smoke tests using httpx AsyncClient."""

from __future__ import annotations

import asyncio

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

CSV_BYTES = (
    b"ticket_id,first_name,last_name,dob\n"
    b"B24H011196,JESUS,PARRA,10/16/1998\n"
    b"B25W010815,JONATHAN,TORRES,11/11/1990\n"
)


@pytest.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        # Trigger lifespan startup
        async with app.router.lifespan_context(app):
            yield c


async def test_health(client: AsyncClient):
    r = await client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["scraper_mode"] in {"mock", "real"}


async def test_create_job_then_poll(client: AsyncClient):
    r = await client.post(
        "/jobs",
        files={"file": ("tickets.csv", CSV_BYTES, "text/csv")},
    )
    assert r.status_code == 202, r.text
    body = r.json()
    job_id = body["job_id"]
    assert body["total_tickets"] == 2

    # Wait for completion (mock latency ~0.4–1.8s × 2 tickets)
    for _ in range(50):  # ≤10s
        r = await client.get(f"/jobs/{job_id}")
        snap = r.json()
        if snap["status"] in {"completed", "failed"}:
            break
        await asyncio.sleep(0.2)

    assert snap["status"] == "completed"
    assert snap["progress"] == 2


async def test_invalid_csv_rejected(client: AsyncClient):
    r = await client.post(
        "/jobs",
        files={"file": ("bad.csv", b"foo,bar\n1,2\n", "text/csv")},
    )
    assert r.status_code == 400
    assert "missing required columns" in r.json()["detail"]["message"].lower()


async def test_oversize_upload_rejected(client: AsyncClient):
    big = b"ticket_id,first_name,last_name,dob\n" + b"x" * (6 * 1024 * 1024)
    r = await client.post(
        "/jobs",
        files={"file": ("big.csv", big, "text/csv")},
    )
    assert r.status_code == 413
    assert r.json()["detail"]["error"] == "file_too_large"
