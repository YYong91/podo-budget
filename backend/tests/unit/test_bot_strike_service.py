"""3 Strike 에러 카운터 서비스 테스트.

사용자가 파싱 불가능한 메시지를 보낼 때 Strike 카운트를 추적하는 서비스를 검증한다.
"""

import time

import pytest

from app.services.bot_strike_service import (
    _error_counts,
    get_strike_count,
    increment_strike,
    reset_strike,
)


@pytest.fixture(autouse=True)
def clear_error_counts():
    """매 테스트마다 에러 카운트 초기화."""
    _error_counts.clear()
    yield
    _error_counts.clear()


class TestGetStrikeCount:
    """get_strike_count 함수 테스트."""

    def test_초기_카운트는_0(self):
        """등록되지 않은 사용자의 카운트는 0이다."""
        assert get_strike_count("telegram", "12345") == 0

    def test_만료된_항목은_0_반환(self):
        """TTL(30분)이 지난 항목은 0을 반환한다."""
        key = "telegram:12345"
        # 31분 전 타임스탬프로 직접 설정
        _error_counts[key] = (2, time.time() - 1860)
        assert get_strike_count("telegram", "12345") == 0

    def test_만료된_항목은_딕셔너리에서_제거(self):
        """만료된 항목 조회 시 딕셔너리에서도 삭제된다."""
        key = "telegram:12345"
        _error_counts[key] = (2, time.time() - 1860)
        get_strike_count("telegram", "12345")
        assert key not in _error_counts

    def test_유효한_항목은_카운트_반환(self):
        """TTL 이내의 항목은 정확한 카운트를 반환한다."""
        key = "telegram:12345"
        _error_counts[key] = (3, time.time())
        assert get_strike_count("telegram", "12345") == 3


class TestIncrementStrike:
    """increment_strike 함수 테스트."""

    def test_첫_증가는_1_반환(self):
        """처음 increment하면 1을 반환한다."""
        result = increment_strike("telegram", "12345")
        assert result == 1

    def test_누적_증가(self):
        """연속 increment하면 누적된다 (1→2→3)."""
        assert increment_strike("telegram", "12345") == 1
        assert increment_strike("telegram", "12345") == 2
        assert increment_strike("telegram", "12345") == 3

    def test_만료_후_증가는_1부터_재시작(self):
        """TTL 만료 후 increment하면 1부터 다시 시작한다."""
        key = "telegram:12345"
        _error_counts[key] = (3, time.time() - 1860)
        result = increment_strike("telegram", "12345")
        assert result == 1


class TestResetStrike:
    """reset_strike 함수 테스트."""

    def test_리셋_후_카운트는_0(self):
        """reset 후 get_strike_count는 0을 반환한다."""
        increment_strike("telegram", "12345")
        increment_strike("telegram", "12345")
        reset_strike("telegram", "12345")
        assert get_strike_count("telegram", "12345") == 0

    def test_리셋은_딕셔너리에서_제거(self):
        """reset은 딕셔너리에서 항목을 삭제한다."""
        increment_strike("telegram", "12345")
        reset_strike("telegram", "12345")
        assert "telegram:12345" not in _error_counts

    def test_존재하지_않는_키_리셋은_에러_없음(self):
        """존재하지 않는 키를 reset해도 에러가 발생하지 않는다."""
        reset_strike("telegram", "99999")  # 에러 없이 통과


class TestIsolation:
    """사용자/플랫폼 간 격리 테스트."""

    def test_다른_사용자는_격리(self):
        """같은 플랫폼이라도 다른 user_id는 독립적이다."""
        increment_strike("telegram", "111")
        increment_strike("telegram", "111")
        increment_strike("telegram", "222")

        assert get_strike_count("telegram", "111") == 2
        assert get_strike_count("telegram", "222") == 1

    def test_다른_플랫폼은_격리(self):
        """같은 user_id라도 다른 플랫폼은 독립적이다."""
        increment_strike("telegram", "12345")
        increment_strike("telegram", "12345")
        increment_strike("kakao", "12345")

        assert get_strike_count("telegram", "12345") == 2
        assert get_strike_count("kakao", "12345") == 1
