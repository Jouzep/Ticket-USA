"""CSV parser for ticket uploads, with robust encoding detection."""

from __future__ import annotations

import csv
import io

from charset_normalizer import from_bytes
from pydantic import ValidationError

from app.models.schemas import CsvValidationError, TicketInput

REQUIRED_COLUMNS = {"ticket_id", "first_name", "last_name", "dob"}


class CsvParseError(Exception):
    """Raised when the CSV cannot be processed at all (encoding, structure)."""


def _decode(content: bytes) -> str:
    """Decode bytes, trying UTF-8 first then falling back to detection."""
    if not content:
        raise CsvParseError("Empty file")
    # Strip BOM
    if content[:3] == b"\xef\xbb\xbf":
        content = content[3:]
    try:
        return content.decode("utf-8")
    except UnicodeDecodeError:
        best = from_bytes(content).best()
        if best is None:
            raise CsvParseError("Unable to detect file encoding") from None
        return str(best)


def parse_csv(
    content: bytes, max_rows: int = 500
) -> tuple[list[TicketInput], list[CsvValidationError]]:
    """Parse a CSV payload into ticket inputs plus per-row errors.

    Returns:
        (valid_tickets, errors)
        - If headers are missing, raises CsvParseError.
        - Row-level errors are collected; valid rows still returned.
        - Hard-caps at `max_rows`.
    """
    text = _decode(content)
    reader = csv.DictReader(io.StringIO(text))
    headers = {h.strip().lower() for h in (reader.fieldnames or [])}
    missing = REQUIRED_COLUMNS - headers
    if missing:
        raise CsvParseError(
            f"Missing required columns: {', '.join(sorted(missing))}. "
            f"Expected: {', '.join(sorted(REQUIRED_COLUMNS))}"
        )

    tickets: list[TicketInput] = []
    errors: list[CsvValidationError] = []

    for row_index, raw_row in enumerate(reader, start=2):  # row 1 is the header
        if row_index - 1 > max_rows:
            errors.append(
                CsvValidationError(
                    row=row_index,
                    message=f"Row limit of {max_rows} reached; remaining rows ignored",
                )
            )
            break

        # Normalize keys to lower-case for robustness
        normalized = {(k or "").strip().lower(): (v or "").strip() for k, v in raw_row.items()}

        if not any(normalized.get(c) for c in REQUIRED_COLUMNS):
            # Skip fully-blank rows silently
            continue

        try:
            tickets.append(TicketInput(**{k: normalized.get(k, "") for k in REQUIRED_COLUMNS}))
        except ValidationError as exc:
            for err in exc.errors():
                errors.append(
                    CsvValidationError(
                        row=row_index,
                        field=".".join(str(p) for p in err.get("loc", [])) or None,
                        message=err.get("msg", "invalid value"),
                    )
                )

    return tickets, errors
