"""카테고리 엔티티 모델

지출/예산의 카테고리를 관리하는 엔티티입니다.
- user_id가 None이고 household_id가 None: 시스템 공통 카테고리(모든 사용자)
- user_id가 있고 household_id가 None: 개인 카테고리
- household_id가 있음: 가구 공유 카테고리
"""

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Category(Base):
    """카테고리 엔티티

    Attributes:
        id: 카테고리 고유 식별자 (Primary Key)
        user_id: 카테고리 소유자 ID (None이면 시스템 공통 카테고리)
        household_id: 가구 공유 카테고리 ID (None이면 개인/시스템 카테고리)
        name: 카테고리 이름 (사용자별 유니크)
        description: 카테고리 설명
        created_at: 레코드 생성 시각
    """

    __tablename__ = "categories"
    __table_args__ = (UniqueConstraint("name", "user_id", name="uq_category_name_user"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # None이면 시스템 카테고리
    household_id = Column(Integer, ForeignKey("households.id", ondelete="SET NULL"), nullable=True, index=True)  # 가구 공유 카테고리
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=func.now())

    # Relationships
    user = relationship("User", back_populates="categories")
    expenses = relationship("Expense", back_populates="category")
    budgets = relationship("Budget", back_populates="category")
