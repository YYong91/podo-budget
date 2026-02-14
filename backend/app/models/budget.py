"""예산 엔티티 모델

사용자별/가구별 카테고리별 예산을 관리하는 엔티티입니다.
household_id가 없으면 개인 예산, 있으면 가구 공유 예산입니다.
"""

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Budget(Base):
    """예산 엔티티

    Attributes:
        id: 예산 고유 식별자 (Primary Key)
        user_id: 예산 소유자 ID (Foreign Key, nullable=True for migration)
        household_id: 공유 가구 예산 ID (Foreign Key, nullable - None이면 개인 예산)
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

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # 점진적 마이그레이션을 위해 nullable=True
    household_id = Column(Integer, ForeignKey("households.id", ondelete="SET NULL"), nullable=True, index=True)  # 공유 가구 예산
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    period = Column(String, nullable=False)  # monthly, weekly, daily
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=True)
    alert_threshold = Column(Float, default=0.8)  # 80% 도달시 경고
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="budgets")
    category = relationship("Category", back_populates="budgets")
