# Telegram Account Linking Design

**Goal:** 사용자가 텔레그램 계정을 자신의 가계부 계정에 안전하게 연동할 수 있도록 한다. 비밀번호 노출 없이 단기 코드 방식 사용.

**Date:** 2026-02-22

---

## Problem

기존 `/link {username} {password}` 방식은 텔레그램 채팅창에 비밀번호를 직접 입력해야 해서 보안 위험이 있다.

## Solution

웹에서 단기 코드(6자리 영숫자, 15분 유효)를 발급하고, 텔레그램에서 `/link {코드}`로 연동한다.

---

## Data Model

`User` 테이블에 컬럼 2개 추가:

```python
telegram_link_code: String(8), nullable, indexed
telegram_link_code_expires_at: DateTime(timezone=True), nullable
```

별도 테이블 불필요. 코드 사용 완료 시 두 필드 모두 NULL로 초기화.

---

## Backend API

| Method | Endpoint | Auth | 동작 |
|--------|----------|------|------|
| `POST` | `/api/auth/telegram-link-code` | 필요 | 6자리 코드 생성, User에 저장, `{code, expires_at}` 반환 |
| `DELETE` | `/api/auth/telegram/link` | 필요 | `telegram_chat_id` + 코드 필드 초기화 (연동 해제) |

---

## Telegram Bot Changes

- `/link {code}` — 코드로 User 조회 → 만료 확인 → `telegram_chat_id` 설정 → 코드 삭제
- 기존 `/link {username} {password}` 방식 제거
- `/start`, `/help` 메시지에 연동 방법 안내 추가

---

## Web UI (프로필/설정 페이지)

**미연동 상태:**
- "텔레그램 연동" 섹션
- "코드 발급" 버튼 → 코드 표시 + 복사 버튼 + 만료 시각
- 안내 텍스트: "@봇이름에서 /link {코드} 입력"

**연동 상태:**
- "✅ 텔레그램 연동됨" 표시
- "연동 해제" 버튼

---

## Security

- 코드는 `secrets.token_urlsafe` 기반 생성 (충분한 엔트로피)
- 코드 사용 즉시 삭제 (일회용)
- 15분 만료 후 자동 무효화
- 이미 다른 계정에 연결된 telegram_chat_id는 재연동 불가 (명시적 해제 필요)
