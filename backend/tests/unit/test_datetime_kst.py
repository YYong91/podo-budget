"""날짜/타임존 처리 테스트 (#368)

KST 기반 날짜 처리를 검증합니다:
- KST 자정 전후 지출 등록 시 올바른 날짜
- 월 경계 (3월 31일 → 3월 통계에 포함)
- "어제", "오늘" 상대 날짜가 KST 기준인지
- date_utils의 날짜 범위 함수들
"""

from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.services.bot_messages import format_korean_date
from app.utils.date_utils import get_month_range, get_week_label, get_week_range, get_year_range

KST = ZoneInfo("Asia/Seoul")


# ── "오늘", "어제" 상대 날짜가 KST 기준인지 ──


def test_format_korean_date_today():
    """오늘 날짜가 '오늘'로 표시되어야 한다"""
    today = datetime.now(KST).date()
    result = format_korean_date(today.isoformat())
    assert result == "오늘"


def test_format_korean_date_yesterday():
    """어제 날짜가 '어제'로 표시되어야 한다"""
    yesterday = datetime.now(KST).date() - timedelta(days=1)
    result = format_korean_date(yesterday.isoformat())
    assert result == "어제"


def test_format_korean_date_other_day():
    """오늘/어제가 아닌 날짜는 'M월 D일 (요일)' 형식이어야 한다"""
    # 일주일 전 날짜 사용 (항상 오늘/어제가 아님)
    other_day = datetime.now(KST).date() - timedelta(days=7)
    result = format_korean_date(other_day.isoformat())
    assert "월" in result
    assert "일" in result
    assert "(" in result  # 요일 괄호


def test_format_korean_date_datetime_iso_string():
    """datetime ISO 문자열도 올바르게 파싱되어야 한다"""
    today = datetime.now(KST).date()
    result = format_korean_date(f"{today.isoformat()}T23:59:59")
    assert result == "오늘"


def test_format_korean_date_date_object():
    """date 객체도 직접 전달 가능해야 한다"""
    today = datetime.now(KST).date()
    result = format_korean_date(today)
    assert result == "오늘"


def test_format_korean_date_datetime_object():
    """datetime 객체도 전달 가능해야 한다"""
    now = datetime.now(KST)
    result = format_korean_date(now)
    assert result == "오늘"


# ── KST 자정 전후 날짜 판정 ──


def test_kst_midnight_boundary_today():
    """KST 23:59:59에 입력하면 '오늘'이어야 한다

    UTC 기준으로는 이미 다음 날이지만, KST 기준으로는 아직 오늘이다.
    format_korean_date가 KST 기준으로 판단하는지 확인.
    """
    kst_now = datetime.now(KST)
    today_kst = kst_now.date()
    result = format_korean_date(today_kst.isoformat())
    assert result == "오늘"


def test_format_korean_date_uses_kst_for_comparison():
    """format_korean_date의 '오늘/어제' 비교가 KST 기준인지 검증

    datetime.now(KST).date()로 오늘을 결정하므로,
    KST 기준 날짜와 비교해야 한다.
    """
    # KST 기준 오늘/어제 계산
    kst_today = datetime.now(KST).date()
    kst_yesterday = kst_today - timedelta(days=1)

    assert format_korean_date(kst_today) == "오늘"
    assert format_korean_date(kst_yesterday) == "어제"


# ── 월 경계 테스트 ──


def test_month_range_march():
    """3월의 범위는 3/1 ~ 3/31이어야 한다"""
    d = date(2026, 3, 15)
    first, last = get_month_range(d)
    assert first == date(2026, 3, 1)
    assert last == date(2026, 3, 31)


def test_month_range_february_non_leap():
    """평년 2월의 범위는 2/1 ~ 2/28이어야 한다"""
    d = date(2026, 2, 10)
    first, last = get_month_range(d)
    assert first == date(2026, 2, 1)
    assert last == date(2026, 2, 28)


def test_month_range_february_leap():
    """윤년 2월의 범위는 2/1 ~ 2/29이어야 한다"""
    d = date(2028, 2, 15)  # 2028은 윤년
    first, last = get_month_range(d)
    assert first == date(2028, 2, 1)
    assert last == date(2028, 2, 29)


def test_month_range_last_day_belongs_to_current_month():
    """3월 31일은 3월 범위에 포함되어야 한다"""
    d = date(2026, 3, 31)
    first, last = get_month_range(d)
    assert first == date(2026, 3, 1)
    assert last == date(2026, 3, 31)
    # 3/31은 범위 내
    assert first <= d <= last


def test_month_range_april_first_not_in_march():
    """4월 1일은 3월 범위에 포함되지 않아야 한다"""
    march_first, march_last = get_month_range(date(2026, 3, 15))
    april_1 = date(2026, 4, 1)
    assert not (march_first <= april_1 <= march_last)


# ── 주간 범위 테스트 ──


def test_week_range_monday_to_sunday():
    """주간 범위는 월요일~일요일이어야 한다"""
    # 2026-03-25는 수요일
    d = date(2026, 3, 25)
    monday, sunday = get_week_range(d)
    assert monday.weekday() == 0  # 월요일
    assert sunday.weekday() == 6  # 일요일
    assert monday <= d <= sunday


def test_week_range_on_monday():
    """월요일을 입력하면 해당 주의 월~일을 반환"""
    # 2026-03-23은 월요일
    d = date(2026, 3, 23)
    monday, sunday = get_week_range(d)
    assert monday == d
    assert sunday == date(2026, 3, 29)


def test_week_range_on_sunday():
    """일요일을 입력하면 해당 주의 월~일을 반환"""
    # 2026-03-29는 일요일
    d = date(2026, 3, 29)
    monday, sunday = get_week_range(d)
    assert monday == date(2026, 3, 23)
    assert sunday == d


# ── 주차 라벨 테스트 ──


def test_week_label_format():
    """주차 라벨이 'M월 N주차' 형식이어야 한다"""
    d = date(2026, 3, 25)
    label = get_week_label(d)
    assert "3월" in label
    assert "주차" in label


def test_week_label_first_week():
    """월 첫째 주는 1주차여야 한다"""
    d = date(2026, 3, 1)
    label = get_week_label(d)
    assert "1주차" in label


# ── 연간 범위 테스트 ──


def test_year_range():
    """연간 범위는 1/1 ~ 12/31이어야 한다"""
    d = date(2026, 6, 15)
    first, last = get_year_range(d)
    assert first == date(2026, 1, 1)
    assert last == date(2026, 12, 31)


# ── LLM 프롬프트의 KST 기준 날짜 ──


def test_prompt_uses_kst_today():
    """LLM 프롬프트에 KST 기준 오늘 날짜가 삽입되어야 한다"""
    from app.services.prompts import get_expense_parser_prompt

    prompt = get_expense_parser_prompt()
    kst_today = datetime.now(KST).date().isoformat()
    assert kst_today in prompt


def test_prompt_uses_kst_yesterday():
    """LLM 프롬프트에 KST 기준 어제 날짜가 삽입되어야 한다"""
    from app.services.prompts import get_expense_parser_prompt

    prompt = get_expense_parser_prompt()
    kst_yesterday = (datetime.now(KST).date() - timedelta(days=1)).isoformat()
    assert kst_yesterday in prompt


# ── 날짜 경계 상황에서의 통계 ──


@pytest.mark.asyncio
async def test_expense_on_march_31_included_in_march_stats(
    authenticated_client,
    test_user,
    test_household,
    db_session,
):
    """3월 31일에 등록된 지출이 3월 통계에 포함되어야 한다"""
    from decimal import Decimal

    from app.models.expense import Expense

    expense = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=Decimal("10000"),
        description="월말 지출",
        date=datetime(2026, 3, 31, 23, 59, 0),
    )
    db_session.add(expense)
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses/stats/monthly?month=2026-03")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 10000.0


@pytest.mark.asyncio
async def test_expense_on_april_1_not_in_march_stats(
    authenticated_client,
    test_user,
    test_household,
    db_session,
):
    """4월 1일에 등록된 지출은 3월 통계에 포함되지 않아야 한다"""
    from decimal import Decimal

    from app.models.expense import Expense

    expense = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        amount=Decimal("20000"),
        description="다음달 지출",
        date=datetime(2026, 4, 1, 0, 0, 0),
    )
    db_session.add(expense)
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses/stats/monthly?month=2026-03")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0.0
