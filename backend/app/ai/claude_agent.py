"""Claude-powered post-scrape analysis (disabled by default).

Two flows are wired but **not connected to the orchestrator yet** — to be
enabled when ANTHROPIC_API_KEY is set and a UI toggle requests AI analysis.

Flow 1 — `extract_ticket_fields(html)`:
    Uses Claude tool-use to parse messy DMV HTML into the strict TicketResult
    schema. Resilient to selector drift.

Flow 2 — `analyze_disputability(ticket)`:
    Returns a structured judgment on whether a ticket is contestable, with
    reasoning and confidence. Useful for fleet ops triage.
"""

from __future__ import annotations

import logging
from typing import Any

from app.config import Settings
from app.models.schemas import TicketResult

logger = logging.getLogger(__name__)


class ClaudeAgent:
    """Thin wrapper around the Anthropic SDK; no-op if no API key."""

    def __init__(self, settings: Settings):
        self._enabled = settings.claude_enabled
        self._model = settings.claude_model
        self._max_tokens = settings.claude_max_tokens
        self._client: Any | None = None
        if self._enabled:
            try:
                from anthropic import AsyncAnthropic

                self._client = AsyncAnthropic(api_key=settings.anthropic_api_key)
            except ImportError as exc:
                logger.warning("Anthropic SDK not installed; AI disabled", exc_info=exc)
                self._enabled = False
            except (ValueError, TypeError) as exc:
                logger.warning("Claude SDK init failed; AI disabled", exc_info=exc)
                self._enabled = False

    @property
    def enabled(self) -> bool:
        return self._enabled

    async def analyze_disputability(self, ticket: TicketResult) -> dict[str, Any] | None:
        """Return {disputable: bool, reasoning: str, confidence: float} or None."""
        if not self._enabled or self._client is None:
            return None
        # Stub — implementation deferred until UI toggle is wired.
        return None

    async def extract_ticket_fields(self, html: str, ticket_id: str) -> dict[str, Any] | None:
        """Use Claude tool-use to extract structured fields from DMV HTML."""
        if not self._enabled or self._client is None:
            return None
        # Stub — implementation deferred until DMV HTML samples are available.
        return None
