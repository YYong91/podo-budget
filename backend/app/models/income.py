"""수입 엔티티 모델

사용자별 수입 기록을 저장하는 Income 엔티티입니다.
user_id를 통해 각 사용자의 수입을 격리하며,
household_id가 있는 경우 해당 가구의 공유 수입으로 기록됩니다.
"""

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Income(Base):
    """수입 엔티티

    Attributes:
        id: 수입 고유 식별자 (Primary Key)
        user_id: 수입을 기록한 사용자 ID (Foreign Key)
        household_id: 공유 가구 ID (Foreign Key, nullable - None이면 개인 수입)
        amount: 수입 금액
        description: 수입 설명
        category_id: 카테고리 ID (Foreign Key, nullable)
        raw_input: 사용자가 입력한 원본 텍스트 (자연어 입력 시 사용)
        date: 수입 발생 일시
        created_at: 레코드 생성 시각
        updated_at: 레코드 수정 시각
    """

    __tablename__ = "incomes"
    __table_args__ = (
        Index("ix_incomes_date", "date"),
        Index("ix_incomes_category_id", "category_id"),
        Index("ix_incomes_household_date", "household_id", "date"),
        Index("ix_incomes_user_date", "user_id", "date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="SET NULL"), nullable=True, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    description = Column(String, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    raw_input = Column(Text, nullable=True)
    memo = Column(Text, nullable=True)  # 선택적 메모
    date = Column(DateTime, nullable=False, default=func.now())
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="incomes")
    category = relationship("Category", back_populates="incomes")
    household = relationship("Household", back_populates="incomes")
