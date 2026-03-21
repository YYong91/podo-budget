# 카카오 콜백 기능 — 5초 타임아웃 근본 해결 (#288)

## 목표
카카오 오픈빌더 콜백 API를 활용하여 LLM 파싱 타임아웃 문제를 근본 해결한다.
환경변수로 on/off 토글하여 승인 전에는 기존 방식, 승인 후 콜백 모드 전환.

## 플로우

### 콜백 모드 (KAKAO_CALLBACK_ENABLED=true)
```
사용자 → "점심 8000원"
카카오 → webhook (callbackUrl 포함)
서버 → 즉시 {"useCallback": true, "data": {"text": "⏳ 분석 중이에요"}} 반환
서버 → 백그라운드 태스크: LLM 파싱 → DB 저장 → callbackUrl로 결과 POST
사용자 ← "🍇 김치찌개 8,000원 기록했어요"
```

### 기존 모드 (KAKAO_CALLBACK_ENABLED=false, 기본값)
기존 동작 그대로 (4.5초 타임아웃 + "다시 시도" 안내)

## 구현

### 1. config.py — 환경변수 추가
```python
KAKAO_CALLBACK_ENABLED: bool = False
```

### 2. kakao.py — webhook 수정

`_handle_expense_input`에서:
1. callbackUrl이 있고 콜백 모드이면 → 즉시 응답 + 백그라운드 태스크
2. 그 외 → 기존 동작

```python
async def _handle_expense_input(utterance, bot_user, db, active_household_id, callback_url=None):
    if callback_url and settings.KAKAO_CALLBACK_ENABLED:
        # 백그라운드 태스크 시작
        asyncio.create_task(_process_and_callback(utterance, bot_user, db, active_household_id, callback_url))
        # 즉시 "분석 중" 응답
        return make_callback_pending_response("⏳ 분석 중이에요")
    # 기존 동작 (4.5초 타임아웃)
    ...
```

### 3. 콜백 응답 헬퍼
```python
def make_callback_pending_response(text: str) -> dict:
    return {"version": "2.0", "useCallback": True, "data": {"text": text}}
```

### 4. 백그라운드 처리 + 콜백 전송
```python
async def _process_and_callback(utterance, bot_user, db, active_household_id, callback_url):
    try:
        # LLM 파싱 (타임아웃 없이)
        result = await _do_expense_processing(utterance, bot_user, db, active_household_id)
        # 콜백 URL로 결과 전송
        await _send_callback_response(callback_url, result)
    except Exception as e:
        logger.error(f"카카오 콜백 처리 실패: {e}")
        await _send_callback_response(callback_url, make_simple_text_response(format_server_error()))

async def _send_callback_response(callback_url: str, response: dict) -> None:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(callback_url, json=response)
        if resp.status_code != 200:
            logger.error(f"카카오 콜백 전송 실패: {resp.status_code}")
```

### 5. DB 세션 관리
백그라운드 태스크에서는 기존 db 세션을 사용할 수 없음 (요청 끝나면 닫힘).
새 세션을 생성해야 함:

```python
async def _process_and_callback(..., callback_url):
    from app.core.database import async_session_factory
    async with async_session_factory() as db:
        # 처리...
```

## 변경 파일
| 파일 | 변경 |
|------|------|
| `core/config.py` | `KAKAO_CALLBACK_ENABLED` 추가 |
| `api/kakao.py` | 콜백 모드 분기, 백그라운드 태스크, 콜백 전송 |
| `tests/integration/test_api_kakao.py` | 콜백 모드 테스트 |
