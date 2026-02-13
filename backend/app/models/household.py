"""가구(Household) 엔티티 모델

여러 사용자가 지출과 예산을 공유할 수 있는 가구를 나타내는 엔티티입니다.
각 가구는 독립적인 통화(currency)와 멤버 관리 시스템을 가집니다.

DDD 관점:
- Aggregate Root: Household는 HouseholdMember와 HouseholdInvitation의 집합 루트입니다.
- 도메인 불변식: 가구는 반드시 한 명 이상의 owner를 가져야 합니다.
"""

from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Household(Base):
    """가구 엔티티

    여러 사용자가 지출과 예산을 공유하기 위한 논리적 단위입니다.
    가구는 소프트 삭제(soft delete)를 지원하여 데이터 보존이 가능합니다.

    Attributes:
        id: 가구 고유 식별자 (Primary Key)
        name: 가구 이름 (예: "우리 가족", "룸메이트 가계부")
        description: 가구 설명 (선택)
        currency: 통화 코드 (ISO 4217, 기본값 "KRW")
        created_at: 가구 생성 시각
        updated_at: 마지막 수정 시각
        deleted_at: 소프트 삭제 시각 (None이면 활성 상태)

    Relationships:
        members: 가구에 속한 멤버 목록 (HouseholdMember)
        invitations: 가구로의 초대 목록 (HouseholdInvitation)
    """

    __tablename__ = "households"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    description = Column(String(200), nullable=True)
    currency = Column(String(3), default="KRW", nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at = Column(DateTime, nullable=True)  # 소프트 삭제 지원

    # Relationships
    # cascade="all, delete-orphan": 가구 삭제 시 멤버와 초대도 함께 삭제
    members = relationship("HouseholdMember", back_populates="household", cascade="all, delete-orphan")
    invitations = relationship("HouseholdInvitation", back_populates="household", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Household(id={self.id}, name={self.name}, currency={self.currency})>"
