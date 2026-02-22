# Telegram Account Linking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 웹에서 단기 코드를 발급하고 텔레그램에서 `/link {코드}`로 계정을 연동한다. 기존 비밀번호 노출 방식을 제거한다.

**Architecture:** User 테이블에 `telegram_link_code` / `telegram_link_code_expires_at` 컬럼 2개 추가. 웹 API로 코드를 생성하고, 텔레그램 봇이 코드를 검증해 `telegram_chat_id`를 설정한다. 프론트엔드 SettingsPage에 연동 UI를 추가한다.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 (async), Alembic, React 19, TypeScript, Tailwind CSS

---

### Task 1: User 모델에 링크 코드 컬럼 추가 + Alembic 마이그레이션

**Files:**
- Modify: `backend/app/models/user.py`
- Create: `backend/alembic/versions/<new>_add_telegram_link_code.py`

**Step 1: user.py에 컬럼 추가**

`backend/app/models/user.py`에서 `telegram_chat_id` 줄 아래에 추가:

```python
from sqlalchemy import Column, String, Boolean, Integer, BigInteger, DateTime

# 기존 컬럼 아래에 추가
telegram_link_code = Column(String(8), unique=True, index=True, nullable=True)  # 단기 연동 코드
telegram_link_code_expires_at = Column(DateTime(timezone=True), nullable=True)  # 만료 시각
```

**Step 2: Alembic 마이그레이션 생성**

```bash
cd /Users/yyong/Developer/podo-budget/backend
alembic revision --autogenerate -m "add_telegram_link_code"
```

생성된 파일을 열어 `upgrade()`가 아래 두 컬럼을 추가하는지 확인:
```python
op.add_column('users', sa.Column('telegram_link_code', sa.String(length=8), nullable=True))
op.add_column('users', sa.Column('telegram_link_code_expires_at', sa.DateTime(timezone=True), nullable=True))
```

자동 생성이 잘못됐으면 수동으로 작성한다.

**Step 3: 마이그레이션 적용**

```bash
cd backend
alembic upgrade head
```

Expected: `Running upgrade ... -> <rev_id>, add_telegram_link_code`

**Step 4: 커밋**

```bash
cd /Users/yyong/Developer/podo-budget
git add backend/app/models/user.py backend/alembic/versions/
git commit -m "feat: User 모델에 telegram_link_code 컬럼 추가"
```

---

### Task 2: 링크 코드 생성/해제 API 엔드포인트

**Files:**
- Modify: `backend/app/schemas/auth.py`
- Modify: `backend/app/api/auth.py`
- Test: `backend/tests/integration/test_api_auth.py` (있으면 추가, 없으면 새 파일)

**Step 1: 테스트 작성 (TDD)**

`backend/tests/integration/test_api_telegram_link.py` 파일 생성:

```python
"""텔레그램 연동 코드 API 테스트"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_generate_link_code_requires_auth(client: AsyncClient):
    """인증 없이 코드 생성 시 401"""
    response = await client.post("/api/auth/telegram-link-code")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_generate_link_code_returns_code(client: AsyncClient, auth_headers: dict):
    """인증 사용자는 코드를 받는다"""
    response = await client.post("/api/auth/telegram-link-code", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "code" in data
    assert "expires_at" in data
    assert len(data["code"]) == 6


@pytest.mark.asyncio
async def test_generate_link_code_overwrites_previous(client: AsyncClient, auth_headers: dict):
    """재발급 시 이전 코드를 덮어쓴다"""
    r1 = await client.post("/api/auth/telegram-link-code", headers=auth_headers)
    r2 = await client.post("/api/auth/telegram-link-code", headers=auth_headers)
    assert r1.json()["code"] != r2.json()["code"]


@pytest.mark.asyncio
async def test_unlink_telegram_requires_auth(client: AsyncClient):
    """인증 없이 연동 해제 시 401"""
    response = await client.delete("/api/auth/telegram/link")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_unlink_telegram(client: AsyncClient, auth_headers: dict):
    """연동 해제 요청은 200을 반환한다"""
    response = await client.delete("/api/auth/telegram/link", headers=auth_headers)
    assert response.status_code == 200
```

conftest.py에 `auth_headers` 픽스처가 없으면 기존 테스트 파일을 참고해서 확인한다.

**Step 2: 테스트 실패 확인**

```bash
cd backend
pytest tests/integration/test_api_telegram_link.py -v
```

Expected: 5개 FAILED (엔드포인트 없음)

**Step 3: auth 스키마에 응답 타입 추가**

`backend/app/schemas/auth.py` 끝에 추가:

```python
class TelegramLinkCodeResponse(BaseModel):
    """텔레그램 연동 코드 응답"""
    code: str
    expires_at: datetime
```

**Step 4: auth.py에 엔드포인트 추가**

`backend/app/api/auth.py`에 추가 (import 포함):

```python
import secrets
import string
from datetime import datetime, timedelta, timezone

from app.schemas.auth import TelegramLinkCodeResponse

@router.post("/telegram-link-code", response_model=TelegramLinkCodeResponse)
async def generate_telegram_link_code(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """텔레그램 연동용 단기 코드 발급 (15분 유효)"""
    code = "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    current_user.telegram_link_code = code
    current_user.telegram_link_code_expires_at = expires_at
    await db.commit()
    return TelegramLinkCodeResponse(code=code, expires_at=expires_at)


@router.delete("/telegram/link", response_model=MessageResponse)
async def unlink_telegram(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """텔레그램 연동 해제"""
    current_user.telegram_chat_id = None
    current_user.telegram_link_code = None
    current_user.telegram_link_code_expires_at = None
    await db.commit()
    return MessageResponse(message="텔레그램 연동이 해제되었습니다.")
```

`get_db` import가 없으면 추가: `from app.core.database import get_db`

**Step 5: UserResponse에 telegram 상태 추가**

`backend/app/schemas/auth.py`의 `UserResponse`에 필드 추가:

```python
class UserResponse(BaseModel):
    id: int
    username: str
    email: str | None
    is_active: bool
    created_at: datetime
    is_telegram_linked: bool = False  # 추가

    class Config:
        from_attributes = True
```

`backend/app/api/auth.py`의 `get_me` 엔드포인트를 아래처럼 수정:

```python
@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
        "is_telegram_linked": current_user.telegram_chat_id is not None,
    }
```

**Step 6: 테스트 통과 확인**

```bash
pytest tests/integration/test_api_telegram_link.py -v
```

Expected: 5개 PASSED

**Step 7: 전체 테스트 회귀 확인**

```bash
pytest --tb=short -q
```

Expected: 기존 테스트 모두 통과

**Step 8: 커밋**

```bash
git add backend/app/schemas/auth.py backend/app/api/auth.py backend/tests/integration/test_api_telegram_link.py
git commit -m "feat: 텔레그램 연동 코드 생성/해제 API 추가"
```

---

### Task 3: bot_user_service에 코드 기반 연동 함수 추가

**Files:**
- Modify: `backend/app/services/bot_user_service.py`
- Test: `backend/tests/integration/test_api_telegram.py`

**Step 1: 테스트 추가**

`backend/tests/integration/test_api_telegram.py` 끝에 추가:

```python
@pytest.mark.asyncio
async def test_link_by_code_success(client, db_session, mock_telegram_send):
    """유효한 코드로 연동 성공"""
    from datetime import datetime, timedelta, timezone
    from app.models.user import User
    from sqlalchemy import select

    # 웹 계정 사용자에게 링크 코드 설정
    result = await db_session.execute(select(User).limit(1))
    # 새 사용자 생성 후 코드 설정
    web_user = User(username="webuser", email="web@test.com", telegram_link_code="ABC123",
                    telegram_link_code_expires_at=datetime.now(timezone.utc) + timedelta(minutes=10))
    db_session.add(web_user)
    await db_session.commit()

    chat_id = 99999
    payload = {"message": {"chat": {"id": chat_id}, "text": "/link ABC123", "from": {"id": chat_id}}}
    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200
    mock_telegram_send.assert_called_once()
    msg = mock_telegram_send.call_args[0][1]
    assert "연동" in msg or "완료" in msg


@pytest.mark.asyncio
async def test_link_by_code_expired(client, db_session, mock_telegram_send):
    """만료된 코드로 연동 시 실패 메시지"""
    from datetime import datetime, timedelta, timezone
    from app.models.user import User

    web_user = User(username="webuser2", email="web2@test.com", telegram_link_code="EXP999",
                    telegram_link_code_expires_at=datetime.now(timezone.utc) - timedelta(minutes=1))
    db_session.add(web_user)
    await db_session.commit()

    chat_id = 88888
    payload = {"message": {"chat": {"id": chat_id}, "text": "/link EXP999", "from": {"id": chat_id}}}
    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200
    msg = mock_telegram_send.call_args[0][1]
    assert "만료" in msg or "유효하지" in msg


@pytest.mark.asyncio
async def test_link_by_invalid_code(client, db_session, mock_telegram_send):
    """존재하지 않는 코드로 연동 시 실패 메시지"""
    chat_id = 77777
    payload = {"message": {"chat": {"id": chat_id}, "text": "/link XXXXXX", "from": {"id": chat_id}}}
    response = await client.post("/api/telegram/webhook", json=payload)
    assert response.status_code == 200
    msg = mock_telegram_send.call_args[0][1]
    assert "유효하지" in msg or "찾을 수 없" in msg
```

**Step 2: 테스트 실패 확인**

```bash
pytest tests/integration/test_api_telegram.py::test_link_by_code_success -v
```

Expected: FAILED

**Step 3: bot_user_service.py에 코드 기반 연동 함수 추가**

`backend/app/services/bot_user_service.py`에 추가:

```python
from datetime import datetime, timezone

async def link_telegram_account_by_code(
    db: AsyncSession, code: str, telegram_chat_id: str
) -> tuple[bool, str]:
    """코드로 텔레그램 계정을 웹 계정에 연동한다.

    Returns:
        (success: bool, message: str)
    """
    from app.models.user import User
    from sqlalchemy import select

    now = datetime.now(timezone.utc)

    # 코드로 사용자 조회
    result = await db.execute(
        select(User).where(User.telegram_link_code == code)
    )
    user = result.scalar_one_or_none()

    if user is None:
        return False, "❌ 유효하지 않은 코드입니다. 웹에서 새 코드를 발급해주세요."

    # 만료 확인
    if user.telegram_link_code_expires_at is None or user.telegram_link_code_expires_at < now:
        # 만료된 코드 정리
        user.telegram_link_code = None
        user.telegram_link_code_expires_at = None
        await db.commit()
        return False, "⏰ 코드가 만료되었습니다. 웹에서 새 코드를 발급해주세요."

    # 이미 다른 계정에 연동된 chat_id인지 확인
    existing = await db.execute(
        select(User).where(User.telegram_chat_id == telegram_chat_id)
    )
    existing_user = existing.scalar_one_or_none()
    if existing_user and existing_user.id != user.id:
        return False, "⚠️ 이 텔레그램 계정은 이미 다른 웹 계정에 연동되어 있습니다."

    # 연동 설정
    user.telegram_chat_id = telegram_chat_id
    user.telegram_link_code = None
    user.telegram_link_code_expires_at = None
    await db.commit()

    logger.info(f"텔레그램 코드 연동 완료: user_id={user.id} ← chat_id={telegram_chat_id}")
    return True, f"✅ 연동 완료! 이제 이 채팅의 지출이 '{user.username}' 계정에 기록됩니다."
```

**Step 4: 테스트 통과 확인**

```bash
pytest tests/integration/test_api_telegram.py::test_link_by_code_success tests/integration/test_api_telegram.py::test_link_by_code_expired tests/integration/test_api_telegram.py::test_link_by_invalid_code -v
```

Expected: 3개 PASSED

**Step 5: 커밋**

```bash
git add backend/app/services/bot_user_service.py backend/tests/integration/test_api_telegram.py
git commit -m "feat: 코드 기반 텔레그램 연동 서비스 함수 추가"
```

---

### Task 4: 텔레그램 봇 /link 핸들러 교체 + /start /help 메시지 업데이트

**Files:**
- Modify: `backend/app/api/telegram.py`
- Modify: `backend/app/services/bot_messages.py`

**Step 1: telegram.py의 /link 핸들러 교체**

`backend/app/api/telegram.py`에서 기존 `/link` 처리 블록(126~145줄 근처)을 찾아 교체:

기존:
```python
# /link 명령어 처리 (기존 웹 계정 연동)
if user_text.startswith("/link"):
    parts = user_text.split()
    if len(parts) != 3:
        await send_telegram_message(
            chat_id,
            "🔗 계정 연동 방법:\n/link 사용자명 비밀번호\n\n예: /link yyong mypassword\n\n⚠️ 연동하면 이 채팅의 지출이 웹 계정에 직접 기록됩니다.",
        )
        return {"ok": True}
    _, username, password = parts
    linked_user = await link_telegram_account(db, username, password, str(chat_id))
    if linked_user:
        await send_telegram_message(
            chat_id,
            f"✅ 연동 완료! 이제 이 채팅의 지출이 '{linked_user.username}' 계정에 기록됩니다.",
        )
    else:
        await send_telegram_message(chat_id, "❌ 사용자명 또는 비밀번호가 올바르지 않습니다.")
    return {"ok": True}
```

교체:
```python
# /link 명령어 처리 (코드 기반 연동)
if user_text.startswith("/link"):
    parts = user_text.split()
    if len(parts) != 2:
        await send_telegram_message(chat_id, format_link_usage_message())
        return {"ok": True}
    code = parts[1].upper()
    success, message = await link_telegram_account_by_code(db, code, str(chat_id))
    await send_telegram_message(chat_id, message)
    return {"ok": True}
```

import 줄도 수정:
```python
# 기존
from app.services.bot_user_service import get_or_create_bot_user, link_telegram_account
# 변경
from app.services.bot_user_service import get_or_create_bot_user, link_telegram_account_by_code
```

**Step 2: bot_messages.py 업데이트**

`backend/app/services/bot_messages.py`에 새 함수 추가:

```python
def format_link_usage_message() -> str:
    """연동 코드 사용법 안내"""
    return (
        "🔗 텔레그램 계정 연동\n\n"
        "1. 포도가계부 웹사이트에서 로그인\n"
        "2. 설정 → 텔레그램 연동 → 코드 발급\n"
        "3. 아래 형식으로 입력:\n\n"
        "/link ABC123\n\n"
        "⏰ 코드는 15분 후 만료됩니다."
    )
```

`format_help_message()`의 명령어 목록에 `/link` 안내 추가:

```python
def format_help_message() -> str:
    return (
        "📖 포도가계부 사용 가이드\n\n"
        "🗣️ 자연어로 입력하세요:\n"
        '· "점심에 김치찌개 8000원"\n'
        '· "스타벅스 아메리카노 4500원"\n'
        '· "어제 택시비 2만원"\n'
        '· "점심 8천원, 커피 5천원" (여러 지출 동시 입력)\n\n'
        "🤖 AI가 자동으로:\n"
        "✓ 금액 추출\n"
        "✓ 날짜 파악\n"
        "✓ 카테고리 분류\n\n"
        "📱 명령어:\n"
        "/help - 도움말\n"
        "/start - 시작하기\n"
        "/report - 이번 달 지출 요약\n"
        "/budget - 예산 현황\n"
        "/link 코드 - 웹 계정 연동 (설정 페이지에서 코드 발급)"
    )
```

`format_welcome_message()`에 연동 안내 추가:

```python
def format_welcome_message() -> str:
    return (
        "🍇 포도가계부에 오신 걸 환영합니다!\n\n"
        "AI가 알아서 정리해주는 똑똑한 가계부예요.\n"
        "카톡 보내듯 편하게 지출을 입력하면\n"
        "자동으로 카테고리를 분류하고 저장해드립니다.\n\n"
        "📝 사용법은 아주 간단해요:\n"
        '"점심에 김치찌개 8000원"\n'
        '"스타벅스 아메리카노 4500원"\n'
        '"택시비 2만원"\n\n'
        "🔗 웹 계정 연동:\n"
        "설정 페이지에서 코드를 발급받아\n"
        "/link 코드 를 입력하면 연동됩니다.\n\n"
        "지금 바로 시작해볼까요?"
    )
```

**Step 3: 전체 텔레그램 테스트 확인**

```bash
pytest tests/integration/test_api_telegram.py -v --tb=short
```

Expected: 기존 테스트 + 신규 3개 모두 PASSED

**Step 4: 커밋**

```bash
git add backend/app/api/telegram.py backend/app/services/bot_messages.py
git commit -m "feat: 텔레그램 /link 명령어 코드 방식으로 교체, /start /help 연동 안내 추가"
```

---

### Task 5: 프론트엔드 — 설정 페이지에 텔레그램 연동 섹션 추가

**Files:**
- Create: `frontend/src/api/telegram.ts`
- Modify: `frontend/src/pages/SettingsPage.tsx`
- Modify: `frontend/src/contexts/AuthContext.tsx` (is_telegram_linked 타입 반영)

**Step 1: API 클라이언트 생성**

`frontend/src/api/telegram.ts` 생성:

```typescript
import apiClient from './client'

export interface TelegramLinkCode {
  code: string
  expires_at: string
}

export async function generateTelegramLinkCode(): Promise<TelegramLinkCode> {
  const response = await apiClient.post<TelegramLinkCode>('/auth/telegram-link-code')
  return response.data
}

export async function unlinkTelegram(): Promise<void> {
  await apiClient.delete('/auth/telegram/link')
}
```

**Step 2: AuthContext User 타입에 is_telegram_linked 추가**

`frontend/src/contexts/AuthContext.tsx`에서 User 인터페이스 찾아 필드 추가:

```typescript
interface User {
  id: number
  username: string
  email: string | null
  is_active: boolean
  created_at: string
  is_telegram_linked: boolean  // 추가
}
```

**Step 3: SettingsPage.tsx에 텔레그램 연동 섹션 추가**

`frontend/src/pages/SettingsPage.tsx` 전체 교체:

```typescript
/**
 * @file SettingsPage.tsx
 * @description 설정 페이지 - 계정 정보 및 텔레그램 연동
 */

import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { generateTelegramLinkCode, unlinkTelegram } from '../api/telegram'
import toast from 'react-hot-toast'

interface LinkCodeState {
  code: string
  expires_at: string
} | null

export default function SettingsPage() {
  const { user, refreshUser } = useAuth()
  const [linkCode, setLinkCode] = useState<{ code: string; expires_at: string } | null>(null)
  const [loadingCode, setLoadingCode] = useState(false)
  const [loadingUnlink, setLoadingUnlink] = useState(false)

  const formatDate = (dateStr: string): string => dateStr.slice(0, 10).replace(/-/g, '.')

  const handleGenerateCode = async () => {
    setLoadingCode(true)
    try {
      const data = await generateTelegramLinkCode()
      setLinkCode(data)
    } catch {
      toast.error('코드 발급에 실패했습니다.')
    } finally {
      setLoadingCode(false)
    }
  }

  const handleUnlink = async () => {
    if (!confirm('텔레그램 연동을 해제할까요?')) return
    setLoadingUnlink(true)
    try {
      await unlinkTelegram()
      toast.success('텔레그램 연동이 해제되었습니다.')
      await refreshUser()
      setLinkCode(null)
    } catch {
      toast.error('연동 해제에 실패했습니다.')
    } finally {
      setLoadingUnlink(false)
    }
  }

  const handleCopyCode = async () => {
    if (!linkCode) return
    await navigator.clipboard.writeText(`/link ${linkCode.code}`)
    toast.success('복사되었습니다!')
  }

  if (!user) return null

  const expiresAt = linkCode
    ? new Date(linkCode.expires_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-warm-900">설정</h1>

      {/* 계정 정보 */}
      <div className="bg-white rounded-2xl shadow-sm border border-warm-200 p-6">
        <h2 className="text-lg font-semibold text-warm-900 mb-4">계정 정보</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-warm-100">
            <span className="text-sm font-medium text-warm-600">사용자명</span>
            <span className="text-sm text-warm-900">{user.username}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-warm-100">
            <span className="text-sm font-medium text-warm-600">이메일</span>
            <span className="text-sm text-warm-900">{user.email || '미등록'}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium text-warm-600">가입일</span>
            <span className="text-sm text-warm-900">{formatDate(user.created_at)}</span>
          </div>
        </div>
      </div>

      {/* 텔레그램 연동 */}
      <div className="bg-white rounded-2xl shadow-sm border border-warm-200 p-6">
        <h2 className="text-lg font-semibold text-warm-900 mb-1">텔레그램 연동</h2>
        <p className="text-sm text-warm-500 mb-4">
          텔레그램 봇에서 자연어로 지출을 입력할 수 있습니다.
        </p>

        {user.is_telegram_linked ? (
          /* 연동 상태 */
          <div className="flex items-center justify-between">
            <span className="text-sm text-leaf-600 font-medium">✅ 연동됨</span>
            <button
              onClick={handleUnlink}
              disabled={loadingUnlink}
              className="text-sm text-warm-500 hover:text-red-500 underline disabled:opacity-50"
            >
              {loadingUnlink ? '해제 중...' : '연동 해제'}
            </button>
          </div>
        ) : (
          /* 미연동 상태 */
          <div className="space-y-3">
            {linkCode ? (
              <div className="bg-grape-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xl font-bold text-grape-700 tracking-widest">
                    {linkCode.code}
                  </span>
                  <button
                    onClick={handleCopyCode}
                    className="text-xs text-grape-600 border border-grape-300 rounded-lg px-3 py-1 hover:bg-grape-100"
                  >
                    /link {linkCode.code} 복사
                  </button>
                </div>
                <p className="text-xs text-warm-500">⏰ {expiresAt}까지 유효</p>
                <p className="text-sm text-warm-600">
                  텔레그램 봇에서 위 코드를 입력하세요:
                  <br />
                  <span className="font-mono text-grape-700">/link {linkCode.code}</span>
                </p>
              </div>
            ) : (
              <button
                onClick={handleGenerateCode}
                disabled={loadingCode}
                className="w-full py-2.5 rounded-xl bg-grape-600 text-white text-sm font-medium hover:bg-grape-700 disabled:opacity-50"
              >
                {loadingCode ? '발급 중...' : '연동 코드 발급'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
```

**Step 4: AuthContext에 refreshUser 함수 확인**

`frontend/src/contexts/AuthContext.tsx`를 열어 `refreshUser` 함수가 있는지 확인한다. 없으면 아래처럼 추가:

```typescript
const refreshUser = async () => {
  try {
    const response = await apiClient.get('/auth/me')
    setUser(response.data)
  } catch {
    // 무시
  }
}
// context value에도 refreshUser 추가
```

**Step 5: 개발 서버에서 확인**

```bash
cd frontend
npm run dev
```

브라우저에서 `/settings` 접속 → "텔레그램 연동" 섹션 확인.

**Step 6: 커밋**

```bash
cd /Users/yyong/Developer/podo-budget
git add frontend/src/api/telegram.ts frontend/src/pages/SettingsPage.tsx frontend/src/contexts/AuthContext.tsx
git commit -m "feat: 설정 페이지에 텔레그램 연동 UI 추가"
```

---

### Task 6: 전체 테스트 + 배포

**Step 1: 전체 백엔드 테스트**

```bash
cd backend
pytest --tb=short -q
```

Expected: 모두 PASSED (기존 테스트 회귀 없음)

**Step 2: 프론트엔드 빌드 확인**

```bash
cd frontend
npm run build
```

Expected: 빌드 성공

**Step 3: PR 생성 및 머지**

```bash
cd /Users/yyong/Developer/podo-budget
git checkout -b feat/telegram-link-code
git push -u origin feat/telegram-link-code
gh pr create --title "feat: 텔레그램 코드 기반 계정 연동" --body "..."
gh pr merge --merge --delete-branch
```
