from datetime import date

from app.services.report_month_utils import (
    month_boundaries,
    month_str_from_date,
    previous_month_kst,
)


def test_previous_month_kst_returns_yyyy_mm():
    result = previous_month_kst()
    assert len(result) == 7
    assert result[4] == "-"


def test_month_boundaries_april():
    start, end = month_boundaries("2026-04")
    assert start == date(2026, 4, 1)
    assert end == date(2026, 5, 1)


def test_month_boundaries_december():
    start, end = month_boundaries("2026-12")
    assert start == date(2026, 12, 1)
    assert end == date(2027, 1, 1)


def test_month_str_from_date():
    assert month_str_from_date(date(2026, 4, 15)) == "2026-04"
    assert month_str_from_date(date(2026, 1, 1)) == "2026-01"
