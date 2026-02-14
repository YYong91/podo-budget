"""가구(Household) 관련 Pydantic 스키마

가구 API의 요청/응답 스키마를 정의합니다.
Pydantic v2 문법을 사용합니다.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

# ===== Household 스키마 =====


class HouseholdCreate(BaseModel):
    """가구 생성 요청 스키마

    Attributes:
        name: 가구 이름 (필수, 최대 50자)
        description: 가구 설명 (선택, 최대 200자)
        currency: 통화 코드 (선택, 기본값 "KRW", ISO 4217)
    """

    name: str = Field(..., min_length=1, max_length=50, description="가구 이름")
    description: str | None = Field(None, max_length=200, description="가구 설명")
    currency: str = Field(default="KRW", max_length=3, description="통화 코드 (ISO 4217)")


class HouseholdUpdate(BaseModel):
    """가구 수정 요청 스키마

    모든 필드가 선택 사항이며, 제공된 필드만 업데이트됩니다.

    Attributes:
        name: 가구 이름 (선택)
        description: 가구 설명 (선택)
    """

    name: str | None = Field(None, min_length=1, max_length=50, description="가구 이름")
    description: str | None = Field(None, max_length=200, description="가구 설명")


class HouseholdResponse(BaseModel):
    """가구 기본 정보 응답 스키마

    가구 목록 조회 시 사용되는 간략한 정보입니다.

    Attributes:
        id: 가구 ID
        name: 가구 이름
        description: 가구 설명
        currency: 통화 코드
        my_role: 현재 사용자의 역할 (owner, admin, member)
        member_count: 활성 멤버 수
        created_at: 생성 시각
    """

    id: int
    name: str
    description: str | None
    currency: str
    my_role: str = Field(..., description="현재 사용자의 역할")
    member_count: int = Field(..., description="활성 멤버 수")
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ===== Member 스키마 =====


class MemberResponse(BaseModel):
    """가구 멤버 정보 응답 스키마

    Attributes:
        user_id: 사용자 ID
        username: 사용자명
        email: 이메일 (있는 경우)
        role: 역할 (owner, admin, member)
        joined_at: 가입 시각
    """

    user_id: int
    username: str
    email: str | None = None
    role: str
    joined_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MemberRoleUpdate(BaseModel):
    """멤버 역할 변경 요청 스키마

    owner만 다른 멤버의 역할을 변경할 수 있습니다.
    owner 역할로 변경하는 것은 별도 API로 처리합니다.

    Attributes:
        role: 새로운 역할 (member 또는 admin)
    """

    role: str = Field(..., pattern="^(member|admin)$", description="member 또는 admin")


# ===== Household Detail 스키마 =====


class HouseholdDetailResponse(BaseModel):
    """가구 상세 정보 응답 스키마

    가구 기본 정보 + 활성 멤버 목록을 포함합니다.

    Attributes:
        id: 가구 ID
        name: 가구 이름
        description: 가구 설명
        currency: 통화 코드
        my_role: 현재 사용자의 역할
        member_count: 활성 멤버 수
        created_at: 생성 시각
        members: 활성 멤버 목록
    """

    id: int
    name: str
    description: str | None
    currency: str
    my_role: str
    member_count: int
    created_at: datetime
    members: list[MemberResponse]

    model_config = ConfigDict(from_attributes=True)


# ===== Invitation 스키마 =====


class InvitationCreate(BaseModel):
    """초대 생성 요청 스키마

    admin 이상 권한을 가진 멤버가 새로운 사용자를 초대할 때 사용합니다.

    Attributes:
        email: 초대받을 사람의 이메일 (필수)
        role: 초대 시 부여할 역할 (선택, 기본값 "member")
    """

    email: EmailStr = Field(..., description="초대받을 사람의 이메일")
    role: str = Field(default="member", pattern="^(member|admin)$", description="member 또는 admin")


class InvitationResponse(BaseModel):
    """초대 정보 응답 스키마

    Attributes:
        id: 초대 ID
        household_id: 가구 ID
        household_name: 가구 이름
        invitee_email: 초대받은 사람의 이메일
        inviter_username: 초대한 사람의 사용자명
        role: 초대 시 부여될 역할
        status: 초대 상태 (pending, accepted, rejected, expired)
        expires_at: 만료 시각
        created_at: 생성 시각
        responded_at: 응답 시각 (수락/거절한 경우)
        token: 초대 토큰 (초대 생성 시에만 포함)
    """

    id: int
    household_id: int
    household_name: str
    invitee_email: str
    inviter_username: str
    role: str
    status: str
    expires_at: datetime
    created_at: datetime
    responded_at: datetime | None = None
    token: str | None = None  # 초대 생성 시에만 포함

    model_config = ConfigDict(from_attributes=True)


# ===== Leave Response 스키마 =====


class LeaveResponse(BaseModel):
    """가구 탈퇴 응답 스키마

    Attributes:
        message: 탈퇴 결과 메시지
        transferred_to: owner 역할이 양도된 사용자 ID (owner 탈퇴 시)
    """

    message: str
    transferred_to: int | None = None
