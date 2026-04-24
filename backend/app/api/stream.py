"""SSE stream endpoint with Last-Event-ID replay."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator

from fastapi import APIRouter, HTTPException, Request
from sse_starlette.sse import EventSourceResponse

from app.api.deps import JobStoreDep, SettingsDep
from app.core.events import TERMINAL_EVENTS

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["stream"])

# 32-bit signed cap — defends against absurd Last-Event-ID input
_MAX_EVENT_ID = 2**31


def _parse_last_event_id(raw: str | None) -> int | None:
    if not raw or not raw.isdigit():
        return None
    value = int(raw)
    return value if 0 <= value < _MAX_EVENT_ID else None


@router.get("/{job_id}/stream")
async def stream_job(
    job_id: str,
    request: Request,
    store: JobStoreDep,
    settings: SettingsDep,
) -> EventSourceResponse:
    job = store.get(job_id)
    if job is None:
        raise HTTPException(404, detail={"error": "not_found"})

    last_id = _parse_last_event_id(request.headers.get("last-event-id"))
    queue = await job.subscribe(last_event_id=last_id)

    async def event_generator() -> AsyncIterator[dict[str, str]]:
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                except TimeoutError:
                    continue

                yield event.to_sse()

                if event.type in TERMINAL_EVENTS:
                    break
        finally:
            await job.unsubscribe(queue)

    return EventSourceResponse(
        event_generator(),
        ping=settings.sse_heartbeat_interval,
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
