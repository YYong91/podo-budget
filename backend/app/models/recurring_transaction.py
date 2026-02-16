"""정기 거래 모델

정기적으로 반복되는 지출/수입을 관리합니다.
frequency(빈도)에 따라 next_due_date가 자동 계산되며,
사용자가 앱 접속 시 pending 항목으로 표시됩니다.
"""

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class RecurringTransaction(Base):
    """정기 거래 엔티티

    Attributes:
        type: 거래 유형 ('expense' | 'income')
        frequency: 반복 빈도 ('monthly' | 'weekly' | 'yearly' | 'custom')
        interval: custom 빈도일 때 N일 간격
        day_of_month: 매월/매년 실행일 (1-31)
        day_of_week: 매주 실행 요일 (0=월 ~ 6=일)
        month_of_year: 매년 실행 월 (1-12)
        next_due_date: 다음 실행 예정일
        is_active: 활성 상태 (False면 일시정지/종료)
    """

    __tablename__ = "recurring_transactions"
    __table_args__ = (
        Index("ix_recurring_user_active", "user_id", "is_active"),
        Index("ix_recurring_next_due_active", "next_due_date", "is_active"),
        Index("ix_recurring_household_active", "household_id", "is_active"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="SET NULL"), nullable=True)
    type = Column(String(10), nullable=False)  # expense | income
    amount = Column(Numeric(12, 2), nullable=False)
    description = Column(String, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    frequency = Column(String(10), nullable=False)  # monthly | weekly | yearly | custom
    interval = Column(Integer, nullable=True)  # custom일 때 N일
    day_of_month = Column(Integer, nullable=True)  # 1-31
    day_of_week = Column(Integer, nullable=True)  # 0-6
    month_of_year = Column(Integer, nullable=True)  # 1-12
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    next_due_date = Column(Date, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User")
    category = relationship("Category")
    household = relationship("Household")
