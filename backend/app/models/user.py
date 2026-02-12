"""User 모델

사용자 인증을 위한 User 엔티티입니다.
향후 각 사용자별로 지출/예산 데이터를 격리하기 위해 사용됩니다.
"""

from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.sql import func

from app.core.database import Base


class User(Base):
    """사용자 엔티티

    Attributes:
        id: 사용자 고유 식별자 (Primary Key)
        username: 로그인용 사용자명 (유니크)
        hashed_password: bcrypt로 해싱된 비밀번호
        is_active: 계정 활성화 상태 (비활성 시 로그인 불가)
        created_at: 계정 생성 시각
        updated_at: 마지막 수정 시각
    """

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self):
        return f"<User(id={self.id}, username={self.username}, is_active={self.is_active})>"
