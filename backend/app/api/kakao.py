"""카카오톡 채널 봇 Webhook 라우트

카카오 i 오픈빌더 스킬 서버 형태로 구현됩니다.
사용자가 자연어로 지출을 입력하면 LLM으로 파싱하여 DB에 저장합니다.
Telegram 봇과 달리 응답을 JSON으로 직접 반환합니다.

주의: 카카오 오픈빌더는 5초 내 응답이 필수입니다.
LLM 호출을 4.5초로 제한하고 타임아웃 시 안내 메시지를 반환합니다.
"""

import asyncio
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import and_, extract, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_user_active_household_id_or_none
from app.core.config import settings
from app.core.database import get_db
from app.models.budget import Budget
from app.models.category import Category
from app.models.expense import Expense
from app.services.bot_messages import (
    format_budget_status,
    format_expense_saved,
    format_help_message,
    format_kakao_link_usage_message,
    format_parse_error,
    format_report_message,
    format_server_error,
    format_timeout_message,
)
from app.services.bot_user_service import get_or_create_bot_user, link_kakao_account_by_code
from app.services.category_hint_service import get_category_hints, get_user_categories
from app.services.category_mapping_service import get_category_mappings_for_prompt, get_mapped_category
from app.services.category_service import get_or_create_category
from app.services.expense_context_detector import resolve_household_id
from app.services.llm_service import get_llm_provider

logger = logging.getLogger(__name__)

router = APIRouter()

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
}


def normalize_command(utterance: str) -> str:
    """한글 명령어를 슬래시 명령어로 정규화

    "변경 외식비" → "/change 외식비"
    "리포트" → "/report"
    "취소해줘" → 그대로 (정확히 일치하지 않으므로 LLM 파싱으로 넘어감)
    """
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


def make_simple_text_response(text: str, quick_replies: list[dict] | None = None) -> dict:
    """카카오 i 오픈빌더 simpleText 응답 생성

    Args:
        text: 응답 메시지 본문
        quick_replies: 빠른 답장 버튼 리스트 (선택사항)

    Returns:
        카카오 응답 형식 (version 2.0)
    """
    response = {"version": "2.0", "template": {"outputs": [{"simpleText": {"text": text}}]}}

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


@router.post("/webhook")
async def kakao_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """카카오톡 채널 봇 Webhook 엔드포인트

    카카오 i 오픈빌더에서 사용자 메시지를 이 URL로 POST합니다.
    - 명령어 (/help, /report, /budget): 해당 정보 반환
    - 자연어 입력: LLM으로 파싱 → DB 저장 → 결과 응답

    응답은 Telegram과 달리 JSON을 직접 반환합니다 (비동기 send 없음).

    보안: KAKAO_BOT_API_KEY 설정 시 Authorization 헤더 검증
    """
    # Webhook API 키 검증 (설정된 경우에만)
    if settings.KAKAO_BOT_API_KEY:
        auth_header = request.headers.get("Authorization", "")
        if auth_header != settings.KAKAO_BOT_API_KEY:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="유효하지 않은 API 키")

    try:
        data = await request.json()

        # userRequest에서 utterance와 user.id 추출
        user_request = data.get("userRequest", {})
        utterance = user_request.get("utterance", "").strip()
        user_info = data.get("user", {})
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

        # /help 명령어 처리
        if utterance.startswith("/help"):
            return make_simple_text_response(
                format_help_message(platform="kakao"),
                quick_replies=[
                    make_quick_reply("📊 이번달 지출 보기", "리포트"),
                    make_quick_reply("💰 예산 현황", "예산"),
                ],
            )

        # /report 명령어 처리 (이번 달 지출 요약)
        if utterance.startswith("/report"):
            return await handle_report_command(db, user_id=bot_user.id)

        # /budget 명령어 처리 (예산 현황)
        if utterance.startswith("/budget"):
            return await handle_budget_command(db, user_id=bot_user.id)

        # /link 명령어 처리 (웹 계정 연동)
        if utterance.startswith("/link"):
            parts = utterance.split()
            if len(parts) != 2:
                return make_simple_text_response(format_kakao_link_usage_message())
            code = parts[1].upper()
            success, message = await link_kakao_account_by_code(db, code, str(kakao_user_id))
            return make_simple_text_response(message)

        # /undo 명령어 처리 (마지막 지출 삭제)
        if utterance.startswith("/undo"):
            return await handle_undo_command(db, bot_user)

        # /change 명령어 처리 (마지막 지출 카테고리 변경)
        if utterance.startswith("/change"):
            return await handle_change_command(db, bot_user, utterance, active_household_id)

        # 자연어 지출 입력 → LLM 파싱 (4.5초 타임아웃)
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
                # 파싱 실패
                if "error" in parsed:
                    return make_simple_text_response(format_parse_error(utterance), quick_replies=[make_quick_reply("❓ 도움말", "도움말")])

                # 카테고리 매핑 확인 → 기존 카테고리 → 새로 생성
                category_name = parsed.get("category", "기타")
                mapped = await get_mapped_category(db, category_name, user_id=bot_user.id, household_id=household_id)
                if mapped:
                    category = mapped
                else:
                    category = await get_or_create_category(db, category_name, user_id=bot_user.id, household_id=household_id)

                # Expense 생성 (user_id + household_id 연결)
                expense_date = datetime.fromisoformat(parsed.get("date", datetime.now().isoformat()))
                expense = Expense(
                    user_id=bot_user.id,
                    amount=parsed["amount"],
                    description=parsed.get("description", utterance),
                    category_id=category.id,
                    raw_input=utterance,
                    date=expense_date,
                    household_id=household_id,
                )
                db.add(expense)
                await db.commit()
                await db.refresh(expense)

                # 성공 응답 (quickReplies 포함)
                return make_simple_text_response(
                    format_expense_saved(
                        amount=parsed["amount"],
                        category=category.name,
                        description=parsed.get("description", utterance),
                        date=expense_date.strftime("%Y-%m-%d"),
                    ),
                    quick_replies=[
                        make_quick_reply("↩️ 방금 거 취소", "취소"),
                        make_quick_reply("🔄 카테고리 변경", "변경"),
                        make_quick_reply("📊 이번달 지출 보기", "리포트"),
                    ],
                )

            # 여러 지출 (list) 처리
            elif isinstance(parsed, list):
                created_expenses = []

                for item in parsed:
                    # 카테고리 매핑 확인 → 기존 카테고리 → 새로 생성
                    category_name = item.get("category", "기타")
                    mapped = await get_mapped_category(db, category_name, user_id=bot_user.id, household_id=household_id)
                    if mapped:
                        category = mapped
                    else:
                        category = await get_or_create_category(db, category_name, user_id=bot_user.id, household_id=household_id)

                    # Expense 생성 (user_id + household_id 연결)
                    expense_date = datetime.fromisoformat(item.get("date", datetime.now().isoformat()))
                    expense = Expense(
                        user_id=bot_user.id,
                        amount=item["amount"],
                        description=item.get("description", ""),
                        category_id=category.id,
                        raw_input=utterance,
                        date=expense_date,
                        household_id=household_id,
                    )
                    db.add(expense)
                    created_expenses.append(expense)

                await db.commit()

                # 성공 메시지 구성
                total_amount = sum(item["amount"] for item in parsed)
                count = len(parsed)
                message_lines = [f"✅ {count}건의 지출이 기록되었어요!\n"]

                for idx, (expense, item) in enumerate(zip(created_expenses, parsed, strict=False), 1):
                    await db.refresh(expense)
                    message_lines.append(f"{idx}. 💰 {item['amount']:,.0f}원 - 📂 {item.get('category', '기타')} - {item.get('description', '')}")

                message_lines.append(f"\n💰 총 {total_amount:,.0f}원")

                return make_simple_text_response(
                    "\n".join(message_lines),
                    quick_replies=[
                        make_quick_reply("↩️ 방금 거 취소", "취소"),
                        make_quick_reply("🔄 카테고리 변경", "변경"),
                        make_quick_reply("📊 이번달 지출 보기", "리포트"),
                    ],
                )

        except Exception as e:
            logger.error(f"카카오 webhook LLM 파싱 실패: {e}")
            return make_simple_text_response(format_server_error(), quick_replies=[make_quick_reply("❓ 도움말", "도움말")])

    except Exception as e:
        logger.error(f"카카오 webhook 처리 실패: {e}")
        return make_simple_text_response(format_server_error())


async def handle_undo_command(db: AsyncSession, bot_user) -> dict:
    """마지막 지출 삭제

    사용자의 가장 최근 지출을 삭제합니다.

    Args:
        db: 데이터베이스 세션
        bot_user: 봇 사용자 객체

    Returns:
        카카오 응답 형식 (version 2.0)
    """
    result = await db.execute(select(Expense).where(Expense.user_id == bot_user.id).order_by(Expense.id.desc()).limit(1))
    expense = result.scalar_one_or_none()

    if not expense:
        return make_simple_text_response("삭제할 지출이 없어요.")

    amount = expense.amount
    description = expense.description
    await db.delete(expense)
    await db.commit()

    return make_simple_text_response(
        f"✅ 마지막 지출이 삭제되었어요.\n\n🗑️ {amount:,.0f}원 - {description}",
        quick_replies=[
            make_quick_reply("📊 이번달 지출 보기", "리포트"),
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


async def handle_change_command(db: AsyncSession, bot_user, utterance: str, active_household_id: int | None) -> dict:
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
        quick_replies = [make_quick_reply(cat.name, f"변경 {cat.name}") for cat in categories if cat.name != current_cat_name][
            :10
        ]  # quickReply 최대 10개 제한

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


async def handle_report_command(db: AsyncSession, user_id: int) -> dict:
    """이번 달 지출 요약 리포트 생성

    카테고리별 지출 합계와 건수를 집계하여 카카오 응답 형식으로 반환합니다.
    사용자별로 데이터를 격리하여 조회합니다.

    Args:
        db: 데이터베이스 세션
        user_id: 조회할 사용자 ID

    Returns:
        카카오 응답 형식 (version 2.0)
    """
    try:
        # 이번 달 1일부터 현재까지 지출 집계 (해당 사용자만)
        now = datetime.now()
        result = await db.execute(
            select(
                Category.name,
                func.sum(Expense.amount).label("total"),
                func.count(Expense.id).label("count"),
            )
            .join(Category, Expense.category_id == Category.id)
            .where(Expense.user_id == user_id)
            .where(extract("year", Expense.date) == now.year)
            .where(extract("month", Expense.date) == now.month)
            .group_by(Category.name)
            .order_by(func.sum(Expense.amount).desc())
        )

        rows = result.all()
        report_data = [{"category": row.name, "total": row.total, "count": row.count} for row in rows]

        message = format_report_message(report_data)
        return make_simple_text_response(message, quick_replies=[make_quick_reply("💰 예산 현황", "예산"), make_quick_reply("❓ 도움말", "도움말")])

    except Exception as e:
        logger.error(f"리포트 생성 실패: {e}")
        return make_simple_text_response(format_server_error())


async def handle_budget_command(db: AsyncSession, user_id: int) -> dict:
    """예산 현황 생성

    설정된 예산과 현재 지출을 비교하여 카카오 응답 형식으로 반환합니다.
    사용자별로 데이터를 격리하여 조회합니다.

    Args:
        db: 데이터베이스 세션
        user_id: 조회할 사용자 ID

    Returns:
        카카오 응답 형식 (version 2.0)
    """
    try:
        # 해당 사용자의 활성 예산 조회
        budget_result = await db.execute(select(Budget).where(Budget.user_id == user_id))
        budgets = budget_result.scalars().all()

        if not budgets:
            return make_simple_text_response(
                "💵 예산 현황\n\n아직 설정된 예산이 없어요.",
                quick_replies=[make_quick_reply("📊 이번달 지출 보기", "리포트"), make_quick_reply("❓ 도움말", "도움말")],
            )

        budget_data = []
        now = datetime.now()

        for budget in budgets:
            # 예산 기간 내의 지출 집계
            end_date = budget.end_date if budget.end_date else now

            if budget.start_date > now:
                continue

            # 카테고리 정보
            category_result = await db.execute(select(Category).where(Category.id == budget.category_id))
            category = category_result.scalar_one_or_none()
            if not category:
                continue

            # 지출 합계 (해당 사용자만)
            expense_result = await db.execute(
                select(func.sum(Expense.amount))
                .where(Expense.user_id == user_id)
                .where(Expense.category_id == budget.category_id)
                .where(Expense.date >= budget.start_date)
                .where(Expense.date <= end_date)
            )
            spent_amount = expense_result.scalar() or 0.0

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
        return make_simple_text_response(message, quick_replies=[make_quick_reply("📊 이번달 지출 보기", "리포트"), make_quick_reply("❓ 도움말", "도움말")])

    except Exception as e:
        logger.error(f"예산 현황 생성 실패: {e}")
        return make_simple_text_response(format_server_error())
