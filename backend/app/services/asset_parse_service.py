"""자연어 자산 입력 파싱"""

import json

from app.services.llm_service import get_llm_provider

ASSET_PARSE_PROMPT = """사용자가 보유 자산이나 부채를 자연어로 입력했습니다. 아래 JSON 배열로 파싱해주세요.

각 항목의 필드:
- name: 자산명 (예: "삼성전자", "신한은행 적금", "주택담보대출")
- type: stock_kr | stock_us | crypto | deposit | real_estate | other | loan
- is_liability: 부채면 true, 자산이면 false
- ticker: 종목코드(한국) 또는 티커(미국) 또는 코인심볼. 모르면 null
- quantity: 수량 (주식 주수, 코인 개수). 해당없으면 null
- avg_buy_price: 매입 평균가 (원). 해당없으면 null
- manual_value: 수동 평가액 (예금 잔액, 부동산 시세, 대출 잔액 등). 해당없으면 null
- interest_rate: 이율(%). 해당없으면 null
- maturity_date: 만기일 (YYYY-MM-DD). 해당없으면 null
- repayment_type: 상환방식 (equal_principal_interest/equal_principal/bullet). 대출만 해당, 나머지 null
- monthly_payment: 월 상환액. 대출만 해당, 나머지 null
- memo: 기타 메모. 해당없으면 null

한국 주식 종목코드 예시: 삼성전자=005930, SK하이닉스=000660, 카카오=035720, NAVER=035420
미국 주식 티커 예시: 애플=AAPL, 테슬라=TSLA, 엔비디아=NVDA, SPY, QQQ
코인 심볼 예시: 비트코인=BTC, 이더리움=ETH, 리플=XRP

금액 단위: 모두 원(KRW) 기준. "7만원"=70000, "2억"=200000000, "5천만원"=50000000

응답은 반드시 JSON 배열만 출력하세요. 다른 텍스트 없이.

사용자 입력:
{input_text}"""


def _sanitize_input(text: str) -> str:
    """프롬프트 인젝션 방어 — 개행 정규화, 길이 제한 (#138)"""
    return text.replace("\r\n", "\n").replace("\r", "\n")[:2000]


async def parse_asset_input(text: str) -> list[dict]:
    """자연어 → 자산 정보 파싱"""
    llm = get_llm_provider()
    safe_text = _sanitize_input(text)
    prompt = ASSET_PARSE_PROMPT.replace("{input_text}", safe_text)

    response = await llm.generate(prompt)

    # JSON 파싱
    try:
        # ```json ... ``` 래핑 제거
        clean = response.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[1]
            clean = clean.rsplit("```", 1)[0]
        items = json.loads(clean)
        if isinstance(items, dict):
            items = [items]
        return items
    except (json.JSONDecodeError, IndexError):
        return []
