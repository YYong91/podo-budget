"""가구 멤버(HouseholdMember) 엔티티 모델

가구와 사용자 간의 다대다 관계를 표현하는 연결 테이블입니다.
각 멤버는 역할(role)을 가지며, 역할에 따라 권한이 다릅니다.

역할 체계:
- owner: 가구 소유자, 모든 권한 보유 (가구 삭제, owner 변경)
- admin: 관리자, 멤버 초대/추방, 가구 설정 수정 가능
- member: 일반 멤버, 지출 기록 및 조회만 가능

도메인 규칙:
- 한 사용자는 같은 가구에 한 번만 속할 수 있습니다 (UNIQUE 제약)
- 가구는 최소 1명의 owner를 가져야 합니다
- 멤버 탈퇴 시 소프트 삭제(left_at 설정)로 기록을 보존합니다
"""

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class HouseholdMember(Base):
    """가구 멤버 엔티티

    가구와 사용자를 연결하고 역할 정보를 저장합니다.

    Attributes:
        id: 멤버 고유 식별자 (Primary Key)
        household_id: 속한 가구의 ID (Foreign Key)
        user_id: 사용자 ID (Foreign Key)
        role: 역할 ("owner" | "admin" | "member")
        joined_at: 가구 가입 시각
        left_at: 가구 탈퇴 시각 (None이면 활성 멤버)

    Relationships:
        household: 속한 가구
        user: 멤버 사용자

    도메인 불변식:
        - (household_id, user_id) 조합은 유니크해야 함
        - role은 "owner", "admin", "member" 중 하나
    """

    __tablename__ = "household_members"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String, nullable=False, default="member")  # owner, admin, member
    joined_at = Column(DateTime, default=func.now(), nullable=False)
    left_at = Column(DateTime, nullable=True)  # 소프트 삭제: 탈퇴한 멤버는 left_at이 설정됨

    # 제약 조건: 한 사용자는 같은 가구에 한 번만 속할 수 있음
    __table_args__ = (UniqueConstraint("household_id", "user_id", name="uq_household_user"),)

    # Relationships
    household = relationship("Household", back_populates="members")
    user = relationship("User", foreign_keys=[user_id])

    def __repr__(self):
        return f"<HouseholdMember(id={self.id}, household_id={self.household_id}, user_id={self.user_id}, role={self.role})>"
