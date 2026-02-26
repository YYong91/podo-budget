"""카테고리 컨텍스트 프롬프트 주입 테스트"""

from app.services.prompts import get_expense_parser_prompt


def test_prompt_no_context():
    """컨텍스트 없을 때 기본 프롬프트 반환"""
    prompt = get_expense_parser_prompt()
    assert "추출 규칙" in prompt
    assert "카테고리" in prompt
    # 동적 섹션 없음
    assert "사용자 카테고리 목록" not in prompt
    assert "과거 거래 패턴" not in prompt


def test_prompt_with_categories():
    """사용자 카테고리 목록이 프롬프트에 주입됨"""
    cats = ["식비", "교통비", "전기차충전", "쿠팡이츠"]
    prompt = get_expense_parser_prompt(categories=cats)

    assert "사용자 카테고리 목록" in prompt
    assert "식비" in prompt
    assert "전기차충전" in prompt
    assert "쿠팡이츠" in prompt
    # 기존 하드코딩 규칙도 유지
    assert "추출 규칙" in prompt


def test_prompt_with_history_hints():
    """히스토리 패턴이 프롬프트에 주입됨"""
    hints = {"쿠팡이츠": "식비", "전기차충전": "교통비", "월급": "급여"}
    prompt = get_expense_parser_prompt(history_hints=hints)

    assert "과거 거래 패턴" in prompt
    assert '"쿠팡이츠" → 식비' in prompt
    assert '"전기차충전" → 교통비' in prompt
    assert '"월급" → 급여' in prompt


def test_prompt_with_both_context():
    """카테고리 + 히스토리 모두 주입됨"""
    cats = ["식비", "교통비"]
    hints = {"스타벅스": "식비"}
    prompt = get_expense_parser_prompt(categories=cats, history_hints=hints)

    assert "사용자 카테고리 목록" in prompt
    assert "과거 거래 패턴" in prompt
    assert "식비, 교통비" in prompt
    assert '"스타벅스" → 식비' in prompt


def test_prompt_empty_categories_not_injected():
    """빈 카테고리 목록은 주입 안 됨"""
    prompt = get_expense_parser_prompt(categories=[])
    assert "사용자 카테고리 목록" not in prompt


def test_prompt_empty_hints_not_injected():
    """빈 히스토리 dict는 주입 안 됨"""
    prompt = get_expense_parser_prompt(history_hints={})
    assert "과거 거래 패턴" not in prompt


def test_prompt_hints_limited_to_20():
    """히스토리 힌트는 최대 20개만 주입됨"""
    # 30개 힌트 생성
    hints = {f"거래{i}": f"카테고리{i}" for i in range(30)}
    prompt = get_expense_parser_prompt(history_hints=hints)

    # 처음 20개만 포함
    assert '"거래0" → 카테고리0' in prompt
    assert '"거래19" → 카테고리19' in prompt
    # 21번째부터는 없어야 함
    assert '"거래20" → 카테고리20' not in prompt
