"""KRX 종목 목록에서 전 종목을 가져와 stocks 테이블 UPSERT

sync 방식 (psycopg2) — GitHub Actions에서 asyncpg 불필요.
의존성: pip install httpx psycopg2-binary sqlalchemy

실행: python backend/scripts/update_stocks.py
환경변수: DATABASE_URL (postgresql+asyncpg:// → 자동 변환)
"""

import os
from datetime import datetime

import httpx
from sqlalchemy import create_engine, text

# KRX 종목 데이터 조회 (data.krx.co.kr, 인증 불필요)
KRX_JSON_URL = "http://data.krx.co.kr/comm/bldAttend/getJsonData.cmd"


def fetch_krx_stocks() -> list[dict]:
    """KRX에서 KOSPI + KOSDAQ 전 종목 조회"""
    stocks: list[dict] = []
    today = datetime.now().strftime("%Y%m%d")

    for mkt_id, market_name in [("STK", "KOSPI"), ("KSQ", "KOSDAQ")]:
        resp = httpx.post(
            KRX_JSON_URL,
            data={
                "bld": "dbms/MDC/STAT/standard/MDCSTAT01901",
                "mktId": mkt_id,
                "trdDd": today,
                "share": "1",
                "csvxls_isNo": "false",
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        for item in data.get("OutBlock_1", []):
            ticker = item.get("ISU_SRT_CD", "")  # 단축코드
            name = item.get("ISU_ABBRV", "")  # 종목명
            if ticker and name and len(ticker) == 6:  # 6자리 종목코드 (보통주 + ETF)
                stocks.append({"ticker": ticker, "name": name, "market": market_name})

    return stocks


def update_db(stocks: list[dict]) -> None:
    """stocks 테이블 UPSERT + 미포함 종목 비활성화 (sync — psycopg2)"""
    db_url = os.environ["DATABASE_URL"]
    # asyncpg URL → psycopg2 URL 변환
    sync_url = db_url.replace("+asyncpg", "").replace("asyncpg://", "postgresql://")
    engine = create_engine(sync_url)

    with engine.begin() as conn:
        active_tickers: set[str] = set()
        for s in stocks:
            conn.execute(
                text(
                    "INSERT INTO stocks (ticker, name, market) VALUES (:ticker, :name, :market) "
                    "ON CONFLICT (ticker) DO UPDATE SET name = :name, market = :market, "
                    "is_active = true, updated_at = NOW()"
                ),
                s,
            )
            active_tickers.add(s["ticker"])

        # 이번에 안 나온 종목 → 상장폐지 처리
        if active_tickers:
            conn.execute(
                text("UPDATE stocks SET is_active = false WHERE is_active = true AND ticker != ALL(:tickers)"),
                {"tickers": list(active_tickers)},
            )


def main() -> None:
    stocks = fetch_krx_stocks()
    print(f"KRX 조회: {len(stocks)}개 종목")
    if not stocks:
        print("경고: KRX에서 종목을 가져오지 못했습니다. DB 갱신을 건너뜁니다.")
        return
    update_db(stocks)
    print("DB 갱신 완료")


if __name__ == "__main__":
    main()
