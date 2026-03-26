"""종목 검색 API 통합 테스트 (#77)

GET /api/stocks/search?q=... — 한글명/티커 부분 매칭, 최대 20개, 인증 필수.
"""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.stock import Stock


@pytest_asyncio.fixture
async def sample_stocks(db_session: AsyncSession) -> list[Stock]:
    """테스트용 종목 데이터"""
    stocks_data = [
        {"ticker": "005930", "name": "삼성전자", "market": "KOSPI"},
        {"ticker": "006400", "name": "삼성SDI", "market": "KOSPI"},
        {"ticker": "000660", "name": "SK하이닉스", "market": "KOSPI"},
        {"ticker": "247540", "name": "에코프로비엠", "market": "KOSDAQ"},
        {"ticker": "999999", "name": "비활성종목", "market": "KOSPI"},
    ]
    stocks = []
    for data in stocks_data:
        stock = Stock(**data)
        db_session.add(stock)
        stocks.append(stock)
    # 비활성 종목 설정
    stocks[-1].is_active = False
    await db_session.commit()
    return stocks


@pytest.mark.asyncio
async def test_search_stocks_by_name(authenticated_client, db_session, sample_stocks):
    """한글 종목명으로 검색"""
    response = await authenticated_client.get("/api/stocks/search", params={"q": "삼성"})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    tickers = {item["ticker"] for item in data}
    assert "005930" in tickers
    assert "006400" in tickers


@pytest.mark.asyncio
async def test_search_stocks_by_ticker(authenticated_client, db_session, sample_stocks):
    """티커로 검색"""
    response = await authenticated_client.get("/api/stocks/search", params={"q": "005930"})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["ticker"] == "005930"
    assert data[0]["name"] == "삼성전자"
    assert data[0]["market"] == "KOSPI"


@pytest.mark.asyncio
async def test_search_empty_result(authenticated_client, db_session, sample_stocks):
    """매칭 없으면 빈 배열"""
    response = await authenticated_client.get("/api/stocks/search", params={"q": "존재하지않는종목"})
    assert response.status_code == 200
    data = response.json()
    assert data == []


@pytest.mark.asyncio
async def test_search_excludes_inactive(authenticated_client, db_session, sample_stocks):
    """비활성 종목은 검색 결과에서 제외"""
    response = await authenticated_client.get("/api/stocks/search", params={"q": "비활성"})
    assert response.status_code == 200
    data = response.json()
    assert data == []


@pytest.mark.asyncio
async def test_search_returns_max_20(authenticated_client, db_session):
    """최대 20개 결과 제한"""
    # 25개 종목 생성
    for i in range(25):
        stock = Stock(ticker=f"T{i:05d}", name=f"테스트종목{i}", market="KOSPI")
        db_session.add(stock)
    await db_session.commit()

    response = await authenticated_client.get("/api/stocks/search", params={"q": "테스트"})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 20


@pytest.mark.asyncio
async def test_search_requires_auth(client, db_session, sample_stocks):
    """비인증 요청은 401"""
    response = await client.get("/api/stocks/search", params={"q": "삼성"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_search_requires_query_param(authenticated_client, db_session):
    """q 파라미터 없으면 422"""
    response = await authenticated_client.get("/api/stocks/search")
    assert response.status_code == 422
