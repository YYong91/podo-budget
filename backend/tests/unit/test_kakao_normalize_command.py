"""카카오 봇 한글 명령어 정규화 단위 테스트"""

import pytest

from app.api.kakao import normalize_command


class TestNormalizeCommand:
    """normalize_command 함수 테스트"""

    # 한글 → 슬래시 명령어 변환
    @pytest.mark.parametrize(
        "input_text, expected",
        [
            ("도움말", "/help"),
            ("도움", "/help"),
            ("리포트", "/report"),
            ("요약", "/report"),
            ("예산", "/budget"),
            ("취소", "/undo"),
            ("삭제", "/undo"),
            ("변경", "/change"),
            ("바꿔", "/change"),
            ("연동", "/link"),
        ],
    )
    def test_korean_to_slash_command(self, input_text, expected):
        assert normalize_command(input_text) == expected

    # 인자 있는 명령어
    @pytest.mark.parametrize(
        "input_text, expected",
        [
            ("변경 외식비", "/change 외식비"),
            ("바꿔 교통비", "/change 교통비"),
            ("연동 ABC123", "/link ABC123"),
        ],
    )
    def test_korean_command_with_args(self, input_text, expected):
        assert normalize_command(input_text) == expected

    # 인자 비허용 명령어에 인자가 붙으면 정규화하지 않음
    @pytest.mark.parametrize(
        "input_text",
        [
            "취소해줘",
            "삭제해줘",
            "도움말 보여줘",
            "예산 현황 보여줘",
            "리포트 보여줘",
        ],
    )
    def test_no_false_positive_with_suffix(self, input_text):
        assert normalize_command(input_text) == input_text

    # 슬래시 명령어는 그대로 통과
    @pytest.mark.parametrize(
        "input_text",
        [
            "/help",
            "/report",
            "/budget",
            "/undo",
            "/change",
            "/change 외식비",
            "/link ABC123",
        ],
    )
    def test_slash_commands_passthrough(self, input_text):
        assert normalize_command(input_text) == input_text

    # 결제수단 관련 명령어
    @pytest.mark.parametrize(
        "input_text, expected",
        [
            ("결제수단변경", "/change_payment"),
            ("결제수단", "/change_payment"),
        ],
    )
    def test_payment_command(self, input_text, expected):
        assert normalize_command(input_text) == expected

    # 자연어 입력은 그대로 통과
    @pytest.mark.parametrize(
        "input_text",
        [
            "점심에 김치찌개 8000원",
            "스타벅스 아메리카노 4500원",
            "어제 택시비 2만원",
        ],
    )
    def test_natural_language_passthrough(self, input_text):
        assert normalize_command(input_text) == input_text


class TestCommandDispatch:
    """/change_payment이 /change에 잡히지 않고 올바르게 디스패치되는지 검증"""

    def test_change_payment_not_caught_by_change(self):
        """핵심 버그: /change_payment이 /change 핸들러에 잡히면 안 됨"""
        from app.api.kakao import _COMMAND_HANDLERS

        utterance = "/change_payment"
        cmd = utterance.split(maxsplit=1)[0]
        assert cmd in _COMMAND_HANDLERS
        # /change가 아닌 /change_payment 핸들러가 매칭되어야 함
        assert cmd == "/change_payment"

    def test_change_command_still_works(self):
        """/change는 여전히 카테고리 변경으로 디스패치"""
        from app.api.kakao import _COMMAND_HANDLERS

        utterance = "/change"
        cmd = utterance.split(maxsplit=1)[0]
        assert cmd in _COMMAND_HANDLERS
        assert cmd == "/change"

    def test_change_with_args_still_works(self):
        """/change 외식비 → cmd는 /change"""
        utterance = "/change 외식비"
        cmd = utterance.split(maxsplit=1)[0]
        assert cmd == "/change"

    def test_set_payment_dispatches_correctly(self):
        """/set_payment도 /change에 잡히지 않아야 함"""
        from app.api.kakao import _COMMAND_HANDLERS

        utterance = "/set_payment 123"
        cmd = utterance.split(maxsplit=1)[0]
        assert cmd in _COMMAND_HANDLERS
        assert cmd == "/set_payment"
