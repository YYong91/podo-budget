"""월간 결산 리포트용 날짜/시간대 헬퍼"""

from datetime import date, datetime, timedelta, timezone

# KST = UTC+9
_KST = timezone(timedelta(hours=9))


def previous_month_kst() -> str:
    """현재 KST 기준 직전 마감 월을 YYYY-MM 형식으로 반환"""
    now_kst = datetime.now(_KST)
    if now_kst.month == 1:
        return f"{now_kst.year - 1}-12"
    return f"{now_kst.year}-{now_kst.month - 1:02d}"


def current_month_kst() -> str:
    """현재 KST 기준 현재 월을 YYYY-MM 형식으로 반환"""
    now_kst = datetime.now(_KST)
    return f"{now_kst.year}-{now_kst.month:02d}"


def month_boundaries(month: str) -> tuple[date, date]:
    """YYYY-MM → (시작일 inclusive, 종료일 exclusive) 반환"""
    year, mon = map(int, month.split("-"))
    start = date(year, mon, 1)
    end = date(year + 1, 1, 1) if mon == 12 else date(year, mon + 1, 1)
    return start, end


def month_str_from_date(d: date) -> str:
    """date → YYYY-MM 형식"""
    return f"{d.year}-{d.month:02d}"
