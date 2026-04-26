"""LLM 호출 + MonthlyReport 상태 전이 서비스

흐름:
  run_llm_for_report(db, report)
    → format_insights_data_for_llm으로 텍스트 포맷
    → LLM generate_comprehensive_insights_v2 호출 (30초 타임아웃)
    → mark_completed (성공) 또는 mark_failed (실패)

mark_completed / mark_failed는 DB 상태 전이만 담당하며 단독으로도 호출 가능합니다.
"""

import asyncio
import logging
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.monthly_report import MonthlyReport

logger = logging.getLogger(__name__)

# LLM 응답 최대 대기 시간 (초)
LLM_TIMEOUT_SECONDS = 30

# last_error 컬럼 최대 길이 (MonthlyReport.last_error String(2000) 대응)
MAX_ERROR_LENGTH = 2000


def _truncate_error(msg: str, max_len: int = MAX_ERROR_LENGTH) -> str:
    """에러 메시지를 최대 길이로 자름

    MonthlyReport.last_error 컬럼이 String(2000)으로 선언되어 있어
    초과 시 DB 저장에 실패하지 않도록 미리 truncate합니다.
    """
    return msg[:max_len] if len(msg) > max_len else msg


async def mark_completed(
    db: AsyncSession,
    report_id: int,
    insights: dict[str, Any],
) -> None:
    """리포트 완료 상태로 전이

    status=completed, insights 저장, completed_at 기록.
    """
    await db.execute(
        update(MonthlyReport)
        .where(MonthlyReport.id == report_id)
        .values(
            status="completed",
            insights=insights,
            completed_at=datetime.now(UTC),
        )
    )
    await db.commit()


async def mark_failed(
    db: AsyncSession,
    report_id: int,
    error: str,
) -> None:
    """리포트 실패 상태로 전이

    status=failed, last_error 기록 (2000자 truncate).
    """
    await db.execute(
        update(MonthlyReport)
        .where(MonthlyReport.id == report_id)
        .values(
            status="failed",
            last_error=_truncate_error(error),
        )
    )
    await db.commit()


async def run_llm_for_report(
    db: AsyncSession,
    report: MonthlyReport,
) -> None:
    """LLM 호출 → 완료/실패 상태 저장

    1. format_insights_data_for_llm으로 report_data를 구조화 텍스트로 변환
    2. LLM generate_comprehensive_insights_v2 호출 (30초 타임아웃)
    3. 성공 시 mark_completed, 실패 시 mark_failed 후 예외 재발생

    예외 재발생 이유: 호출자(스케줄러/웹훅)가 재시도 여부를 결정해야 하기 때문.
    """
    try:
        from app.services.llm_service import get_llm_provider
        from app.services.prompts import format_insights_data_for_llm

        # HouseholdProfile이 없으면 None으로 처리 (format 함수가 None을 허용)
        try:
            from sqlalchemy import select

            from app.models.household_profile import HouseholdProfile

            profile = await db.scalar(select(HouseholdProfile).where(HouseholdProfile.household_id == report.household_id))
        except Exception:
            # HouseholdProfile 모델이 없는 환경(테스트 등)에서는 None 사용
            profile = None

        formatted_text = format_insights_data_for_llm(report.report_data, profile)

        llm = get_llm_provider("insights")
        insights_dict = await asyncio.wait_for(
            llm.generate_comprehensive_insights_v2(formatted_text),
            timeout=LLM_TIMEOUT_SECONDS,
        )

        await mark_completed(db, report.id, insights_dict)
        logger.info(
            "[monthly-reports] llm_success household_id=%d month=%s",
            report.household_id,
            report.month,
        )

    except Exception as e:
        error_msg = _truncate_error(str(e))
        await mark_failed(db, report.id, error_msg)
        logger.warning(
            "[monthly-reports] llm_failed household_id=%d month=%s error=%s",
            report.household_id,
            report.month,
            error_msg,
        )
        raise
