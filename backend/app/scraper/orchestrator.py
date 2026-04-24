"""Job orchestrator — runs scrapes for one job, emitting events as it goes.

Concurrency: bounded by `max_concurrent` semaphore (default 5). Browser-pool
size further constrains real-mode concurrency.

Cancellation: cooperative via `job.cancel_event`. Each in-flight scrape is
allowed to complete, but no new ones start once cancellation is requested.

Uses `asyncio.TaskGroup` (Python 3.11+) for structured concurrency: child
exceptions are aggregated and propagated correctly.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime

from app.core.events import EventType
from app.core.job_store import Job
from app.models.schemas import JobStatus, TicketInput
from app.scraper.base import BaseScraper, ScrapeOutcome, ScrapeResponse

logger = logging.getLogger(__name__)


async def run_job(job: Job, scraper: BaseScraper, max_concurrent: int = 5) -> None:
    """Drive a single job to completion or cancellation."""
    job.status = JobStatus.RUNNING
    await job.emit(EventType.JOB_STARTED, {"total": job.total_tickets})

    semaphore = asyncio.Semaphore(max_concurrent)

    async def scrape_one(index: int, ticket: TicketInput) -> None:
        async with semaphore:
            if job.cancel_event.is_set():
                return
            await job.emit(
                EventType.TICKET_SEARCHING,
                {
                    "ticket_id": ticket.ticket_id,
                    "index": index,
                    "total": job.total_tickets,
                },
            )
            response: ScrapeResponse | None = None
            try:
                response = await scraper.scrape(ticket)
            except asyncio.CancelledError:
                raise
            except (RuntimeError, ValueError, OSError, TimeoutError) as exc:
                logger.warning(
                    "Scrape failed",
                    extra={"ticket_id": ticket.ticket_id, "error": str(exc)},
                )
                await job.emit(
                    EventType.TICKET_ERROR,
                    {
                        "ticket_id": ticket.ticket_id,
                        "error": f"{type(exc).__name__}: {exc}",
                    },
                )
                job.summary.errors += 1
            else:
                await _emit_outcome(job, response)
            finally:
                job.progress += 1
                await job.emit(
                    EventType.JOB_PROGRESS,
                    {"completed": job.progress, "total": job.total_tickets},
                )

    cancelled = False
    failed_error: str | None = None

    try:
        async with asyncio.TaskGroup() as tg:
            for index, ticket in enumerate(job.tickets):
                tg.create_task(
                    scrape_one(index, ticket),
                    name=f"scrape:{ticket.ticket_id}",
                )
    except* asyncio.CancelledError:
        cancelled = True
    except* Exception as eg:  # noqa: BLE001 — supervisor must capture group
        first = eg.exceptions[0] if eg.exceptions else RuntimeError("unknown")
        logger.exception("Job failed", extra={"job_id": job.id})
        failed_error = f"{type(first).__name__}: {first}"

    if failed_error is not None:
        await _finalize(job, failed_error=failed_error)
    elif cancelled:
        await _finalize(job, cancelled=True)
        raise asyncio.CancelledError
    else:
        await _finalize(job, cancelled=job.cancel_event.is_set())


async def _emit_outcome(job: Job, response: ScrapeResponse) -> None:
    if response.outcome == ScrapeOutcome.FOUND and response.result:
        job.results.append(response.result)
        job.summary.found += 1
        job.summary.total_amount_due += response.result.amount_due
        await job.emit(
            EventType.TICKET_FOUND,
            {
                "ticket_id": response.ticket_id,
                "result": response.result.model_dump(mode="json"),
            },
        )
    elif response.outcome == ScrapeOutcome.NOT_FOUND:
        job.summary.not_found += 1
        await job.emit(
            EventType.TICKET_NOT_FOUND, {"ticket_id": response.ticket_id}
        )
    elif response.outcome == ScrapeOutcome.CAPTCHA_BLOCKED:
        job.summary.captcha_blocked += 1
        await job.emit(
            EventType.TICKET_CAPTCHA_BLOCKED,
            {"ticket_id": response.ticket_id, "error": response.error or "captcha"},
        )
    else:
        job.summary.errors += 1
        await job.emit(
            EventType.TICKET_ERROR,
            {"ticket_id": response.ticket_id, "error": response.error or "unknown"},
        )


async def _finalize(
    job: Job, *, cancelled: bool = False, failed_error: str | None = None
) -> None:
    job.completed_at = datetime.now(UTC)
    if failed_error:
        job.status = JobStatus.FAILED
        await job.emit(EventType.JOB_FAILED, {"error": failed_error})
    elif cancelled:
        job.status = JobStatus.CANCELLED
        await job.emit(EventType.JOB_CANCELLED, {})
    else:
        job.status = JobStatus.COMPLETED
        await job.emit(
            EventType.JOB_COMPLETE,
            {"summary": job.summary.model_dump(mode="json")},
        )
