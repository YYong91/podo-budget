"""카테고리 엔티티 모델

지출/예산의 카테고리를 관리하는 엔티티입니다.
- user_id=None, household_id=None: 시스템 공통 카테고리 (전체 공유)
- household_id=X: 가계 카테고리 (가구 멤버 공유)
- user_id=X, household_id=None: 솔로 유저 개인 카테고리 (가구 미소속 폴백)
"""

from sqlalchemy import BigInteger, Column, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Category(Base):
    """카테고리 엔티티

    Attributes:
        id: 카테고리 고유 식별자 (Primary Key)
        user_id: 솔로 유저 개인 카테고리 소유자 ID (None이면 시스템 or 가계 카테고리)
        household_id: 가계 카테고리 ID (None이면 솔로/시스템 카테고리)
        name: 카테고리 이름
        description: 카테고리 설명
        created_at: 레코드 생성 시각
    """

    __tablename__ = "categories"
    __table_args__ = (
        UniqueConstraint("name", "household_id", "user_id", name="uq_category_name_scope"),
        Index("ix_categories_household_type", "household_id", "type"),  # 카테고리 조회 전반에 사용 (#238)
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # None이면 시스템 카테고리
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=True, index=True)  # 가구 카테고리 (시스템 카테고리는 NULL)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    type = Column(String(10), nullable=False, default="expense")  # expense | income | both
    sort_order = Column(BigInteger, nullable=False, default=0, server_default="0")  # 사용 횟수 기반 정렬 (높을수록 앞)
    created_at = Column(DateTime, default=func.now(), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="categories")
    expenses = relationship("Expense", back_populates="category")
    incomes = relationship("Income", back_populates="category")
    budgets = relationship("Budget", back_populates="category")
