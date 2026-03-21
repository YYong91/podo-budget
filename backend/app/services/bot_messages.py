"""봇 응답 메시지 템플릿 — UX 리디자인 버전

디자인 원칙:
- 톤: 친근한 존댓말 (~했어요, ~해볼까요?)
- 길이: 짧은 160자, 기본 380자, 상세 500자
- 이모지: 시작/핵심 포인트에만 (과용 금지)
- Progressive Disclosure: TOP 3만 노출, 나머지 접기
- 3 Strike: 점진적 에러 안내
"""

from datetime import date, datetime, timedelta

# 한국어 요일 매핑
_WEEKDAY_NAMES = ["월", "화", "수", "목", "금", "토", "일"]


def format_korean_date(d: date | datetime | str) -> str:
    """날짜를 한국어로 포맷

    - 오늘 → "오늘"
    - 어제 → "어제"
    - 그 외 → "3월 20일 (금)"
    """
    if isinstance(d, str):
        # "2026-03-20T00:00:00" 등 datetime ISO 문자열도 처리
        d = datetime.fromisoformat(d).date() if "T" in d else date.fromisoformat(d)
    if isinstance(d, datetime):
        d = d.date()

    today = date.today()
    if d == today:
        return "오늘"
    if d == today - timedelta(days=1):
        return "어제"

    weekday = _WEEKDAY_NAMES[d.weekday()]
    return f"{d.month}월 {d.day}일 ({weekday})"


def format_expense_saved(amount: float, category: str, description: str, date: str) -> str:
    """지출 저장 성공 메시지

    Before: "✅ 지출이 기록되었어요!\n\n💰 8,000원\n📂 식비\n📅 2026-03-20\n📝 김치찌개"
    After:  "🍇 김치찌개 8,000원 기록했어요\n\n3월 20일 (금) · 식비"
    """
    korean_date = format_korean_date(date)
    return f"🍇 {description} {amount:,.0f}원 기록했어요\n\n{korean_date} · {category}"


def format_income_saved(amount: float, category: str, description: str, date: str) -> str:
    """수입 저장 성공 메시지

    "💰 월급 3,000,000원 수입 기록했어요\n\n3월 20일 (금) · 급여"
    """
    korean_date = format_korean_date(date)
    return f"💰 {description} {amount:,.0f}원 수입 기록했어요\n\n{korean_date} · {category}"


def format_mixed_saved(
    expense_count: int,
    income_count: int,
    total_amount: float,
    items: list[dict] | None = None,
) -> str:
    """수입/지출 혼합 저장 메시지

    건수 요약 + 개별 항목(있으면) + 총액
    """
    parts = []
    if expense_count > 0:
        parts.append(f"지출 {expense_count}건")
    if income_count > 0:
        parts.append(f"수입 {income_count}건")

    header = f"🍇 {' + '.join(parts)} 기록했어요"

    lines = [header, ""]

    if items:
        for item in items:
            type_label = "📤" if item.get("type") == "income" else "📥"
            lines.append(f"{type_label} {item['description']} {item['amount']:,.0f}원 · {item['category']}")
        lines.append("")

    lines.append(f"총 {total_amount:,.0f}원")
    return "\n".join(lines)


def format_parse_error(strike: int | str = 1) -> str:
    """파싱 실패 메시지 — 3 Strike 점진적 안내

    Strike 1: 기본 안내 + 예시
    Strike 2: 다른 방식 제안
    Strike 3+: 도움말 안내
    """
    # 하위 호환: 기존 호출에서 raw_input 문자열을 넘기는 경우
    if isinstance(strike, str):
        strike = 1
    if strike <= 1:
        return "🤔 금액을 찾지 못했어요\n\n" "이렇게 입력해보세요:\n" '"점심 김치찌개 8000원"'
    elif strike == 2:
        return "😅 아직 이해하지 못했어요\n\n" "다른 방식으로 입력해볼까요?\n" '"8000원 점심" 처럼 금액을 먼저 써도 돼요'
    else:
        # strike >= 3
        return "제가 아직 이해하기 어려운 표현인 것 같아요 😊\n\n" "아래 버튼으로 도움말을 확인해보세요"


def format_unknown_input(**kwargs) -> str:
    """파싱 실패 — 알 수 없는 표현 (하위 호환용)

    format_parse_error(strike=2)와 동일
    """
    return format_parse_error(strike=2)


def format_help_message(platform: str = "telegram") -> str:
    """도움말 메시지 — 핵심 3개 예시 + 명령어 (500자 이내)"""
    base = (
        "📖 포도가계부 사용 가이드\n\n"
        "이렇게 입력하세요:\n"
        '· "점심 김치찌개 8000원"\n'
        '· "택시비 2만원"\n'
        '· "커피 5천원, 점심 8천원"\n\n'
        "AI가 금액·날짜·카테고리를 자동 분류해요\n"
    )

    if platform == "kakao":
        commands = "\n명령어:\n" "리포트 — 이번 달 지출 요약\n" "예산 — 예산 현황\n" "취소 — 마지막 거래 삭제\n" "변경 — 카테고리 변경\n" "도움말 — 이 도움말"
    else:
        commands = "\n명령어:\n" "/report — 이번 달 지출 요약\n" "/budget — 예산 현황\n" "/link 코드 — 웹 계정 연동\n" "/help — 이 도움말"

    return base + commands


def format_welcome_message() -> str:
    """환영 메시지 (380자 이내)"""
    return (
        "🍇 포도가계부에 오신 걸 환영해요!\n\n"
        "카톡 보내듯 편하게 지출을 입력하면\n"
        "AI가 자동으로 정리해드려요.\n\n"
        '예: "점심 김치찌개 8000원"\n\n'
        "웹 계정 연동은 /link 코드 로 가능해요."
    )


def format_link_usage_message() -> str:
    """연동 코드 사용법 (텔레그램)"""
    return (
        "🔗 웹 계정 연동 방법\n\n"
        "1. 포도가계부 웹 → 설정 → 텔레그램 연동\n"
        "2. 코드를 발급받아 아래처럼 입력\n\n"
        "/link ABC123\n\n"
        "⏰ 코드는 15분 후 만료돼요"
    )


def format_kakao_link_usage_message() -> str:
    """연동 코드 사용법 (카카오톡)"""
    return (
        "🔗 웹 계정 연동 방법\n\n"
        "1. 포도가계부 웹 → 설정 → 카카오톡 연동\n"
        "2. 코드를 발급받아 아래처럼 입력\n\n"
        "연동 ABC123\n\n"
        "⏰ 코드는 15분 후 만료돼요"
    )


def format_delete_confirm(amount: float, description: str, **kwargs) -> str:
    """삭제 완료 메시지

    **kwargs로 기존 category 파라미터 하위 호환
    """
    return f"✅ {description} {amount:,.0f}원 삭제했어요"


def format_server_error() -> str:
    """서버 오류 메시지 (160자 이내)"""
    return "😅 일시적인 문제가 생겼어요\n잠시 후 다시 시도해주세요"


def format_timeout_message() -> str:
    """LLM 응답 타임아웃 메시지"""
    return "⏳ AI가 분석 중이에요\n같은 내용을 다시 보내주시면 빠르게 처리해드릴게요"


def format_report_message(report_data: list[dict]) -> str:
    """이번 달 지출 리포트 — TOP 3 + 접기 (500자 이내)

    Args:
        report_data: [{"category": "식비", "total": 150000, "count": 12}, ...]
    """
    now = datetime.now()
    month_label = f"{now.month}월"

    if not report_data:
        return f"📊 {month_label} 지출 리포트\n\n아직 지출 내역이 없어요."

    total_amount = sum(item["total"] for item in report_data)

    lines = [f"📊 {month_label} 지출 리포트\n"]

    # TOP 3만 표시
    top3 = report_data[:3]
    for i, item in enumerate(top3, 1):
        pct = (item["total"] / total_amount * 100) if total_amount > 0 else 0
        lines.append(f"{i}. {item['category']} {item['total']:,.0f}원 ({item['count']}건, {pct:.0f}%)")

    # 나머지 접기
    remaining = len(report_data) - 3
    if remaining > 0:
        lines.append(f"   외 {remaining}개 카테고리")

    lines.append(f"\n💰 총 {total_amount:,.0f}원")
    return "\n".join(lines)


def format_report_message_full(report_data: list[dict]) -> str:
    """전체 지출 리포트 — 모든 카테고리 표시 (접기 없음)

    Args:
        report_data: [{"category": "식비", "total": 150000, "count": 12}, ...]
    """
    now = datetime.now()
    month_label = f"{now.month}월"

    if not report_data:
        return f"📊 {month_label} 지출 리포트\n\n아직 지출 내역이 없어요."

    total_amount = sum(item["total"] for item in report_data)
    lines = [f"📊 {month_label} 지출 리포트 (전체)\n"]

    for i, item in enumerate(report_data, 1):
        pct = (item["total"] / total_amount * 100) if total_amount > 0 else 0
        lines.append(f"{i}. {item['category']} {item['total']:,.0f}원 ({item['count']}건, {pct:.0f}%)")

    lines.append(f"\n💰 총 {total_amount:,.0f}원")
    return "\n".join(lines)


def format_budget_status(budget_data: list[dict]) -> str:
    """예산 현황 — 초과/주의 우선 + 안전 접기 (500자 이내)

    Args:
        budget_data: [{"category": "식비", "budget": 300000, "spent": 150000,
                      "remaining": 150000, "usage": 50.0}, ...]
    """
    now = datetime.now()
    month_label = f"{now.month}월"

    if not budget_data:
        return f"💵 {month_label} 예산 현황\n\n아직 설정된 예산이 없어요."

    # 심각도별 분류
    over = []  # usage >= 100
    warning = []  # usage >= 80
    safe = []  # usage < 80

    for item in budget_data:
        usage = item["usage"]
        if usage >= 100:
            over.append(item)
        elif usage >= 80:
            warning.append(item)
        else:
            safe.append(item)

    lines = [f"💵 {month_label} 예산 현황\n"]

    # 초과 항목 (최대 5개)
    for item in over[:5]:
        over_amount = item["spent"] - item["budget"]
        lines.append(f"🚨 {item['category']} {item['spent']:,.0f}원 / {item['budget']:,.0f}원 (+{over_amount:,.0f}원 초과)")
    if len(over) > 5:
        lines.append(f"   외 {len(over) - 5}개 초과")

    # 주의 항목 (최대 5개)
    for item in warning[:5]:
        lines.append(f"⚠️ {item['category']} {item['spent']:,.0f}원 / {item['budget']:,.0f}원 ({item['usage']:.0f}%)")
    if len(warning) > 5:
        lines.append(f"   외 {len(warning) - 5}개 주의")

    # 안전 항목: 초과/주의가 있으면 접고, 없으면 전부 표시
    if safe and (over or warning):
        lines.append(f"\n✅ {len(safe)}개 카테고리 안전")
    else:
        for item in safe:
            lines.append(f"✅ {item['category']} {item['spent']:,.0f}원 / {item['budget']:,.0f}원 ({item['usage']:.0f}%)")

    return "\n".join(lines)


def format_budget_status_full(budget_data: list[dict]) -> str:
    """전체 예산 현황 — 모든 항목 표시 (접기 없음)

    Args:
        budget_data: [{"category": "식비", "budget": 300000, "spent": 150000,
                      "remaining": 150000, "usage": 50.0}, ...]
    """
    now = datetime.now()
    month_label = f"{now.month}월"

    if not budget_data:
        return f"💵 {month_label} 예산 현황\n\n아직 설정된 예산이 없어요."

    lines = [f"💵 {month_label} 예산 현황 (전체)\n"]

    for item in budget_data:
        usage = item["usage"]
        if usage >= 100:
            over_amount = item["spent"] - item["budget"]
            lines.append(f"🚨 {item['category']} {item['spent']:,.0f}원 / {item['budget']:,.0f}원 (+{over_amount:,.0f}원 초과)")
        elif usage >= 80:
            lines.append(f"⚠️ {item['category']} {item['spent']:,.0f}원 / {item['budget']:,.0f}원 ({usage:.0f}%)")
        else:
            lines.append(f"✅ {item['category']} {item['spent']:,.0f}원 / {item['budget']:,.0f}원 ({usage:.0f}%)")

    return "\n".join(lines)
