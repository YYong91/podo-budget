"""예산 엔티티 모델

사용자별/가구별 카테고리별 예산을 관리하는 엔티티입니다.
모든 예산은 가구(household)에 소속됩니다.
"""

from sqlalchemy import Column, DateTime, Float, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Budget(Base):  # type: ignore[misc]
    """예산 엔티티

    Attributes:
        id: 예산 고유 식별자 (Primary Key)
        user_id: 예산 소유자 ID (Foreign Key, nullable=True for migration)
        household_id: 소속 가구 예산 ID (Foreign Key, NOT NULL)
        category_id: 카테고리 ID (Foreign Key)
        amount: 예산 금액
        period: 예산 기간 (monthly, weekly, daily)
        start_date: 예산 시작일
        end_date: 예산 종료일 (None이면 무기한)
        alert_threshold: 경고 임계값 (기본 0.8 = 80%)
        created_at: 레코드 생성 시각
        updated_at: 레코드 수정 시각
    """

    __tablename__ = "budgets"
    # 자주 쿼리되는 컬럼 복합 인덱스 (#238)
    __table_args__ = (
        Index("ix_budgets_household_period", "household_id", "period"),  # 예산 페이지 로드 시 매번 사용
        Index("ix_budgets_start_end_date", "start_date", "end_date"),  # 날짜 범위 필터링
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # 점진적 마이그레이션을 위해 nullable=True
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)  # 소속 가구 예산 (필수)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    period = Column(String, nullable=False)  # monthly, weekly, daily
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=True)
    alert_threshold = Column(Float, default=0.8)  # 80% 도달시 경고
    created_at = Column(DateTime, default=func.now(), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="budgets")
    category = relationship("Category", back_populates="budgets")
