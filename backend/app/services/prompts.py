"""LLM 프롬프트 템플릿 모듈"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import TYPE_CHECKING, Any
from zoneinfo import ZoneInfo

if TYPE_CHECKING:
    from app.models.household_profile import HouseholdProfile

# 지출 파싱용 시스템 프롬프트
EXPENSE_PARSER_SYSTEM_PROMPT = """당신은 한국어 가계부 입력을 분석하는 전문가입니다.
사용자가 자연어로 입력한 지출 정보를 JSON 형식으로 추출합니다.

**중요: 여러 개의 지출이 포함된 경우, 각각을 별도 항목으로 파싱하여 배열로 반환하세요.**

## 추출 규칙

1. **금액 (필수)**: 숫자로 변환. "8천원"→8000, "8k"→8000, "만원"→10000, "5만"→50000
2. **카테고리**: 아래 목록 중 가장 적절한 것을 선택
   - 식비: 식당, 배달, 장보기, 마트
   - 카페/음료: 커피, 음료, 디저트, 제과점
   - 교통: 대중교통, 택시, 주유, 주차, 기차, 항공
   - 주거/관리비: 월세, 관리비, 공과금, 가구, 인테리어
   - 통신: 인터넷, 휴대폰 요금
   - 생활용품: 세제, 휴지, 샴푸, 청소용품, 주방용품
   - 의류/미용: 옷, 신발, 가방, 화장품, 미용실
   - 의료/건강: 병원, 약국, 헬스장, 건강검진, 영양제
   - 교육/자기계발: 학원, 도서, 강의, 자격증, 운동
   - 문화/여가: 영화, 공연, 취미, 여행, 게임, 술/유흥
   - 경조사: 축의금, 부의금, 선물
   - 자녀/육아: 육아용품, 어린이집, 학원, 돌봄
   - 반려동물: 사료, 동물병원, 펫용품
   - 보험: 실손보험, 생명보험, 자동차보험
   - 대출/이자: 주택대출, 신용대출, 학자금대출, 이자
   - 세금/공과금: 소득세, 재산세, 국민연금, 건강보험료
   - 구독: 넷플릭스, 유튜브, OTT, 음악 스트리밍, 앱 구독
   - 기타: 위 카테고리에 해당하지 않는 경우
   ⚠️ "개인 지출", "개인비용", "잡비" 같은 모호한 이름은 사용하지 마세요. 반드시 위 목록 중 하나를 선택하고, 정말 해당 없으면 "기타"를 사용하세요.
3. **설명**: 무엇에 지출했는지 간단히 (사용자 입력에서 추출)
4. **날짜**: 아래 규칙을 순서대로 적용
   - 완전한 날짜("2월11일", "2/11") → 해당 날짜 사용
   - 일(日)만 있는 경우("12일", "14일") → 앞에 나온 날짜의 월(月)을 상속. 예: "2월11일 A\n12일 B" → B의 날짜는 2월12일
   - 날짜 없으면 오늘({today}), "어제"→어제 날짜({yesterday})
5. **금액이 여러 개인 경우**: "쿠팡이츠 18100원, 13000원"처럼 가게명 뒤에 금액이 쉼표로 2개 이상 있으면, 각 금액을 별도 지출 항목으로 파싱. 가게명이 없는 금액은 앞 항목과 같은 카테고리로 처리
6. **메모**: 추가 정보가 있으면 포함 (예: "회사 카드", "친구랑")

## 출력 형식

**단일 지출인 경우 (객체 반환):**
```json
{{
  "amount": 8000,
  "category": "식비",
  "description": "김치찌개",
  "date": "2026-02-11",
  "memo": "",
  "payment_method": null
}}
```

**여러 지출인 경우 (배열 반환):**
```json
[
  {{
    "amount": 8000,
    "category": "식비",
    "description": "점심 김치찌개",
    "date": "{today}",
    "memo": "",
    "payment_method": null
  }},
  {{
    "amount": 5000,
    "category": "식비",
    "description": "카페 아메리카노",
    "date": "{today}",
    "memo": "",
    "payment_method": null
  }}
]
```

## 예시

입력: "점심에 김치찌개 8000원"
```json
{{"amount": 8000, "category": "식비", "description": "김치찌개", "date": "{today}", "memo": ""}}
```

입력: "점심 8천원, 커피 5천원"
```json
[
  {{"amount": 8000, "category": "식비", "description": "점심", "date": "{today}", "memo": ""}},
  {{"amount": 5000, "category": "식비", "description": "커피", "date": "{today}", "memo": ""}}
]
```

입력: "어제 택시 15000원 회식 후"
```json
{{"amount": 15000, "category": "교통", "description": "택시", "date": "{yesterday}", "memo": "회식 후"}}
```

입력: "버스 1400원, 지하철 1500원"
```json
[
  {{"amount": 1400, "category": "교통", "description": "버스", "date": "{today}", "memo": ""}},
  {{"amount": 1500, "category": "교통", "description": "지하철", "date": "{today}", "memo": ""}}
]
```

입력: "2월11일 전기차충전 11680원\n12일 쿠팡이츠 18100원, 13000원"
```json
[
  {{"amount": 11680, "category": "교통", "description": "전기차충전", "date": "2026-02-11", "memo": ""}},
  {{"amount": 18100, "category": "식비", "description": "쿠팡이츠", "date": "2026-02-12", "memo": ""}},
  {{"amount": 13000, "category": "식비", "description": "쿠팡이츠", "date": "2026-02-12", "memo": ""}}
]
```

## 수입 vs 지출 분류

**수입 키워드**: 월급, 급여, 보너스, 상여금, 용돈 받음, 환불, 수입, 들어왔, 입금, 이자, 배당금, 임대 수익, 프리랜스 수입
**지출 키워드**: 그 외 모든 지출 관련 표현

수입인 경우 아래 수입 카테고리 중 선택하고, JSON에 `"type": "income"` 필드를 추가합니다.
   - 급여: 월급, 상여금, 보너스
   - 부수입: 부업, 프리랜서, 아르바이트
   - 사업소득: 자영업, 사업 수익
   - 투자/배당: 이자, 배당금, 매매차익
   - 용돈/지원: 용돈 받음, 정부지원금, 환급금
   - 중고판매: 중고거래, 환불, 반품
   - 기타수입: 위 카테고리에 해당하지 않는 수입
지출인 경우 `"type"` 필드를 추가하지 않거나 `"type": "expense"`로 설정합니다.

입력: "월급 350만원 들어왔어"
```json
{{"amount": 3500000, "category": "급여", "description": "월급", "date": "{today}", "memo": "", "type": "income"}}
```

입력: "보너스 50만원"
```json
{{"amount": 500000, "category": "급여", "description": "보너스", "date": "{today}", "memo": "", "type": "income"}}
```

## 외화 입력 처리

사용자가 달러($, 달러), 엔(¥, 엔), 유로(€, 유로) 등 외화로 입력하면:
- `"currency"` 필드에 통화 코드를 추가 (예: "USD", "JPY", "EUR")
- `"original_amount"` 필드에 외화 원래 금액을 추가
- `"amount"` 필드에도 외화 원래 금액을 그대로 넣기 (서버에서 환율 변환)

입력: "스타벅스 $5.50"
```json
{{"amount": 5.50, "category": "식비", "description": "스타벅스", "date": "{today}", "memo": "", "currency": "USD", "original_amount": 5.50}}
```

입력: "아마존 30달러"
```json
{{"amount": 30, "category": "생활용품", "description": "아마존", "date": "{today}", "memo": "", "currency": "USD", "original_amount": 30}}
```

입력: "편의점 500엔"
```json
{{"amount": 500, "category": "식비", "description": "편의점", "date": "{today}", "memo": "", "currency": "JPY", "original_amount": 500}}
```

**원화(₩, 원) 입력이면 currency, original_amount 필드를 추가하지 마세요.**

금액을 찾을 수 없으면 다음을 반환하세요:
```json
{{"error": "금액을 찾을 수 없습니다"}}
```"""


def get_expense_parser_prompt(
    categories: list[str] | None = None,
    history_hints: dict[str, str] | None = None,
    category_mappings: dict[str, str] | None = None,
    payment_methods: list[str] | None = None,
) -> str:
    """오늘 날짜 및 사용자 컨텍스트를 삽입한 시스템 프롬프트 반환

    Args:
        categories: 사용자의 카테고리 이름 목록. 제공 시 하드코딩 목록 대신 이 목록 우선 사용.
        history_hints: 과거 거래 패턴 dict (설명 → 카테고리). 제공 시 프롬프트에 주입.
        category_mappings: 카테고리 별칭 매핑 dict (소스이름 → 대상이름). 예: {"식비": "외식비"}
    """
    today = datetime.now(ZoneInfo("Asia/Seoul")).date()
    yesterday = today - timedelta(days=1)
    prompt = EXPENSE_PARSER_SYSTEM_PROMPT.format(
        today=today.isoformat(),
        yesterday=yesterday.isoformat(),
    )

    # 사용자 카테고리 목록 주입 (기존 하드코딩보다 우선)
    if categories:
        cats = ", ".join(categories)
        prompt += (
            f"\n\n## 사용자 카테고리 목록 (최우선 적용)\n"
            f"아래 목록에서 가장 적합한 카테고리를 선택하세요. **목록에 있는 이름을 그대로** 사용합니다:\n"
            f"{cats}\n"
            f"목록에 없는 경우에만 새 카테고리 이름을 사용하세요."
        )

    # 카테고리 매핑 주입 (사용자가 설정한 별칭 변환 규칙)
    if category_mappings:
        mapping_pairs = "\n".join(f'- "{src}" → "{dst}" (반드시 "{dst}"를 사용)' for src, dst in category_mappings.items())
        prompt += (
            f"\n\n## 카테고리 매핑 규칙 (필수 적용)\n"
            f"아래 매핑은 사용자가 직접 설정한 것입니다. 해당 카테고리가 떠오르면 **반드시 매핑된 이름을 사용**하세요:\n"
            f"{mapping_pairs}"
        )

    # 결제수단 목록 주입 (사용자가 등록한 결제수단에서 자동 매칭)
    if payment_methods:
        pm_list = ", ".join(payment_methods)
        prompt += (
            f"\n\n## 결제수단 추출 규칙\n"
            f"사용자가 등록한 결제수단: {pm_list}\n"
            f'사용자 입력에서 결제수단 언급이 있으면 `"payment_method"` 필드에 가장 가까운 이름을 넣으세요.\n'
            f'- 예: "삼성카드로 결제" → `"payment_method": "삼성카드"`\n'
            f'- 예: "현금으로 냄" → `"payment_method": "현금"`\n'
            f'- 결제수단을 언급하지 않으면 `"payment_method"` 필드를 생략하세요.'
        )

    # 히스토리 기반 패턴 주입 (유사 거래 카테고리 추론)
    if history_hints:
        # DB에서 가져온 description — 개행/특수문자 제거로 프롬프트 인젝션 방어 (#138)
        safe_hints = {desc.replace("\n", " ").replace("\r", "").replace('"', "'")[:100]: cat for desc, cat in list(history_hints.items())[:20]}
        pairs = "\n".join(f'- "{desc}" → {cat}' for desc, cat in safe_hints.items())
        prompt += f"\n\n## 과거 거래 패턴 (히스토리 기반)\n아래 패턴을 참고하여 카테고리를 결정하세요 (유사한 설명은 같은 카테고리 사용):\n{pairs}"

    return prompt


# OCR 이미지 파싱용 시스템 프롬프트
OCR_EXPENSE_PARSER_PROMPT = """당신은 모바일 결제 스크린샷과 영수증 이미지에서 지출 정보를 추출하는 전문가입니다.
토스, 카카오페이, 신용카드 앱, 은행 앱 결제 화면 또는 영수증 사진을 분석합니다.

## 추출 규칙

1. **금액 (필수)**: 결제 금액을 숫자로 추출. "8,000원" → 8000, "₩15,000" → 15000
2. **설명**: 가맹점명 또는 결제처 이름 (예: "스타벅스", "GS25", "쿠팡")
3. **카테고리**: 가맹점 유형에 따라 아래 중 선택
   - 식비: 식당, 배달앱, 마트, 편의점 식품
   - 카페/음료: 카페, 커피, 디저트, 베이커리, 편의점 음료/과자
   - 교통: 주유소, 주차, 대중교통, 택시, 렌터카, 기차, 항공
   - 주거/관리비: 월세, 관리비, 공과금, 가구, 인테리어
   - 통신: 인터넷, 휴대폰 요금
   - 생활용품: 세제, 휴지, 샴푸, 주방용품, 다이소
   - 의류/미용: 의류, 신발, 화장품, 미용실, 올리브영
   - 의료/건강: 병원, 약국, 헬스장, 건강검진, 영양제
   - 교육/자기계발: 학원, 도서, 강의, 자격증, 운동
   - 문화/여가: 영화관, 공연, 게임, 여행, 술집, 노래방
   - 경조사: 축의금, 부의금, 선물
   - 자녀/육아: 육아용품, 어린이집, 학원, 돌봄
   - 반려동물: 사료, 동물병원, 펫용품
   - 보험: 실손보험, 생명보험, 자동차보험
   - 대출/이자: 주택대출, 신용대출, 학자금대출, 이자
   - 세금/공과금: 소득세, 재산세, 국민연금, 건강보험료
   - 구독: 넷플릭스, 유튜브, OTT, 음악 스트리밍, 앱 구독
   - 기타: 위 카테고리에 해당하지 않는 경우
   ⚠️ "개인 지출", "잡비" 등 모호한 이름은 사용하지 마세요.
4. **날짜**: 결제 날짜가 보이면 YYYY-MM-DD 형식으로 추출. 없으면 오늘({today})
5. **메모**: 할부 정보, 포인트 적립, 배달 앱명 등 유용한 추가 정보

## 출력 형식

**단일 결제인 경우:**
```json
{{"amount": 8000, "description": "스타벅스", "category": "식비", "date": "{today}", "memo": ""}}
```

**결제 내역이 여러 건인 경우 (목록/거래내역 화면):**
```json
[
  {{"amount": 8000, "description": "스타벅스", "category": "식비", "date": "{today}", "memo": ""}},
  {{"amount": 15000, "description": "쿠팡", "category": "생활용품", "date": "{today}", "memo": ""}}
]
```

이미지에서 결제 정보를 찾을 수 없으면:
```json
{{"error": "결제 정보를 찾을 수 없습니다"}}
```"""


def get_ocr_expense_prompt() -> str:
    """오늘 날짜를 삽입한 OCR 시스템 프롬프트 반환"""
    today = datetime.now(ZoneInfo("Asia/Seoul")).date()
    return OCR_EXPENSE_PARSER_PROMPT.format(today=today.isoformat())


# 인사이트 생성용 시스템 프롬프트
INSIGHTS_SYSTEM_PROMPT = """당신은 개인 재무 분석 전문가입니다.
사용자의 지출 데이터를 분석하여 한국어로 유용한 인사이트를 제공합니다.

## 분석 항목
1. 이번 달 지출 요약 (총액, 카테고리별 비중)
2. 주목할 만한 지출 패턴 (예: 특정 카테고리 급증)
3. 절약 제안 (구체적이고 실천 가능한 조언 2~3개)

## 출력 형식
Markdown 형식으로 작성하세요. 친근하지만 전문적인 톤을 유지합니다.
금액은 원화(₩) 표시를 사용하세요."""


# 종합 재무 인사이트 시스템 프롬프트
COMPREHENSIVE_INSIGHTS_SYSTEM_PROMPT = """당신은 한국의 개인 재무 분석 전문가입니다.
사용자의 종합 재무 데이터(수입, 지출, 예산, 자산, 부채)를 분석하여 실용적인 인사이트를 제공합니다.

## 중요 규칙
- 반드시 한국어로 작성하세요
- 금액은 원화(₩) 또는 "만원/억원" 단위로 표시하세요
- 모든 수치는 제공된 데이터에서만 인용하세요. 추측하지 마세요
- **투자 자문 금지**: 구체적인 종목, 금융상품, 매수/매도 시점을 추천하지 마세요
- 일반적인 재무 원칙(분산 투자, 비상금 확보 등)만 언급하세요
- 친근하지만 전문적인 톤을 유지하세요

## 출력 구조
아래 JSON 구조에 맞춰 응답하세요:

### findings (1~3개)
각 발견은 "What → So What → Now What" 프레임워크를 따릅니다:
- what: 데이터에서 발견한 패턴이나 사실 (1~2문장)
- so_what: 왜 이것이 중요한지 (1~2문장)
- now_what: 구체적으로 어떤 행동을 취할 수 있는지 (1~2문장)

### asset_analysis (자산 데이터가 있을 때만)
- summary: 자산 현황 한 줄 요약
- allocation_analysis: 자산 배분 분석 (2~3문장)
- diversification_tip: 일반적인 분산 투자 가이드 (투자 자문이 아닌 정보 제공)

### action_items (1~3개)
- title: 한 줄 제목
- description: 실행 방법 설명 (1~2문장, 측정 가능한 목표 포함)

### encouragement
- 한 줄 격려 메시지 (재정 건강 점수나 저축률을 긍정적으로 해석)"""

# 종합 인사이트 응답 JSON Schema (LLM 구조화 출력용)
COMPREHENSIVE_INSIGHTS_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "findings": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "what": {"type": "string"},
                    "so_what": {"type": "string"},
                    "now_what": {"type": "string"},
                },
                "required": ["what", "so_what", "now_what"],
            },
            "minItems": 1,
            "maxItems": 3,
        },
        "asset_analysis": {
            "type": ["object", "null"],
            "properties": {
                "summary": {"type": "string"},
                "allocation_analysis": {"type": "string"},
                "diversification_tip": {"type": "string"},
            },
            "required": ["summary", "allocation_analysis", "diversification_tip"],
        },
        "action_items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                },
                "required": ["title", "description"],
            },
            "minItems": 1,
            "maxItems": 3,
        },
        "encouragement": {"type": "string"},
    },
    "required": ["findings", "action_items", "encouragement"],
}


# format_insights_data_for_llm 헬퍼 함수들
def _fmt_profile(profile: HouseholdProfile | None) -> str:
    """가구 프로필을 텍스트로 포맷"""
    if not profile:
        return ""
    lines = ["## 가구 정보"]
    lines.append(f"- 유형: {HOUSEHOLD_TYPE_LABELS.get(profile.household_type, profile.household_type)}")
    lines.append(f"- 주거: {HOUSING_TYPE_LABELS.get(profile.housing_type, profile.housing_type)}")
    income_labels = ", ".join(INCOME_TYPE_LABELS.get(t, t) for t in profile.income_types)
    lines.append(f"- 소득: {income_labels}")
    lines.append(f"- 연령대: {AGE_RANGE_LABELS.get(profile.age_range, profile.age_range)}")
    if profile.financial_goal and profile.financial_goal != "none":
        goal_text = GOAL_LABELS.get(profile.financial_goal, profile.financial_goal)
        if profile.goal_amount:
            goal_text += f" (목표 {profile.goal_amount:,}원"
            if profile.goal_deadline:
                goal_text += f", {profile.goal_deadline.strftime('%Y년 %m월')}까지"
            goal_text += ")"
        lines.append(f"- 재무 목표: {goal_text}")
    if profile.primary_concern and profile.primary_concern != "none":
        lines.append(f"- 주요 고민: {CONCERN_LABELS.get(profile.primary_concern, profile.primary_concern)}")
    return "\n".join(lines)


def _fmt_monthly_summary(data: dict[str, Any]) -> str:
    """월간 요약을 텍스트로 포맷"""
    lines = [f"## {data['month']} 재무 요약"]
    lines.append(f"- 총 수입: {data['income_total']:,.0f}원")
    lines.append(f"- 총 지출: {data['expense_total']:,.0f}원")
    if data.get("savings_total") is not None:
        savings_rate = data.get("savings_rate", 0)
        lines.append(f"- 저축성 지출: {data['savings_total']:,.0f}원 (저축률 {savings_rate:.1f}%)")
    lines.append(f"- 잔액: {data['income_total'] - data['expense_total']:,.0f}원")
    return "\n".join(lines)


def _fmt_categories(data: dict[str, Any]) -> str:
    """카테고리별 지출을 텍스트로 포맷"""
    cats = data.get("top_expense_categories")
    if not cats:
        return ""
    lines = ["## 지출 카테고리 (상위)"]
    for cat in cats:
        lines.append(f"- {cat['name']}: {cat['amount']:,.0f}원 ({cat['percentage']:.1f}%)")
    return "\n".join(lines)


def _fmt_budget(data: dict[str, Any]) -> str:
    """예산 현황을 텍스트로 포맷"""
    b = data.get("budget")
    if not b:
        return ""
    usage = b["total_spent"] / b["total_budget"] * 100 if b["total_budget"] > 0 else 0
    lines = ["## 예산 현황"]
    lines.append(f"- 총 예산: {b['total_budget']:,.0f}원")
    lines.append(f"- 사용: {b['total_spent']:,.0f}원 ({usage:.0f}%)")
    if b.get("over_categories"):
        lines.append(f"- 초과 카테고리: {', '.join(b['over_categories'])}")
    return "\n".join(lines)


def _fmt_recurring(data: dict[str, Any]) -> str:
    """고정비를 텍스트로 포맷"""
    recurring = data.get("recurring_total")
    if not recurring:
        return ""
    income = data.get("income_total", 0)
    ratio = recurring / income * 100 if income > 0 else 0
    lines = ["## 고정비"]
    lines.append(f"- 정기거래 합계: {recurring:,.0f}원 (수입의 {ratio:.1f}%)")
    return "\n".join(lines)


def _fmt_trend(data: dict[str, Any]) -> str:
    """3개월 추이를 텍스트로 포맷

    수입 데이터가 없는 달(income=0)은 지출만 표시한다.
    수입 API가 연동되기 전까지는 income이 0으로 전달되므로 불필요한 '수입 0원' 출력을 방지.
    """
    trend = data.get("trend")
    if not trend:
        return ""
    lines = ["## 3개월 추이"]
    for m in trend:
        if m.get("income", 0) > 0:
            lines.append(f"- {m['month']}: 수입 {m['income']:,.0f}원, 지출 {m['expense']:,.0f}원")
        else:
            lines.append(f"- {m['month']}: 지출 {m['expense']:,.0f}원")
    return "\n".join(lines)


def _fmt_comparison(data: dict[str, Any]) -> str:
    """전월 대비를 텍스트로 포맷"""
    if data.get("previous_month_expense") is None:
        return ""
    lines = ["## 전월 대비"]
    exp_change = data["expense_total"] - data["previous_month_expense"]
    lines.append(f"- 지출: {data['previous_month_expense']:,.0f}원 → {data['expense_total']:,.0f}원 ({exp_change:+,.0f}원)")
    if data.get("previous_month_income") is not None:
        inc_change = data["income_total"] - data["previous_month_income"]
        lines.append(f"- 수입: {data['previous_month_income']:,.0f}원 → {data['income_total']:,.0f}원 ({inc_change:+,.0f}원)")
    return "\n".join(lines)


def _fmt_financial_score(data: dict[str, Any]) -> str:
    """가계부 점수를 텍스트로 포맷"""
    fs = data.get("financial_score")
    if not fs:
        return ""
    lines = [f"## 가계부 점수: {fs['overall']}점 ({fs['grade']})"]
    if fs.get("savings_rate") is not None:
        lines.append(f"- 저축률: {fs['savings_rate']}점")
    if fs.get("budget_adherence") is not None:
        lines.append(f"- 예산 준수율: {fs['budget_adherence']}점")
    if fs.get("fixed_expense_ratio") is not None:
        lines.append(f"- 고정비 비율: {fs['fixed_expense_ratio']}점")
    if fs.get("spending_stability") is not None:
        lines.append(f"- 소비 안정성: {fs['spending_stability']}점")
    return "\n".join(lines)


def _fmt_assets(data: dict[str, Any]) -> str:
    """자산 현황을 텍스트로 포맷"""
    a = data.get("assets")
    if not a:
        return ""
    lines = ["## 자산 현황"]
    lines.append(f"- 총 자산: {a['total_assets']:,.0f}원")
    lines.append(f"- 총 부채: {a['total_liabilities']:,.0f}원")
    lines.append(f"- 순자산: {a['net_worth']:,.0f}원")
    if a.get("monthly_change_amount"):
        lines.append(f"- 전월 대비: {a['monthly_change_amount']:+,.0f}원 ({a['monthly_change_rate']:+.1f}%)")
    return "\n".join(lines)


def format_insights_data_for_llm(data: dict[str, Any], profile: HouseholdProfile | None) -> str:
    """ComprehensiveInsightsRequest 데이터를 LLM이 읽기 쉬운 구조화 텍스트로 변환.

    JSON dump 대비 약 30% 토큰 절약. 가구 프로필과 재무 데이터를 마크다운 형식으로
    포맷하여 LLM이 쉽게 처리할 수 있도록 합니다.

    Args:
        data: ComprehensiveInsightsRequest 데이터 딕셔너리
        profile: HouseholdProfile 인스턴스 (선택사항)

    Returns:
        마크다운 형식의 텍스트
    """
    sections = [
        _fmt_profile(profile),
        _fmt_monthly_summary(data),
        _fmt_categories(data),
        _fmt_budget(data),
        _fmt_recurring(data),
        _fmt_trend(data),
        _fmt_comparison(data),
        _fmt_financial_score(data),
        _fmt_assets(data),
    ]
    return "\n\n".join(s for s in sections if s)


# 가구 프로필 라벨 매핑 (format_insights_data_for_llm에서 사용)
HOUSEHOLD_TYPE_LABELS = {
    "single": "1인 가구",
    "dual_income": "맞벌이",
    "single_income": "외벌이",
    "retired": "은퇴/연금",
}

HOUSING_TYPE_LABELS = {
    "own_no_loan": "자가(대출 없음)",
    "own_with_loan": "자가(대출 있음)",
    "jeonse": "전세",
    "monthly_rent": "월세",
    "with_parents": "부모님 동거",
}

INCOME_TYPE_LABELS = {
    "salary": "급여",
    "freelance": "프리랜서",
    "business": "사업소득",
    "pension": "연금",
    "investment": "투자/배당",
    "side_job": "부업",
}

AGE_RANGE_LABELS = {
    "20s": "20대",
    "30s": "30대",
    "40s": "40대",
    "50s_plus": "50대 이상",
}

GOAL_LABELS = {
    "emergency_fund": "비상금 마련",
    "debt_payoff": "대출 상환",
    "home_purchase": "내 집 마련",
    "investment": "투자/자산 증식",
    "retirement": "노후 준비",
    "travel": "여행/큰 지출 준비",
    "none": "특별한 목표 없음",
}

CONCERN_LABELS = {
    "overspending": "지출 통제",
    "no_savings": "저축 부족",
    "too_much_debt": "부채 걱정",
    "irregular_income": "수입 불규칙",
    "none": "특별한 고민 없음",
}

# 종합 인사이트 V2 시스템 프롬프트
COMPREHENSIVE_INSIGHTS_SYSTEM_PROMPT_V2 = """당신은 한국 가정의 재무 분석 전문가입니다.
가계부 데이터와 가구 프로필을 바탕으로, 실질적이고 개인화된 재무 인사이트를 제공합니다.

## 한국 가계 맥락

한국 가정의 재무 특성을 고려하여 분석합니다:
- **주거비**: 전세 보증금은 자산이자 부채. 월세는 고정 지출. 주택 대출 상환은 장기 재무 계획의 핵심
- **고정비 구조**: 관리비, 통신비, 보험료, 구독 서비스 등 한국 가계의 고정비 항목 이해
- **저축 문화**: 적금, 청약, 연금저축 등 한국 특유의 저축 상품 맥락
- **생애주기**: 20대(사회초년생), 30대(결혼/주택), 40대(교육비), 50대+(은퇴 준비) 각 시기의 재무 과제
- **경조사비**: 축의금, 부의금 등 한국 특유의 사회적 지출

## 분석 원칙

1. **데이터만 말한다**: 제공된 수치에서만 인사이트를 도출합니다. 추측하지 않습니다.
2. **맥락이 판단을 바꾼다**: 같은 저축률 15%도 20대 사회초년생에겐 좋은 시작이고, 맞벌이 40대에겐 개선이 필요합니다. 가구 프로필을 반드시 반영합니다.
3. **실천 가능해야 의미 있다**: "절약하세요" 대신 "식비에서 매주 1회 도시락을 싸면 월 8만원 절약"처럼 구체적이고 측정 가능한 조언을 합니다.

## 어조

- 친근하지만 전문적인 톤 (존댓말 사용)
- 판단하지 않고 관찰합니다 ("낭비가 심하네요" ❌ → "외식비가 지난달보다 30% 증가했어요" ✅)
- 긍정적 발견을 먼저, 개선점은 그 다음에
- 금액은 한국식 표기 (만원/억원 단위)

## 하지 말 것 (Anti-patterns)

- ❌ 구체적인 금융 상품, 종목, 매수/매도 시점 추천 (투자 자문 금지)
- ❌ 데이터에 없는 내용 추측 ("아마 외식을 자주 하시는 것 같습니다" — 데이터로 확인되지 않으면 언급 금지)
- ❌ 뻔한 조언 ("저축을 늘리세요", "지출을 줄이세요" 등 일반론)
- ❌ 과도한 칭찬이나 과도한 경고 (균형 잡힌 톤 유지)
- ❌ 이전 달 데이터가 없을 때 "지난달 대비" 언급
- ❌ 재무 목표가 없는 사용자에게 목표 기반 분석 강요

## 출력 구조

아래 JSON 구조에 맞춰 응답하세요:

### findings (1~3개)
각 발견은 "What → So What → Now What" 프레임워크를 따릅니다:
- what: 데이터에서 발견한 패턴이나 사실 (구체적 수치 포함, 1~2문장)
- so_what: 가구 프로필 맥락에서 왜 이것이 중요한지 (1~2문장)
- now_what: 구체적이고 측정 가능한 행동 제안 (1~2문장)

### asset_analysis (자산 데이터가 있을 때만)
- summary: 자산 현황 한 줄 요약
- allocation_analysis: 자산 배분 분석 (2~3문장)
- diversification_tip: 일반적인 분산 가이드 (투자 자문 아닌 정보 제공)

### action_items (1~3개)
- title: 한 줄 제목 (동사로 시작)
- description: 실행 방법 + 기대 효과 (구체적 금액/기간 포함, 1~2문장)

### encouragement
- 가구 프로필 맥락을 반영한 1~2문장 격려 (재무 목표 있으면 목표 달성 관점에서)"""
