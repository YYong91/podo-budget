"""종목 검색 API"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.stock import Stock
from app.models.user import User
from app.schemas.stock import StockResponse

router = APIRouter()


@router.get("/search", response_model=list[StockResponse])
async def search_stocks(
    q: str = Query(..., min_length=1, description="종목명 또는 티커"),
    _current_user: User = Depends(get_current_user),  # 인증 필수 — 비인증 프록시 차단
    db: AsyncSession = Depends(get_db),
) -> object:
    """종목 검색 — 한글명 또는 티커 부분 매칭, 최대 20개"""
    import re

    escaped_q = re.sub(r"([%_\\])", r"\\\1", q)
    result = await db.execute(
        select(Stock)
        .where(
            Stock.is_active == True,  # noqa: E712
            or_(Stock.name.ilike(f"%{escaped_q}%"), Stock.ticker.ilike(f"%{escaped_q}%")),
        )
        .limit(20)
    )
    return result.scalars().all()
