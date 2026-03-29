# 봇 응답 메시지 전면 리디자인 구현 계획 (#286)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** bot_messages.py 전체 메시지를 UX 리서치 기반으로 리디자인하고, 텔레그램/카카오 핸들러에 수입 삭제·지출↔수입 변환·3 Strike 에러 처리를 추가한다.

**Architecture:** bot_messages.py는 순수 함수 모듈로 유지하고, 새로운 bot_strike_service.py(in-memory TTL 카운터)를 추가. 텔레그램/카카오 핸들러에서 새 콜백(delete_income, convert_to_expense, convert_to_income)을 디스패치 테이블에 등록. 카카오 undo는 Expense+Income 중 최신을 삭제하도록 확장.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0 async, pytest + pytest-asyncio

---

## Task 1: 3 Strike 에러 카운터 서비스

**Files:**
- Create: `backend/app/services/bot_strike_service.py`
- Test: `backend/tests/unit/test_bot_strike_service.py`

**Step 1: 테스트 작성**

```python
# backend/tests/unit/test_bot_strike_service.py
"""3 Strike 에러 카운터 단위 테스트"""

import time

from app.services.bot_strike_service import (
    _error_counts,
    get_strike_count,
    increment_strike,
    reset_strike,
)


def test_initial_strike_count_is_zero():
    """초기 strike 카운트는 0"""
    _error_counts.clear()
    assert get_strike_count("telegram", "12345") == 0


def test_increment_strike_returns_new_count():
    """increment 후 1 반환"""
    _error_counts.clear()
    count = increment_strike("telegram", "12345")
    assert count == 1


def test_increment_strike_accumulates():
    """연속 increment 시 누적"""
    _error_counts.clear()
    increment_strike("telegram", "12345")
    increment_strike("telegram", "12345")
    count = increment_strike("telegram", "12345")
    assert count == 3


def test_reset_strike_clears_count():
    """reset 후 0으로 복귀"""
    _error_counts.clear()
    increment_strike("telegram", "12345")
    increment_strike("telegram", "12345")
    reset_strike("telegram", "12345")
    assert get_strike_count("telegram", "12345") == 0


def test_different_users_isolated():
    """서로 다른 사용자의 카운트는 독립"""
    _error_counts.clear()
    increment_strike("telegram", "111")
    increment_strike("telegram", "111")
    increment_strike("telegram", "222")
    assert get_strike_count("telegram", "111") == 2
    assert get_strike_count("telegram", "222") == 1


def test_different_platforms_isolated():
    """서로 다른 플랫폼의 카운트는 독립"""
    _error_counts.clear()
    increment_strike("telegram", "111")
    increment_strike("kakao", "111")
    assert get_strike_count("telegram", "111") == 1
    assert get_strike_count("kakao", "111") == 1


def test_expired_strike_returns_zero():
    """TTL 만료 후 카운트 0으로 리셋"""
    _error_counts.clear()
    increment_strike("telegram", "12345")
    # TTL 강제 만료 시뮬레이션
    key = "telegram:12345"
    count, _ = _error_counts[key]
    _error_counts[key] = (count, time.time() - 1801)  # 30분 + 1초 전
    assert get_strike_count("telegram", "12345") == 0
```

**Step 2: 테스트 실행 → 실패 확인**

```bash
cd backend && python -m pytest tests/unit/test_bot_strike_service.py -v
```
Expected: FAIL (import error)

**Step 3: 구현**

```python
# backend/app/services/bot_strike_service.py
"""3 Strike 에러 카운터 (in-memory, TTL 30분)

사용자가 연속으로 파싱 실패할 때 점진적 안내를 제공하기 위한 카운터.
서버 재시작 시 자연스럽게 리셋됨 (의도된 동작).
"""

import time

# key: "{platform}:{user_id}", value: (count, last_updated_timestamp)
_error_counts: dict[str, tuple[int, float]] = {}

STRIKE_TTL_SECONDS = 1800  # 30분


def _make_key(platform: str, user_id: str) -> str:
    return f"{platform}:{user_id}"


def get_strike_count(platform: str, user_id: str) -> int:
    """현재 strike 카운트 반환 (TTL 만료 시 0)"""
    key = _make_key(platform, user_id)
    entry = _error_counts.get(key)
    if entry is None:
        return 0
    count, updated_at = entry
    if time.time() - updated_at > STRIKE_TTL_SECONDS:
        del _error_counts[key]
        return 0
    return count


def increment_strike(platform: str, user_id: str) -> int:
    """strike 카운트 1 증가, 새 카운트 반환"""
    current = get_strike_count(platform, user_id)
    new_count = current + 1
    _error_counts[_make_key(platform, user_id)] = (new_count, time.time())
    return new_count


def reset_strike(platform: str, user_id: str) -> None:
    """strike 카운트 초기화 (파싱 성공 시 호출)"""
    key = _make_key(platform, user_id)
    _error_counts.pop(key, None)
```

**Step 4: 테스트 실행 → 통과 확인**

```bash
cd backend && python -m pytest tests/unit/test_bot_strike_service.py -v
```
Expected: ALL PASS

**Step 5: 커밋**

```bash
git add backend/app/services/bot_strike_service.py backend/tests/unit/test_bot_strike_service.py
git commit -m "feat: 3 Strike 에러 카운터 서비스 추가 (#286)"
```

---

## Task 2: bot_messages.py 메시지 리디자인

**Files:**
- Modify: `backend/app/services/bot_messages.py` (전체 리디자인)
- Modify: `backend/tests/unit/test_bot_messages.py` (테스트 업데이트)

**Step 1: 테스트 먼저 업데이트**

기존 테스트가 현재 메시지 포맷을 검증하므로, 리디자인된 포맷에 맞게 테스트를 먼저 수정.

```python
# backend/tests/unit/test_bot_messages.py — 전체 교체
"""
봇 메시지 템플릿 단위 테스트

- format 함수들의 출력 형식 검증
- 리디자인된 메시지 포맷 (한국어 날짜, 간결한 톤)
- 3 Strike 에러 메시지 분기
"""

from datetime import datetime

from app.services.bot_messages import (
    format_budget_status,
    format_delete_confirm,
    format_expense_saved,
    format_help_message,
    format_income_saved,
    format_korean_date,
    format_mixed_saved,
    format_parse_error,
    format_report_message,
    format_server_error,
    format_timeout_message,
    format_welcome_message,
)


# ── 날짜 포맷 ──


def test_format_korean_date_today():
    """오늘 날짜는 '오늘'로 표시"""
    today = datetime.now()
    result = format_korean_date(today)
    assert result == "오늘"


def test_format_korean_date_yesterday():
    """어제 날짜는 '어제'로 표시"""
    from datetime import timedelta

    yesterday = datetime.now() - timedelta(days=1)
    result = format_korean_date(yesterday)
    assert result == "어제"


def test_format_korean_date_other():
    """그 외 날짜는 'M월 D일 (요일)' 형식"""
    # 2026-03-20은 금요일
    date = datetime(2026, 3, 20)
    result = format_korean_date(date)
    assert result == "3월 20일 (금)"


# ── 지출 저장 ──


def test_format_expense_saved():
    """지출 저장 메시지: 설명+금액 한 줄, 한국어 날짜"""
    result = format_expense_saved(
        amount=8000, category="식비", description="김치찌개", date="2026-03-20"
    )
    assert "김치찌개" in result
    assert "8,000원" in result
    assert "식비" in result
    # 한국어 날짜 포맷 (오늘이 아니면 M월 D일)
    assert "3월 20일" in result or "오늘" in result


def test_format_expense_saved_large_amount():
    """큰 금액의 천 단위 콤마 포맷"""
    result = format_expense_saved(
        amount=1500000, category="주거", description="월세", date="2026-02-01"
    )
    assert "1,500,000원" in result


# ── 수입 저장 ──


def test_format_income_saved():
    """수입 저장 메시지 포맷"""
    result = format_income_saved(
        amount=3000000, category="급여", description="월급", date="2026-03-20"
    )
    assert "월급" in result
    assert "3,000,000원" in result
    assert "수입" in result


# ── 혼합 저장 ──


def test_format_mixed_saved():
    """혼합 저장 메시지: 건수 + 상세 내역"""
    items = [
        {"amount": 8000, "description": "김치찌개", "category": "식비", "type": "expense"},
        {"amount": 50000, "description": "용돈", "category": "기타수입", "type": "income"},
    ]
    result = format_mixed_saved(
        expense_count=1, income_count=1, total_amount=58000, items=items
    )
    assert "지출 1건" in result
    assert "수입 1건" in result
    assert "58,000" in result


# ── 파싱 에러 (3 Strike) ──


def test_format_parse_error_strike_1():
    """Strike 1: 가이드 + 예시"""
    result = format_parse_error(strike=1)
    assert "금액" in result
    assert "입력해" in result


def test_format_parse_error_strike_2():
    """Strike 2: 다른 방식 제안"""
    result = format_parse_error(strike=2)
    assert "다른" in result or "금액을 먼저" in result


def test_format_parse_error_strike_3():
    """Strike 3: 버튼 대안 안내"""
    result = format_parse_error(strike=3)
    assert "버튼" in result or "아래" in result


def test_format_parse_error_strike_capped_at_3():
    """Strike 4 이상도 3과 동일"""
    result_3 = format_parse_error(strike=3)
    result_5 = format_parse_error(strike=5)
    assert result_3 == result_5


# ── 도움말 ──


def test_format_help_message_telegram():
    """텔레그램 도움말: 간결한 예시 + 명령어"""
    result = format_help_message()
    assert "사용법" in result
    assert "김치찌개" in result or "8000원" in result
    # 간결해야 함 (500자 이내)
    assert len(result) <= 500


def test_format_help_message_kakao():
    """카카오 도움말: 한글 명령어 포함"""
    result = format_help_message(platform="kakao")
    assert "취소" in result
    assert "리포트" in result


# ── 환영 ──


def test_format_welcome_message():
    """환영 메시지: 간결 + 핵심 안내"""
    result = format_welcome_message()
    assert "환영" in result
    assert "가계부" in result
    assert len(result) <= 380


# ── 삭제 확인 ──


def test_format_delete_confirm():
    """삭제 완료 메시지: 간결"""
    result = format_delete_confirm(amount=8000, description="김치찌개")
    assert "8,000원" in result
    assert "김치찌개" in result
    assert "삭제" in result


# ── 서버 에러 ──


def test_format_server_error():
    """서버 에러 메시지"""
    result = format_server_error()
    assert "다시 시도" in result
    assert len(result) <= 160


# ── 타임아웃 ──


def test_format_timeout_message():
    """타임아웃 메시지"""
    result = format_timeout_message()
    assert "분석" in result or "시간" in result
    assert "다시" in result


# ── 리포트 ──


def test_format_report_message_empty():
    """리포트: 지출 없을 때"""
    result = format_report_message([])
    assert "없" in result


def test_format_report_message_top3():
    """리포트: TOP 3만 기본 표시"""
    data = [
        {"category": "식비", "total": 150000, "count": 12},
        {"category": "교통", "total": 80000, "count": 8},
        {"category": "카페", "total": 60000, "count": 15},
        {"category": "문화", "total": 30000, "count": 3},
        {"category": "기타", "total": 10000, "count": 2},
    ]
    result = format_report_message(data)
    assert "식비" in result
    assert "교통" in result
    assert "카페" in result
    assert "총" in result
    # 500자 이내
    assert len(result) <= 500


def test_format_report_message_3_or_less():
    """리포트: 3개 이하면 전체 표시"""
    data = [
        {"category": "식비", "total": 100000, "count": 5},
        {"category": "교통", "total": 50000, "count": 3},
    ]
    result = format_report_message(data)
    assert "식비" in result
    assert "교통" in result


# ── 예산 ──


def test_format_budget_status_empty():
    """예산: 설정 없을 때"""
    result = format_budget_status([])
    assert "예산" in result
    assert "없" in result


def test_format_budget_status_warning_first():
    """예산: 초과/주의를 먼저 표시, 안전은 접기"""
    data = [
        {"category": "식비", "budget": 300000, "spent": 320000, "remaining": -20000, "usage": 106.7},
        {"category": "교통", "budget": 100000, "spent": 85000, "remaining": 15000, "usage": 85.0},
        {"category": "카페", "budget": 50000, "spent": 20000, "remaining": 30000, "usage": 40.0},
    ]
    result = format_budget_status(data)
    assert "🚨" in result  # 초과
    assert "⚠️" in result  # 주의
    # 안전 항목은 접혀서 카페 상세가 안 보여야 함
    assert "안전" in result
    # 500자 이내
    assert len(result) <= 500
```

**Step 2: 테스트 실행 → 실패 확인**

```bash
cd backend && python -m pytest tests/unit/test_bot_messages.py -v
```
Expected: FAIL (새 함수/시그니처 없음)

**Step 3: bot_messages.py 구현**

```python
# backend/app/services/bot_messages.py — 전체 교체
"""봇 응답 메시지 템플릿 (UX 리서치 기반 리디자인)

디자인 원칙:
- 친근한 존댓말 ("~했어요", "~해볼까요?")
- 짧은 응답 160자, 기본 380자, 상세 500자 이내
- 모든 응답에 다음 행동 버튼 포함 (핸들러에서 처리)
- 3 Strike 점진적 에러 안내
- Progressive Disclosure (TOP 3, 접기)
"""

from datetime import datetime, timedelta


def format_korean_date(date: datetime | str) -> str:
    """한국어 날짜 포맷: 오늘/어제/M월 D일 (요일)"""
    if isinstance(date, str):
        date = datetime.fromisoformat(date)

    now = datetime.now()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    target = date.replace(hour=0, minute=0, second=0, microsecond=0)

    if target == today:
        return "오늘"
    if target == today - timedelta(days=1):
        return "어제"

    weekdays = "월화수목금토일"
    return f"{date.month}월 {date.day}일 ({weekdays[date.weekday()]})"


def format_expense_saved(amount: float, category: str, description: str, date: str) -> str:
    """지출 저장 성공 메시지"""
    korean_date = format_korean_date(date)
    return f"🍇 {description} {amount:,.0f}원 기록했어요\n\n{korean_date} · {category}"


def format_income_saved(amount: float, category: str, description: str, date: str) -> str:
    """수입 저장 성공 메시지"""
    korean_date = format_korean_date(date)
    return f"💰 {description} {amount:,.0f}원 수입 기록했어요\n\n{korean_date} · {category}"


def format_mixed_saved(
    expense_count: int,
    income_count: int,
    total_amount: float,
    items: list[dict] | None = None,
) -> str:
    """수입/지출 혼합 저장 메시지"""
    parts = []
    if expense_count > 0:
        parts.append(f"지출 {expense_count}건")
    if income_count > 0:
        parts.append(f"수입 {income_count}건")

    lines = [f"✅ {' + '.join(parts)} 기록했어요\n"]

    if items:
        for idx, item in enumerate(items, 1):
            icon = "💰" if item.get("type") == "income" else "🍇"
            lines.append(
                f"{idx}. {icon} {item.get('description', '')} "
                f"{item['amount']:,.0f}원 · {item.get('category', '기타')}"
            )

    lines.append(f"\n총 {total_amount:,.0f}원")
    return "\n".join(lines)


def format_parse_error(strike: int = 1) -> str:
    """파싱 실패 메시지 — 3 Strike 점진적 안내"""
    strike = min(strike, 3)

    if strike == 1:
        return (
            '🤔 금액을 찾지 못했어요\n\n'
            '이렇게 입력해보세요:\n'
            '"점심 김치찌개 8000원"'
        )
    elif strike == 2:
        return (
            '😅 아직 이해하지 못했어요\n\n'
            '다른 방식으로 입력해볼까요?\n'
            '"8000원 점심" 처럼 금액을 먼저 써도 돼요'
        )
    else:
        return (
            "제가 아직 이해하기 어려운 표현인 것 같아요 😊\n\n"
            "아래 버튼으로 도움말을 확인해보세요"
        )


def format_help_message(platform: str = "telegram") -> str:
    """도움말 메시지 (간결 버전)"""
    base = (
        "🍇 포도가계부 사용법\n\n"
        "💬 자연어로 입력하세요:\n"
        '"점심 김치찌개 8000원"\n'
        '"월급 300만원 수입"\n'
        '"어제 택시비 2만원"'
    )

    if platform == "kakao":
        commands = (
            "\n\n📱 명령어:\n"
            "리포트 — 이번 달 지출 요약\n"
            "예산 — 예산 현황\n"
            "취소 — 마지막 기록 삭제\n"
            "변경 — 카테고리 변경"
        )
    else:
        commands = (
            "\n\n📱 명령어:\n"
            "/report — 이번 달 지출 요약\n"
            "/budget — 예산 현황\n"
            "/link 코드 — 웹 계정 연동\n"
            "/help — 이 도움말"
        )

    return base + commands


def format_welcome_message() -> str:
    """환영 메시지 (간결)"""
    return (
        "🍇 포도가계부에 오신 걸 환영해요!\n\n"
        "말하듯 편하게 지출을 입력하면\n"
        "AI가 자동으로 분류하고 기록해드려요.\n\n"
        '"점심 김치찌개 8000원"'
    )


def format_link_usage_message() -> str:
    """연동 코드 사용법 안내 (텔레그램)"""
    return (
        "🔗 웹 계정 연동 방법\n\n"
        "1. budget.podonest.com 로그인\n"
        "2. 설정 → 텔레그램 연동 → 코드 발급\n"
        "3. /link 코드 입력\n\n"
        "⏰ 코드는 15분 후 만료돼요"
    )


def format_kakao_link_usage_message() -> str:
    """연동 코드 사용법 안내 (카카오톡)"""
    return (
        "🔗 카카오톡 계정 연동 방법\n\n"
        "1. budget.podonest.com 로그인\n"
        "2. 설정 → 카카오톡 연동 → 코드 발급\n"
        "3. 연동 코드 입력\n\n"
        "⏰ 코드는 15분 후 만료돼요"
    )


def format_delete_confirm(amount: float, description: str, **kwargs) -> str:
    """삭제 완료 메시지"""
    return f"✅ {description} {amount:,.0f}원 삭제했어요"


def format_server_error() -> str:
    """서버 오류 메시지"""
    return "😅 일시적인 문제가 생겼어요\n잠시 후 다시 시도해주세요"


def format_timeout_message() -> str:
    """LLM 응답 타임아웃 메시지"""
    return "⏳ AI가 분석 중이에요\n같은 내용을 다시 보내주시면 빠르게 처리해드릴게요"


def format_report_message(report_data: list[dict]) -> str:
    """이번 달 지출 요약 (TOP 3 + 접기)"""
    now = datetime.now()

    if not report_data:
        return f"📊 {now.month}월 지출 리포트\n\n아직 지출 내역이 없어요."

    total_amount = sum(item["total"] for item in report_data)

    # TOP 3만 상세 표시
    lines = [f"📊 {now.month}월 지출 리포트\n"]
    display_items = report_data[:3]

    for idx, item in enumerate(display_items, 1):
        percentage = (item["total"] / total_amount * 100) if total_amount > 0 else 0
        lines.append(
            f"{idx}. {item['category']} {item['total']:,.0f}원 "
            f"({item['count']}건) {percentage:.0f}%"
        )

    # 4개 이상이면 나머지는 접기
    remaining = len(report_data) - 3
    if remaining > 0:
        lines.append(f"\n외 {remaining}개 카테고리")

    lines.append(f"\n💰 총 {total_amount:,.0f}원")
    return "\n".join(lines)


def format_budget_status(budget_data: list[dict]) -> str:
    """예산 현황 (초과/주의 우선, 안전 접기)"""
    now = datetime.now()

    if not budget_data:
        return f"💵 {now.month}월 예산 현황\n\n아직 설정된 예산이 없어요."

    # 초과/주의/안전 분류
    danger = [b for b in budget_data if b["usage"] >= 100]
    warning = [b for b in budget_data if 80 <= b["usage"] < 100]
    safe = [b for b in budget_data if b["usage"] < 80]

    lines = [f"💵 {now.month}월 예산 현황\n"]

    for item in danger:
        over = abs(item["remaining"])
        lines.append(
            f"🚨 {item['category']} {item['spent']:,.0f} / {item['budget']:,.0f}원 "
            f"({item['usage']:.0f}%) — {over:,.0f}원 초과"
        )

    for item in warning:
        lines.append(
            f"⚠️ {item['category']} {item['spent']:,.0f} / {item['budget']:,.0f}원 "
            f"({item['usage']:.0f}%) — {item['remaining']:,.0f}원 남음"
        )

    if safe:
        lines.append(f"\n✅ {len(safe)}개 카테고리 안전")

    return "\n".join(lines)
```

**Step 4: 테스트 실행 → 통과 확인**

```bash
cd backend && python -m pytest tests/unit/test_bot_messages.py -v
```
Expected: ALL PASS

**Step 5: 기존 테스트 전체 실행 (깨진 테스트 확인)**

```bash
cd backend && python -m pytest tests/unit/test_bot_messages_extra.py -v 2>/dev/null; echo "---"
cd backend && python -m pytest tests/integration/test_api_telegram.py -v
cd backend && python -m pytest tests/integration/test_api_kakao.py -v
```

시그니처 변경으로 깨지는 테스트 수정:
- `format_parse_error` — 기존은 `raw_input` 인자, 이제 `strike` 인자
- `format_delete_confirm` — 기존은 `category` 필수 인자, 이제 `**kwargs`로 호환
- `format_mixed_saved` — 기존 시그니처 변경됨
- 통합 테스트의 메시지 내용 assert 업데이트 필요

**Step 6: 커밋**

```bash
git add backend/app/services/bot_messages.py backend/tests/unit/test_bot_messages.py
git commit -m "refactor: bot_messages.py 전체 메시지 UX 리디자인 (#286)"
```

---

## Task 3: 텔레그램 핸들러 — 메시지 포맷 적용 + 3 Strike

**Files:**
- Modify: `backend/app/api/telegram.py`
- Modify: `backend/tests/integration/test_api_telegram.py`

**Step 1: 통합 테스트 업데이트 (깨진 assert 수정 + 새 테스트)**

기존 통합 테스트의 메시지 assert를 리디자인된 포맷에 맞게 업데이트:

- `test_webhook_start_command`: "환영" assert 유지 (변경 없음)
- `test_webhook_expense_input`: "기록" assert 유지
- `test_webhook_parse_error`: "금액을 찾을 수 없" → "금액을 찾지 못했어요" 또는 "금액" 포함 검증
- 나머지는 대부분 호환됨

새 테스트 추가:

```python
# test_api_telegram.py에 추가

@pytest.mark.asyncio
async def test_webhook_parse_error_strike_progression(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """파싱 실패 3 Strike 점진적 메시지 변화"""
    from app.services.bot_strike_service import _error_counts
    _error_counts.clear()

    await setup_bot_user_with_household(db_session, chat_id=12345)
    mock_llm_parse_expense.return_value = {"error": "파싱 실패"}

    # Strike 1
    payload = {"message": {"chat": {"id": 12345}, "text": "ㅋㅋㅋ"}}
    await client.post("/api/telegram/webhook", json=payload)
    msg1 = mock_telegram_send.call_args[0][1]

    # Strike 2
    mock_telegram_send.reset_mock()
    await client.post("/api/telegram/webhook", json=payload)
    msg2 = mock_telegram_send.call_args[0][1]

    # Strike 3
    mock_telegram_send.reset_mock()
    await client.post("/api/telegram/webhook", json=payload)
    msg3 = mock_telegram_send.call_args[0][1]

    # 메시지가 점진적으로 달라져야 함
    assert msg1 != msg2
    assert msg2 != msg3
```

**Step 2: 테스트 실행 → 실패 확인**

```bash
cd backend && python -m pytest tests/integration/test_api_telegram.py::test_webhook_parse_error_strike_progression -v
```

**Step 3: telegram.py 수정**

주요 변경:
1. `format_parse_error` 호출 시 `strike` 인자 전달
2. 성공 시 `reset_strike` 호출
3. `format_expense_saved`/`format_income_saved` 결과에 한국어 날짜 자동 적용 (bot_messages.py에서 처리)
4. 날짜 포맷 변경: `strftime("%Y-%m-%d")` → `date.isoformat()` (bot_messages.py에서 한국어 변환)

```python
# telegram.py 상단 import 추가
from app.services.bot_strike_service import increment_strike, reset_strike

# _handle_single_expense_parsed 수정
async def _handle_single_expense_parsed(...):
    if "error" in parsed:
        strike = increment_strike("telegram", str(chat_id))
        await send_telegram_message(chat_id, format_parse_error(strike=strike))
        return
    # 성공 시 strike 초기화
    reset_strike("telegram", str(chat_id))
    ...

# _save_and_respond_single 수정 — date 포맷을 isoformat으로
    date=record_date.isoformat(),  # bot_messages.py에서 한국어 변환
```

**Step 4: 테스트 실행 → 통과 확인**

```bash
cd backend && python -m pytest tests/integration/test_api_telegram.py -v
```

**Step 5: 커밋**

```bash
git add backend/app/api/telegram.py backend/tests/integration/test_api_telegram.py
git commit -m "feat: 텔레그램 핸들러 3 Strike + 메시지 포맷 적용 (#286)"
```

---

## Task 4: 텔레그램 — 수입 삭제 + 지출↔수입 변환 콜백

**Files:**
- Modify: `backend/app/api/telegram.py`
- Modify: `backend/tests/integration/test_api_telegram.py`

**Step 1: 테스트 작성**

```python
# test_api_telegram.py에 추가

@pytest.mark.asyncio
async def test_callback_delete_income(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """수입 삭제 콜백 — 삭제 확인 후 Income 삭제"""
    from unittest.mock import AsyncMock, patch
    from app.models.income import Income

    bot_user, household = await setup_bot_user_with_household(db_session, chat_id=12345)
    cat = Category(name="급여", type="income", household_id=household.id)
    db_session.add(cat)
    await db_session.flush()

    income = Income(user_id=bot_user.id, amount=3000000, description="월급",
                    category_id=cat.id, date=datetime.now(), household_id=household.id)
    db_session.add(income)
    await db_session.commit()
    await db_session.refresh(income)

    # delete_income 콜백 → 확인 프롬프트
    with patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock):
        callback_payload = {
            "callback_query": {
                "id": "cb_del_inc",
                "message": {"chat": {"id": 12345}},
                "data": f"delete_income:{income.id}",
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200

    # 확인 프롬프트 메시지
    assert "삭제" in mock_telegram_send.call_args[0][1]


@pytest.mark.asyncio
async def test_callback_convert_expense_to_income(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """지출→수입 변환 콜백"""
    from unittest.mock import AsyncMock, patch
    from app.models.income import Income

    bot_user, household = await setup_bot_user_with_household(db_session, chat_id=12345)
    # 지출 생성
    payload = {"message": {"chat": {"id": 12345}, "text": "용돈 50000원"}}
    await client.post("/api/telegram/webhook", json=payload)

    result = await db_session.execute(select(Expense))
    expense = result.scalars().first()
    assert expense is not None

    # convert_to_income 콜백
    mock_telegram_send.reset_mock()
    with patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock):
        callback_payload = {
            "callback_query": {
                "id": "cb_convert",
                "message": {"chat": {"id": 12345}},
                "data": f"convert_to_income:{expense.id}",
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200

    # 지출이 삭제되고 수입이 생성되었는지 확인
    result = await db_session.execute(select(Expense))
    assert len(result.scalars().all()) == 0
    result = await db_session.execute(select(Income))
    incomes = result.scalars().all()
    assert len(incomes) == 1
    assert incomes[0].amount == 50000


@pytest.mark.asyncio
async def test_callback_convert_income_to_expense(client, db_session, mock_telegram_send, mock_llm_parse_expense):
    """수입→지출 변환 콜백"""
    from unittest.mock import AsyncMock, patch
    from app.models.income import Income

    bot_user, household = await setup_bot_user_with_household(db_session, chat_id=12345)
    cat = Category(name="급여", type="income", household_id=household.id)
    db_session.add(cat)
    await db_session.flush()

    income = Income(user_id=bot_user.id, amount=50000, description="용돈",
                    category_id=cat.id, date=datetime.now(), household_id=household.id)
    db_session.add(income)
    await db_session.commit()
    await db_session.refresh(income)

    mock_telegram_send.reset_mock()
    with patch("app.api.telegram.answer_callback_query", new_callable=AsyncMock):
        callback_payload = {
            "callback_query": {
                "id": "cb_convert2",
                "message": {"chat": {"id": 12345}},
                "data": f"convert_to_expense:{income.id}",
            }
        }
        response = await client.post("/api/telegram/webhook", json=callback_payload)
        assert response.status_code == 200

    # 수입이 삭제되고 지출이 생성되었는지 확인
    result = await db_session.execute(select(Income))
    assert len(result.scalars().all()) == 0
    result = await db_session.execute(select(Expense))
    expenses = result.scalars().all()
    assert len(expenses) == 1
    assert expenses[0].amount == 50000
```

**Step 2: 테스트 실행 → 실패 확인**

```bash
cd backend && python -m pytest tests/integration/test_api_telegram.py::test_callback_delete_income -v
cd backend && python -m pytest tests/integration/test_api_telegram.py::test_callback_convert_expense_to_income -v
cd backend && python -m pytest tests/integration/test_api_telegram.py::test_callback_convert_income_to_expense -v
```

**Step 3: telegram.py에 새 콜백 핸들러 구현**

`handle_callback_query` 리팩토링 필요: 현재 Expense만 조회하는데, Income도 조회해야 함.

1. `_handle_delete_income` — Income 조회 → 삭제 확인 프롬프트
2. `_handle_confirm_delete_income` — 실제 삭제
3. `_handle_convert_to_income` — Expense 삭제 → Income 생성
4. `_handle_convert_to_expense` — Income 삭제 → Expense 생성
5. `handle_callback_query` 수정: `delete_income`, `confirm_delete_income`, `convert_to_income`, `convert_to_expense` 액션 추가. Income 콜백은 Income 모델에서 조회.

버튼 레이아웃 업데이트:
- 지출 저장: [카테고리 변경] [삭제] + 2행 [수입으로 변경]
- 수입 저장: [삭제] [지출로 변경]

**Step 4: 테스트 실행 → 통과 확인**

```bash
cd backend && python -m pytest tests/integration/test_api_telegram.py -v
```

**Step 5: 커밋**

```bash
git add backend/app/api/telegram.py backend/tests/integration/test_api_telegram.py
git commit -m "feat: 텔레그램 수입 삭제 + 지출↔수입 변환 콜백 (#286)"
```

---

## Task 5: 카카오 핸들러 — 메시지 포맷 적용 + 3 Strike + undo 수입

**Files:**
- Modify: `backend/app/api/kakao.py`
- Modify: `backend/tests/integration/test_api_kakao.py`

**Step 1: 테스트 작성**

```python
# test_api_kakao.py에 추가

@pytest.mark.asyncio
async def test_kakao_parse_error_strike_progression(client, db_session, mock_llm_parse_expense):
    """카카오 파싱 실패 3 Strike 점진적 메시지"""
    from app.services.bot_strike_service import _error_counts
    _error_counts.clear()

    mock_llm_parse_expense.return_value = {"error": "파싱 실패"}

    messages = []
    for _ in range(3):
        payload = make_kakao_payload("ㅋㅋㅋ")
        response = await client.post("/api/kakao/webhook", json=payload, headers=KAKAO_HEADERS)
        text = response.json()["template"]["outputs"][0]["simpleText"]["text"]
        messages.append(text)

    # 3단계 메시지가 모두 달라야 함
    assert messages[0] != messages[1]
    assert messages[1] != messages[2]


@pytest.mark.asyncio
async def test_kakao_undo_deletes_latest_income(client, db_session, mock_llm_parse_expense):
    """취소 명령어가 최신 수입도 삭제 가능"""
    from app.models.income import Income

    # 먼저 지출 생성
    mock_llm_parse_expense.return_value = {
        "amount": 8000, "category": "식비", "description": "점심",
        "date": "2026-03-20", "type": "expense",
    }
    await client.post("/api/kakao/webhook", json=make_kakao_payload("점심 8000원"), headers=KAKAO_HEADERS)

    # 그 다음 수입 생성 (더 최신)
    mock_llm_parse_expense.return_value = {
        "amount": 50000, "category": "기타수입", "description": "용돈",
        "date": "2026-03-20", "type": "income",
    }
    await client.post("/api/kakao/webhook", json=make_kakao_payload("용돈 5만원 수입"), headers=KAKAO_HEADERS)

    # 취소 → 최신인 수입이 삭제되어야 함
    response = await client.post("/api/kakao/webhook", json=make_kakao_payload("취소"), headers=KAKAO_HEADERS)
    text = response.json()["template"]["outputs"][0]["simpleText"]["text"]
    assert "용돈" in text or "50,000" in text

    # 지출은 남아있어야 함
    result = await db_session.execute(select(Expense))
    assert len(result.scalars().all()) == 1
    result = await db_session.execute(select(Income))
    assert len(result.scalars().all()) == 0
```

NOTE: `make_kakao_payload`와 `KAKAO_HEADERS`는 기존 test_api_kakao.py의 헬퍼/상수를 참조. 없으면 생성.

**Step 2: 테스트 실행 → 실패 확인**

**Step 3: kakao.py 수정**

주요 변경:
1. `_handle_expense_input`에 3 Strike 적용 (telegram과 동일 패턴)
2. `handle_undo_command` 수정: Expense와 Income 중 최신 삭제
3. 성공 시 `reset_strike` 호출
4. 날짜 포맷을 isoformat으로 전달 (bot_messages.py에서 한국어 변환)
5. quick reply 버튼 레이아웃 통일

```python
# handle_undo_command 수정 핵심 로직
async def handle_undo_command(db, bot_user):
    # Expense와 Income 중 가장 최근 것을 삭제
    exp_result = await db.execute(
        select(Expense).where(Expense.user_id == bot_user.id).order_by(Expense.id.desc()).limit(1)
    )
    last_expense = exp_result.scalar_one_or_none()

    inc_result = await db.execute(
        select(Income).where(Income.user_id == bot_user.id).order_by(Income.id.desc()).limit(1)
    )
    last_income = inc_result.scalar_one_or_none()

    # 둘 다 없으면
    if not last_expense and not last_income:
        return make_simple_text_response("삭제할 기록이 없어요.")

    # ID가 큰 쪽이 더 최신 (auto-increment)
    # Income과 Expense는 별도 테이블이므로 created_at 또는 id 비교
    if last_expense and last_income:
        # 둘 다 있으면 더 최근에 생성된 것 삭제 (date 비교가 아닌 id 비교)
        delete_income = last_income.id > last_expense.id  # 같은 시퀀스는 아니므로 date 비교
        # → date 비교로 변경: 같은 날이면 ID 큰 쪽
        if last_income.date > last_expense.date:
            delete_income = True
        elif last_income.date < last_expense.date:
            delete_income = False
        else:
            delete_income = last_income.id > last_expense.id
    elif last_income:
        delete_income = True
    else:
        delete_income = False

    if delete_income:
        record = last_income
        record_type = "수입"
    else:
        record = last_expense
        record_type = "지출"

    amount = record.amount
    description = record.description
    await db.delete(record)
    await db.commit()

    return make_simple_text_response(
        format_delete_confirm(amount=amount, description=description),
        quick_replies=[...]
    )
```

**Step 4: 테스트 실행 → 통과 확인**

```bash
cd backend && python -m pytest tests/integration/test_api_kakao.py -v
```

**Step 5: 커밋**

```bash
git add backend/app/api/kakao.py backend/tests/integration/test_api_kakao.py
git commit -m "feat: 카카오 핸들러 3 Strike + undo 수입 지원 (#286)"
```

---

## Task 6: 기존 테스트 호환성 수정 + 전체 테스트 통과

**Files:**
- Modify: `backend/tests/unit/test_bot_messages_extra.py` (있으면)
- Modify: `backend/tests/integration/test_api_telegram.py` (assert 업데이트)
- Modify: `backend/tests/integration/test_api_kakao.py` (assert 업데이트)
- Modify: `backend/tests/integration/test_telegram_category_confirm.py`

**Step 1: 전체 테스트 실행하여 깨진 것 식별**

```bash
cd backend && python -m pytest --ignore=tests/integration/test_api_budget_bulk.py -v --tb=short 2>&1 | tail -50
```

**Step 2: 깨진 테스트 수정**

주로 변경되는 부분:
- `format_parse_error(raw_input)` → `format_parse_error(strike=N)` 호출부
- `format_delete_confirm(amount, category, description)` → `format_delete_confirm(amount=X, description=Y)`
- 메시지 내용 assert: "금액을 찾을 수 없어요" → "금액을 찾지 못했어요" 등

**Step 3: 전체 테스트 통과 확인**

```bash
cd backend && python -m pytest --ignore=tests/integration/test_api_budget_bulk.py -v
```

**Step 4: 프론트엔드 빌드/린트 확인** (변경 없으므로 빠르게)

```bash
cd frontend && npm run lint && npm run build
```

**Step 5: 커밋**

```bash
git add -A
git commit -m "fix: 메시지 리디자인에 따른 기존 테스트 호환성 수정 (#286)"
```

---

## Task 7: PR 생성

**Step 1: 브랜치 push + PR 생성**

```bash
git push -u origin feature/286-bot-message-redesign
gh pr create --base develop --title "feat: 봇 응답 메시지 전면 리디자인 (#286)" --body "..."
```

PR 본문에 포함할 내용:
- UX 리서치 기반 리디자인 요약
- Before/After 메시지 비교
- 새 기능: 3 Strike, 수입 삭제, 지출↔수입 변환
- 테스트 커버리지
