"""종목(Stock) 스키마"""

from pydantic import BaseModel


class StockResponse(BaseModel):
    """종목 검색 응답"""

    id: int
    ticker: str
    name: str
    market: str

    model_config = {"from_attributes": True}
