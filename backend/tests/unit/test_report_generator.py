"""report_generator 단위 테스트

LLM 호출과 DB 상태 전이를 담당하는 서비스의 핵심 로직을 검증합니다.
run_llm_for_report는 LLM 의존성이 있어 단위 테스트 대상에서 제외합니다.
"""

import pytest

from app.services.report_generator import _truncate_error, mark_completed, mark_failed


def test_truncate_error_long_message():
    """2000자 초과 에러 메시지는 잘린다"""
    long_msg = "x" * 3000
    result = _truncate_error(long_msg)
    assert len(result) <= 2000


def test_truncate_error_short_message():
    """2000자 이하 메시지는 그대로 반환한다"""
    msg = "short error"
    assert _truncate_error(msg) == msg


def test_truncate_error_exactly_max():
    """정확히 2000자는 잘리지 않는다"""
    msg = "x" * 2000
    result = _truncate_error(msg)
    assert result == msg
    assert len(result) == 2000


@pytest.mark.asyncio
async def test_mark_failed_updates_status(db_session, test_household, test_user):
    """mark_failed 호출 시 status=failed, last_error 갱신된다"""
    from app.models.monthly_report import MonthlyReport

    report = MonthlyReport(
        household_id=test_household.id,
        month="2026-03",
        status="processing",
        report_data={},
        attempt_count=1,
    )
    db_session.add(report)
    await db_session.commit()

    await mark_failed(db_session, report.id, "LLM timeout")
    await db_session.refresh(report)

    assert report.status == "failed"
    assert "LLM timeout" in report.last_error


@pytest.mark.asyncio
async def test_mark_failed_truncates_long_error(db_session, test_household, test_user):
    """mark_failed는 긴 에러 메시지를 2000자로 잘라 저장한다"""
    from app.models.monthly_report import MonthlyReport

    report = MonthlyReport(
        household_id=test_household.id,
        month="2026-04",
        status="processing",
        report_data={},
        attempt_count=1,
    )
    db_session.add(report)
    await db_session.commit()

    long_error = "e" * 3000
    await mark_failed(db_session, report.id, long_error)
    await db_session.refresh(report)

    assert report.status == "failed"
    assert len(report.last_error) <= 2000


@pytest.mark.asyncio
async def test_mark_completed_updates_status(db_session, test_household, test_user):
    """mark_completed 호출 시 status=completed, insights 저장, completed_at 설정된다"""
    from app.models.monthly_report import MonthlyReport

    report = MonthlyReport(
        household_id=test_household.id,
        month="2026-05",
        status="processing",
        report_data={},
        attempt_count=1,
    )
    db_session.add(report)
    await db_session.commit()

    insights = {"summary": "테스트 인사이트", "health_score": 80}
    await mark_completed(db_session, report.id, insights)
    await db_session.refresh(report)

    assert report.status == "completed"
    assert report.insights == insights
    assert report.completed_at is not None
