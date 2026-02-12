"""Telegram 봇 응답 메시지 템플릿 (docs/BOT_MESSAGES.md 기반)"""


def format_expense_saved(amount: float, category: str, description: str, date: str) -> str:
    """지출 저장 성공 메시지"""
    return f"✅ 지출이 기록되었어요!\n\n" f"💰 {amount:,.0f}원\n" f"📂 {category}\n" f"📅 {date}\n" f"📝 {description}"


def format_parse_error(raw_input: str) -> str:
    """파싱 실패 - 금액 없음"""
    return f"❓ 금액을 찾을 수 없어요.\n\n" f'입력하신 내용: "{raw_input}"\n\n' f"얼마를 쓰셨나요?\n" f'예시: "8000원" 또는 "8천원"'


def format_unknown_input(raw_input: str) -> str:
    """파싱 실패 - 알 수 없는 표현"""
    return (
        f"😅 무슨 뜻인지 이해하지 못했어요.\n\n"
        f'입력하신 내용: "{raw_input}"\n\n'
        f"이렇게 입력해보세요:\n"
        f'"점심에 김치찌개 8000원"\n'
        f'"스타벅스 아메리카노 4500원"'
    )


def format_help_message() -> str:
    """도움말 메시지"""
    return (
        "📖 HomeNRich 사용 가이드\n\n"
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
        "/budget - 예산 현황"
    )


def format_welcome_message() -> str:
    """최초 시작 메시지"""
    return (
        "🎉 HomeNRich에 오신 걸 환영합니다!\n\n"
        "AI가 알아서 정리해주는 똑똑한 가계부예요.\n"
        "카톡 보내듯 편하게 지출을 입력하면\n"
        "자동으로 카테고리를 분류하고 저장해드립니다.\n\n"
        "📝 사용법은 아주 간단해요:\n"
        '"점심에 김치찌개 8000원"\n'
        '"스타벅스 아메리카노 4500원"\n'
        '"택시비 2만원"\n\n'
        "지금 바로 시작해볼까요?"
    )


def format_delete_confirm(amount: float, category: str, description: str) -> str:
    """삭제 완료 메시지"""
    return f"✅ 삭제 완료!\n\n{amount:,.0f}원 [{category}] {description}\n삭제되었어요."


def format_server_error() -> str:
    """서버 오류 메시지"""
    return "⚠️ 일시적인 오류가 발생했어요.\n잠시 후 다시 시도해주시겠어요?"


def format_report_message(report_data: list[dict]) -> str:
    """이번 달 지출 요약 메시지

    Args:
        report_data: 카테고리별 지출 집계 리스트
                    [{"category": "식비", "total": 150000, "count": 12}, ...]

    Returns:
        포맷된 리포트 메시지
    """
    if not report_data:
        return "📊 이번 달 지출 리포트\n\n아직 지출 내역이 없어요."

    # 전체 합계 계산
    total_amount = sum(item["total"] for item in report_data)

    # 메시지 구성
    lines = ["📊 이번 달 지출 리포트\n"]
    for item in report_data:
        category = item["category"]
        total = item["total"]
        count = item["count"]
        percentage = (total / total_amount * 100) if total_amount > 0 else 0
        lines.append(f"📂 {category}: {total:,.0f}원 ({count}건, {percentage:.1f}%)")

    lines.append(f"\n💰 총 지출: {total_amount:,.0f}원")
    return "\n".join(lines)


def format_budget_status(budget_data: list[dict]) -> str:
    """예산 현황 메시지

    Args:
        budget_data: 예산 알림 데이터 리스트
                    [{"category": "식비", "budget": 300000, "spent": 150000,
                      "remaining": 150000, "usage": 50.0}, ...]

    Returns:
        포맷된 예산 현황 메시지
    """
    if not budget_data:
        return "💵 예산 현황\n\n아직 설정된 예산이 없어요."

    lines = ["💵 예산 현황\n"]
    for item in budget_data:
        category = item["category"]
        budget = item["budget"]
        spent = item["spent"]
        remaining = item["remaining"]
        usage = item["usage"]

        # 예산 초과 시 경고 아이콘
        if usage >= 100:
            icon = "🚨"
            status = "초과!"
        elif usage >= 80:
            icon = "⚠️"
            status = "주의"
        else:
            icon = "✅"
            status = "안전"

        lines.append(f"{icon} {category}: {spent:,.0f}원 / {budget:,.0f}원")
        lines.append(f"   사용률 {usage:.1f}% ({status})")
        lines.append(f"   남은 예산: {remaining:,.0f}원\n")

    return "\n".join(lines)
