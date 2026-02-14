"""가구(Household) API 통합 테스트

가구 CRUD, 멤버 관리, 초대 시스템의 모든 시나리오를 테스트합니다.

테스트 범위:
- Household CRUD (생성, 목록, 상세, 수정, 삭제)
- 멤버 관리 (역할 변경, 추방, 탈퇴)
- 초대 시스템 (생성, 수락, 거절, 취소, 만료)
- 권한 검증 (member가 admin 작업 시도 → 403)
- 에러 케이스 (중복 초대, 존재하지 않는 가구 등)
"""

from datetime import datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.household import Household
from app.models.household_invitation import HouseholdInvitation
from app.models.household_member import HouseholdMember
from app.models.user import User

# ===== Household CRUD 테스트 =====


@pytest.mark.asyncio
async def test_create_household_성공(authenticated_client: AsyncClient):
    """가구 생성 성공 테스트

    - 가구를 생성하고 생성자가 자동으로 owner가 되는지 확인
    """
    response = await authenticated_client.post(
        "/api/households/",
        json={
            "name": "테스트 가구",
            "description": "테스트용 가구입니다",
            "currency": "KRW",
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "테스트 가구"
    assert data["description"] == "테스트용 가구입니다"
    assert data["currency"] == "KRW"
    assert data["my_role"] == "owner"
    assert data["member_count"] == 1


@pytest.mark.asyncio
async def test_list_households_내가_속한_가구만_조회(authenticated_client: AsyncClient, authenticated_client2: AsyncClient):
    """내가 속한 가구 목록 조회 테스트

    - 각 사용자는 자신이 속한 가구만 조회할 수 있음
    """
    # 사용자1이 가구 생성
    response1 = await authenticated_client.post(
        "/api/households/",
        json={"name": "가구1"},
    )
    assert response1.status_code == 201

    # 사용자2가 가구 생성
    response2 = await authenticated_client2.post(
        "/api/households/",
        json={"name": "가구2"},
    )
    assert response2.status_code == 201

    # 사용자1 가구 목록 조회 (가구1만 보임)
    response = await authenticated_client.get("/api/households/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "가구1"

    # 사용자2 가구 목록 조회 (가구2만 보임)
    response = await authenticated_client2.get("/api/households/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "가구2"


@pytest.mark.asyncio
async def test_get_household_상세_조회_성공(authenticated_client: AsyncClient):
    """가구 상세 정보 조회 성공 테스트

    - 멤버 목록이 포함된 상세 정보 조회
    """
    # 가구 생성
    create_response = await authenticated_client.post(
        "/api/households/",
        json={"name": "상세 조회 테스트"},
    )
    household_id = create_response.json()["id"]

    # 상세 조회
    response = await authenticated_client.get(f"/api/households/{household_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "상세 조회 테스트"
    assert data["my_role"] == "owner"
    assert data["member_count"] == 1
    assert len(data["members"]) == 1
    assert data["members"][0]["role"] == "owner"


@pytest.mark.asyncio
async def test_get_household_권한_없는_사용자는_조회_불가(authenticated_client: AsyncClient, authenticated_client2: AsyncClient):
    """가구 상세 조회 권한 검증 테스트

    - 멤버가 아닌 사용자는 가구를 조회할 수 없음
    """
    # 사용자1이 가구 생성
    create_response = await authenticated_client.post(
        "/api/households/",
        json={"name": "비공개 가구"},
    )
    household_id = create_response.json()["id"]

    # 사용자2가 조회 시도 (403 예상)
    response = await authenticated_client2.get(f"/api/households/{household_id}")
    assert response.status_code == 403
    assert "접근할 권한이 없습니다" in response.json()["detail"]


@pytest.mark.asyncio
async def test_update_household_admin이_수정_가능(authenticated_client: AsyncClient):
    """가구 정보 수정 성공 테스트

    - admin 이상 권한을 가진 사용자가 가구 정보를 수정할 수 있음
    """
    # 가구 생성
    create_response = await authenticated_client.post(
        "/api/households/",
        json={"name": "원래 이름"},
    )
    household_id = create_response.json()["id"]

    # 가구 수정
    response = await authenticated_client.put(
        f"/api/households/{household_id}",
        json={
            "name": "변경된 이름",
            "description": "새로운 설명",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "변경된 이름"
    assert data["description"] == "새로운 설명"


@pytest.mark.asyncio
async def test_delete_household_owner만_삭제_가능(authenticated_client: AsyncClient, db_session: AsyncSession):
    """가구 소프트 삭제 성공 테스트

    - owner만 가구를 삭제할 수 있음
    - 소프트 삭제로 deleted_at이 설정됨
    """
    # 가구 생성
    create_response = await authenticated_client.post(
        "/api/households/",
        json={"name": "삭제 테스트"},
    )
    household_id = create_response.json()["id"]

    # 가구 삭제
    response = await authenticated_client.delete(f"/api/households/{household_id}")
    assert response.status_code == 204

    # DB에서 소프트 삭제 확인
    query = select(Household).where(Household.id == household_id)
    result = await db_session.execute(query)
    household = result.scalar_one()
    assert household.deleted_at is not None

    # 삭제된 가구는 목록에 표시되지 않음
    list_response = await authenticated_client.get("/api/households/")
    assert len(list_response.json()) == 0


@pytest.mark.asyncio
async def test_delete_household_존재하지_않는_가구(authenticated_client: AsyncClient):
    """존재하지 않는 가구 삭제 시도 테스트

    - 404 에러 반환
    """
    response = await authenticated_client.delete("/api/households/99999")
    assert response.status_code == 404


# ===== 멤버 관리 테스트 =====


@pytest.mark.asyncio
async def test_update_member_role_owner가_역할_변경(
    authenticated_client: AsyncClient, authenticated_client2: AsyncClient, db_session: AsyncSession, test_user2: User
):
    """멤버 역할 변경 성공 테스트

    - owner가 다른 멤버의 역할을 변경할 수 있음
    """
    # 1. 사용자1이 가구 생성 (owner)
    create_response = await authenticated_client.post(
        "/api/households/",
        json={"name": "역할 변경 테스트"},
    )
    household_id = create_response.json()["id"]

    # 2. 사용자2를 멤버로 직접 추가 (DB 조작)
    member = HouseholdMember(household_id=household_id, user_id=test_user2.id, role="member")
    db_session.add(member)
    await db_session.commit()

    # 3. owner가 사용자2의 역할을 admin으로 변경
    response = await authenticated_client.patch(
        f"/api/households/{household_id}/members/{test_user2.id}/role",
        json={"role": "admin"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "admin"
    assert data["user_id"] == test_user2.id


@pytest.mark.asyncio
async def test_update_member_role_자기_자신은_변경_불가(authenticated_client: AsyncClient, test_user: User):
    """자기 자신의 역할 변경 시도 테스트

    - 400 에러 반환
    """
    # 가구 생성
    create_response = await authenticated_client.post(
        "/api/households/",
        json={"name": "자기 역할 변경 테스트"},
    )
    household_id = create_response.json()["id"]

    # 자기 자신의 역할 변경 시도
    response = await authenticated_client.patch(
        f"/api/households/{household_id}/members/{test_user.id}/role",
        json={"role": "member"},
    )
    assert response.status_code == 400
    assert "자신의 역할은 변경할 수 없습니다" in response.json()["detail"]


@pytest.mark.asyncio
async def test_remove_member_admin이_멤버_추방(
    authenticated_client: AsyncClient, authenticated_client2: AsyncClient, db_session: AsyncSession, test_user2: User
):
    """멤버 추방 성공 테스트

    - admin 이상 권한을 가진 사용자가 멤버를 추방할 수 있음
    """
    # 1. 가구 생성
    create_response = await authenticated_client.post(
        "/api/households/",
        json={"name": "멤버 추방 테스트"},
    )
    household_id = create_response.json()["id"]

    # 2. 사용자2를 멤버로 추가
    member = HouseholdMember(household_id=household_id, user_id=test_user2.id, role="member")
    db_session.add(member)
    await db_session.commit()

    # 3. owner가 사용자2를 추방
    response = await authenticated_client.delete(f"/api/households/{household_id}/members/{test_user2.id}")
    assert response.status_code == 204

    # 4. DB에서 소프트 삭제 확인
    query = select(HouseholdMember).where(HouseholdMember.household_id == household_id, HouseholdMember.user_id == test_user2.id)
    result = await db_session.execute(query)
    member = result.scalar_one()
    assert member.left_at is not None


@pytest.mark.asyncio
async def test_remove_member_owner는_추방_불가(
    authenticated_client: AsyncClient, authenticated_client2: AsyncClient, db_session: AsyncSession, test_user: User, test_user2: User
):
    """owner 추방 시도 테스트

    - owner는 추방할 수 없음 (400 에러)
    """
    # 1. 가구 생성 (사용자1 = owner)
    create_response = await authenticated_client.post(
        "/api/households/",
        json={"name": "owner 추방 테스트"},
    )
    household_id = create_response.json()["id"]

    # 2. 사용자2를 admin으로 추가
    member = HouseholdMember(household_id=household_id, user_id=test_user2.id, role="admin")
    db_session.add(member)
    await db_session.commit()

    # 3. admin(사용자2)이 owner(사용자1) 추방 시도
    response = await authenticated_client2.delete(f"/api/households/{household_id}/members/{test_user.id}")
    assert response.status_code == 400
    assert "소유자는 추방할 수 없습니다" in response.json()["detail"]


@pytest.mark.asyncio
async def test_leave_household_일반_멤버_탈퇴(
    authenticated_client: AsyncClient, authenticated_client2: AsyncClient, db_session: AsyncSession, test_user2: User
):
    """일반 멤버 자발적 탈퇴 테스트

    - member 역할의 사용자가 가구에서 탈퇴할 수 있음
    """
    # 1. 가구 생성
    create_response = await authenticated_client.post(
        "/api/households/",
        json={"name": "탈퇴 테스트"},
    )
    household_id = create_response.json()["id"]

    # 2. 사용자2를 멤버로 추가
    member = HouseholdMember(household_id=household_id, user_id=test_user2.id, role="member")
    db_session.add(member)
    await db_session.commit()

    # 3. 사용자2가 탈퇴
    response = await authenticated_client2.post(f"/api/households/{household_id}/leave")
    assert response.status_code == 200
    data = response.json()
    assert "탈퇴했습니다" in data["message"]
    assert data["transferred_to"] is None


@pytest.mark.asyncio
async def test_leave_household_owner_탈퇴_시_역할_양도(
    authenticated_client: AsyncClient, authenticated_client2: AsyncClient, db_session: AsyncSession, test_user: User, test_user2: User
):
    """owner 탈퇴 시 역할 자동 양도 테스트

    - owner가 탈퇴하면 자동으로 다른 멤버에게 owner 역할을 양도함
    """
    # 1. 가구 생성 (사용자1 = owner)
    create_response = await authenticated_client.post(
        "/api/households/",
        json={"name": "owner 탈퇴 테스트"},
    )
    household_id = create_response.json()["id"]

    # 2. 사용자2를 member로 추가
    member = HouseholdMember(household_id=household_id, user_id=test_user2.id, role="member")
    db_session.add(member)
    await db_session.commit()

    # 3. owner(사용자1)가 탈퇴
    response = await authenticated_client.post(f"/api/households/{household_id}/leave")
    assert response.status_code == 200
    data = response.json()
    assert "양도되었습니다" in data["message"]
    assert data["transferred_to"] == test_user2.id

    # 4. 사용자2가 owner가 되었는지 확인
    query = select(HouseholdMember).where(HouseholdMember.household_id == household_id, HouseholdMember.user_id == test_user2.id)
    result = await db_session.execute(query)
    new_owner = result.scalar_one()
    assert new_owner.role == "owner"


@pytest.mark.asyncio
async def test_leave_household_마지막_멤버는_탈퇴_불가(authenticated_client: AsyncClient):
    """마지막 멤버 탈퇴 시도 테스트

    - 혼자 남은 멤버는 탈퇴할 수 없음 (가구 삭제 필요)
    """
    # 가구 생성 (혼자)
    create_response = await authenticated_client.post(
        "/api/households/",
        json={"name": "혼자 남은 가구"},
    )
    household_id = create_response.json()["id"]

    # 탈퇴 시도
    response = await authenticated_client.post(f"/api/households/{household_id}/leave")
    assert response.status_code == 400
    assert "마지막 멤버는 탈퇴할 수 없습니다" in response.json()["detail"]


# ===== 초대 시스템 테스트 =====


@pytest.mark.asyncio
async def test_create_invitation_성공(authenticated_client: AsyncClient):
    """초대 생성 성공 테스트

    - admin 이상 권한을 가진 사용자가 초대를 생성할 수 있음
    """
    # 가구 생성
    create_response = await authenticated_client.post(
        "/api/households/",
        json={"name": "초대 테스트"},
    )
    household_id = create_response.json()["id"]

    # 초대 생성
    response = await authenticated_client.post(
        f"/api/households/{household_id}/invitations",
        json={
            "email": "invitee@example.com",
            "role": "member",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["invitee_email"] == "invitee@example.com"
    assert data["role"] == "member"
    assert data["status"] == "pending"
    assert data["token"] is not None  # 초대 생성 시에만 토큰 포함


@pytest.mark.asyncio
async def test_create_invitation_중복_초대_불가(authenticated_client: AsyncClient):
    """중복 초대 방지 테스트

    - 같은 이메일로 pending 초대가 있으면 생성 불가
    """
    # 가구 생성
    create_response = await authenticated_client.post(
        "/api/households/",
        json={"name": "중복 초대 테스트"},
    )
    household_id = create_response.json()["id"]

    # 첫 번째 초대 생성
    await authenticated_client.post(
        f"/api/households/{household_id}/invitations",
        json={"email": "duplicate@example.com", "role": "member"},
    )

    # 두 번째 초대 시도 (400 예상)
    response = await authenticated_client.post(
        f"/api/households/{household_id}/invitations",
        json={"email": "duplicate@example.com", "role": "member"},
    )
    assert response.status_code == 400
    assert "이미 초대가 전송되었습니다" in response.json()["detail"]


@pytest.mark.asyncio
async def test_create_invitation_owner_역할로는_초대_불가(authenticated_client: AsyncClient):
    """owner 역할 초대 시도 테스트

    - owner 역할로는 초대할 수 없음 (400 에러)
    """
    # 가구 생성
    create_response = await authenticated_client.post(
        "/api/households/",
        json={"name": "owner 초대 테스트"},
    )
    household_id = create_response.json()["id"]

    # owner 역할로 초대 시도
    response = await authenticated_client.post(
        f"/api/households/{household_id}/invitations",
        json={"email": "owner@example.com", "role": "owner"},
    )
    # 스키마에서 owner 역할이 차단됨 (Pydantic 검증)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_list_invitations_가구의_초대_목록_조회(authenticated_client: AsyncClient):
    """가구 초대 목록 조회 테스트

    - admin 이상 권한을 가진 사용자가 가구의 모든 초대를 조회할 수 있음
    """
    # 가구 생성
    create_response = await authenticated_client.post(
        "/api/households/",
        json={"name": "초대 목록 테스트"},
    )
    household_id = create_response.json()["id"]

    # 초대 2개 생성
    await authenticated_client.post(
        f"/api/households/{household_id}/invitations",
        json={"email": "user1@example.com", "role": "member"},
    )
    await authenticated_client.post(
        f"/api/households/{household_id}/invitations",
        json={"email": "user2@example.com", "role": "admin"},
    )

    # 초대 목록 조회
    response = await authenticated_client.get(f"/api/households/{household_id}/invitations")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["token"] is None  # 목록 조회 시에는 토큰 미포함


@pytest.mark.asyncio
async def test_cancel_invitation_admin이_초대_취소(authenticated_client: AsyncClient, db_session: AsyncSession):
    """초대 취소 성공 테스트

    - admin 이상 권한을 가진 사용자가 pending 초대를 취소할 수 있음
    """
    # 가구 생성
    create_response = await authenticated_client.post(
        "/api/households/",
        json={"name": "초대 취소 테스트"},
    )
    household_id = create_response.json()["id"]

    # 초대 생성
    invite_response = await authenticated_client.post(
        f"/api/households/{household_id}/invitations",
        json={"email": "cancel@example.com", "role": "member"},
    )
    invitation_id = invite_response.json()["id"]

    # 초대 취소
    response = await authenticated_client.delete(f"/api/households/{household_id}/invitations/{invitation_id}")
    assert response.status_code == 204

    # DB에서 초대가 삭제되었는지 확인
    query = select(HouseholdInvitation).where(HouseholdInvitation.id == invitation_id)
    result = await db_session.execute(query)
    invitation = result.scalar_one_or_none()
    assert invitation is None


@pytest.mark.asyncio
async def test_list_my_invitations_내가_받은_초대_조회(
    authenticated_client2: AsyncClient, authenticated_client: AsyncClient, db_session: AsyncSession, test_user2: User
):
    """내가 받은 초대 목록 조회 테스트

    - 사용자의 이메일로 받은 초대를 조회할 수 있음
    """
    # 사용자2의 이메일 설정
    query = select(User).where(User.id == test_user2.id)
    result = await db_session.execute(query)
    user2 = result.scalar_one()
    user2.email = "test2@example.com"
    await db_session.commit()

    # 사용자1이 가구 생성 및 사용자2 초대
    create_response = await authenticated_client.post(
        "/api/households/",
        json={"name": "내 초대 테스트"},
    )
    household_id = create_response.json()["id"]

    await authenticated_client.post(
        f"/api/households/{household_id}/invitations",
        json={"email": "test2@example.com", "role": "member"},
    )

    # 사용자2가 자신의 초대 목록 조회
    response = await authenticated_client2.get("/api/invitations/my")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["invitee_email"] == "test2@example.com"
    assert data[0]["status"] == "pending"


@pytest.mark.asyncio
async def test_accept_invitation_초대_수락_성공(
    authenticated_client: AsyncClient, authenticated_client2: AsyncClient, db_session: AsyncSession, test_user2: User
):
    """초대 수락 성공 테스트

    - 초대를 수락하면 자동으로 가구 멤버로 추가됨
    """
    # 사용자2의 이메일 설정
    query = select(User).where(User.id == test_user2.id)
    result = await db_session.execute(query)
    user2 = result.scalar_one()
    user2.email = "accept@example.com"
    await db_session.commit()

    # 사용자1이 가구 생성 및 초대
    create_response = await authenticated_client.post(
        "/api/households/",
        json={"name": "초대 수락 테스트"},
    )
    household_id = create_response.json()["id"]

    invite_response = await authenticated_client.post(
        f"/api/households/{household_id}/invitations",
        json={"email": "accept@example.com", "role": "admin"},
    )
    token = invite_response.json()["token"]

    # 사용자2가 초대 수락
    response = await authenticated_client2.post(f"/api/invitations/{token}/accept")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "accepted"
    assert data["responded_at"] is not None

    # 멤버로 추가되었는지 확인
    query = select(HouseholdMember).where(HouseholdMember.household_id == household_id, HouseholdMember.user_id == test_user2.id)
    result = await db_session.execute(query)
    member = result.scalar_one()
    assert member.role == "admin"


@pytest.mark.asyncio
async def test_accept_invitation_이미_멤버인_경우_에러(authenticated_client: AsyncClient, db_session: AsyncSession, test_user: User):
    """이미 멤버인 사용자가 초대 수락 시도 테스트

    - 400 에러 반환
    """
    # 사용자1의 이메일 설정
    query = select(User).where(User.id == test_user.id)
    result = await db_session.execute(query)
    user1 = result.scalar_one()
    user1.email = "member@example.com"
    await db_session.commit()

    # 가구 생성 (사용자1은 이미 owner)
    create_response = await authenticated_client.post(
        "/api/households/",
        json={"name": "중복 멤버 테스트"},
    )
    household_id = create_response.json()["id"]

    # 초대 생성 (DB 직접 조작)
    invitation = HouseholdInvitation(
        household_id=household_id,
        inviter_id=test_user.id,
        invitee_email="member@example.com",
        invitee_user_id=test_user.id,
        token="test-token-123",
        role="member",
        status="pending",
        expires_at=datetime.utcnow() + timedelta(days=7),
    )
    db_session.add(invitation)
    await db_session.commit()

    # 초대 수락 시도
    response = await authenticated_client.post("/api/invitations/test-token-123/accept")
    assert response.status_code == 400
    assert "이미 가구 멤버입니다" in response.json()["detail"]


@pytest.mark.asyncio
async def test_reject_invitation_초대_거절_성공(
    authenticated_client: AsyncClient, authenticated_client2: AsyncClient, db_session: AsyncSession, test_user2: User
):
    """초대 거절 성공 테스트

    - 초대를 거절하면 상태가 rejected로 변경됨
    """
    # 사용자2의 이메일 설정
    query = select(User).where(User.id == test_user2.id)
    result = await db_session.execute(query)
    user2 = result.scalar_one()
    user2.email = "reject@example.com"
    await db_session.commit()

    # 사용자1이 가구 생성 및 초대
    create_response = await authenticated_client.post(
        "/api/households/",
        json={"name": "초대 거절 테스트"},
    )
    household_id = create_response.json()["id"]

    invite_response = await authenticated_client.post(
        f"/api/households/{household_id}/invitations",
        json={"email": "reject@example.com", "role": "member"},
    )
    token = invite_response.json()["token"]

    # 사용자2가 초대 거절
    response = await authenticated_client2.post(f"/api/invitations/{token}/reject")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "rejected"
    assert data["responded_at"] is not None

    # 멤버로 추가되지 않았는지 확인
    query = select(HouseholdMember).where(HouseholdMember.household_id == household_id, HouseholdMember.user_id == test_user2.id)
    result = await db_session.execute(query)
    member = result.scalar_one_or_none()
    assert member is None


@pytest.mark.asyncio
async def test_accept_invitation_만료된_초대(authenticated_client2: AsyncClient, db_session: AsyncSession, test_user: User, test_user2: User):
    """만료된 초대 수락 시도 테스트

    - 만료된 초대는 수락할 수 없음 (400 에러)
    """
    # 사용자2의 이메일 설정
    query = select(User).where(User.id == test_user2.id)
    result = await db_session.execute(query)
    user2 = result.scalar_one()
    user2.email = "expired@example.com"
    await db_session.commit()

    # 가구 생성 (DB 직접 조작)
    household = Household(name="만료 테스트", currency="KRW")
    db_session.add(household)
    await db_session.flush()

    # owner 멤버 추가
    member = HouseholdMember(household_id=household.id, user_id=test_user.id, role="owner")
    db_session.add(member)

    # 만료된 초대 생성
    invitation = HouseholdInvitation(
        household_id=household.id,
        inviter_id=test_user.id,
        invitee_email="expired@example.com",
        invitee_user_id=test_user2.id,
        token="expired-token",
        role="member",
        status="pending",
        expires_at=datetime.utcnow() - timedelta(days=1),  # 이미 만료됨
    )
    db_session.add(invitation)
    await db_session.commit()

    # 만료된 초대 수락 시도
    response = await authenticated_client2.post("/api/invitations/expired-token/accept")
    assert response.status_code == 400
    assert "만료된 초대입니다" in response.json()["detail"]

    # 초대 상태가 expired로 변경되었는지 확인
    query = select(HouseholdInvitation).where(HouseholdInvitation.token == "expired-token")
    result = await db_session.execute(query)
    invitation = result.scalar_one()
    assert invitation.status == "expired"


@pytest.mark.asyncio
async def test_accept_invitation_이미_처리된_초대(authenticated_client2: AsyncClient, db_session: AsyncSession, test_user: User, test_user2: User):
    """이미 처리된 초대 수락 시도 테스트

    - accepted 또는 rejected 상태의 초대는 다시 수락할 수 없음
    """
    # 사용자2의 이메일 설정
    query = select(User).where(User.id == test_user2.id)
    result = await db_session.execute(query)
    user2 = result.scalar_one()
    user2.email = "processed@example.com"
    await db_session.commit()

    # 가구 생성
    household = Household(name="처리된 초대 테스트", currency="KRW")
    db_session.add(household)
    await db_session.flush()

    # owner 멤버 추가
    member = HouseholdMember(household_id=household.id, user_id=test_user.id, role="owner")
    db_session.add(member)

    # 이미 수락된 초대 생성
    invitation = HouseholdInvitation(
        household_id=household.id,
        inviter_id=test_user.id,
        invitee_email="processed@example.com",
        invitee_user_id=test_user2.id,
        token="processed-token",
        role="member",
        status="accepted",  # 이미 수락됨
        expires_at=datetime.utcnow() + timedelta(days=7),
        responded_at=datetime.utcnow(),
    )
    db_session.add(invitation)
    await db_session.commit()

    # 이미 처리된 초대 수락 시도
    response = await authenticated_client2.post("/api/invitations/processed-token/accept")
    assert response.status_code == 400
    assert "이미 처리된 초대입니다" in response.json()["detail"]


# ===== 권한 검증 테스트 =====


@pytest.mark.asyncio
async def test_update_household_member는_수정_불가(
    authenticated_client: AsyncClient, authenticated_client2: AsyncClient, db_session: AsyncSession, test_user2: User
):
    """member 권한으로 가구 수정 시도 테스트

    - member는 가구 정보를 수정할 수 없음 (403 에러)
    """
    # 가구 생성 (사용자1 = owner)
    create_response = await authenticated_client.post(
        "/api/households/",
        json={"name": "권한 테스트"},
    )
    household_id = create_response.json()["id"]

    # 사용자2를 member로 추가
    member = HouseholdMember(household_id=household_id, user_id=test_user2.id, role="member")
    db_session.add(member)
    await db_session.commit()

    # 사용자2(member)가 가구 수정 시도
    response = await authenticated_client2.put(
        f"/api/households/{household_id}",
        json={"name": "변경 시도"},
    )
    assert response.status_code == 403
    assert "관리자 권한이 필요합니다" in response.json()["detail"]


@pytest.mark.asyncio
async def test_create_invitation_member는_초대_불가(
    authenticated_client: AsyncClient, authenticated_client2: AsyncClient, db_session: AsyncSession, test_user2: User
):
    """member 권한으로 초대 생성 시도 테스트

    - member는 초대를 생성할 수 없음 (403 에러)
    """
    # 가구 생성 (사용자1 = owner)
    create_response = await authenticated_client.post(
        "/api/households/",
        json={"name": "초대 권한 테스트"},
    )
    household_id = create_response.json()["id"]

    # 사용자2를 member로 추가
    member = HouseholdMember(household_id=household_id, user_id=test_user2.id, role="member")
    db_session.add(member)
    await db_session.commit()

    # 사용자2(member)가 초대 생성 시도
    response = await authenticated_client2.post(
        f"/api/households/{household_id}/invitations",
        json={"email": "test@example.com", "role": "member"},
    )
    assert response.status_code == 403
    assert "관리자 권한이 필요합니다" in response.json()["detail"]


@pytest.mark.asyncio
async def test_remove_member_member는_추방_불가(
    authenticated_client: AsyncClient, authenticated_client2: AsyncClient, db_session: AsyncSession, test_user: User, test_user2: User
):
    """member 권한으로 다른 멤버 추방 시도 테스트

    - member는 다른 멤버를 추방할 수 없음 (403 에러)
    """
    # 가구 생성 (사용자1 = owner)
    create_response = await authenticated_client.post(
        "/api/households/",
        json={"name": "추방 권한 테스트"},
    )
    household_id = create_response.json()["id"]

    # 사용자2를 member로 추가
    member = HouseholdMember(household_id=household_id, user_id=test_user2.id, role="member")
    db_session.add(member)
    await db_session.commit()

    # 사용자2(member)가 owner(사용자1) 추방 시도
    response = await authenticated_client2.delete(f"/api/households/{household_id}/members/{test_user.id}")
    assert response.status_code == 403
    assert "관리자 권한이 필요합니다" in response.json()["detail"]


# ──────────────────────────────────────────────
# 재가입 시나리오 테스트 (TST-003)
# ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_rejoin_household_after_leave(authenticated_client, authenticated_client2, test_user, test_user2, db_session):
    """탈퇴 후 재초대 수락 시 정상 재가입 (UniqueConstraint 회피)"""
    # 1. 가구 생성 (사용자1 = owner)
    response = await authenticated_client.post("/api/households/", json={"name": "재가입 테스트"})
    assert response.status_code == 201
    household_id = response.json()["id"]

    # 2. 사용자2를 멤버로 추가 (DB 직접 추가)
    member = HouseholdMember(household_id=household_id, user_id=test_user2.id, role="member")
    db_session.add(member)
    await db_session.commit()

    # 3. 사용자2 탈퇴
    response = await authenticated_client2.post(f"/api/households/{household_id}/leave")
    assert response.status_code == 200

    # 탈퇴 확인
    result = await db_session.execute(
        select(HouseholdMember).where(
            HouseholdMember.household_id == household_id,
            HouseholdMember.user_id == test_user2.id,
        )
    )
    left_member = result.scalar_one()
    assert left_member.left_at is not None

    # 4. 사용자1이 사용자2를 다시 초대 (이메일 필요)
    # test_user2에 이메일 설정
    test_user2.email = "user2@test.com"
    await db_session.commit()

    response = await authenticated_client.post(
        f"/api/households/{household_id}/invitations",
        json={"email": "user2@test.com", "role": "member"},
    )
    assert response.status_code == 201
    token = response.json()["token"]

    # 5. 사용자2가 초대 수락 → 재가입 성공 (UniqueConstraint 에러 없이)
    response = await authenticated_client2.post(f"/api/invitations/{token}/accept")
    assert response.status_code == 200

    # 6. 재가입 확인: left_at가 None으로 복원됨
    result = await db_session.execute(
        select(HouseholdMember).where(
            HouseholdMember.household_id == household_id,
            HouseholdMember.user_id == test_user2.id,
            HouseholdMember.left_at.is_(None),
        )
    )
    rejoin_member = result.scalar_one_or_none()
    assert rejoin_member is not None
