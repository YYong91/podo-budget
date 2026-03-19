"""날짜 유틸리티 함수

expenses.py와 income.py에서 공통으로 사용하는 날짜 범위/라벨 함수 (#199)
"""

from calendar import monthrange
from datetime import date, timedelta


def get_week_range(d: date) -> tuple[date, date]:
    """주어진 날짜가 속한 주의 월요일~일요일 반환"""
    monday = d - timedelta(days=d.weekday())
    sunday = monday + timedelta(days=6)
    return monday, sunday


def get_week_label(d: date) -> str:
    """주차 라벨 생성 (예: '2월 3주차')"""
    first_day = d.replace(day=1)
    week_num = (d.day + first_day.weekday() - 1) // 7 + 1
    return f"{d.month}월 {week_num}주차"


def get_month_range(d: date) -> tuple[date, date]:
    """주어진 날짜가 속한 월의 첫날~마지막날 반환"""
    first = d.replace(day=1)
    _, last_day = monthrange(d.year, d.month)
    last = d.replace(day=last_day)
    return first, last


def get_year_range(d: date) -> tuple[date, date]:
    """주어진 날짜가 속한 연도의 첫날~마지막날 반환"""
    return date(d.year, 1, 1), date(d.year, 12, 31)
