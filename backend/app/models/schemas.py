"""Pydantic schemas — the single source of truth for API contracts."""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ─────────────────────────────────────────────────────────────
# Input — CSV rows
# ─────────────────────────────────────────────────────────────

# Date input formats accepted from CSV (portable — no glibc-only directives)
_DOB_FORMATS = ("%m/%d/%Y", "%Y-%m-%d", "%m-%d-%Y")


class TicketInput(BaseModel):
    """A single ticket from the uploaded CSV."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        strict=False,  # Coerce strings → dates; CSV is always strings
        extra="forbid",
    )

    ticket_id: Annotated[str, Field(min_length=1, max_length=32)]
    first_name: Annotated[str, Field(min_length=1, max_length=64)]
    last_name: Annotated[str, Field(min_length=1, max_length=64)]
    dob: date

    @field_validator("ticket_id")
    @classmethod
    def _ticket_id_clean(cls, v: str) -> str:
        v = v.strip().upper()
        if not v:
            raise ValueError("ticket_id cannot be empty")
        return v

    @field_validator("dob", mode="before")
    @classmethod
    def _parse_dob(cls, v: str | date) -> date:
        if isinstance(v, date):
            return v
        if not isinstance(v, str):
            raise ValueError(f"dob must be a string or date, got {type(v).__name__}")
        v = v.strip()
        for fmt in _DOB_FORMATS:
            try:
                return datetime.strptime(v, fmt).date()
            except ValueError:
                continue
        # Last-ditch: split and normalize a `M/D/YYYY` style without zero-padding
        try:
            parts = v.replace("-", "/").split("/")
            if len(parts) == 3:
                m, d, y = parts
                return date(int(y), int(m), int(d))
        except (ValueError, TypeError) as exc:
            raise ValueError(f"Invalid date format: {v!r} (expected M/D/YYYY)") from exc
        raise ValueError(f"Invalid date format: {v!r} (expected M/D/YYYY)")


class CsvValidationError(BaseModel):
    model_config = ConfigDict(extra="forbid")
    row: int
    field: str | None = None
    message: str


# ─────────────────────────────────────────────────────────────
# Ticket scraping result
# ─────────────────────────────────────────────────────────────

class TicketStatus(str, Enum):
    OPEN = "OPEN"
    PAID_IN_FULL = "PAID IN FULL"
    PARTIAL = "PARTIAL"
    DISMISSED = "DISMISSED"
    UNKNOWN = "UNKNOWN"


class TicketResult(BaseModel):
    """Fully-parsed ticket details returned by the scraper."""

    model_config = ConfigDict(
        str_strip_whitespace=True,
        extra="forbid",
        validate_assignment=True,
    )

    ticket_id: str
    summons_number: str | None = None
    violation_code: str | None = None
    violation_description: str | None = None
    issue_date: str | None = None
    plate: str | None = None
    state: str | None = None
    fine_amount: float = 0.0
    penalty: float = 0.0
    interest: float = 0.0
    reduction: float = 0.0
    paid: float = 0.0
    amount_due: float = 0.0
    status: TicketStatus = TicketStatus.UNKNOWN


# ─────────────────────────────────────────────────────────────
# Job lifecycle
# ─────────────────────────────────────────────────────────────

class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    FAILED = "failed"


class JobSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")
    total: int = 0
    found: int = 0
    not_found: int = 0
    errors: int = 0
    captcha_blocked: int = 0
    total_amount_due: float = 0.0


class JobSnapshot(BaseModel):
    """Public view of a job returned by GET /jobs/:id."""

    model_config = ConfigDict(extra="forbid")

    id: str
    status: JobStatus
    total_tickets: int
    progress: int
    created_at: datetime
    completed_at: datetime | None = None
    summary: JobSummary
    results: list[TicketResult] = Field(default_factory=list)


class JobCreateResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_id: str
    total_tickets: int
    status: JobStatus


# ─────────────────────────────────────────────────────────────
# API errors
# ─────────────────────────────────────────────────────────────

class ValidationErrorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    error: str = "validation_failed"
    message: str
    details: list[CsvValidationError] = Field(default_factory=list)
