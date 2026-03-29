# 피드백 시스템 업그레이드 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 봇(카카오/텔레그램)에서 피드백 제출 + 관리자 알림 + 소스 추적 추가

**Architecture:** Feedback 모델에 source 필드 추가, 봇 핸들러에 /feedback 명령어 등록, 피드백 생성 시 관리자 텔레그램 알림 전송. 알림은 기존 `send_telegram_message` 재활용.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, Telegram Bot API, 카카오 i 오픈빌더 응답 포맷

**Design doc:** `docs/plans/2026-03-23-feedback-upgrade-design.md`
**Issue:** #83

---

### Task 1: Feedback 모델에 source 필드 추가

**Files:**
- Modify: `backend/app/models/feedback.py`
- Modify: `backend/app/schemas/feedback.py`
- Test: `backend/tests/integration/test_api_feedback.py` (기존 테스트 확인)

**Step 1: 모델에 source 컬럼 추가**

`backend/app/models/feedback.py`:
```python
source = Column(String, nullable=False, default="web")  # "web" | "telegram" | "kakao"
```

**Step 2: 스키마에 source 필드 추가**

`backend/app/schemas/feedback.py`:
- `FeedbackCreate`에 `source: Literal["web", "telegram", "kakao"] = "web"` 추가
- `FeedbackResponse`에 `source: str` 추가

**Step 3: API 응답에 source 포함**

`backend/app/api/feedback.py`:
- `_to_response` 함수에 `source=feedback.source` 추가

**Step 4: Alembic 마이그레이션 생성 및 적용**

```bash
cd backend && alembic revision --autogenerate -m "add source field to feedback"
cd backend && alembic upgrade head
```

**Step 5: 기존 테스트 통과 확인**

```bash
cd backend && pytest tests/integration/test_api_feedback.py -v
```

**Step 6: 커밋**

```bash
git add backend/app/models/feedback.py backend/app/schemas/feedback.py backend/app/api/feedback.py backend/alembic/
git commit -m "feat: Feedback 모델에 source 필드 추가 (web/telegram/kakao)"
```

---

### Task 2: 관리자 텔레그램 알림 서비스

**Files:**
- Modify: `backend/app/core/config.py` — `ADMIN_TELEGRAM_CHAT_ID` 설정 추가
- Create: `backend/app/services/feedback_notify.py` — 알림 서비스
- Test: `backend/tests/unit/test_feedback_notify.py`

**Step 1: config에 ADMIN_TELEGRAM_CHAT_ID 추가**

`backend/app/core/config.py` Settings 클래스에:
```python
ADMIN_TELEGRAM_CHAT_ID: str = ""  # 피드백 알림 수신할 관리자 텔레그램 채팅 ID
```

**Step 2: 알림 테스트 작성**

`backend/tests/unit/test_feedback_notify.py`:
```python
import pytest
from unittest.mock import AsyncMock, patch

from app.services.feedback_notify import notify_admin_feedback


@pytest.mark.asyncio
async def test_notify_admin_feedback_sends_message():
    """관리자 chat_id 설정 시 텔레그램 메시지 전송"""
    with patch("app.services.feedback_notify.settings") as mock_settings, \
         patch("app.services.feedback_notify.send_telegram_message", new_callable=AsyncMock) as mock_send:
        mock_settings.ADMIN_TELEGRAM_CHAT_ID = "12345"
        mock_settings.TELEGRAM_BOT_TOKEN = "test-token"

        await notify_admin_feedback(
            username="testuser",
            feedback_type="feature",
            title="검색 기능 요청",
            content="검색 기능이 있으면 좋겠어요",
            source="kakao",
        )

        mock_send.assert_called_once()
        msg = mock_send.call_args[1]["text"] if "text" in mock_send.call_args[1] else mock_send.call_args[0][1]
        assert "검색 기능 요청" in msg
        assert "kakao" in msg


@pytest.mark.asyncio
async def test_notify_admin_feedback_skips_when_no_chat_id():
    """관리자 chat_id 미설정 시 전송하지 않음"""
    with patch("app.services.feedback_notify.settings") as mock_settings, \
         patch("app.services.feedback_notify.send_telegram_message", new_callable=AsyncMock) as mock_send:
        mock_settings.ADMIN_TELEGRAM_CHAT_ID = ""

        await notify_admin_feedback(
            username="testuser",
            feedback_type="bug",
            title="버그 신고",
            content="카테고리가 안 보여요",
            source="web",
        )

        mock_send.assert_not_called()
```

**Step 3: 테스트 실행 → 실패 확인**

```bash
cd backend && pytest tests/unit/test_feedback_notify.py -v
```

**Step 4: 알림 서비스 구현**

`backend/app/services/feedback_notify.py`:
```python
"""피드백 관리자 알림 서비스"""

import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

TYPE_LABEL = {"feature": "기능 요청", "bug": "버그 신고"}
SOURCE_LABEL = {"web": "웹", "telegram": "텔레그램", "kakao": "카카오톡"}


async def notify_admin_feedback(
    username: str,
    feedback_type: str,
    title: str,
    content: str,
    source: str,
) -> None:
    """새 피드백 등록 시 관리자 텔레그램으로 알림 전송

    ADMIN_TELEGRAM_CHAT_ID가 미설정이면 무시합니다.
    """
    if not settings.ADMIN_TELEGRAM_CHAT_ID:
        return

    from app.api.telegram import send_telegram_message

    type_label = TYPE_LABEL.get(feedback_type, feedback_type)
    source_label = SOURCE_LABEL.get(source, source)

    text = (
        f"📬 새 피드백 ({type_label})\n"
        f"From: {username} ({source_label})\n"
        f"───\n"
        f"📌 {title}\n"
        f"{content[:500]}"
    )

    try:
        await send_telegram_message(int(settings.ADMIN_TELEGRAM_CHAT_ID), text)
    except Exception as e:
        logger.error(f"피드백 알림 전송 실패: {e}")
```

**Step 5: 테스트 통과 확인**

```bash
cd backend && pytest tests/unit/test_feedback_notify.py -v
```

**Step 6: 웹 API에 알림 연동**

`backend/app/api/feedback.py`의 `create_feedback` 엔드포인트 마지막에 추가:
```python
from app.services.feedback_notify import notify_admin_feedback
import asyncio

# commit 후, 응답 반환 전
asyncio.create_task(notify_admin_feedback(
    username=current_user.username or "unknown",
    feedback_type=data.type,
    title=data.title,
    content=data.content,
    source=data.source,
))
```

**Step 7: 커밋**

```bash
git add backend/app/core/config.py backend/app/services/feedback_notify.py backend/tests/unit/test_feedback_notify.py backend/app/api/feedback.py
git commit -m "feat: 피드백 생성 시 관리자 텔레그램 알림 전송"
```

---

### Task 3: 카카오톡 봇 피드백 명령어

**Files:**
- Modify: `backend/app/api/kakao.py` — `/feedback` 핸들러 + COMMAND_ALIASES
- Modify: `backend/app/services/bot_messages.py` — 메시지 템플릿
- Test: `backend/tests/integration/test_api_kakao.py`

**Step 1: bot_messages.py에 피드백 메시지 템플릿 추가**

```python
def format_feedback_received() -> str:
    """피드백 접수 완료 메시지"""
    return "✅ 피드백 감사합니다! 개발팀에게 전달했어요.\n웹에서 진행 상황을 확인할 수 있어요."


def format_feedback_guide() -> str:
    """피드백 사용법 안내 메시지"""
    return (
        "💬 피드백을 보내주세요!\n\n"
        "예시:\n"
        "· 피드백 검색 기능이 있으면 좋겠어요\n"
        "· 버그 카테고리가 안 보여요\n\n"
        "'버그'로 시작하면 버그 신고로 분류돼요."
    )
```

**Step 2: kakao.py에 /feedback 핸들러 추가**

COMMAND_ALIASES에 추가:
```python
"피드백": ("/feedback", True),
"건의": ("/feedback", True),
```

핸들러 함수:
```python
async def _handle_feedback_command(utterance: str, bot_user: Any, db: AsyncSession, active_household_id: int | None) -> dict:
    """``/feedback`` 명령어 처리"""
    # "/feedback" 제거 후 내용 추출
    content = utterance.replace("/feedback", "").strip()
    if not content:
        return make_simple_text_response(
            format_feedback_guide(),
            quick_replies=[make_quick_reply("❓ 도움말", "도움말")],
        )

    # "버그"로 시작하면 bug, 아니면 feature
    feedback_type = "bug" if content.startswith("버그") else "feature"
    title = content[:50]

    feedback = Feedback(
        user_id=bot_user.id,
        type=feedback_type,
        title=title,
        content=content,
        source="kakao",
    )
    db.add(feedback)
    await db.commit()

    # 관리자 알림 (비동기)
    import asyncio
    from app.services.feedback_notify import notify_admin_feedback
    asyncio.create_task(notify_admin_feedback(
        username=bot_user.username or "unknown",
        feedback_type=feedback_type,
        title=title,
        content=content,
        source="kakao",
    ))

    return make_simple_text_response(
        format_feedback_received(),
        quick_replies=[
            make_quick_reply("📊 이번달 보기", "리포트"),
            make_quick_reply("❓ 도움말", "도움말"),
        ],
    )
```

_COMMAND_HANDLERS에 등록:
```python
"/feedback": _handle_feedback_command,
```

**Step 3: 테스트 작성 및 실행**

카카오 피드백 명령어 테스트를 `tests/integration/test_api_kakao.py`에 추가:
- 내용 있는 피드백 제출 → 201 + "감사합니다" 응답
- 내용 없이 "피드백" → 가이드 메시지 응답
- "버그"로 시작 → type=bug 확인

```bash
cd backend && pytest tests/integration/test_api_kakao.py -v -k feedback
```

**Step 4: 커밋**

```bash
git add backend/app/api/kakao.py backend/app/services/bot_messages.py backend/tests/integration/test_api_kakao.py
git commit -m "feat: 카카오톡 봇 피드백 명령어 추가 (/feedback, 피드백, 건의)"
```

---

### Task 4: 텔레그램 봇 피드백 명령어

**Files:**
- Modify: `backend/app/api/telegram.py` — `/feedback` 핸들러
- Test: `backend/tests/integration/test_api_telegram.py`

**Step 1: telegram.py에 /feedback 핸들러 추가**

```python
async def _handle_feedback_command(chat_id: int, user_text: str, bot_user: Any, db: AsyncSession, active_household_id: int | None) -> dict:
    """``/feedback`` 명령어 처리"""
    content = user_text.replace("/feedback", "").strip()
    if not content:
        await send_telegram_message(
            chat_id,
            format_feedback_guide(),
            reply_markup={
                "inline_keyboard": [[
                    {"text": "📖 사용법 보기", "callback_data": "cmd:help"},
                ]]
            },
        )
        return {"ok": True}

    feedback_type = "bug" if content.startswith("버그") else "feature"
    title = content[:50]

    feedback = Feedback(
        user_id=bot_user.id,
        type=feedback_type,
        title=title,
        content=content,
        source="telegram",
    )
    db.add(feedback)
    await db.commit()

    import asyncio
    from app.services.feedback_notify import notify_admin_feedback
    asyncio.create_task(notify_admin_feedback(
        username=bot_user.username or "unknown",
        feedback_type=feedback_type,
        title=title,
        content=content,
        source="telegram",
    ))

    await send_telegram_message(chat_id, format_feedback_received())
    return {"ok": True}
```

_COMMAND_HANDLERS에 등록:
```python
"/feedback": _handle_feedback_command,
```

**Step 2: 테스트 작성 및 실행**

```bash
cd backend && pytest tests/integration/test_api_telegram.py -v -k feedback
```

**Step 3: 커밋**

```bash
git add backend/app/api/telegram.py backend/tests/integration/test_api_telegram.py
git commit -m "feat: 텔레그램 봇 피드백 명령어 추가 (/feedback)"
```

---

### Task 5: 프론트엔드 source 뱃지 표시

**Files:**
- Modify: `frontend/src/types/index.ts` — Feedback 타입에 source 추가
- Modify: `frontend/src/pages/FeedbackPage.tsx` — 카드에 source 뱃지
- Modify: `frontend/src/components/admin/AdminFeedbackDashboard.tsx` — source 필터 + 뱃지

**Step 1: 타입 수정**

`frontend/src/types/index.ts`의 `Feedback` 인터페이스에:
```typescript
source: 'web' | 'telegram' | 'kakao'
```

**Step 2: FeedbackPage 카드에 소스 뱃지 추가**

소스 아이콘/텍스트 매핑:
```typescript
const SOURCE_LABELS: Record<string, { text: string; className: string }> = {
  web: { text: '웹', className: 'bg-blue-50 text-blue-600' },
  telegram: { text: 'TG', className: 'bg-sky-50 text-sky-600' },
  kakao: { text: '카톡', className: 'bg-yellow-50 text-yellow-700' },
}
```

FeedbackCard의 헤더 영역에 기존 type 뱃지 옆에 source 뱃지 표시.

**Step 3: AdminFeedbackDashboard에 소스 필터 추가**

기존 typeFilter와 동일 패턴으로 sourceFilter 추가:
- 전체 / 웹 / 텔레그램 / 카카오톡

**Step 4: 프론트엔드 테스트 + 빌드 확인**

```bash
cd frontend && npm run lint && npm run test:run && npm run build
```

**Step 5: 커밋**

```bash
git add frontend/src/types/index.ts frontend/src/pages/FeedbackPage.tsx frontend/src/components/admin/AdminFeedbackDashboard.tsx
git commit -m "feat: 피드백 카드에 소스 뱃지 + 관리자 소스 필터 추가"
```

---

### Task 6: 도움말 메시지 업데이트 + 전체 테스트

**Files:**
- Modify: `backend/app/services/bot_messages.py` — 도움말에 피드백 명령어 추가
- 확인: 전체 테스트 스위트

**Step 1: 도움말 메시지에 피드백 명령어 추가**

`format_help_message()`의 명령어 목록에 추가:
```
· 피드백 [내용] — 의견이나 버그 신고
```

**Step 2: 전체 테스트 실행**

```bash
cd backend && pytest --ignore=tests/integration/test_api_budget_bulk.py -v
cd frontend && npm run lint && npm run test:run && npm run build
```

**Step 3: 커밋**

```bash
git add backend/app/services/bot_messages.py
git commit -m "docs: 봇 도움말에 피드백 명령어 안내 추가"
```

---

### Task 7: 환경변수 설정 + PR

**Step 1: .env.example에 ADMIN_TELEGRAM_CHAT_ID 추가**

**Step 2: dev/prod 환경에 ADMIN_TELEGRAM_CHAT_ID 설정**

```bash
fly secrets set ADMIN_TELEGRAM_CHAT_ID="관리자_채팅_ID" --app podo-budget-dev
fly secrets set ADMIN_TELEGRAM_CHAT_ID="관리자_채팅_ID" --app podo-budget-backend
```

**Step 3: PR 생성**

```bash
gh pr create --base develop --title "feat: 봇 피드백 채널 + 관리자 알림 + 소스 추적 (#83)" \
  --body "close #83 ..."
```
