"""개발 환경 자산 데이터 시딩 스크립트"""

import asyncio
import json
import random
from datetime import date, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

ASSETS = [
    # (name, type, is_liability, ticker, quantity, avg_buy_price, manual_value, interest_rate, maturity_date, repayment_type, monthly_payment)
    # 예금/적금
    ("토스뱅크 자유적금", "deposit", False, None, None, None, 5200000, 3.5, None, None, None),
    ("카카오뱅크 비상금", "deposit", False, None, None, None, 3800000, 2.0, None, None, None),
    ("신한은행 정기예금", "deposit", False, None, None, None, 10000000, 3.8, "2026-09-15", None, None),
    # 한국 주식
    ("삼성전자", "stock_kr", False, "005930", 15, 72000, None, None, None, None, None),
    ("NAVER", "stock_kr", False, "035420", 5, 195000, None, None, None, None, None),
    ("카카오", "stock_kr", False, "035720", 10, 48500, None, None, None, None, None),
    # 미국 주식
    ("AAPL", "stock_us", False, "AAPL", 3, 178.50, None, None, None, None, None),
    ("TSLA", "stock_us", False, "TSLA", 2, 245.00, None, None, None, None, None),
    # 코인
    ("비트코인", "crypto", False, "BTC", 0.05, 65000000, None, None, None, None, None),
    ("이더리움", "crypto", False, "ETH", 0.8, 3200000, None, None, None, None, None),
    # 기타 자산
    ("전세 보증금", "real_estate", False, None, None, None, 150000000, None, None, None, None),
    # 부채
    ("학자금 대출", "loan", True, None, None, None, 8000000, 2.5, "2028-06-30", "equal_principal_interest", 350000),
    ("카드론", "loan", True, None, None, None, 2000000, 12.0, "2026-12-31", "equal_principal_interest", 200000),
]


async def seed():
    async with async_session() as s:
        # 기존 자산 데이터 정리 (테이블 없으면 무시)
        import contextlib

        for table in ("asset_goals", "asset_snapshots", "assets"):
            with contextlib.suppress(Exception):
                await s.execute(text(f"DELETE FROM {table}"))

        # 자산/부채 생성
        for name, atype, is_liability, ticker, qty, avg_price, manual_val, rate, maturity, repay_type, monthly_pay in ASSETS:
            await s.execute(
                text(
                    "INSERT INTO assets (household_id, created_by, name, type, is_liability, "
                    "ticker, quantity, avg_buy_price, manual_value, interest_rate, maturity_date, "
                    "repayment_type, monthly_payment, created_at, updated_at) "
                    "VALUES (:hid, :uid, :name, :type, :is_liability, :ticker, :qty, :avg_price, "
                    ":manual_val, :rate, :maturity, :repay_type, :monthly_pay, "
                    "datetime('now'), datetime('now'))"
                ),
                {
                    "hid": 1,
                    "uid": 1,
                    "name": name,
                    "type": atype,
                    "is_liability": is_liability,
                    "ticker": ticker,
                    "qty": qty,
                    "avg_price": avg_price,
                    "manual_val": manual_val,
                    "rate": rate,
                    "maturity": maturity,
                    "repay_type": repay_type,
                    "monthly_pay": monthly_pay,
                },
            )

        # 순자산 스냅샷 (최근 2개월, 매일)
        base_assets = 179_000_000  # 약 1.79억
        base_liabilities = 10_000_000  # 1천만

        for i in range(60, -1, -1):
            d = date(2026, 3, 15) - timedelta(days=i)
            # 점진적 증가 + 랜덤 변동
            growth = 1 + 0.015 * (60 - i) / 60  # 최대 1.5% 성장
            variation = random.uniform(-0.005, 0.008)
            snap_assets = int(base_assets * (growth + variation))
            snap_liabilities = int(base_liabilities * (1 - 0.01 * (60 - i) / 60))
            snap_net = snap_assets - snap_liabilities

            breakdown = json.dumps(
                {
                    "deposit": 19000000,
                    "stock_kr": 2540000,
                    "stock_us": 1240000,
                    "crypto": 5810000,
                    "real_estate": 150000000,
                }
            )

            await s.execute(
                text(
                    "INSERT INTO asset_snapshots (household_id, user_id, snapshot_date, "
                    "total_assets, total_liabilities, net_worth, breakdown, created_at) "
                    "VALUES (:hid, :uid, :d, :assets, :liab, :net, :breakdown, datetime('now'))"
                ),
                {
                    "hid": 1,
                    "uid": 1,
                    "d": str(d),
                    "assets": snap_assets,
                    "liab": snap_liabilities,
                    "net": snap_net,
                    "breakdown": breakdown,
                },
            )

        # 순자산 목표: 2027년 말 2억
        await s.execute(
            text(
                "INSERT INTO asset_goals (household_id, user_id, target_net_worth, target_date, "
                "created_at, updated_at) VALUES (1, 1, 200000000, '2027-12-31', "
                "datetime('now'), datetime('now'))"
            )
        )

        await s.commit()

        r = await s.execute(text("SELECT COUNT(*) FROM assets"))
        print(f"자산/부채: {r.scalar()}건")
        r = await s.execute(text("SELECT COUNT(*) FROM asset_snapshots"))
        print(f"스냅샷: {r.scalar()}건")
        r = await s.execute(text("SELECT COUNT(*) FROM asset_goals"))
        print(f"목표: {r.scalar()}건")


if __name__ == "__main__":
    asyncio.run(seed())
