"""지출 엔티티 모델

사용자별 지출 기록을 저장하는 Expense 엔티티입니다.
user_id를 통해 각 사용자의 지출을 격리하며,
household_id를 통해 소속 가구의 지출로 기록됩니다.
"""

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Expense(Base):  # type: ignore[misc]
    """지출 엔티티

    Attributes:
        id: 지출 고유 식별자 (Primary Key)
        user_id: 지출을 기록한 사용자 ID (Foreign Key, nullable=True for migration)
        household_id: 소속 가구 ID (Foreign Key, NOT NULL)
        amount: 지출 금액
        description: 지출 설명
        category_id: 카테고리 ID (Foreign Key, nullable)
        raw_input: 사용자가 입력한 원본 텍스트 (자연어 입력 시 사용)
        date: 지출 발생 일시
        created_at: 레코드 생성 시각
        updated_at: 레코드 수정 시각
    """

    __tablename__ = "expenses"
    __table_args__ = (
        Index("ix_expenses_date", "date"),  # 날짜 범위 조회 성능
        Index("ix_expenses_category_id", "category_id"),  # 카테고리별 조회 성능
        Index("ix_expenses_household_date", "household_id", "date"),  # 가구별 월별 조회
        Index("ix_expenses_user_date", "user_id", "date"),  # 사용자별 기간 조회
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # 점진적 마이그레이션을 위해 nullable=True
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)  # 소속 가구 (필수)
    amount = Column(Numeric(12, 2), nullable=False)
    description = Column(String, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    raw_input = Column(Text, nullable=True)  # 사용자가 입력한 원본 텍스트
    memo = Column(Text, nullable=True)  # 선택적 메모
    exclude_from_stats = Column(Boolean, nullable=False, default=False)  # 통계 제외 여부 (저축, 퇴직금 등 비정형 대규모 거래용)
    recurring_transaction_id = Column(
        Integer,
        ForeignKey("recurring_transactions.id", ondelete="SET NULL"),
        nullable=True,
    )  # 정기 거래에서 생성된 경우 연결
    payment_method_id = Column(
        Integer,
        ForeignKey("payment_methods.id", ondelete="SET NULL"),
        nullable=True,
    )  # 결제수단 (카드, 현금 등)
    date = Column(DateTime, nullable=False, default=func.now())
    created_at = Column(DateTime, default=func.now(), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="expenses")
    category = relationship("Category", back_populates="expenses")
    household = relationship("Household", back_populates="expenses")
    recurring_transaction = relationship("RecurringTransaction", back_populates="expenses")
    payment_method = relationship("PaymentMethod")
