"""카카오톡 채널 봇 Webhook 라우트

카카오 i 오픈빌더 스킬 서버 형태로 구현됩니다.
사용자가 자연어로 지출을 입력하면 LLM으로 파싱하여 DB에 저장합니다.
Telegram 봇과 달리 응답을 JSON으로 직접 반환합니다.

주의: 카카오 오픈빌더는 5초 내 응답이 필수입니다.
LLM 호출을 4.5초로 제한하고 타임아웃 시 안내 메시지를 반환합니다.
"""

import asyncio
import hmac
import logging
from collections.abc import Awaitable, Callable
from datetime import datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import and_, extract, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_user_active_household_id_or_none
from app.core.config import settings
from app.core.database import get_db
from app.models.budget import Budget
from app.models.category import Category
from app.models.expense import Expense
from app.models.income import Income
from app.services.bot_messages import (
    format_budget_status,
    format_budget_status_full,
    format_delete_confirm,
    format_expense_saved,
    format_help_message,
    format_income_saved,
    format_kakao_link_usage_message,
    format_parse_error,
    format_report_message,
    format_report_message_full,
    format_server_error,
    format_timeout_message,
)
from app.services.bot_strike_service import increment_strike, reset_strike
from app.services.bot_user_service import get_or_create_bot_user, link_kakao_account_by_code
from app.services.category_hint_service import get_category_hints, get_user_categories
from app.services.category_mapping_service import get_category_mappings_for_prompt, get_mapped_category
from app.services.category_service import get_or_create_category
from app.services.expense_context_detector import resolve_household_id
from app.services.llm_service import get_llm_provider

logger = logging.getLogger(__name__)

router = APIRouter()

# 백그라운드 콜백 태스크 참조 보관 (GC 방지 + 셧다운 안전)
_background_tasks: set[asyncio.Task] = set()  # type: ignore[type-arg]

# 한글 명령어 → 슬래시 명령어 매핑 (모바일 입력 편의)
# 인자를 받는 명령어: /change, /link
# 인자를 받지 않는 명령어: /help, /report, /budget, /undo
COMMAND_ALIASES: dict[str, tuple[str, bool]] = {
    # 한글 키워드: (슬래시 명령어, 인자 허용 여부)
    "도움말": ("/help", False),
    "도움": ("/help", False),
    "리포트": ("/report", False),
    "요약": ("/report", False),
    "예산": ("/budget", False),
    "취소": ("/undo", False),
    "삭제": ("/undo", False),
    "변경": ("/change", True),
    "바꿔": ("/change", True),
    "연동": ("/link", True),
    "리포트 전체": ("/report_full", False),
    "예산 전체": ("/budget_full", False),
}


def normalize_command(utterance: str) -> str:
    """한글 명령어를 슬래시 명령어로 정규화

    "변경 외식비" → "/change 외식비"
    "리포트" → "/report"
    "리포트 전체" → "/report_full"
    "취소해줘" → 그대로 (정확히 일치하지 않으므로 LLM 파싱으로 넘어감)
    """
    # 다중 단어 별칭을 먼저 체크 (예: "리포트 전체", "예산 전체")
    if utterance in COMMAND_ALIASES:
        command, _ = COMMAND_ALIASES[utterance]
        return command

    parts = utterance.split(maxsplit=1)
    first_word = parts[0]

    if first_word not in COMMAND_ALIASES:
        return utterance

    command, allows_args = COMMAND_ALIASES[first_word]
    rest = parts[1].strip() if len(parts) > 1 else ""

    # 인자를 허용하지 않는 명령어는 정확히 일치할 때만 정규화
    if not allows_args and rest:
        return utterance

    return f"{command} {rest}" if rest else command


def make_callback_pending_response(text: str) -> dict:
    """카카오 콜백 대기 응답 — useCallback: true로 즉시 반환

    카카오 오픈빌더 콜백 API 규격에 따라 useCallback과 data를 포함합니다.
    이 응답을 받은 카카오는 callbackUrl로 최종 결과를 기다립니다.
    """
    return {
        "version": "2.0",
        "useCallback": True,
        "data": {"text": text},
    }


async def _send_callback_response(callback_url: str, response: dict) -> None:
    """콜백 URL로 최종 결과 전송

    카카오 오픈빌더가 제공한 callbackUrl(1분 유효, 1회용)로 POST 요청을 보냅니다.
    """
    import httpx

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(callback_url, json=response)
            if resp.status_code != 200:
                logger.error(f"카카오 콜백 전송 실패: {resp.status_code} - {resp.text}")
    except Exception as e:
        logger.error(f"카카오 콜백 전송 에러: {e}")


async def _process_expense_callback(
    utterance: str,
    kakao_user_id: str,
    callback_url: str,
) -> None:
    """백그라운드에서 LLM 파싱 → DB 저장 → 콜백 전송

    asyncio.create_task로 실행되며, 독립적인 DB 세션을 사용합니다.
    원본 요청의 세션은 이미 반환되었으므로 새 세션으로 모든 조회/저장을 수행합니다.
    """
    from app.core.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        try:
            # 새 세션에서 봇 사용자 재조회
            bot_user = await get_or_create_bot_user(db, platform="kakao", platform_user_id=kakao_user_id, auto_create_household=True)
            active_household_id = await get_user_active_household_id_or_none(bot_user, db)

            llm = get_llm_provider("parse")
            household_id_for_hints = active_household_id
            user_categories = await get_user_categories(db, bot_user.id, household_id_for_hints)
            history_hints = await get_category_hints(db, bot_user.id, household_id_for_hints)
            cat_mappings = await get_category_mappings_for_prompt(db, user_id=bot_user.id, household_id=household_id_for_hints)

            # LLM 파싱 (타임아웃 없음 — 콜백이므로 최대 1분)
            parsed = await llm.parse_expense(utterance, categories=user_categories, history_hints=history_hints, category_mappings=cat_mappings)
            household_id = await resolve_household_id(utterance, None, active_household_id)

            if isinstance(parsed, dict):
                result = await _handle_single_expense(db, bot_user, parsed, utterance, household_id)
            elif isinstance(parsed, list):
                result = await _handle_multiple_expenses(db, bot_user, parsed, utterance, household_id)
            else:
                result = make_simple_text_response(format_server_error(), quick_replies=[make_quick_reply("❓ 도움말", "도움말")])

            await _send_callback_response(callback_url, result)

        except Exception as e:
            logger.error(f"카카오 콜백 백그라운드 처리 실패: {e}")
            error_response = make_simple_text_response(
                format_server_error(),
                quick_replies=[make_quick_reply("❓ 도움말", "도움말")],
            )
            await _send_callback_response(callback_url, error_response)


def make_simple_text_response(text: str, quick_replies: list[dict] | None = None) -> dict:
    """카카오 i 오픈빌더 simpleText 응답 생성

    Args:
        text: 응답 메시지 본문
        quick_replies: 빠른 답장 버튼 리스트 (선택사항)

    Returns:
        카카오 응답 형식 (version 2.0)
    """
    response: dict[str, Any] = {"version": "2.0", "template": {"outputs": [{"simpleText": {"text": text}}]}}

    if quick_replies:
        response["template"]["quickReplies"] = quick_replies

    return response


def make_quick_reply(label: str, message_text: str) -> dict:
    """빠른 답장 버튼 아이템 생성

    Args:
        label: 버튼에 표시될 텍스트
        message_text: 버튼 클릭 시 전송될 메시지

    Returns:
        quickReply 아이템
    """
    return {"label": label, "action": "message", "messageText": message_text}


# ---------------------------------------------------------------------------
# kakao_webhook: 슬래시 명령어 디스패치
# ---------------------------------------------------------------------------


async def _handle_help_command(utterance: str, bot_user: Any, db: AsyncSession, active_household_id: int | None) -> dict:
    """``/help`` 명령어 처리"""
    return make_simple_text_response(
        format_help_message(platform="kakao"),
        quick_replies=[
            make_quick_reply("📊 이번달 지출 보기", "리포트"),
            make_quick_reply("💰 예산 현황", "예산"),
        ],
    )


async def _handle_report_command(utterance: str, bot_user: Any, db: AsyncSession, active_household_id: int | None) -> dict:
    """``/report`` 명령어 처리"""
    return await handle_report_command(db, household_id=active_household_id)


async def _handle_budget_command(utterance: str, bot_user: Any, db: AsyncSession, active_household_id: int | None) -> dict:
    """``/budget`` 명령어 처리"""
    return await handle_budget_command(db, household_id=active_household_id)


async def _handle_link_command(utterance: str, bot_user: Any, db: AsyncSession, active_household_id: int | None, *, kakao_user_id: str = "") -> dict:
    """``/link`` 명령어 처리 (웹 계정 연동)"""
    parts = utterance.split()
    if len(parts) != 2:
        return make_simple_text_response(format_kakao_link_usage_message())
    code = parts[1].upper()
    success, message = await link_kakao_account_by_code(db, code, kakao_user_id)
    return make_simple_text_response(message)


async def _handle_undo_command(utterance: str, bot_user: Any, db: AsyncSession, active_household_id: int | None) -> dict:
    """``/undo`` 명령어 처리 (마지막 지출 삭제)"""
    return await handle_undo_command(db, bot_user)


async def _handle_change_command(utterance: str, bot_user: Any, db: AsyncSession, active_household_id: int | None) -> dict:
    """``/change`` 명령어 처리 (마지막 지출 카테고리 변경)"""
    return await handle_change_command(db, bot_user, utterance, active_household_id)


async def _handle_report_full_command(utterance: str, bot_user: Any, db: AsyncSession, active_household_id: int | None) -> dict:
    """``/report_full`` 명령어 처리 (전체 카테고리 리포트)"""
    return await handle_report_full_command(db, household_id=active_household_id)


async def _handle_budget_full_command(utterance: str, bot_user: Any, db: AsyncSession, active_household_id: int | None) -> dict:
    """``/budget_full`` 명령어 처리 (전체 예산 현황)"""
    return await handle_budget_full_command(db, household_id=active_household_id)


# 슬래시 명령어 디스패치 테이블
# 키: 명령어 prefix, 값: 핸들러 함수
# 핸들러 시그니처: (utterance, bot_user, db, active_household_id) -> dict
_COMMAND_HANDLERS: dict[
    str,
    Callable[[str, Any, AsyncSession, int | None], Awaitable[dict]],
] = {
    "/help": _handle_help_command,
    "/report_full": _handle_report_full_command,
    "/report": _handle_report_command,
    "/budget_full": _handle_budget_full_command,
    "/budget": _handle_budget_command,
    "/undo": _handle_undo_command,
    "/change": _handle_change_command,
}


async def _handle_expense_input(
    utterance: str,
    bot_user: Any,
    db: AsyncSession,
    active_household_id: int | None,
    *,
    callback_url: str | None = None,
    kakao_user_id: str = "",
) -> dict:
    """자연어 지출 입력 → LLM 파싱 → DB 저장

    콜백 모드(KAKAO_CALLBACK_ENABLED + callbackUrl 존재):
    - 즉시 useCallback 응답 반환 → 백그라운드에서 LLM 파싱 → 콜백 URL로 결과 전송
    기존 모드:
    - 4.5초 타임아웃 내에서 동기 처리
    """
    # 콜백 모드: 즉시 응답 + 백그라운드 처리
    if callback_url and settings.KAKAO_CALLBACK_ENABLED:
        task = asyncio.create_task(
            _process_expense_callback(utterance, kakao_user_id, callback_url),
            name=f"kakao-callback-{kakao_user_id[:8]}",
        )
        _background_tasks.add(task)
        task.add_done_callback(_background_tasks.discard)
        return make_callback_pending_response("⏳ 분석 중이에요")

    # 기존 동작 (4.5초 타임아웃)
    try:
        llm = get_llm_provider("parse")

        # 사용자 카테고리 목록 + 히스토리 힌트 + 매핑 로드 (정확도 향상)
        household_id_for_hints = active_household_id
        user_categories = await get_user_categories(db, bot_user.id, household_id_for_hints)
        history_hints = await get_category_hints(db, bot_user.id, household_id_for_hints)
        cat_mappings = await get_category_mappings_for_prompt(db, user_id=bot_user.id, household_id=household_id_for_hints)

        try:
            async with asyncio.timeout(4.5):
                parsed = await llm.parse_expense(utterance, categories=user_categories, history_hints=history_hints, category_mappings=cat_mappings)
        except TimeoutError:
            logger.warning(f"카카오 LLM 파싱 타임아웃: {utterance}")
            return make_simple_text_response(
                format_timeout_message(),
                quick_replies=[make_quick_reply("🔄 다시 시도", utterance), make_quick_reply("❓ 도움말", "도움말")],
            )

        # 자연어 컨텍스트 기반 household_id 결정
        household_id = await resolve_household_id(utterance, None, active_household_id)

        # 단일 지출 (dict) 처리
        if isinstance(parsed, dict):
            return await _handle_single_expense(db, bot_user, parsed, utterance, household_id)

        # 여러 지출 (list) 처리
        if isinstance(parsed, list):
            return await _handle_multiple_expenses(db, bot_user, parsed, utterance, household_id)

        # 예상치 못한 타입
        return make_simple_text_response(format_server_error(), quick_replies=[make_quick_reply("❓ 도움말", "도움말")])

    except Exception as e:
        logger.error(f"카카오 webhook LLM 파싱 실패: {e}")
        return make_simple_text_response(format_server_error(), quick_replies=[make_quick_reply("❓ 도움말", "도움말")])


async def _handle_single_expense(db: AsyncSession, bot_user: Any, parsed: dict, utterance: str, household_id: int | None) -> dict:
    """단일 파싱 결과 처리: 에러 / 카테고리 매핑 / 수입·지출 분기 저장"""
    strike_user_id = str(bot_user.id)

    if "error" in parsed:
        strike = increment_strike("kakao", strike_user_id)
        # Strike별 quickReply 단계적 확장
        if strike <= 1:
            qr = [make_quick_reply("❓ 도움말", "도움말")]
        elif strike == 2:
            qr = [make_quick_reply("❓ 도움말", "도움말"), make_quick_reply("📊 리포트", "리포트")]
        else:
            qr = [make_quick_reply("❓ 도움말", "도움말"), make_quick_reply("📊 리포트", "리포트"), make_quick_reply("💰 예산", "예산")]
        return make_simple_text_response(format_parse_error(strike), quick_replies=qr)

    # 파싱 성공 → Strike 리셋
    reset_strike("kakao", strike_user_id)

    item_type = parsed.get("type", "expense")

    # 카테고리 매핑 확인 → 기존 카테고리 → 새로 생성
    category_name = parsed.get("category", "기타")
    mapped = await get_mapped_category(db, category_name, user_id=bot_user.id, household_id=household_id)
    category = mapped or await get_or_create_category(db, category_name, user_id=bot_user.id, household_id=household_id)

    record_date = datetime.fromisoformat(parsed.get("date", datetime.now().isoformat()))
    record_kwargs = {
        "user_id": bot_user.id,
        "amount": parsed["amount"],
        "description": parsed.get("description", utterance),
        "category_id": category.id,
        "raw_input": utterance,
        "date": record_date,
        "household_id": household_id,
    }

    if item_type == "income":
        record = Income(**record_kwargs)
        db.add(record)
        await db.commit()
        await db.refresh(record)
        return make_simple_text_response(
            format_income_saved(
                amount=parsed["amount"],
                category=category.name,
                description=parsed.get("description", utterance),
                date=record_date.date().isoformat(),
            ),
            quick_replies=[
                make_quick_reply("↩️ 방금 거 취소", "취소"),
                make_quick_reply("📊 이번달 보기", "리포트"),
            ],
        )

    # 지출 (기본)
    record = Expense(**record_kwargs)
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return make_simple_text_response(
        format_expense_saved(
            amount=parsed["amount"],
            category=category.name,
            description=parsed.get("description", utterance),
            date=record_date.date().isoformat(),
        ),
        quick_replies=[
            make_quick_reply("↩️ 방금 거 취소", "취소"),
            make_quick_reply("🔄 카테고리 변경", "변경"),
            make_quick_reply("📊 이번달 지출 보기", "리포트"),
        ],
    )


async def _handle_multiple_expenses(db: AsyncSession, bot_user: Any, parsed: list, utterance: str, household_id: int | None) -> dict:
    """여러 건 처리 — 수입/지출 혼합 지원"""
    created_expenses = []
    created_incomes = []

    for item in parsed:
        item_type = item.get("type", "expense")
        category_name = item.get("category", "기타")
        mapped = await get_mapped_category(db, category_name, user_id=bot_user.id, household_id=household_id)
        category = mapped or await get_or_create_category(db, category_name, user_id=bot_user.id, household_id=household_id)

        record_date = datetime.fromisoformat(item.get("date", datetime.now().isoformat()))
        record_kwargs = {
            "user_id": bot_user.id,
            "amount": item["amount"],
            "description": item.get("description", ""),
            "category_id": category.id,
            "raw_input": utterance,
            "date": record_date,
            "household_id": household_id,
        }

        if item_type == "income":
            record = Income(**record_kwargs)
            db.add(record)
            created_incomes.append((record, item))
        else:
            record = Expense(**record_kwargs)
            db.add(record)
            created_expenses.append((record, item))

    await db.commit()

    # 성공 → Strike 리셋
    reset_strike("kakao", str(bot_user.id))

    # 응답 메시지 생성
    total_amount = sum(item["amount"] for item in parsed)
    expense_count = len(created_expenses)
    income_count = len(created_incomes)

    parts = []
    if expense_count > 0:
        parts.append(f"지출 {expense_count}건")
    if income_count > 0:
        parts.append(f"수입 {income_count}건")

    message_lines = [f"✅ {' + '.join(parts)}(총 ₩{total_amount:,.0f}) 기록했어요\n"]

    for idx, (_, item) in enumerate(created_expenses + created_incomes, 1):
        type_icon = "💵" if item.get("type") == "income" else "💰"
        message_lines.append(f"{idx}. {type_icon} {item['amount']:,.0f}원 - 📂 {item.get('category', '기타')} - {item.get('description', '')}")

    return make_simple_text_response(
        "\n".join(message_lines),
        quick_replies=[
            make_quick_reply("↩️ 방금 거 취소", "취소"),
            make_quick_reply("📊 이번달 보기", "리포트"),
        ],
    )


@router.post("/webhook")
async def kakao_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """카카오톡 채널 봇 Webhook 엔드포인트

    카카오 i 오픈빌더에서 사용자 메시지를 이 URL로 POST합니다.
    - 명령어 (/help, /report, /budget): 해당 정보 반환
    - 자연어 입력: LLM으로 파싱 → DB 저장 → 결과 응답

    응답은 Telegram과 달리 JSON을 직접 반환합니다 (비동기 send 없음).

    보안: KAKAO_BOT_API_KEY 설정 시 Authorization 헤더 검증
    """
    # KAKAO_BOT_API_KEY가 곧 인증 수단 — 미설정 시 무인증 상태이므로 모든 요청 거부
    if not settings.KAKAO_BOT_API_KEY:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="카카오 봇 API 키가 설정되지 않았습니다")
    auth_header = request.headers.get("Authorization", "")
    # 카카오 오픈빌더는 "Bearer TOKEN" 형식으로 전송할 수 있으므로 prefix 제거 (#145)
    api_key = auth_header.removeprefix("Bearer ").strip()
    # hmac.compare_digest로 timing attack 방지 (#145)
    if not hmac.compare_digest(api_key, settings.KAKAO_BOT_API_KEY):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="유효하지 않은 API 키")

    try:
        data = await request.json()

        # userRequest에서 utterance와 user.id 추출
        user_request = data.get("userRequest", {})
        utterance = user_request.get("utterance", "").strip()
        # 카카오 오픈빌더: user 정보는 userRequest.user에 위치
        user_info = user_request.get("user", {}) or data.get("user", {})
        kakao_user_id = user_info.get("id", "unknown")

        # 봇 사용자 생성 또는 조회 (데이터 격리를 위함)
        bot_user = await get_or_create_bot_user(db, platform="kakao", platform_user_id=kakao_user_id, auto_create_household=True)

        # 사용자의 활성 가구 ID 조회 (봇은 미연동 사용자를 별도 처리해야 하므로 or_none 사용)
        active_household_id = await get_user_active_household_id_or_none(bot_user, db)

        # utterance가 없으면 에러 응답
        if not utterance:
            return make_simple_text_response('❓ 메시지를 입력해주세요.\n\n예: "점심에 김치찌개 8000원"')

        # 한글 명령어 정규화 (예: "변경" → "/change", "리포트" → "/report")
        utterance = normalize_command(utterance)

        # /link는 요청에서 추출한 kakao_user_id가 필요하므로 별도 처리
        if utterance.startswith("/link"):
            return await _handle_link_command(utterance, bot_user, db, active_household_id, kakao_user_id=kakao_user_id)

        # 슬래시 명령어 디스패치
        for prefix, handler in _COMMAND_HANDLERS.items():
            if utterance.startswith(prefix):
                return await handler(utterance, bot_user, db, active_household_id)

        # 자연어 지출 입력 처리 (콜백 URL이 있으면 전달)
        callback_url = user_request.get("callbackUrl")
        return await _handle_expense_input(
            utterance,
            bot_user,
            db,
            active_household_id,
            callback_url=callback_url,
            kakao_user_id=kakao_user_id,
        )

    except Exception as e:
        logger.error(f"카카오 webhook 처리 실패: {e}")
        return make_simple_text_response(format_server_error())


async def handle_undo_command(db: AsyncSession, bot_user: Any) -> dict:
    """마지막 거래(지출 또는 수입) 삭제

    Expense와 Income 중 created_at이 더 최근인 것을 삭제합니다.

    Args:
        db: 데이터베이스 세션
        bot_user: 봇 사용자 객체

    Returns:
        카카오 응답 형식 (version 2.0)
    """
    # 최신 Expense 조회
    expense_result = await db.execute(select(Expense).where(Expense.user_id == bot_user.id).order_by(Expense.id.desc()).limit(1))
    last_expense = expense_result.scalar_one_or_none()

    # 최신 Income 조회
    income_result = await db.execute(select(Income).where(Income.user_id == bot_user.id).order_by(Income.id.desc()).limit(1))
    last_income = income_result.scalar_one_or_none()

    if not last_expense and not last_income:
        return make_simple_text_response("삭제할 기록이 없어요.")

    # 둘 다 있으면 created_at으로 비교, 같으면 Income 우선 (수입 undo가 더 최근 기능)
    if last_expense and last_income:
        target = last_income if last_income.created_at >= last_expense.created_at else last_expense
    elif last_income:
        target = last_income
    else:
        target = last_expense

    amount = target.amount
    description = target.description
    await db.delete(target)
    await db.commit()

    return make_simple_text_response(
        format_delete_confirm(amount=amount, description=description),
        quick_replies=[
            make_quick_reply("📊 이번달 보기", "리포트"),
            make_quick_reply("❓ 도움말", "도움말"),
        ],
    )


async def _get_accessible_categories(
    db: AsyncSession,
    user_id: int,
    household_id: int | None,
) -> list[Category]:
    """사용자가 접근 가능한 카테고리 목록 (사용 빈도 순 정렬)"""
    conditions = [
        and_(Category.household_id.is_(None), Category.user_id.is_(None)),
        and_(Category.user_id == user_id, Category.household_id.is_(None)),
    ]
    if household_id is not None:
        conditions.append(Category.household_id == household_id)

    result = await db.execute(
        select(Category)
        .outerjoin(Expense, and_(Expense.category_id == Category.id, Expense.user_id == user_id))
        .where(or_(*conditions))
        .group_by(Category.id)
        .order_by(func.count(Expense.id).desc(), Category.name)
    )
    return list(result.scalars().all())


async def handle_change_command(db: AsyncSession, bot_user: Any, utterance: str, active_household_id: int | None) -> dict:
    """마지막 지출의 카테고리 변경

    - /change → 카테고리 목록을 quickReply로 표시
    - /change 카테고리명 → 마지막 지출의 카테고리를 변경

    Args:
        db: 데이터베이스 세션
        bot_user: 봇 사용자 객체
        utterance: 사용자 입력 텍스트
        active_household_id: 활성 가구 ID

    Returns:
        카카오 응답 형식 (version 2.0)
    """
    # 마지막 지출 조회
    result = await db.execute(select(Expense).where(Expense.user_id == bot_user.id).order_by(Expense.id.desc()).limit(1))
    expense = result.scalar_one_or_none()

    if not expense:
        return make_simple_text_response("변경할 지출이 없어요.")

    # 현재 카테고리 조회
    cat_result = await db.execute(select(Category).where(Category.id == expense.category_id))
    current_category = cat_result.scalar_one_or_none()
    current_cat_name = current_category.name if current_category else "기타"

    parts = utterance.split(maxsplit=1)

    # /change만 입력 → 카테고리 목록 표시
    if len(parts) == 1:
        categories = await _get_accessible_categories(db, bot_user.id, expense.household_id)

        # 현재 카테고리를 제외한 목록으로 quickReply 생성
        quick_replies = [make_quick_reply(cat.name, f"변경 {cat.name}") for cat in categories if cat.name != current_cat_name][:10]  # quickReply 최대 10개 제한

        msg = f"📂 마지막 지출: {expense.amount:,.0f}원 - {current_cat_name}\n\n"
        if quick_replies:
            msg += "어떤 카테고리로 변경할까요?"
        else:
            msg += "변경할 카테고리명을 입력해주세요.\n예: 변경 외식비"

        return make_simple_text_response(
            msg,
            quick_replies=quick_replies or [make_quick_reply("↩️ 취소", "리포트")],
        )

    # /change 카테고리명 → 카테고리 변경 실행
    new_cat_name = parts[1].strip()
    new_category = await get_or_create_category(db, new_cat_name, user_id=bot_user.id, household_id=expense.household_id)

    # 매핑 저장: 같은 LLM 응답이 오면 다음부터 자동 적용
    from app.services.category_mapping_service import save_category_mapping

    if current_cat_name != new_cat_name:
        await save_category_mapping(
            db,
            source_name=current_cat_name,
            target_category_id=new_category.id,
            user_id=bot_user.id if expense.household_id is None else None,
            household_id=expense.household_id,
        )

    expense.category_id = new_category.id
    await db.commit()

    return make_simple_text_response(
        f"✅ 카테고리가 변경되었어요.\n\n💰 {expense.amount:,.0f}원 - 📂 {current_cat_name} → {new_cat_name}",
        quick_replies=[
            make_quick_reply("📊 이번달 지출 보기", "리포트"),
            make_quick_reply("❓ 도움말", "도움말"),
        ],
    )


async def handle_report_command(db: AsyncSession, household_id: int | None) -> dict:
    """이번 달 지출 요약 리포트 생성

    카테고리별 지출 합계와 건수를 집계하여 카카오 응답 형식으로 반환합니다.
    가구 단위로 데이터를 조회합니다 (웹 리포트와 동일한 스코프).

    Args:
        db: 데이터베이스 세션
        household_id: 조회할 가구 ID

    Returns:
        카카오 응답 형식 (version 2.0)
    """
    if household_id is None:
        return make_simple_text_response(
            "🏠 가구 설정이 필요합니다.\n웹에서 계정을 연동해주세요.",
            quick_replies=[make_quick_reply("❓ 도움말", "도움말")],
        )

    try:
        # 이번 달 1일부터 현재까지 지출 집계 (가구 단위)
        now = datetime.now()
        result = await db.execute(
            select(
                Category.name,
                func.sum(Expense.amount).label("total"),
                func.count(Expense.id).label("count"),
            )
            .join(Category, Expense.category_id == Category.id)
            .where(Expense.household_id == household_id)
            .where(extract("year", Expense.date) == now.year)
            .where(extract("month", Expense.date) == now.month)
            .group_by(Category.name)
            .order_by(func.sum(Expense.amount).desc())
        )

        rows = result.all()
        report_data = [{"category": row.name, "total": row.total, "count": row.count} for row in rows]

        message = format_report_message(report_data)
        quick_replies = [make_quick_reply("💰 예산 현황", "예산"), make_quick_reply("❓ 도움말", "도움말")]
        # 3개 초과 카테고리 시 "전체 보기" 퀵리플라이 추가
        if len(report_data) > 3:
            quick_replies.insert(0, make_quick_reply("📋 전체 보기", "리포트 전체"))
        return make_simple_text_response(message, quick_replies=quick_replies)

    except Exception as e:
        logger.error(f"리포트 생성 실패: {e}")
        return make_simple_text_response(format_server_error())


async def handle_budget_command(db: AsyncSession, household_id: int | None) -> dict:
    """예산 현황 생성

    설정된 예산과 현재 지출을 비교하여 카카오 응답 형식으로 반환합니다.
    가구 단위로 데이터를 조회합니다 (웹 리포트와 동일한 스코프).

    Args:
        db: 데이터베이스 세션
        household_id: 조회할 가구 ID

    Returns:
        카카오 응답 형식 (version 2.0)
    """
    if household_id is None:
        return make_simple_text_response(
            "🏠 가구 설정이 필요합니다.\n웹에서 계정을 연동해주세요.",
            quick_replies=[make_quick_reply("❓ 도움말", "도움말")],
        )

    try:
        # Budget + Category JOIN으로 카테고리 개별 조회 제거 (N번 → 0번, #168)
        budget_cat_result = await db.execute(
            select(Budget, Category).join(Category, Budget.category_id == Category.id).where(Budget.household_id == household_id)
        )
        budget_cats = budget_cat_result.all()

        if not budget_cats:
            return make_simple_text_response(
                "💵 예산 현황\n\n아직 설정된 예산이 없어요.",
                quick_replies=[make_quick_reply("📊 이번달 지출 보기", "리포트"), make_quick_reply("❓ 도움말", "도움말")],
            )

        budget_data = []
        now = datetime.now()

        for budget, category in budget_cats:
            # 예산 기간 내의 지출 집계
            end_date = budget.end_date if budget.end_date else now

            if budget.start_date > now:
                continue

            # 지출 합계 (예산별 날짜 범위가 다르므로 개별 집계 유지)
            expense_result = await db.execute(
                select(func.sum(Expense.amount))
                .where(Expense.household_id == household_id)
                .where(Expense.category_id == budget.category_id)
                .where(Expense.date >= budget.start_date)
                .where(Expense.date <= end_date)
            )
            spent_amount = expense_result.scalar() or Decimal(0)

            usage = (spent_amount / budget.amount * 100) if budget.amount > 0 else 0
            remaining = budget.amount - spent_amount

            budget_data.append(
                {
                    "category": category.name,
                    "budget": budget.amount,
                    "spent": spent_amount,
                    "remaining": remaining,
                    "usage": usage,
                }
            )

        message = format_budget_status(budget_data)
        quick_replies = [make_quick_reply("📊 이번달 지출 보기", "리포트"), make_quick_reply("❓ 도움말", "도움말")]
        # 위험/안전 예산이 혼재하면 안전 항목이 접혀있으므로 "전체 보기" 추가
        has_danger = any(b["usage"] >= 80 for b in budget_data)
        has_safe = any(b["usage"] < 80 for b in budget_data)
        if has_danger and has_safe:
            quick_replies.insert(0, make_quick_reply("📋 전체 보기", "예산 전체"))
        return make_simple_text_response(message, quick_replies=quick_replies)

    except Exception as e:
        logger.error(f"예산 현황 생성 실패: {e}")
        return make_simple_text_response(format_server_error())


async def handle_report_full_command(db: AsyncSession, household_id: int | None) -> dict:
    """전체 카테고리 지출 리포트 (접기 없이 모든 카테고리 표시)

    Args:
        db: 데이터베이스 세션
        household_id: 조회할 가구 ID

    Returns:
        카카오 응답 형식 (version 2.0)
    """
    if household_id is None:
        return make_simple_text_response(
            "🏠 가구 설정이 필요합니다.\n웹에서 계정을 연동해주세요.",
            quick_replies=[make_quick_reply("❓ 도움말", "도움말")],
        )

    try:
        now = datetime.now()
        result = await db.execute(
            select(
                Category.name,
                func.sum(Expense.amount).label("total"),
                func.count(Expense.id).label("count"),
            )
            .join(Category, Expense.category_id == Category.id)
            .where(Expense.household_id == household_id)
            .where(extract("year", Expense.date) == now.year)
            .where(extract("month", Expense.date) == now.month)
            .group_by(Category.name)
            .order_by(func.sum(Expense.amount).desc())
        )

        rows = result.all()
        report_data = [{"category": row.name, "total": row.total, "count": row.count} for row in rows]

        message = format_report_message_full(report_data)
        return make_simple_text_response(
            message,
            quick_replies=[
                make_quick_reply("💰 예산 현황", "예산"),
                make_quick_reply("❓ 도움말", "도움말"),
            ],
        )

    except Exception as e:
        logger.error(f"전체 리포트 생성 실패: {e}")
        return make_simple_text_response(format_server_error())


async def handle_budget_full_command(db: AsyncSession, household_id: int | None) -> dict:
    """전체 예산 현황 (접기 없이 모든 예산 항목 표시)

    Args:
        db: 데이터베이스 세션
        household_id: 조회할 가구 ID

    Returns:
        카카오 응답 형식 (version 2.0)
    """
    if household_id is None:
        return make_simple_text_response(
            "🏠 가구 설정이 필요합니다.\n웹에서 계정을 연동해주세요.",
            quick_replies=[make_quick_reply("❓ 도움말", "도움말")],
        )

    try:
        budget_cat_result = await db.execute(
            select(Budget, Category).join(Category, Budget.category_id == Category.id).where(Budget.household_id == household_id)
        )
        budget_cats = budget_cat_result.all()

        if not budget_cats:
            return make_simple_text_response(
                "💵 예산 현황\n\n아직 설정된 예산이 없어요.",
                quick_replies=[make_quick_reply("📊 이번달 지출 보기", "리포트"), make_quick_reply("❓ 도움말", "도움말")],
            )

        budget_data = []
        now = datetime.now()

        for budget, category in budget_cats:
            end_date = budget.end_date if budget.end_date else now

            if budget.start_date > now:
                continue

            expense_result = await db.execute(
                select(func.sum(Expense.amount))
                .where(Expense.household_id == household_id)
                .where(Expense.category_id == budget.category_id)
                .where(Expense.date >= budget.start_date)
                .where(Expense.date <= end_date)
            )
            spent_amount = expense_result.scalar() or Decimal(0)

            usage = (spent_amount / budget.amount * 100) if budget.amount > 0 else 0
            remaining = budget.amount - spent_amount

            budget_data.append(
                {
                    "category": category.name,
                    "budget": budget.amount,
                    "spent": spent_amount,
                    "remaining": remaining,
                    "usage": usage,
                }
            )

        message = format_budget_status_full(budget_data)
        return make_simple_text_response(
            message,
            quick_replies=[
                make_quick_reply("📊 이번달 지출 보기", "리포트"),
                make_quick_reply("❓ 도움말", "도움말"),
            ],
        )

    except Exception as e:
        logger.error(f"전체 예산 현황 생성 실패: {e}")
        return make_simple_text_response(format_server_error())
