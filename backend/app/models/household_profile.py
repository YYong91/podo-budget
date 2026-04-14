"""가구 프로필(HouseholdProfile) 엔티티 모델

가구의 재무적 맥락 정보를 저장하는 모델.
인사이트 AI가 개인화된 분석을 제공하기 위해 사용한다.

- Step 1 (필수): household_type, housing_type, income_types, age_range
- Step 2 (선택): financial_goal, goal_amount, goal_deadline, primary_concern
"""

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import JSON, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.household import Household


class HouseholdProfile(Base):  # type: ignore[misc]
    """가구 프로필 엔티티

    가구당 1개만 존재(unique=True)하며 가구 삭제 시 함께 삭제(CASCADE)된다.

    Attributes:
        id: 프로필 고유 식별자 (Primary Key)
        household_id: 소속 가구 (FK, unique — 가구당 1개)

        # Step 1 (온보딩 필수)
        household_type: 가구 유형 (single | dual_income | single_income | retired)
        housing_type: 주거 형태 (own_no_loan | own_with_loan | jeonse | monthly_rent | with_parents)
        income_types: 수입 유형 목록 (salary, freelance, business, pension 등 복수 선택)
        age_range: 연령대 (20s | 30s | 40s | 50s_plus)

        # Step 2 (심화 선택)
        financial_goal: 재무 목표 (emergency_fund | debt_payoff | home_purchase | investment | retirement | travel | none)
        goal_amount: 목표 금액 (원)
        goal_deadline: 목표 달성 기한
        primary_concern: 주요 고민 (overspending | no_savings | too_much_debt | irregular_income | none)

        created_at: 프로필 생성 시각
        updated_at: 마지막 수정 시각
    """

    __tablename__ = "household_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    # Step 1 (온보딩 필수 항목)
    household_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        comment="single | dual_income | single_income | retired",
    )
    housing_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        comment="own_no_loan | own_with_loan | jeonse | monthly_rent | with_parents",
    )
    income_types: Mapped[list[str]] = mapped_column(
        JSON,
        nullable=False,
        comment='["salary", "freelance", "business", "pension"] 등 복수 선택',
    )
    age_range: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        comment="20s | 30s | 40s | 50s_plus",
    )

    # Step 2 (심화 선택 항목)
    financial_goal: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="emergency_fund | debt_payoff | home_purchase | investment | retirement | travel | none",
    )
    goal_amount: Mapped[int | None] = mapped_column(nullable=True)
    goal_deadline: Mapped[date | None] = mapped_column(nullable=True)
    primary_concern: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="overspending | no_savings | too_much_debt | irregular_income | none",
    )

    created_at: Mapped[datetime] = mapped_column(default=func.now(), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(default=func.now(), onupdate=func.now(), server_default=func.now(), nullable=False)

    # Relationships
    household: Mapped["Household"] = relationship(back_populates="profile")

    def __repr__(self) -> str:
        return f"<HouseholdProfile(id={self.id}, household_id={self.household_id}, type={self.household_type})>"
