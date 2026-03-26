"""stocks_kr.json → stocks 테이블 시드 (sync — update_stocks.py와 동일 패턴)

실행: cd backend && python scripts/seed_stocks.py
환경변수: DATABASE_URL (postgresql+asyncpg:// 또는 postgresql:// 모두 지원)
"""

import json
import os
from pathlib import Path

from sqlalchemy import create_engine, text


def seed() -> None:
    json_path = Path(__file__).parent.parent.parent / "frontend" / "public" / "stocks_kr.json"
    stocks = json.loads(json_path.read_text())

    db_url = os.environ["DATABASE_URL"]
    # asyncpg URL → psycopg2 URL 변환
    sync_url = db_url.replace("+asyncpg", "").replace("asyncpg://", "postgresql://")
    engine = create_engine(sync_url)

    with engine.begin() as conn:
        for s in stocks:
            conn.execute(
                text(
                    "INSERT INTO stocks (ticker, name, market) VALUES (:ticker, :name, :market) "
                    "ON CONFLICT (ticker) DO UPDATE SET name = :name, market = :market, is_active = true"
                ),
                {"ticker": s["ticker"], "name": s["name"], "market": s["market"]},
            )
    print(f"시드 완료: {len(stocks)}개 종목")


if __name__ == "__main__":
    seed()
