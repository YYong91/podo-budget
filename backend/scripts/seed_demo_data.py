"""
시연용 테스트 데이터 시딩 스크립트
2026년 1~3월 현실적인 가계부 데이터를 생성한다.

사용법:
  cd backend && python -m scripts.seed_demo_data
"""

import asyncio
import random
from datetime import date

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import Base
from app.models import Category, Expense, Income, User
from app.models.household import Household
from app.models.household_member import HouseholdMember

engine = create_async_engine(settings.DATABASE_URL)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# ── 카테고리 매핑 (DB 조회 후 id를 채운다) ──
EXPENSE_CATEGORIES = [
    "식비",
    "교통비",
    "주거/통신",
    "생활용품",
    "의류/미용",
    "문화/여가",
    "의료/건강",
    "교육",
    "경조사",
    "기타",
]
INCOME_CATEGORIES = ["급여", "부수입", "투자수익", "기타"]

# ── 현실적인 지출 패턴 ──
EXPENSE_PATTERNS = [
    # (설명, 카테고리, 금액범위, 월 빈도)
    ("점심 식사", "식비", (7000, 12000), 20),
    ("편의점 간식", "식비", (1500, 5000), 10),
    ("저녁 외식", "식비", (15000, 35000), 6),
    ("카페 커피", "식비", (4500, 6500), 15),
    ("마트 장보기", "식비", (30000, 80000), 4),
    ("배달음식", "식비", (18000, 35000), 4),
    ("지하철/버스", "교통비", (1400, 1500), 22),
    ("택시", "교통비", (8000, 25000), 2),
    ("주유", "교통비", (60000, 80000), 1),
    ("월세", "주거/통신", (650000, 650000), 1),
    ("통신비", "주거/통신", (55000, 55000), 1),
    ("인터넷", "주거/통신", (25000, 25000), 1),
    ("전기요금", "주거/통신", (30000, 60000), 1),
    ("세탁세제/화장지", "생활용품", (10000, 25000), 2),
    ("다이소", "생활용품", (5000, 15000), 2),
    ("옷 구매", "의류/미용", (30000, 80000), 1),
    ("미용실", "의류/미용", (15000, 30000), 1),
    ("넷플릭스", "문화/여가", (17000, 17000), 1),
    ("영화 관람", "문화/여가", (14000, 28000), 1),
    ("책 구매", "문화/여가", (15000, 25000), 1),
    ("운동 회원권", "의료/건강", (70000, 70000), 1),
    ("약국", "의료/건강", (5000, 15000), 1),
    ("온라인 강의", "교육", (30000, 50000), 1),
    ("축의금/부의금", "경조사", (50000, 100000), 0.3),
]

# ── 현실적인 수입 패턴 ──
INCOME_PATTERNS = [
    ("월급", "급여", (3200000, 3200000), 1),
    ("프리랜서 수입", "부수입", (300000, 800000), 0.5),
    ("배당금", "투자수익", (50000, 150000), 0.3),
    ("캐시백/리워드", "기타", (5000, 20000), 1),
]


def random_dates_in_month(year: int, month: int, count: int) -> list[date]:
    """해당 월에서 count개의 랜덤 날짜를 생성한다."""
    next_month = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
    days_in_month = (next_month - date(year, month, 1)).days

    # 3월은 오늘(13일)까지만
    if year == 2026 and month == 3:
        days_in_month = min(days_in_month, 13)

    dates = []
    for _ in range(count):
        day = random.randint(1, days_in_month)
        dates.append(date(year, month, day))
    return dates


async def get_or_create_user(session: AsyncSession) -> User:
    """시딩용 유저를 가져오거나 생성한다."""
    result = await session.execute(select(User).limit(1))
    user = result.scalar_one_or_none()
    if user:
        return user

    user = User(
        username="demo",
        email="demo@podonest.com",
        hashed_password="not-a-real-hash",  # pragma: allowlist secret
        is_active=True,
    )
    session.add(user)
    await session.flush()
    return user


async def get_category_map(session: AsyncSession, user_id: int, household_id: int) -> dict[str, int]:
    """카테고리명 → id 매핑을 반환한다. 없으면 생성."""
    result = await session.execute(select(Category))
    existing = {c.name: c.id for c in result.scalars().all()}

    all_names = set(EXPENSE_CATEGORIES + INCOME_CATEGORIES)
    for name in all_names:
        if name not in existing:
            cat_type = "income" if name in INCOME_CATEGORIES else "expense"
            cat = Category(name=name, type=cat_type, user_id=user_id, household_id=household_id, sort_order=0)
            session.add(cat)
            await session.flush()
            existing[name] = cat.id

    return existing


async def seed():
    # 테이블 생성 (SQLite create_all)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        # 기존 시딩 데이터 정리
        await session.execute(text("DELETE FROM expenses"))
        await session.execute(text("DELETE FROM incomes"))
        await session.commit()

        user = await get_or_create_user(session)

        # 가구 생성
        result = await session.execute(select(Household).limit(1))
        household = result.scalar_one_or_none()
        if not household:
            household = Household(name="우리 가계부", description="시연용", currency="KRW")
            session.add(household)
            await session.flush()
            member = HouseholdMember(household_id=household.id, user_id=user.id, role="owner")
            session.add(member)
            await session.flush()

        cat_map = await get_category_map(session, user.id, household.id)

        expense_count = 0
        income_count = 0

        for year, month in [(2026, 1), (2026, 2), (2026, 3)]:
            # 지출 생성
            for desc, cat_name, (lo, hi), freq in EXPENSE_PATTERNS:
                # freq가 1 미만이면 확률적으로 생성
                count = int(freq) if freq >= 1 else (1 if random.random() < freq else 0)
                if count == 0:
                    continue

                dates = random_dates_in_month(year, month, count)
                for d in dates:
                    amount = random.randint(lo // 100, hi // 100) * 100  # 100원 단위
                    expense = Expense(
                        user_id=user.id,
                        household_id=household.id,
                        amount=amount,
                        description=desc,
                        category_id=cat_map.get(cat_name),
                        date=d,
                    )
                    session.add(expense)
                    expense_count += 1

            # 수입 생성
            for desc, cat_name, (lo, hi), freq in INCOME_PATTERNS:
                count = int(freq) if freq >= 1 else (1 if random.random() < freq else 0)
                if count == 0:
                    continue

                dates = random_dates_in_month(year, month, count)
                for d in dates:
                    amount = random.randint(lo // 1000, hi // 1000) * 1000  # 1000원 단위
                    # 월급은 25일 고정
                    if desc == "월급":
                        pay_day = min(25, 28 if month == 2 else 31)
                        if year == 2026 and month == 3:
                            pay_day = min(pay_day, 13)
                        d = date(year, month, pay_day)

                    income = Income(
                        user_id=user.id,
                        household_id=household.id,
                        amount=amount,
                        description=desc,
                        category_id=cat_map.get(cat_name),
                        date=d,
                    )
                    session.add(income)
                    income_count += 1

        await session.commit()
        print(f"시딩 완료: 지출 {expense_count}건, 수입 {income_count}건 (2026년 1~3월)")


if __name__ == "__main__":
    asyncio.run(seed())
