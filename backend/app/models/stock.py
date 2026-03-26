from sqlalchemy import Boolean, Column, DateTime, Integer, String, func

from app.core.database import Base


class Stock(Base):  # type: ignore[misc]
    """종목 마스터 테이블 — 글로벌 데이터 (household_id 없음)

    KRX에서 일일 갱신되는 한국 주식/ETF 종목 목록.
    가격 조회 시 market(KOSPI/KOSDAQ) → Yahoo Finance 서픽스(.KS/.KQ) 변환에 사용.
    """

    __tablename__ = "stocks"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, nullable=False, unique=True, index=True)  # "005930"
    name = Column(String, nullable=False)  # "삼성전자"
    market = Column(String, nullable=False)  # "KOSPI" | "KOSDAQ"
    is_active = Column(Boolean, nullable=False, default=True)
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
