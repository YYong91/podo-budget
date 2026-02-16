"""2026년 1월 수입 데이터 임포트 스크립트"""

import asyncio
from datetime import datetime

from sqlalchemy import text

from app.core.database import AsyncSessionLocal
from app.services.category_service import get_or_create_category

USER_ID = 6  # yyong

INCOMES = [
    # === 고정수입 ===
    ("2026-01-08", "급여", "실업급여", 1773000),
    ("2026-01-09", "급여", "육아휴직급여", 1600000),
    ("2026-01-23", "기타 수입", "아동수당", 100000),
    ("2026-01-23", "기타 수입", "부모급여", 500000),
    ("2026-01-30", "전세이자 지원", "전세이자지원", 400000),
    # === 부가수입 ===
    ("2026-01-09", "기타 수입", "덕소 형제들 일본여행 에어비앤비 선결제분 리턴", 738000),
    ("2026-01-28", "기타 수입", "문화센터 취소", 31100),
]


async def main():
    async with AsyncSessionLocal() as db:
        cat_cache = {}
        count = 0

        for date_str, category_name, description, amount in INCOMES:
            if category_name not in cat_cache:
                cat = await get_or_create_category(db, category_name, user_id=USER_ID)
                cat_cache[category_name] = cat.id

            await db.execute(
                text(
                    "INSERT INTO incomes (user_id, category_id, amount, description, date, created_at, updated_at) "
                    "VALUES (:uid, :cid, :amount, :desc, :date, NOW(), NOW())"
                ),
                {
                    "uid": USER_ID,
                    "cid": cat_cache[category_name],
                    "amount": amount,
                    "desc": description,
                    "date": datetime.fromisoformat(date_str),
                },
            )
            count += 1

        await db.commit()
        print(f"1월 수입 {count}건 삽입 완료")

        result = await db.execute(
            text("SELECT COUNT(*), SUM(amount) FROM incomes WHERE user_id = :uid"),
            {"uid": USER_ID},
        )
        row = result.fetchone()
        print(f"총 {row[0]}건, 합계 ₩{row[1]:,.0f}")


asyncio.run(main())
