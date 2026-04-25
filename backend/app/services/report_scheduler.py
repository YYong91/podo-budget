"""월간 결산 리포트 스케줄러 — Phase 1/2 오케스트레이션

Phase 1: 자격 통과 가구의 report_data 집계 + pending row 일괄 생성 (멱등)
Phase 2: pending row를 꺼내 LLM 호출 + completed/failed 상태 전이 (병렬 처리)
"""

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.monthly_report import MonthlyReport
from app.services.report_data_builder import build_report_data
from app.services.report_eligibility import find_eligible_households
from app.services.report_generator import run_llm_for_report

logger = logging.getLogger(__name__)

# Phase 2 병렬 LLM 호출 최대 동시 수 (DB 커넥션 + LLM rate limit 고려)
_PHASE2_CONCURRENCY = 5


async def phase1_enqueue_pending(db: AsyncSession, month: str) -> int:
    """자격 통과 가구의 report_data 집계 + pending row 일괄 생성 (멱등)

    이미 MonthlyReport row가 존재하는 가구는 건너뛴다.
    SQLite 테스트 환경 호환을 위해 SELECT-before-INSERT 패턴을 사용한다.

    Args:
        db: 비동기 DB 세션
        month: 대상 월 (YYYY-MM 형식)

    Returns:
        새로 생성된 row 수
    """
    eligible_ids = await find_eligible_households(db, month)
    logger.info(
        "[monthly-reports] eligible_households count=%d month=%s",
        len(eligible_ids),
        month,
    )

    created = 0
    for hid in eligible_ids:
        # 멱등성 보장: 이미 존재하면 건너뜀
        existing = await db.scalar(
            select(MonthlyReport).where(
                MonthlyReport.household_id == hid,
                MonthlyReport.month == month,
            )
        )
        if existing:
            logger.debug(
                "[monthly-reports] skip existing household_id=%d month=%s",
                hid,
                month,
            )
            continue

        data = await build_report_data(db, hid, month)
        report = MonthlyReport(
            household_id=hid,
            month=month,
            status="pending",
            report_data=data,
            trigger_source="auto",
        )
        db.add(report)
        created += 1

    await db.commit()
    logger.info("[monthly-reports] phase1_complete queued=%d month=%s", created, month)
    return created


async def recover_stale_processing(db: AsyncSession, threshold_minutes: int = 15) -> int:
    """processing 좀비 row를 pending으로 복구

    started_at이 threshold_minutes 이상 경과한 processing row를
    pending으로 되돌려 재시도 대상에 포함시킨다.

    Args:
        db: 비동기 DB 세션
        threshold_minutes: 좀비 판단 기준 시간(분). 기본 15분.

    Returns:
        복구된 row 수
    """
    cutoff = datetime.utcnow() - timedelta(minutes=threshold_minutes)

    result = await db.execute(
        update(MonthlyReport)
        .where(
            MonthlyReport.status == "processing",
            MonthlyReport.started_at <= cutoff,
        )
        .values(status="pending")
    )
    recovered = result.rowcount
    await db.commit()

    if recovered:
        logger.warning(
            "[monthly-reports] recovered stale processing rows count=%d threshold_minutes=%d",
            recovered,
            threshold_minutes,
        )
    return recovered


async def phase2_process_pending(month: str) -> int:
    """pending row를 꺼내 LLM 호출 병렬 처리

    각 report마다 독립된 DB 세션을 생성하여 LLM 호출 후
    completed 또는 failed 상태로 전이한다.

    Args:
        month: 대상 월 (YYYY-MM 형식)

    Returns:
        처리 시도된 row 수 (성공/실패 포함)
    """
    async with AsyncSessionLocal() as db:
        pending_ids: list[int] = list(
            await db.scalars(
                select(MonthlyReport.id).where(
                    MonthlyReport.month == month,
                    MonthlyReport.status == "pending",
                )
            )
        )

    logger.info(
        "[monthly-reports] phase2_start pending_count=%d month=%s",
        len(pending_ids),
        month,
    )

    if not pending_ids:
        return 0

    semaphore = asyncio.Semaphore(_PHASE2_CONCURRENCY)

    async def _process_one(report_id: int) -> None:
        """단일 report를 독립 세션으로 처리"""
        async with semaphore, AsyncSessionLocal() as db:
            report = await db.scalar(select(MonthlyReport).where(MonthlyReport.id == report_id))
            if not report or report.status != "pending":
                # 다른 워커가 먼저 처리했거나 상태 변경됨
                return

            # processing 상태로 전이 (started_at 기록)
            await db.execute(
                update(MonthlyReport)
                .where(MonthlyReport.id == report_id)
                .values(
                    status="processing",
                    started_at=datetime.now(UTC),
                    attempt_count=MonthlyReport.attempt_count + 1,
                )
            )
            await db.commit()
            await db.refresh(report)

            try:
                await run_llm_for_report(db, report)
            except Exception as exc:
                logger.warning(
                    "[monthly-reports] phase2_failed report_id=%d error=%s",
                    report_id,
                    str(exc)[:200],
                )

    await asyncio.gather(*[_process_one(rid) for rid in pending_ids])

    logger.info(
        "[monthly-reports] phase2_complete processed=%d month=%s",
        len(pending_ids),
        month,
    )
    return len(pending_ids)
