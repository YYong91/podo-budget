"""월간 결산 리포트 엔티티"""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.household import Household


class MonthlyReport(Base):  # type: ignore[misc]
    """가구별 월간 결산 리포트

    매월 1일 03:00 KST에 자동 생성된다.
    한 가구는 한 달에 하나의 리포트만 가질 수 있다 (unique constraint).
    """

    __tablename__ = "monthly_reports"

    id: Mapped[int] = mapped_column(primary_key=True)

    # ── 식별 ──
    household_id: Mapped[int] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"),
        nullable=False,
    )
    month: Mapped[str] = mapped_column(
        String(7),
        nullable=False,
        comment="YYYY-MM 형식 (예: 2026-04)",
    )

    # ── 상태 머신 ──
    status: Mapped[str] = mapped_column(
        String(15),
        nullable=False,
        default="pending",
        comment="pending | processing | completed | failed",
    )
    attempt_count: Mapped[int] = mapped_column(
        default=0,
        nullable=False,
        comment="LLM 호출 시도 횟수. 0=Phase 1 완료, 1+=Phase 2 시도",
    )
    last_error: Mapped[str | None] = mapped_column(
        String(2000),
        nullable=True,
        comment="마지막 실패 사유 (2000자 truncate)",
    )
    trigger_source: Mapped[str] = mapped_column(
        String(15),
        nullable=False,
        default="auto",
        comment="auto | admin | retry",
    )

    # ── 데이터 스냅샷 ──
    report_data: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
        comment="분석 시점의 입력 스냅샷. 이후 거래 변경과 무관하게 불변.",
    )
    insights: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
        comment="LLM 출력 (StructuredInsightsResponse 구조). completed 시에만 채워짐.",
    )
    insights_version: Mapped[int] = mapped_column(
        default=1,
        nullable=False,
        comment="LLM 출력 스키마 버전. 스키마 변경 시 증가하여 하위 호환 처리 기준으로 사용.",
    )

    # ── 메타 ──
    llm_tokens_used: Mapped[int | None] = mapped_column(nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        default=func.now(),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        default=func.now(),
        onupdate=func.now(),
        server_default=func.now(),
        nullable=False,
    )

    household: Mapped["Household"] = relationship(back_populates="monthly_reports")

    __table_args__ = (
        UniqueConstraint(
            "household_id",
            "month",
            name="uq_monthly_report_household_month",
        ),
        Index("ix_monthly_reports_month_status", "month", "status"),
    )

    def __repr__(self) -> str:
        return f"<MonthlyReport(" f"id={self.id}, " f"household_id={self.household_id}, " f"month={self.month}, " f"status={self.status})>"
