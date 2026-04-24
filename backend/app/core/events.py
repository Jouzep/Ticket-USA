"""Scraping event types emitted over SSE.

Each event has a monotonically-increasing integer id per job, enabling
Last-Event-ID replay on reconnect.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class EventType(str, Enum):
    # Job lifecycle
    JOB_STARTED = "job.started"
    JOB_PROGRESS = "job.progress"
    JOB_COMPLETE = "job.complete"
    JOB_CANCELLED = "job.cancelled"
    JOB_FAILED = "job.failed"

    # Per-ticket
    TICKET_SEARCHING = "ticket.searching"
    TICKET_FOUND = "ticket.found"
    TICKET_NOT_FOUND = "ticket.not_found"
    TICKET_ERROR = "ticket.error"
    TICKET_CAPTCHA_BLOCKED = "ticket.captcha_blocked"


TERMINAL_EVENTS = frozenset(
    {EventType.JOB_COMPLETE, EventType.JOB_CANCELLED, EventType.JOB_FAILED}
)


@dataclass(slots=True)
class Event:
    """A single SSE event, serializable to the ServerSentEvent wire format."""

    id: int
    type: EventType
    data: dict[str, Any] = field(default_factory=dict)

    @property
    def data_json(self) -> str:
        return json.dumps(self.data, default=str, separators=(",", ":"))

    def to_sse(self) -> dict[str, str]:
        """Convert to the dict format expected by sse-starlette."""
        return {
            "id": str(self.id),
            "event": self.type.value,
            "data": self.data_json,
        }
