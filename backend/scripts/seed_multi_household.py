"""멀티 가계부 시딩 스크립트
기존 유저에게 추가 가계부(커플/여행모임)를 생성하고 현실적인 데이터를 넣는다.

사용법:
  cd backend && python -m scripts.seed_multi_household
"""

import asyncio
import random
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import Base
from app.models import Category, Expense, Income, User
from app.models.household import Household
from app.models.household_member import HouseholdMember

engine = create_async_engine(settings.DATABASE_URL)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# ── 커플 가계부 패턴 ──
COUPLE_EXPENSE_CATEGORIES = ["식비", "주거/통신", "문화/여가", "생활용품", "경조사", "기타"]
COUPLE_INCOME_CATEGORIES = ["급여", "부수입", "기타"]

COUPLE_EXPENSE_PATTERNS = [
    # (설명, 카테고리, 금액범위, 월 빈도)
    ("데이트 식사", "식비", (25000, 60000), 4),
    ("마트 장보기", "식비", (50000, 120000), 4),
    ("배달음식", "식비", (20000, 40000), 3),
    ("카페", "식비", (8000, 15000), 6),
    ("월세", "주거/통신", (800000, 800000), 1),
    ("관리비", "주거/통신", (100000, 150000), 1),
    ("전기/수도", "주거/통신", (40000, 80000), 1),
    ("인터넷/TV", "주거/통신", (35000, 35000), 1),
    ("영화/공연", "문화/여가", (20000, 50000), 2),
    ("넷플릭스", "문화/여가", (17000, 17000), 1),
    ("세제/생필품", "생활용품", (15000, 30000), 2),
    ("결혼식 축의금", "경조사", (50000, 100000), 0.5),
]

COUPLE_INCOME_PATTERNS = [
    ("남편 월급", "급여", (3800000, 3800000), 1),
    ("아내 월급", "급여", (3200000, 3200000), 1),
    ("중고거래", "부수입", (20000, 100000), 0.5),
    ("캐시백", "기타", (5000, 15000), 1),
]


# ── 여행 모임 패턴 ──
TRAVEL_EXPENSE_CATEGORIES = ["교통비", "식비", "문화/여가", "기타"]
TRAVEL_INCOME_CATEGORIES = ["기타"]

TRAVEL_EXPENSE_PATTERNS = [
    # 1월: 제주도 여행
    ("제주 항공권", "교통비", (80000, 120000), 0),
    ("렌터카", "교통비", (60000, 80000), 0),
    ("제주 맛집", "식비", (30000, 60000), 0),
    ("카페", "식비", (10000, 20000), 0),
    ("입장료/액티비티", "문화/여가", (20000, 50000), 0),
    ("숙소", "기타", (80000, 150000), 0),
    # 2월: 강릉 당일치기
    ("KTX 왕복", "교통비", (50000, 60000), 0),
    ("강릉 해물탕", "식비", (40000, 60000), 0),
    ("커피거리 카페", "식비", (15000, 25000), 0),
    # 3월: 일본 여행 준비
    ("항공권 예매", "교통비", (250000, 350000), 0),
    ("여행자보험", "기타", (15000, 25000), 0),
]

# 여행별 일정과 지출 인덱스
TRAVEL_TRIPS = [
    {
        "name": "제주도 2박3일",
        "year": 2026,
        "month": 1,
        "days": (16, 17, 18),
        "expense_indices": [0, 1, 2, 3, 4, 5],  # 항공+렌터카+맛집+카페+액티비티+숙소
        "per_day_indices": [2, 3],  # 맛집, 카페는 매일
    },
    {
        "name": "강릉 당일치기",
        "year": 2026,
        "month": 2,
        "days": (8,),
        "expense_indices": [6, 7, 8],  # KTX+해물탕+카페
        "per_day_indices": [],
    },
    {
        "name": "일본 여행 준비",
        "year": 2026,
        "month": 3,
        "days": (5,),
        "expense_indices": [9, 10],  # 항공권+보험
        "per_day_indices": [],
    },
]


def random_dates_in_month(year: int, month: int, count: int) -> list[date]:
    """해당 월에서 count개의 랜덤 날짜를 생성한다."""
    next_month = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
    days_in_month = (next_month - date(year, month, 1)).days

    if year == 2026 and month == 3:
        days_in_month = min(days_in_month, 15)

    dates = []
    for _ in range(count):
        day = random.randint(1, days_in_month)
        dates.append(date(year, month, day))
    return dates


async def get_or_create_categories(session: AsyncSession, names: list[str], cat_type: str, user_id: int, household_id: int) -> dict[str, int]:
    """카테고리명 → id 매핑. 해당 가구용 카테고리가 없으면 생성."""
    # 기존 카테고리 조회 (가구별)
    result = await session.execute(select(Category).where(Category.household_id == household_id))
    existing = {c.name: c.id for c in result.scalars().all()}

    for name in names:
        if name not in existing:
            actual_type = "income" if cat_type == "income" else "expense"
            cat = Category(name=name, type=actual_type, user_id=user_id, household_id=household_id, sort_order=0)
            session.add(cat)
            await session.flush()
            existing[name] = cat.id

    return existing


async def create_household_if_not_exists(session: AsyncSession, name: str, description: str, user_id: int) -> Household | None:
    """이름으로 가구를 찾고, 없으면 생성. 이미 있으면 None 반환."""
    result = await session.execute(select(Household).where(Household.name == name))
    existing = result.scalar_one_or_none()
    if existing:
        print(f"  '{name}' 이미 존재 — 건너뜀")
        return None

    household = Household(name=name, description=description, currency="KRW")
    session.add(household)
    await session.flush()

    member = HouseholdMember(household_id=household.id, user_id=user_id, role="owner")
    session.add(member)
    await session.flush()

    return household


async def seed_couple_household(session: AsyncSession, user: User) -> int:
    """커플 가계부 생성 + 데이터 시딩"""
    household = await create_household_if_not_exists(session, "우리 둘 살림", "커플 공동 가계부 💑", user.id)
    if not household:
        return 0

    # 카테고리 생성
    all_cat_names = list(set(COUPLE_EXPENSE_CATEGORIES + COUPLE_INCOME_CATEGORIES))
    expense_cats = await get_or_create_categories(
        session,
        [n for n in all_cat_names if n not in COUPLE_INCOME_CATEGORIES],
        "expense",
        user.id,
        household.id,
    )
    income_cats = await get_or_create_categories(
        session,
        [n for n in all_cat_names if n in COUPLE_INCOME_CATEGORIES],
        "income",
        user.id,
        household.id,
    )
    cat_map = {**expense_cats, **income_cats}

    total = 0

    for year, month in [(2026, 1), (2026, 2), (2026, 3)]:
        # 지출
        for desc, cat_name, (lo, hi), freq in COUPLE_EXPENSE_PATTERNS:
            count = int(freq) if freq >= 1 else (1 if random.random() < freq else 0)
            if count == 0:
                continue
            dates = random_dates_in_month(year, month, count)
            for d in dates:
                amount = random.randint(lo // 100, hi // 100) * 100
                session.add(
                    Expense(
                        user_id=user.id,
                        household_id=household.id,
                        amount=amount,
                        description=desc,
                        category_id=cat_map.get(cat_name),
                        date=d,
                    )
                )
                total += 1

        # 수입
        for desc, cat_name, (lo, hi), freq in COUPLE_INCOME_PATTERNS:
            count = int(freq) if freq >= 1 else (1 if random.random() < freq else 0)
            if count == 0:
                continue
            dates = random_dates_in_month(year, month, count)
            for d in dates:
                amount = random.randint(lo // 1000, hi // 1000) * 1000
                # 월급은 25일 고정
                if "월급" in desc:
                    pay_day = min(25, 28 if month == 2 else 31)
                    if year == 2026 and month == 3:
                        pay_day = min(pay_day, 15)
                    d = date(year, month, pay_day)
                session.add(
                    Income(
                        user_id=user.id,
                        household_id=household.id,
                        amount=amount,
                        description=desc,
                        category_id=cat_map.get(cat_name),
                        date=d,
                    )
                )
                total += 1

    print(f"  '우리 둘 살림' 생성 완료: {total}건")
    return total


async def seed_travel_household(session: AsyncSession, user: User) -> int:
    """여행 모임 가계부 생성 + 데이터 시딩"""
    household = await create_household_if_not_exists(session, "여행 모임 통장", "친구들이랑 여행 경비 관리 ✈️", user.id)
    if not household:
        return 0

    # 카테고리 생성
    all_cat_names = list(set(TRAVEL_EXPENSE_CATEGORIES + TRAVEL_INCOME_CATEGORIES))
    expense_cats = await get_or_create_categories(
        session,
        [n for n in all_cat_names if n not in TRAVEL_INCOME_CATEGORIES],
        "expense",
        user.id,
        household.id,
    )
    income_cats = await get_or_create_categories(
        session,
        [n for n in all_cat_names if n in TRAVEL_INCOME_CATEGORIES],
        "income",
        user.id,
        household.id,
    )
    cat_map = {**expense_cats, **income_cats}

    total = 0

    # 여행별 지출 생성
    for trip in TRAVEL_TRIPS:
        year, month = trip["year"], trip["month"]
        days = trip["days"]

        for idx in trip["expense_indices"]:
            desc, cat_name, (lo, hi), _ = TRAVEL_EXPENSE_PATTERNS[idx]

            if idx in trip["per_day_indices"]:
                # 매일 발생하는 지출 (맛집, 카페 등)
                for day in days:
                    amount = random.randint(lo // 100, hi // 100) * 100
                    session.add(
                        Expense(
                            user_id=user.id,
                            household_id=household.id,
                            amount=amount,
                            description=f"{desc} ({trip['name']})",
                            category_id=cat_map.get(cat_name),
                            date=date(year, month, day),
                        )
                    )
                    total += 1
            else:
                # 1회성 지출 (항공권, 렌터카, 숙소 등)
                amount = random.randint(lo // 100, hi // 100) * 100
                d = date(year, month, days[0])
                session.add(
                    Expense(
                        user_id=user.id,
                        household_id=household.id,
                        amount=amount,
                        description=f"{desc} ({trip['name']})",
                        category_id=cat_map.get(cat_name),
                        date=d,
                    )
                )
                total += 1

    # 월별 회비 수입 (4명 × 50,000원)
    members = ["민수", "지영", "현우", "소연"]
    for year, month in [(2026, 1), (2026, 2), (2026, 3)]:
        for name in members:
            d = random_dates_in_month(year, month, 1)[0]
            session.add(
                Income(
                    user_id=user.id,
                    household_id=household.id,
                    amount=50000,
                    description=f"{name} 회비",
                    category_id=cat_map.get("기타"),
                    date=d,
                )
            )
            total += 1

    print(f"  '여행 모임 통장' 생성 완료: {total}건")
    return total


async def seed():
    # 테이블 생성
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        # 유저 가져오기 (이메일 인자 또는 첫 번째 유저)
        import sys

        email = sys.argv[1] if len(sys.argv) > 1 else None
        if email:
            result = await session.execute(select(User).where(User.email == email))
        else:
            result = await session.execute(select(User).limit(1))
        user = result.scalar_one_or_none()
        if not user:
            print("유저가 없습니다. seed_demo_data.py를 먼저 실행하세요.")
            return

        print(f"유저: {user.username} (id={user.id})")

        # 기존 가계부 확인
        result = await session.execute(select(Household).join(HouseholdMember).where(HouseholdMember.user_id == user.id, HouseholdMember.left_at.is_(None)))
        existing = result.scalars().all()
        print(f"기존 가계부: {[h.name for h in existing]}")

        # 추가 가계부 생성
        total = 0
        total += await seed_couple_household(session, user)
        total += await seed_travel_household(session, user)

        await session.commit()
        print(f"\n시딩 완료: 총 {total}건 추가")

        # 최종 확인
        result = await session.execute(select(Household).join(HouseholdMember).where(HouseholdMember.user_id == user.id, HouseholdMember.left_at.is_(None)))
        all_households = result.scalars().all()
        print(f"전체 가계부: {[h.name for h in all_households]}")


if __name__ == "__main__":
    asyncio.run(seed())
