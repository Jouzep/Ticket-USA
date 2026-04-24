"""Job CRUD endpoints (POST upload, GET snapshot, DELETE cancel)."""

from __future__ import annotations

import asyncio
import logging
from typing import Annotated

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile, status

from app.api.deps import JobStoreDep, ScrapersDep, SettingsDep
from app.config import ScraperMode
from app.core.csv_parser import CsvParseError, parse_csv
from app.models.schemas import (
    JobCreateResponse,
    JobSnapshot,
    ValidationErrorResponse,
)
from app.scraper.orchestrator import run_job

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["jobs"])

MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB


def _is_csv_filename(name: str | None) -> bool:
    if not name:
        return False
    if "\x00" in name or "/" in name or "\\" in name or ".." in name:
        return False
    return name.lower().endswith(".csv")


def _is_acceptable_content_type(ct: str | None) -> bool:
    if not ct:
        return True
    return ct in {"text/csv", "application/vnd.ms-excel", "application/octet-stream"}


@router.post(
    "",
    response_model=JobCreateResponse,
    status_code=status.HTTP_202_ACCEPTED,
    responses={
        400: {"model": ValidationErrorResponse},
        413: {"model": ValidationErrorResponse},
    },
)
async def create_job(
    settings: SettingsDep,
    store: JobStoreDep,
    scrapers: ScrapersDep,
    file: Annotated[UploadFile, File(...)],
    scraper_mode: Annotated[ScraperMode | None, Form()] = None,
    content_length: Annotated[int | None, Header(alias="content-length")] = None,
) -> JobCreateResponse:
    if content_length is not None and content_length > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail={
                "error": "file_too_large",
                "message": f"Max {MAX_UPLOAD_BYTES // (1024 * 1024)} MB",
            },
        )

    if not _is_acceptable_content_type(file.content_type) and not _is_csv_filename(
        file.filename
    ):
        raise HTTPException(
            status_code=400,
            detail={
                "error": "invalid_content_type",
                "message": f"Expected CSV file, got {file.content_type}",
            },
        )

    raw = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail={
                "error": "file_too_large",
                "message": f"Max {MAX_UPLOAD_BYTES // (1024 * 1024)} MB",
            },
        )

    try:
        tickets, errors = parse_csv(raw, max_rows=settings.max_tickets_per_job)
    except CsvParseError as exc:
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_csv", "message": str(exc)},
        ) from exc

    if not tickets:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "empty_csv",
                "message": "No valid rows found",
                "validation_errors": [e.model_dump(mode="json") for e in errors],
            },
        )

    # Pick the scraper for this job (frontend toggle) — fall back to backend default
    picked = scraper_mode or settings.scraper_mode
    scraper = scrapers.get(picked)
    if scraper is None:
        available = sorted(m.value for m in scrapers)
        raise HTTPException(
            status_code=400,
            detail={
                "error": "scraper_not_available",
                "message": (
                    f"Scraper mode '{picked.value}' not enabled on this server. "
                    f"Available: {available}"
                ),
            },
        )

    job = store.create(tickets)
    task = asyncio.create_task(
        run_job(job, scraper, max_concurrent=settings.max_concurrent_scrapes),
        name=f"job:{job.id}",
    )
    store.track_task(job.id, task)

    return JobCreateResponse(
        job_id=job.id,
        total_tickets=len(tickets),
        status=job.status,
    )


@router.get("/{job_id}", response_model=JobSnapshot)
async def get_job(job_id: str, store: JobStoreDep) -> JobSnapshot:
    job = store.get(job_id)
    if job is None:
        raise HTTPException(404, detail={"error": "not_found"})
    return JobSnapshot(
        id=job.id,
        status=job.status,
        total_tickets=job.total_tickets,
        progress=job.progress,
        created_at=job.created_at,
        completed_at=job.completed_at,
        summary=job.summary,
        results=job.results,
    )


@router.delete("/{job_id}", status_code=status.HTTP_202_ACCEPTED)
async def cancel_job(job_id: str, store: JobStoreDep) -> dict[str, str]:
    cancelled = await store.cancel(job_id)
    if not cancelled:
        raise HTTPException(
            404, detail={"error": "not_found_or_already_terminal"}
        )
    return {"status": "cancelling"}
