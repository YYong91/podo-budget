"""3 Strike 에러 카운터 서비스.

사용자가 봇에 파싱 불가능한 메시지를 보낼 때 Strike 카운트를 추적한다.
Strike 1→2→3으로 갈수록 다른 에러 메시지를 제공하며,
성공적인 파싱 시 카운트를 초기화한다.

인메모리 딕셔너리 기반이며, TTL 30분(1800초) 후 자동 만료된다.
"""

import time

# TTL 30분 (1800초)
STRIKE_TTL_SECONDS: int = 1800

# 에러 카운트 저장소: key="{platform}:{user_id}", value=(count, timestamp)
_error_counts: dict[str, tuple[int, float]] = {}


def _make_key(platform: str, user_id: str) -> str:
    """플랫폼과 사용자 ID로 딕셔너리 키를 생성한다."""
    return f"{platform}:{user_id}"


def get_strike_count(platform: str, user_id: str) -> int:
    """현재 Strike 카운트를 반환한다.

    만료되었거나 존재하지 않으면 0을 반환한다.
    만료된 항목은 딕셔너리에서 자동 삭제된다.
    """
    key = _make_key(platform, user_id)
    entry = _error_counts.get(key)
    if entry is None:
        return 0

    count, timestamp = entry
    if time.time() - timestamp > STRIKE_TTL_SECONDS:
        # TTL 만료 — 딕셔너리에서 제거
        del _error_counts[key]
        return 0

    return count


def increment_strike(platform: str, user_id: str) -> int:
    """Strike 카운트를 1 증가시키고 새 카운트를 반환한다.

    만료된 항목이면 1부터 다시 시작한다.
    """
    current = get_strike_count(platform, user_id)
    new_count = current + 1
    key = _make_key(platform, user_id)
    _error_counts[key] = (new_count, time.time())
    return new_count


def reset_strike(platform: str, user_id: str) -> None:
    """Strike 카운트를 초기화한다.

    성공적인 파싱 시 호출하여 카운트를 제거한다.
    """
    key = _make_key(platform, user_id)
    _error_counts.pop(key, None)
