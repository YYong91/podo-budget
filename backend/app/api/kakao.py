"""카카오톡 채널 봇 Webhook 라우트

카카오 i 오픈빌더 스킬 서버 형태로 구현됩니다.
사용자가 자연어로 지출을 입력하면 LLM으로 파싱하여 DB에 저장합니다.
Telegram 봇과 달리 응답을 JSON으로 직접 반환합니다.
"""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.budget import Budget
from app.models.category import Category
from app.models.expense import Expense
from app.services.bot_messages import (
    format_budget_status,
    format_expense_saved,
    format_help_message,
    format_parse_error,
    format_report_message,
    format_server_error,
)
from app.services.bot_user_service import get_or_create_bot_user
from app.services.category_service import get_or_create_category
from app.services.llm_service import get_llm_provider

logger = logging.getLogger(__name__)

router = APIRouter()


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
    """
    try:
        data = await request.json()

        # userRequest에서 utterance와 user.id 추출
        user_request = data.get("userRequest", {})
        utterance = user_request.get("utterance", "").strip()
        user_info = data.get("user", {})
        kakao_user_id = user_info.get("id", "unknown")

        # 봇 사용자 생성 또는 조회 (데이터 격리를 위함)
        bot_user = await get_or_create_bot_user(db, platform="kakao", platform_user_id=kakao_user_id)

        # utterance가 없으면 에러 응답
        if not utterance:
            return make_simple_text_response("❓ 메시지를 입력해주세요.\n\n" '예: "점심에 김치찌개 8000원"')

        # /help 명령어 처리
        if utterance.startswith("/help"):
            return make_simple_text_response(
                format_help_message(), quick_replies=[make_quick_reply("📊 이번달 지출 보기", "/report"), make_quick_reply("💰 예산 현황", "/budget")]
            )

        # /report 명령어 처리 (이번 달 지출 요약)
        if utterance.startswith("/report"):
            return await handle_report_command(db, user_id=bot_user.id)

        # /budget 명령어 처리 (예산 현황)
        if utterance.startswith("/budget"):
            return await handle_budget_command(db, user_id=bot_user.id)

        # 자연어 지출 입력 → LLM 파싱
        try:
            llm = get_llm_provider("parse")
            parsed = await llm.parse_expense(utterance)

            # 단일 지출 (dict) 처리
            if isinstance(parsed, dict):
                # 파싱 실패
                if "error" in parsed:
                    return make_simple_text_response(format_parse_error(utterance), quick_replies=[make_quick_reply("❓ 도움말", "/help")])

                # 카테고리 매칭/생성 (사용자별 카테고리 관리)
                category_name = parsed.get("category", "기타")
                category = await get_or_create_category(db, category_name, user_id=bot_user.id)

                # Expense 생성 (user_id 연결로 데이터 격리)
                expense_date = datetime.fromisoformat(parsed.get("date", datetime.now().isoformat()))
                expense = Expense(
                    user_id=bot_user.id,
                    amount=parsed["amount"],
                    description=parsed.get("description", utterance),
                    category_id=category.id,
                    raw_input=utterance,
                    date=expense_date,
                )
                db.add(expense)
                await db.commit()
                await db.refresh(expense)

                # 성공 응답 (quickReplies 포함)
                return make_simple_text_response(
                    format_expense_saved(
                        amount=parsed["amount"],
                        category=category_name,
                        description=parsed.get("description", utterance),
                        date=expense_date.strftime("%Y-%m-%d"),
                    ),
                    quick_replies=[make_quick_reply("📊 이번달 지출 보기", "/report"), make_quick_reply("💰 예산 현황", "/budget")],
                )

            # 여러 지출 (list) 처리
            elif isinstance(parsed, list):
                created_expenses = []

                for item in parsed:
                    # 카테고리 매칭/생성 (사용자별 카테고리 관리)
                    category_name = item.get("category", "기타")
                    category = await get_or_create_category(db, category_name, user_id=bot_user.id)

                    # Expense 생성 (user_id 연결로 데이터 격리)
                    expense_date = datetime.fromisoformat(item.get("date", datetime.now().isoformat()))
                    expense = Expense(
                        user_id=bot_user.id,
                        amount=item["amount"],
                        description=item.get("description", ""),
                        category_id=category.id,
                        raw_input=utterance,
                        date=expense_date,
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
                    message_lines.append(f"{idx}. 💰 {item['amount']:,.0f}원 - " f"📂 {item.get('category', '기타')} - {item.get('description', '')}")

                message_lines.append(f"\n💰 총 {total_amount:,.0f}원")

                return make_simple_text_response(
                    "\n".join(message_lines), quick_replies=[make_quick_reply("📊 이번달 지출 보기", "/report"), make_quick_reply("💰 예산 현황", "/budget")]
                )

        except Exception as e:
            logger.error(f"카카오 webhook LLM 파싱 실패: {e}")
            return make_simple_text_response(format_server_error(), quick_replies=[make_quick_reply("❓ 도움말", "/help")])

    except Exception as e:
        logger.error(f"카카오 webhook 처리 실패: {e}")
        return make_simple_text_response(format_server_error())


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
        return make_simple_text_response(message, quick_replies=[make_quick_reply("💰 예산 현황", "/budget"), make_quick_reply("❓ 도움말", "/help")])

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
                quick_replies=[make_quick_reply("📊 이번달 지출 보기", "/report"), make_quick_reply("❓ 도움말", "/help")],
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
        return make_simple_text_response(message, quick_replies=[make_quick_reply("📊 이번달 지출 보기", "/report"), make_quick_reply("❓ 도움말", "/help")])

    except Exception as e:
        logger.error(f"예산 현황 생성 실패: {e}")
        return make_simple_text_response(format_server_error())
