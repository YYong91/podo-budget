"""가구 초대(HouseholdInvitation) 엔티티 모델

가구에 새로운 멤버를 초대하기 위한 엔티티입니다.
이메일 기반 초대 시스템으로, 회원과 비회원 모두 초대 가능합니다.

초대 프로세스:
1. admin 이상 권한 사용자가 이메일로 초대 생성
2. 고유한 토큰(UUID) 생성
3. 초대 링크를 이메일로 전송 (현재는 토큰만 반환, 이메일 전송은 향후 구현)
4. 초대받은 사용자가 토큰으로 수락/거절
5. 수락 시 자동으로 HouseholdMember 생성

도메인 규칙:
- 초대는 기본 7일 후 만료됩니다
- 같은 이메일로 중복 초대 불가 (pending 상태 초대가 이미 존재하면)
- owner 역할로는 초대할 수 없습니다 (owner 변경은 별도 프로세스)
- 초대 상태: pending → accepted/rejected/expired
"""

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class HouseholdInvitation(Base):
    """가구 초대 엔티티

    가구에 새로운 멤버를 초대하기 위한 토큰 기반 초대 시스템입니다.

    Attributes:
        id: 초대 고유 식별자 (Primary Key)
        household_id: 초대하는 가구의 ID (Foreign Key)
        inviter_id: 초대한 사용자의 ID (Foreign Key)
        invitee_email: 초대받은 사람의 이메일 (회원/비회원 모두 가능)
        invitee_user_id: 초대받은 사람이 회원인 경우 User ID (선택)
        token: 초대 고유 토큰 (UUID 문자열, 초대 링크에 사용)
        role: 초대 시 부여할 역할 ("member" | "admin", owner는 불가)
        status: 초대 상태 ("pending" | "accepted" | "rejected" | "expired")
        expires_at: 초대 만료 시각
        created_at: 초대 생성 시각
        responded_at: 수락/거절 시각 (pending 상태에서는 None)

    Relationships:
        household: 초대 대상 가구
        inviter: 초대한 사용자
        invitee: 초대받은 사용자 (회원인 경우)

    도메인 불변식:
        - token은 전역적으로 유니크해야 함 (UUID 사용)
        - role은 "member" 또는 "admin"만 가능 ("owner"는 불가)
        - status는 "pending", "accepted", "rejected", "expired" 중 하나
    """

    __tablename__ = "household_invitations"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    inviter_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    invitee_email = Column(String(255), nullable=False, index=True)
    invitee_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # 회원인 경우에만 설정
    token = Column(String, unique=True, nullable=False, index=True)  # UUID 문자열
    role = Column(String, nullable=False, default="member")  # member or admin (owner는 불가)
    status = Column(String, nullable=False, default="pending")  # pending, accepted, rejected, expired
    expires_at = Column(DateTime, nullable=False)  # 기본 7일 후 만료
    created_at = Column(DateTime, default=func.now(), nullable=False)
    responded_at = Column(DateTime, nullable=True)  # 수락/거절 시각

    # Relationships
    household = relationship("Household", back_populates="invitations")
    inviter = relationship("User", foreign_keys=[inviter_id])
    invitee = relationship("User", foreign_keys=[invitee_user_id])

    def __repr__(self):
        return f"<HouseholdInvitation(id={self.id}, email={self.invitee_email}, status={self.status})>"
