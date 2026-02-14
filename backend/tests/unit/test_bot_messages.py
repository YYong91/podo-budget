"""
봇 메시지 템플릿 단위 테스트

- format 함수들의 출력 형식 검증
- 금액 포맷팅, 한글 메시지 정상 출력 확인
"""

from app.services.bot_messages import (
    format_delete_confirm,
    format_expense_saved,
    format_help_message,
    format_parse_error,
    format_server_error,
    format_timeout_message,
    format_unknown_input,
    format_welcome_message,
)


def test_format_expense_saved():
    """지출 저장 성공 메시지 포맷 확인"""
    result = format_expense_saved(amount=8000, category="식비", description="김치찌개", date="2026-02-11")

    assert "8,000원" in result
    assert "식비" in result
    assert "김치찌개" in result
    assert "2026-02-11" in result
    assert "✅" in result


def test_format_expense_saved_large_amount():
    """큰 금액의 천 단위 콤마 포맷"""
    result = format_expense_saved(amount=1500000, category="주거", description="월세", date="2026-02-01")

    assert "1,500,000원" in result


def test_format_parse_error():
    """파싱 실패 메시지 포맷"""
    result = format_parse_error("아무말이나")

    assert "아무말이나" in result
    assert "금액을 찾을 수 없어요" in result
    assert "예시" in result


def test_format_unknown_input():
    """알 수 없는 입력 메시지 포맷"""
    result = format_unknown_input("xyz")

    assert "xyz" in result
    assert "이해하지 못했어요" in result
    assert "입력해보세요" in result


def test_format_help_message():
    """도움말 메시지에 필수 내용 포함"""
    result = format_help_message()

    assert "사용 가이드" in result
    assert "/help" in result
    assert "/start" in result
    assert "자연어" in result


def test_format_welcome_message():
    """환영 메시지에 필수 내용 포함"""
    result = format_welcome_message()

    assert "환영" in result
    assert "가계부" in result
    assert "사용법" in result


def test_format_delete_confirm():
    """삭제 완료 메시지 포맷"""
    result = format_delete_confirm(amount=8000, category="식비", description="김치찌개")

    assert "8,000원" in result
    assert "식비" in result
    assert "김치찌개" in result
    assert "삭제" in result


def test_format_server_error():
    """서버 오류 메시지 포맷"""
    result = format_server_error()

    assert "오류" in result
    assert "다시 시도" in result


def test_format_timeout_message():
    """타임아웃 메시지 포맷"""
    result = format_timeout_message()

    assert "시간" in result
    assert "다시" in result
