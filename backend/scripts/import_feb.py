"""2026년 2월 실제 데이터 임포트 스크립트 (지출 + 수입)"""

import asyncio
from datetime import datetime

from sqlalchemy import text

from app.core.database import AsyncSessionLocal
from app.services.category_service import get_or_create_category

USER_ID = 6  # yyong

EXPENSES = [
    # === 저축성지출 ===
    ("2026-02-01", "용돈", "채이 용돈", 100000),
    ("2026-02-05", "저축성지출", "메트라이프", 300000),
    ("2026-02-05", "저축성지출", "퇴직금 ISA", 15000000),
    ("2026-02-10", "저축성지출", "승용 ISA", 600000),
    ("2026-02-10", "저축성지출", "승용 연금저축", 500000),
    ("2026-02-10", "저축성지출", "승용 주택청약", 100000),
    ("2026-02-10", "저축성지출", "승용 퇴직연금", 250000),
    ("2026-02-10", "저축성지출", "석화 ISA", 600000),
    ("2026-02-10", "저축성지출", "석화계좌 퇴직금 ISA", 15000000),
    # === 고정지출 ===
    ("2026-02-01", "용돈", "승용용돈", 300000),
    ("2026-02-01", "용돈", "석화용돈", 300000),
    ("2026-02-03", "교통비", "티머니", 50000),
    ("2026-02-04", "문화생활비", "애플원", 20900),
    ("2026-02-05", "의료비", "승용 보험", 152650),
    ("2026-02-07", "주거비", "전세이자", 394325),
    ("2026-02-08", "통신비", "U+", 22000),
    ("2026-02-10", "교통비", "운전자보험", 10000),
    ("2026-02-10", "의료비", "석화 보장성보험", 150000),
    ("2026-02-10", "통신비", "석화 휴대폰", 60000),
    ("2026-02-10", "의료비", "채이 보험", 61120),
    # === 변동지출 ===
    ("2026-02-01", "생필품비", "채이 반명함사진", 20000),
    ("2026-02-01", "생필품비", "오아시스", 900),
    ("2026-02-02", "생필품비", "채이 반찬", 31350),
    ("2026-02-02", "생필품비", "오아시스", 27313),
    ("2026-02-03", "생필품비", "반찬 슈퍼키친", 17700),
    ("2026-02-03", "생필품비", "쿠팡", 63530),
    ("2026-02-03", "외식비", "세븐일레븐", 2200),
    ("2026-02-04", "생필품비", "기저귀", 33010),
    ("2026-02-05", "생필품비", "쿠팡", 17900),
    ("2026-02-05", "생필품비", "쿠팡", 3800),
    ("2026-02-05", "생필품비", "쿠팡", 17500),
    ("2026-02-05", "생필품비", "온브릭스", 82132),
    ("2026-02-06", "생필품비", "쿠팡이츠 반찬", 24900),
    ("2026-02-06", "경조사회비", "시온 축의금", 100000),
    ("2026-02-06", "생필품비", "수향미", 44500),
    ("2026-02-06", "생필품비", "운림가", 19500),
    ("2026-02-06", "의료비", "튼튼소아과", 2900),
    ("2026-02-06", "의료비", "강남열린약국", 1800),
    ("2026-02-07", "경조사회비", "진호 축의금", 100000),
    ("2026-02-07", "생필품비", "쿠팡", 45920),
    ("2026-02-07", "외식비", "옛날통닭영통점", 9000),
    ("2026-02-07", "생필품비", "온브릭스 천혜양", 36720),
    ("2026-02-08", "생필품비", "채이 반찬", 19300),
    ("2026-02-09", "생필품비", "쿠팡", 27790),
    ("2026-02-09", "생필품비", "공청기 필터", 19000),
    ("2026-02-10", "외식비", "청담김밥", 18500),
]

INCOMES = [
    # === 고정수입 ===
    ("2026-02-02", "급여", "큐빅 급여", 3417437),
    ("2026-02-04", "급여", "실업 급여", 1773000),
    # === 부가수입 ===
    ("2026-02-04", "기타 수입", "여행적금 리턴", 300000),
    ("2026-02-05", "급여", "저스트큐 1월 급여", 3959620),
    ("2026-02-05", "급여", "저스트큐 퇴직급여", 23904845),
]


async def main():
    async with AsyncSessionLocal() as db:
        cat_cache = {}

        # 지출 삽입
        exp_count = 0
        for date_str, category_name, description, amount in EXPENSES:
            if category_name not in cat_cache:
                cat = await get_or_create_category(db, category_name, user_id=USER_ID)
                cat_cache[category_name] = cat.id

            await db.execute(
                text(
                    "INSERT INTO expenses (user_id, category_id, amount, description, date, created_at, updated_at) "
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
            exp_count += 1

        # 수입 삽입
        inc_count = 0
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
            inc_count += 1

        await db.commit()
        print(f"2월 지출 {exp_count}건, 수입 {inc_count}건 삽입 완료")

        # 검증
        result = await db.execute(
            text("SELECT COUNT(*), SUM(amount) FROM expenses WHERE user_id = :uid AND date >= '2026-02-01' AND date < '2026-03-01'"),
            {"uid": USER_ID},
        )
        row = result.fetchone()
        print(f"2월 지출: {row[0]}건, ₩{row[1]:,.0f}")

        result = await db.execute(
            text("SELECT COUNT(*), SUM(amount) FROM incomes WHERE user_id = :uid AND date >= '2026-02-01' AND date < '2026-03-01'"),
            {"uid": USER_ID},
        )
        row = result.fetchone()
        print(f"2월 수입: {row[0]}건, ₩{row[1]:,.0f}")


asyncio.run(main())
