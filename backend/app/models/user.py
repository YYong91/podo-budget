"""User 모델

사용자 인증을 위한 User 엔티티입니다.
각 사용자는 개인 지출 데이터를 가지며, 가구(Household)에 속하여 공유 데이터를 관리할 수 있습니다.
"""

from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class User(Base):
    """사용자 엔티티

    Attributes:
        id: 사용자 고유 식별자 (Primary Key)
        username: 로그인용 사용자명 (유니크)
        email: 이메일 주소 (가구 초대용, 선택 사항)
        hashed_password: bcrypt로 해싱된 비밀번호
        is_active: 계정 활성화 상태 (비활성 시 로그인 불가)
        created_at: 계정 생성 시각
        updated_at: 마지막 수정 시각
    """

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=True)  # 초대 시스템용 이메일
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    expenses = relationship("Expense", back_populates="user")
    incomes = relationship("Income", back_populates="user")
    categories = relationship("Category", back_populates="user")
    budgets = relationship("Budget", back_populates="user")

    def __repr__(self):
        return f"<User(id={self.id}, username={self.username}, is_active={self.is_active})>"
