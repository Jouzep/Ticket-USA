"""Shared test fixtures."""

from __future__ import annotations

from datetime import date

import pytest

from app.models.schemas import TicketInput


@pytest.fixture
def sample_ticket() -> TicketInput:
    return TicketInput(
        ticket_id="B24H011196",
        first_name="JESUS",
        last_name="PARRA",
        dob=date(1998, 10, 16),
    )


@pytest.fixture
def sample_tickets() -> list[TicketInput]:
    return [
        TicketInput(
            ticket_id=f"T{i:04d}",
            first_name="A",
            last_name="B",
            dob=date(1990, 1, 1),
        )
        for i in range(3)
    ]
