"""공유 httpx AsyncClient (커넥션 풀링)

여러 서비스(price_service, exchange_rate 등)에서 사용하는 공유 HTTP 클라이언트.
순환 import 방지를 위해 별도 모듈로 분리.
"""

import httpx

_http_client: httpx.AsyncClient | None = None


def get_http_client() -> httpx.AsyncClient:
    """공유 httpx 클라이언트 반환 (lazy init)"""
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=10,
            headers={"User-Agent": "Mozilla/5.0"},
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        )
    return _http_client


async def close_http_client() -> None:
    """공유 httpx 클라이언트 종료 -- app lifespan shutdown에서 호출"""
    global _http_client
    if _http_client is not None and not _http_client.is_closed:
        await _http_client.aclose()
        _http_client = None
