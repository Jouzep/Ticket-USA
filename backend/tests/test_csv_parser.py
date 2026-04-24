from datetime import date

import pytest

from app.core.csv_parser import CsvParseError, parse_csv


def test_parse_valid_csv():
    content = (
        b"ticket_id,first_name,last_name,dob\n"
        b"B24H011196,JESUS,PARRA,10/16/1998\n"
        b"B25W010815,JONATHAN,TORRES,11/11/1990\n"
    )
    tickets, errors = parse_csv(content)
    assert len(tickets) == 2
    assert not errors
    assert tickets[0].ticket_id == "B24H011196"
    assert tickets[0].dob == date(1998, 10, 16)


def test_parse_handles_bom():
    content = b"\xef\xbb\xbfticket_id,first_name,last_name,dob\nA1,JOHN,DOE,1/1/1990\n"
    tickets, _ = parse_csv(content)
    assert len(tickets) == 1
    assert tickets[0].ticket_id == "A1"


def test_parse_iso_date():
    content = b"ticket_id,first_name,last_name,dob\nA1,JOHN,DOE,1990-01-01\n"
    tickets, errors = parse_csv(content)
    assert len(tickets) == 1
    assert not errors
    assert tickets[0].dob == date(1990, 1, 1)


def test_missing_columns_raises():
    content = b"ticket_id,first_name\nA1,JOHN\n"
    with pytest.raises(CsvParseError):
        parse_csv(content)


def test_empty_file_raises():
    with pytest.raises(CsvParseError):
        parse_csv(b"")


def test_bad_row_collected_as_error():
    content = (
        b"ticket_id,first_name,last_name,dob\n"
        b"A1,JOHN,DOE,not-a-date\n"
        b"A2,JANE,DOE,1/1/1990\n"
    )
    tickets, errors = parse_csv(content)
    assert len(tickets) == 1
    assert tickets[0].ticket_id == "A2"
    assert any(e.row == 2 for e in errors)


def test_max_rows_enforced():
    rows = b"ticket_id,first_name,last_name,dob\n" + b"".join(
        f"A{i},J,D,1/1/1990\n".encode() for i in range(10)
    )
    tickets, errors = parse_csv(rows, max_rows=5)
    assert len(tickets) == 5
    assert any("limit" in e.message for e in errors)
