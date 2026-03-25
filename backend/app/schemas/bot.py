"""봇 응답 데이터 객체

핸들러가 외부 API를 직접 호출하는 대신 BotResponse를 반환하고,
dispatch 레이어(telegram_webhook, handle_callback_query)에서만 실제 전송을 수행합니다.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(slots=True)
class BotResponse:
    """봇 핸들러의 반환값 — 메시징 레이어와 비즈니스 로직을 분리

    Attributes:
        text: 사용자에게 보낼 메시지 본문
        reply_markup: 인라인 키보드 등의 마크업 (Telegram 전용, 선택사항)
        callback_answer: answer_callback_query로 보낼 팝업 텍스트 (콜백 핸들러 전용)
    """

    text: str
    reply_markup: dict | None = None
    callback_answer: str | None = None


@dataclass(slots=True)
class BotResponseList:
    """복수 응답이 필요한 경우 (callback_answer + 메시지 전송 등)

    Attributes:
        responses: 순서대로 처리할 BotResponse 리스트
        callback_answer: answer_callback_query 팝업 텍스트 (첫 번째로 처리)
    """

    responses: list[BotResponse] = field(default_factory=list)
    callback_answer: str | None = None
