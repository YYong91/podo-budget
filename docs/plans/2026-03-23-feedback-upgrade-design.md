# 피드백 시스템 업그레이드 디자인

## 배경

현재 피드백은 웹에서만 제출 가능. 봇 사용자는 피드백을 보내려면 웹에 접속해야 함.
또한 피드백이 들어와도 관리자에게 알림이 없어 놓치기 쉬움.

## 변경 사항

### 1. 봇 피드백 채널

카카오톡/텔레그램 봇에서 피드백 제출 가능.

**트리거:** `/feedback`, "피드백", "건의"

**플로우:**

```
유저: "피드백 검색 기능이 있으면 좋겠어요"
봇:  "✅ 피드백 감사합니다! 개발팀에게 전달했어요.
      웹에서 진행 상황을 확인할 수 있어요."

유저: "피드백"  (내용 없이)
봇:  "💬 피드백을 보내주세요!
      예시: '피드백 검색 기능이 있으면 좋겠어요'
      예시: '버그 카테고리가 안 보여요'"
```

- "피드백" 뒤 텍스트가 있으면 바로 저장
- "버그"로 시작하면 type=bug, 아니면 type=feature 자동 분류
- title은 내용 앞 20자, content는 전체

### 2. 관리자 알림

피드백 생성 시 관리자 텔레그램으로 알림 전송:

```
📬 새 피드백 (기능 요청)
From: username (kakao)
───
검색 기능이 있으면 좋겠어요
```

- 기존 텔레그램 `send_telegram_message` 함수 재활용
- 관리자 chat_id는 환경변수 (`ADMIN_TELEGRAM_CHAT_ID`)
- 웹/봇 모든 소스에서 알림 발송

### 3. 소스 추적

Feedback 모델에 `source` 필드 추가:

```python
source = Column(String, nullable=False, default="web")  # "web" | "telegram" | "kakao"
```

- 기존 데이터는 "web"으로 기본값
- 관리자 대시보드 + 피드백 카드에 소스 뱃지 표시

## 변경 범위

| 파일 | 변경 |
|------|------|
| `models/feedback.py` | `source` 컬럼 추가 |
| `schemas/feedback.py` | source 필드 추가 |
| `alembic/` | 마이그레이션 1개 |
| `api/kakao.py` | `/feedback` 핸들러 + COMMAND_ALIASES |
| `api/telegram.py` | `/feedback` 핸들러 |
| `api/feedback.py` | 생성 시 관리자 알림 호출 |
| `services/bot_messages.py` | 피드백 관련 메시지 템플릿 |
| `frontend/` | 피드백 카드에 source 뱃지 표시 |

## 향후 확장 (별도 이슈)

- 관리자 답변 기능 (유저가 많아지면)
- 투표/공감 (유저 수 증가 시)
- 스크린샷 첨부 (파일 업로드 인프라 필요)
