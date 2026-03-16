# 종합 재무 리포트 페이지 개편 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** InsightsPage를 월간 전용 종합 재무 리포트로 개편한다 — 가계부(수입/지출) + 자산 데이터를 통합하고, 코드 기반 재정 건강 점수 + 구조화된 AI 분석을 제공한다.

**Architecture:** 프론트엔드가 기존 API 여러 개를 병렬 호출하여 데이터를 수집하고, 재정 건강 점수를 코드로 계산한 뒤, 사전 계산된 JSON을 새 백엔드 엔드포인트로 전송하여 구조화된 LLM 응답을 받는다. 기존 컴포넌트(BudgetVsActual, MonthlyHighlights)를 재사용하고 신규 컴포넌트(HealthScore, AssetChange, CategoryTop, StructuredInsights)를 추가한다.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Chart.js (react-chartjs-2), FastAPI, Anthropic/OpenAI LLM, Vitest, MSW

---

## 배경

- 디자인 문서: `docs/plans/2026-03-14-report-overhaul-design.md`
- 대시보드 제거 계획: `docs/plans/2026-03-14-remove-dashboard-design.md` (별도 진행)
- 현재 InsightsPage: `frontend/src/pages/InsightsPage.tsx` (275줄)
- 현재 백엔드 인사이트: `backend/app/api/insights.py` (지출만, 마크다운 출력)

---

### Task 1: 백엔드 — 구조화된 종합 인사이트 스키마 정의

현재 인사이트 응답은 자유형 마크다운(`insights: string`). 새 엔드포인트의 요청/응답을 Pydantic 스키마로 정의한다.

**Files:**
- Create: `backend/app/schemas/insights.py`

**Step 1: 스키마 파일 생성**

```python
"""종합 재무 인사이트 요청/응답 스키마"""

from pydantic import BaseModel, Field


# ── 요청: 프론트엔드가 사전 계산하여 전송 ──

class CategorySummary(BaseModel):
    name: str
    amount: float
    percentage: float

class BudgetSummary(BaseModel):
    total_budget: float
    total_spent: float
    over_categories: list[str] = []

class AssetBreakdown(BaseModel):
    total_assets: float
    total_liabilities: float
    net_worth: float
    breakdown: dict[str, float] = {}
    monthly_change_amount: float = 0
    monthly_change_rate: float = 0

class LoanInfo(BaseModel):
    name: str
    balance: float
    rate: float
    monthly_payment: float = 0

class DebtSummary(BaseModel):
    loans: list[LoanInfo] = []
    total_interest_monthly: float = 0

class HealthScoreBreakdown(BaseModel):
    savings: int
    spending: int
    debt: int
    overall: int
    grade: str

class ComprehensiveInsightsRequest(BaseModel):
    """프론트엔드가 사전 계산한 종합 재무 데이터"""
    month: str = Field(..., pattern=r"^\d{4}-\d{2}$")
    income_total: float
    expense_total: float
    top_expense_categories: list[CategorySummary] = []
    budget: BudgetSummary | None = None
    assets: AssetBreakdown | None = None
    debt: DebtSummary | None = None
    savings_rate: float = 0
    health_score: HealthScoreBreakdown | None = None
    previous_month_expense: float | None = None
    previous_month_income: float | None = None


# ── 응답: LLM이 생성하는 구조화된 인사이트 ──

class Finding(BaseModel):
    """핵심 발견 (What → So What → Now What)"""
    what: str
    so_what: str
    now_what: str

class AssetAnalysis(BaseModel):
    """자산 분석"""
    summary: str
    allocation_analysis: str
    diversification_tip: str

class ActionItem(BaseModel):
    """액션 아이템"""
    title: str
    description: str

class StructuredInsightsResponse(BaseModel):
    """LLM이 생성하는 구조화된 인사이트"""
    findings: list[Finding] = Field(..., min_length=1, max_length=3)
    asset_analysis: AssetAnalysis | None = None
    action_items: list[ActionItem] = Field(..., min_length=1, max_length=3)
    encouragement: str = ""

class ComprehensiveInsightsResponse(BaseModel):
    """종합 인사이트 API 응답"""
    month: str
    insights: StructuredInsightsResponse
```

**Step 2: 커밋**

```bash
git add backend/app/schemas/insights.py
git commit -m "feat: 종합 재무 인사이트 요청/응답 스키마 정의"
```

---

### Task 2: 백엔드 — 종합 인사이트 LLM 프롬프트 작성

현재 `INSIGHTS_SYSTEM_PROMPT`는 지출만 분석하는 간단한 프롬프트. 새로운 종합 분석용 프롬프트를 추가한다. JSON Schema 기반 구조화 출력을 강제한다.

**Files:**
- Modify: `backend/app/services/prompts.py`

**Step 1: 종합 인사이트 프롬프트 추가**

`prompts.py` 맨 아래에 추가:

```python
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
```

**Step 2: 커밋**

```bash
git add backend/app/services/prompts.py
git commit -m "feat: 종합 재무 인사이트 LLM 프롬프트 및 JSON Schema 추가"
```

---

### Task 3: 백엔드 — LLM 프로바이더에 종합 인사이트 메서드 추가

`LLMProvider` 추상 클래스에 `generate_comprehensive_insights` 메서드를 추가하고, Anthropic/OpenAI 프로바이더에 구현한다. JSON Schema로 구조화된 출력을 강제한다.

**Files:**
- Modify: `backend/app/services/llm_service.py`

**Step 1: 추상 메서드 추가**

`LLMProvider` 클래스(약 36행)에 추가:

```python
@abstractmethod
async def generate_comprehensive_insights(self, report_data: dict[str, Any]) -> dict[str, Any]:
    """종합 재무 데이터를 분석하여 구조화된 인사이트 생성"""
    ...
```

**Step 2: AnthropicProvider 구현**

`AnthropicProvider.generate_comprehensive_insights` 메서드 추가:

```python
async def generate_comprehensive_insights(self, report_data: dict[str, Any]) -> dict[str, Any]:
    import anthropic
    from app.services.prompts import COMPREHENSIVE_INSIGHTS_SYSTEM_PROMPT, COMPREHENSIVE_INSIGHTS_JSON_SCHEMA

    client = anthropic.AsyncAnthropic()
    model = self.model

    response = await client.messages.create(
        model=model,
        max_tokens=2000,
        system=COMPREHENSIVE_INSIGHTS_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"다음 재무 데이터를 분석해주세요:\n\n{json.dumps(report_data, ensure_ascii=False, indent=2)}",
            }
        ],
        tools=[
            {
                "name": "structured_insights",
                "description": "구조화된 재무 인사이트 응답",
                "input_schema": COMPREHENSIVE_INSIGHTS_JSON_SCHEMA,
            }
        ],
        tool_choice={"type": "tool", "name": "structured_insights"},
    )

    # tool_use 블록에서 구조화된 JSON 추출
    for block in response.content:
        if block.type == "tool_use":
            return block.input

    raise ValueError("LLM이 구조화된 응답을 반환하지 않았습니다")
```

**Step 3: OpenAIProvider 구현**

```python
async def generate_comprehensive_insights(self, report_data: dict[str, Any]) -> dict[str, Any]:
    from openai import AsyncOpenAI
    from app.services.prompts import COMPREHENSIVE_INSIGHTS_SYSTEM_PROMPT, COMPREHENSIVE_INSIGHTS_JSON_SCHEMA

    client = AsyncOpenAI()
    model = self.model

    response = await client.chat.completions.create(
        model=model,
        max_tokens=2000,
        messages=[
            {"role": "system", "content": COMPREHENSIVE_INSIGHTS_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"다음 재무 데이터를 분석해주세요:\n\n{json.dumps(report_data, ensure_ascii=False, indent=2)}",
            },
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "structured_insights",
                "schema": COMPREHENSIVE_INSIGHTS_JSON_SCHEMA,
                "strict": True,
            },
        },
    )

    return json.loads(response.choices[0].message.content)
```

**Step 4: Google/Local 스텁 추가**

```python
async def generate_comprehensive_insights(self, report_data: dict[str, Any]) -> dict[str, Any]:
    raise NotImplementedError("종합 인사이트는 아직 이 프로바이더를 지원하지 않습니다")
```

**Step 5: 커밋**

```bash
git add backend/app/services/llm_service.py
git commit -m "feat: LLM 프로바이더에 구조화된 종합 인사이트 메서드 추가"
```

---

### Task 4: 백엔드 — 종합 인사이트 API 엔드포인트 추가

프론트엔드에서 사전 계산된 데이터를 받아 LLM에 전달하고 구조화된 응답을 반환하는 엔드포인트를 추가한다.

**Files:**
- Modify: `backend/app/api/insights.py`

**Step 1: 새 엔드포인트 추가**

기존 `/generate` 엔드포인트 아래에 추가:

```python
from app.schemas.insights import ComprehensiveInsightsRequest, ComprehensiveInsightsResponse

@router.post("/generate-comprehensive", response_model=ComprehensiveInsightsResponse)
@limiter.limit("5/minute")
async def generate_comprehensive_insights(
    request: Request,
    body: ComprehensiveInsightsRequest,
    current_user: User = Depends(get_current_user),
):
    """종합 재무 인사이트 생성

    프론트엔드가 사전 계산한 재무 데이터를 받아 LLM에게 구조화된 분석을 요청합니다.
    건강 점수, 자산/부채 현황 등은 프론트엔드에서 계산하여 전송합니다.

    Rate Limiting:
    - 사용자당 분당 5회 제한
    """
    report_data = body.model_dump(exclude_none=True)

    llm = get_llm_provider("insights")
    structured = await llm.generate_comprehensive_insights(report_data)

    return ComprehensiveInsightsResponse(
        month=body.month,
        insights=structured,
    )
```

**Step 2: import 정리**

파일 상단에 `ComprehensiveInsightsRequest`, `ComprehensiveInsightsResponse` import 추가.

**Step 3: 빌드 확인**

```bash
cd backend && python -c "from app.api.insights import router; print('OK')"
```

Expected: `OK`

**Step 4: 커밋**

```bash
git add backend/app/api/insights.py backend/app/schemas/insights.py
git commit -m "feat: 종합 재무 인사이트 API 엔드포인트 추가"
```

---

### Task 5: 백엔드 — 종합 인사이트 API 테스트

새 엔드포인트의 입력 검증, LLM 모킹, 응답 구조를 테스트한다.

**Files:**
- Create: `backend/tests/test_insights_comprehensive.py`

**Step 1: 테스트 파일 작성**

```python
"""종합 재무 인사이트 API 테스트"""

import pytest
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient


VALID_REQUEST = {
    "month": "2026-03",
    "income_total": 5000000,
    "expense_total": 3200000,
    "top_expense_categories": [
        {"name": "식비", "amount": 1200000, "percentage": 37.5},
        {"name": "주거", "amount": 800000, "percentage": 25.0},
    ],
    "savings_rate": 36.0,
    "health_score": {
        "savings": 85,
        "spending": 72,
        "debt": 90,
        "overall": 82,
        "grade": "B+",
    },
}

MOCK_LLM_RESPONSE = {
    "findings": [
        {
            "what": "식비가 전체 지출의 37.5%를 차지합니다",
            "so_what": "전국 평균(30%) 대비 높은 수준입니다",
            "now_what": "주 2회 도시락을 준비하면 월 20만원 절약 가능합니다",
        }
    ],
    "asset_analysis": None,
    "action_items": [
        {
            "title": "식비 예산 100만원 설정",
            "description": "이번 달 식비를 100만원 이내로 관리해보세요",
        }
    ],
    "encouragement": "저축률 36%는 매우 우수합니다! 이 습관을 유지하세요.",
}


@pytest.mark.asyncio
async def test_generate_comprehensive_insights(client: AsyncClient, auth_headers: dict):
    """종합 인사이트 생성 성공"""
    with patch(
        "app.api.insights.get_llm_provider"
    ) as mock_get_provider:
        mock_provider = AsyncMock()
        mock_provider.generate_comprehensive_insights.return_value = MOCK_LLM_RESPONSE
        mock_get_provider.return_value = mock_provider

        response = await client.post(
            "/api/insights/generate-comprehensive",
            json=VALID_REQUEST,
            headers=auth_headers,
        )

    assert response.status_code == 200
    data = response.json()
    assert data["month"] == "2026-03"
    assert len(data["insights"]["findings"]) == 1
    assert data["insights"]["findings"][0]["what"] == "식비가 전체 지출의 37.5%를 차지합니다"
    assert len(data["insights"]["action_items"]) == 1
    assert data["insights"]["encouragement"] != ""


@pytest.mark.asyncio
async def test_generate_comprehensive_invalid_month(client: AsyncClient, auth_headers: dict):
    """잘못된 월 형식 → 422"""
    response = await client.post(
        "/api/insights/generate-comprehensive",
        json={**VALID_REQUEST, "month": "2026-3"},
        headers=auth_headers,
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_generate_comprehensive_minimal_request(client: AsyncClient, auth_headers: dict):
    """최소한의 데이터만으로도 동작"""
    with patch(
        "app.api.insights.get_llm_provider"
    ) as mock_get_provider:
        mock_provider = AsyncMock()
        mock_provider.generate_comprehensive_insights.return_value = MOCK_LLM_RESPONSE
        mock_get_provider.return_value = mock_provider

        response = await client.post(
            "/api/insights/generate-comprehensive",
            json={
                "month": "2026-03",
                "income_total": 0,
                "expense_total": 0,
            },
            headers=auth_headers,
        )

    assert response.status_code == 200
```

**Step 2: 테스트 실행**

```bash
cd backend && pytest tests/test_insights_comprehensive.py -v
```

Expected: PASS (3 tests)

**Step 3: 커밋**

```bash
git add backend/tests/test_insights_comprehensive.py
git commit -m "test: 종합 재무 인사이트 API 테스트 추가"
```

---

### Task 6: 프론트엔드 — TypeScript 타입 및 API 클라이언트 추가

새 엔드포인트에 대응하는 타입과 API 함수를 추가한다.

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/api/insights.ts`

**Step 1: 타입 추가**

`frontend/src/types/index.ts` 맨 아래에 추가:

```typescript
// ── 종합 재무 인사이트 ──

export interface HealthScore {
  savings: number
  spending: number
  debt: number
  overall: number
  grade: string
}

export interface Finding {
  what: string
  so_what: string
  now_what: string
}

export interface AssetAnalysisResult {
  summary: string
  allocation_analysis: string
  diversification_tip: string
}

export interface ActionItem {
  title: string
  description: string
}

export interface StructuredInsights {
  findings: Finding[]
  asset_analysis: AssetAnalysisResult | null
  action_items: ActionItem[]
  encouragement: string
}

export interface ComprehensiveInsightsResponse {
  month: string
  insights: StructuredInsights
}
```

**Step 2: API 클라이언트 함수 추가**

`frontend/src/api/insights.ts`에 추가:

```typescript
import type { ComprehensiveInsightsResponse } from '../types'

// insightsApi 객체에 메서드 추가:
generateComprehensive: (data: Record<string, unknown>) =>
  api.post<ComprehensiveInsightsResponse>('/insights/generate-comprehensive', data, { timeout: 60000 })
    .then(res => res.data),
```

기존 `insightsApi` 객체에 `generateComprehensive` 메서드를 추가한다. 기존 `generate`는 하위 호환을 위해 유지.

**Step 3: 커밋**

```bash
git add frontend/src/types/index.ts frontend/src/api/insights.ts
git commit -m "feat: 종합 인사이트 TypeScript 타입 및 API 클라이언트 추가"
```

---

### Task 7: 프론트엔드 — 재정 건강 점수 계산 유틸리티

코드에서 재정 건강 점수를 계산하는 순수 함수를 작성한다. LLM에 보내기 전에 프론트엔드에서 계산한다.

**Files:**
- Create: `frontend/src/utils/healthScore.ts`
- Create: `frontend/src/utils/__tests__/healthScore.test.ts`

**Step 1: 테스트 먼저 작성**

`frontend/src/utils/__tests__/healthScore.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { calculateHealthScore } from '../healthScore'

describe('calculateHealthScore', () => {
  it('저축률 36%이면 savings 점수가 높다', () => {
    const score = calculateHealthScore({
      incomeTotal: 5000000,
      expenseTotal: 3200000,
      budgetTotal: 4000000,
      budgetSpent: 3200000,
      totalLiabilities: 0,
      totalAssets: 10000000,
      avgLoanRate: 0,
    })
    expect(score.savings).toBeGreaterThanOrEqual(80)
    expect(score.grade).toMatch(/^[AB]/)
  })

  it('수입이 0이면 저축률 점수 0', () => {
    const score = calculateHealthScore({
      incomeTotal: 0,
      expenseTotal: 0,
    })
    expect(score.savings).toBe(0)
    expect(score.overall).toBeGreaterThanOrEqual(0)
  })

  it('예산 초과 시 spending 점수가 낮다', () => {
    const score = calculateHealthScore({
      incomeTotal: 5000000,
      expenseTotal: 5500000,
      budgetTotal: 4000000,
      budgetSpent: 5500000,
    })
    expect(score.spending).toBeLessThan(50)
  })

  it('부채 비율 높으면 debt 점수가 낮다', () => {
    const score = calculateHealthScore({
      incomeTotal: 5000000,
      expenseTotal: 3000000,
      totalLiabilities: 100000000,
      totalAssets: 50000000,
      avgLoanRate: 8,
    })
    expect(score.debt).toBeLessThan(50)
  })

  it('grade 범위가 A+~F 사이다', () => {
    const grades = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F']
    const score = calculateHealthScore({
      incomeTotal: 3000000,
      expenseTotal: 2000000,
    })
    expect(grades).toContain(score.grade)
  })
})
```

**Step 2: 테스트 실행 — 실패 확인**

```bash
cd frontend && npx vitest run src/utils/__tests__/healthScore.test.ts
```

Expected: FAIL (모듈 없음)

**Step 3: 구현**

`frontend/src/utils/healthScore.ts`:

```typescript
import type { HealthScore } from '../types'

interface HealthScoreInput {
  incomeTotal: number
  expenseTotal: number
  budgetTotal?: number
  budgetSpent?: number
  totalLiabilities?: number
  totalAssets?: number
  avgLoanRate?: number
}

/**
 * 재정 건강 점수 계산 (코드 기반, LLM 미사용)
 *
 * - savings (저축률): 수입 대비 (수입-지출) 비율
 * - spending (지출관리): 예산 준수율
 * - debt (부채): 부채 비율 + 평균 이자율
 * - overall: 가중 평균 → grade
 */
export function calculateHealthScore(input: HealthScoreInput): HealthScore {
  const { incomeTotal, expenseTotal, budgetTotal, budgetSpent, totalLiabilities = 0, totalAssets = 0, avgLoanRate = 0 } = input

  // 1. 저축률 점수 (0~100)
  let savings = 0
  if (incomeTotal > 0) {
    const savingsRate = ((incomeTotal - expenseTotal) / incomeTotal) * 100
    // 저축률 50% → 100점, 20% → 70점, 0% → 30점, 마이너스 → 0점
    if (savingsRate >= 50) savings = 100
    else if (savingsRate >= 0) savings = Math.round(30 + (savingsRate / 50) * 70)
    else savings = 0
  }

  // 2. 지출 관리 점수 (0~100)
  let spending = 70 // 기본값 (예산 미설정 시)
  if (budgetTotal && budgetTotal > 0 && budgetSpent !== undefined) {
    const usageRate = budgetSpent / budgetTotal
    if (usageRate <= 0.8) spending = 100
    else if (usageRate <= 1.0) spending = Math.round(100 - (usageRate - 0.8) * 250)
    else spending = Math.max(0, Math.round(50 - (usageRate - 1.0) * 100))
  }

  // 3. 부채 점수 (0~100)
  let debt = 100 // 기본값 (부채 없으면 만점)
  if (totalLiabilities > 0) {
    // 부채 비율 점수 (자산 대비)
    const debtRatio = totalAssets > 0 ? totalLiabilities / totalAssets : 2
    let ratioScore = 100
    if (debtRatio > 1) ratioScore = 20
    else if (debtRatio > 0.5) ratioScore = Math.round(60 - (debtRatio - 0.5) * 80)
    else ratioScore = Math.round(100 - debtRatio * 80)

    // 이자율 점수
    let rateScore = 100
    if (avgLoanRate > 10) rateScore = 20
    else if (avgLoanRate > 5) rateScore = Math.round(80 - (avgLoanRate - 5) * 12)
    else if (avgLoanRate > 0) rateScore = Math.round(100 - avgLoanRate * 4)

    debt = Math.round(ratioScore * 0.6 + rateScore * 0.4)
  }

  // 4. 종합 점수 (가중 평균)
  const overall = Math.round(savings * 0.4 + spending * 0.3 + debt * 0.3)

  // 5. 등급
  let grade: string
  if (overall >= 90) grade = 'A+'
  else if (overall >= 80) grade = 'A'
  else if (overall >= 70) grade = 'B+'
  else if (overall >= 60) grade = 'B'
  else if (overall >= 50) grade = 'C+'
  else if (overall >= 40) grade = 'C'
  else if (overall >= 30) grade = 'D'
  else grade = 'F'

  return { savings, spending, debt, overall, grade }
}
```

**Step 4: 테스트 실행 — 성공 확인**

```bash
cd frontend && npx vitest run src/utils/__tests__/healthScore.test.ts
```

Expected: PASS

**Step 5: 커밋**

```bash
git add frontend/src/utils/healthScore.ts frontend/src/utils/__tests__/healthScore.test.ts
git commit -m "feat: 재정 건강 점수 계산 유틸리티 + 테스트"
```

---

### Task 8: 프론트엔드 — FinancialHealthScore 컴포넌트

재정 건강 점수를 시각적으로 표시하는 컴포넌트를 만든다. 종합 점수 + 등급 + 세부 항목 바.

**Files:**
- Create: `frontend/src/components/stats/FinancialHealthScore.tsx`
- Create: `frontend/src/components/stats/__tests__/FinancialHealthScore.test.tsx`

**Step 1: 테스트 작성**

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import FinancialHealthScore from '../FinancialHealthScore'

describe('FinancialHealthScore', () => {
  const mockScore = {
    savings: 85,
    spending: 72,
    debt: 90,
    overall: 82,
    grade: 'A',
  }

  it('종합 점수와 등급을 표시한다', () => {
    render(<FinancialHealthScore score={mockScore} />)
    expect(screen.getByText('82')).toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('세부 항목(저축, 지출, 부채)을 표시한다', () => {
    render(<FinancialHealthScore score={mockScore} />)
    expect(screen.getByText('저축')).toBeInTheDocument()
    expect(screen.getByText('지출 관리')).toBeInTheDocument()
    expect(screen.getByText('부채')).toBeInTheDocument()
  })

  it('score가 null이면 null을 반환한다', () => {
    const { container } = render(<FinancialHealthScore score={null} />)
    expect(container.firstChild).toBeNull()
  })
})
```

**Step 2: 테스트 실행 — 실패 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/FinancialHealthScore.test.tsx
```

Expected: FAIL

**Step 3: 구현**

`frontend/src/components/stats/FinancialHealthScore.tsx`:

```tsx
import type { HealthScore } from '../../types'

interface FinancialHealthScoreProps {
  score: HealthScore | null
}

function getGradeColor(grade: string): string {
  if (grade.startsWith('A')) return 'text-leaf-600'
  if (grade.startsWith('B')) return 'text-grape-600'
  if (grade.startsWith('C')) return 'text-amber-600'
  return 'text-red-600'
}

function getBarColor(value: number): string {
  if (value >= 80) return 'bg-leaf-500'
  if (value >= 60) return 'bg-grape-500'
  if (value >= 40) return 'bg-amber-500'
  return 'bg-red-500'
}

const LABELS = [
  { key: 'savings' as const, label: '저축' },
  { key: 'spending' as const, label: '지출 관리' },
  { key: 'debt' as const, label: '부채' },
]

export default function FinancialHealthScore({ score }: FinancialHealthScoreProps) {
  if (!score) return null

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-warm-200/60 p-4">
      <h3 className="text-sm font-semibold text-warm-700 mb-3">재정 건강 점수</h3>

      {/* 종합 점수 + 등급 */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative w-16 h-16">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f0ec" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15.9" fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray={`${score.overall} ${100 - score.overall}`}
              className={getGradeColor(score.grade)}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-warm-900">
            {score.overall}
          </span>
        </div>
        <div>
          <span className={`text-2xl font-bold ${getGradeColor(score.grade)}`}>{score.grade}</span>
          <p className="text-xs text-warm-500 mt-0.5">100점 만점</p>
        </div>
      </div>

      {/* 세부 항목 */}
      <div className="space-y-2">
        {LABELS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-xs text-warm-600 w-14 shrink-0">{label}</span>
            <div className="flex-1 h-2 bg-warm-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getBarColor(score[key])}`}
                style={{ width: `${score[key]}%` }}
              />
            </div>
            <span className="text-xs font-medium text-warm-700 w-8 text-right">{score[key]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Step 4: 테스트 실행 — 성공 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/FinancialHealthScore.test.tsx
```

Expected: PASS

**Step 5: 커밋**

```bash
git add frontend/src/components/stats/FinancialHealthScore.tsx frontend/src/components/stats/__tests__/FinancialHealthScore.test.tsx
git commit -m "feat: 재정 건강 점수 표시 컴포넌트 + 테스트"
```

---

### Task 9: 프론트엔드 — AssetChangeSummary 컴포넌트

전월 대비 순자산 변동 + 유형별 증감을 표시한다. 자산 미등록 시 CTA를 보여준다.

**Files:**
- Create: `frontend/src/components/stats/AssetChangeSummary.tsx`
- Create: `frontend/src/components/stats/__tests__/AssetChangeSummary.test.tsx`

**Step 1: 테스트 작성**

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AssetChangeSummary from '../AssetChangeSummary'

describe('AssetChangeSummary', () => {
  const mockSummary = {
    net_worth: 85000000,
    total_assets: 100000000,
    total_liabilities: 15000000,
    breakdown: { stock_kr: 30000000, deposit: 50000000, real_estate: 20000000 },
    total_profit_loss: 2000000,
    total_profit_loss_pct: 2.4,
  }

  const mockPrevSnapshot = {
    snapshot_date: '2026-02-28',
    total_assets: 97000000,
    total_liabilities: 14000000,
    net_worth: 83000000,
    breakdown: { stock_kr: 28000000, deposit: 49000000, real_estate: 20000000 },
  }

  it('순자산과 변동액을 표시한다', () => {
    render(
      <MemoryRouter>
        <AssetChangeSummary summary={mockSummary} previousSnapshot={mockPrevSnapshot} />
      </MemoryRouter>
    )
    expect(screen.getByText('자산 변동')).toBeInTheDocument()
    // 순자산 8500만원 표시
    expect(screen.getByText(/8,500만원/)).toBeInTheDocument()
  })

  it('summary가 null이면 CTA를 표시한다', () => {
    render(
      <MemoryRouter>
        <AssetChangeSummary summary={null} previousSnapshot={null} />
      </MemoryRouter>
    )
    expect(screen.getByText(/자산을 등록/)).toBeInTheDocument()
  })

  it('previousSnapshot이 없으면 변동률을 표시하지 않는다', () => {
    render(
      <MemoryRouter>
        <AssetChangeSummary summary={mockSummary} previousSnapshot={null} />
      </MemoryRouter>
    )
    expect(screen.getByText('자산 변동')).toBeInTheDocument()
    expect(screen.queryByText(/전월 대비/)).not.toBeInTheDocument()
  })
})
```

**Step 2: 테스트 실행 — 실패 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/AssetChangeSummary.test.tsx
```

**Step 3: 구현**

`frontend/src/components/stats/AssetChangeSummary.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { TrendingUp, TrendingDown } from 'lucide-react'
import type { AssetSummary, AssetSnapshot } from '../../types'
import { formatAmount } from '../../utils/format'

interface AssetChangeSummaryProps {
  summary: AssetSummary | null
  previousSnapshot: AssetSnapshot | null
}

const TYPE_LABELS: Record<string, string> = {
  stock_kr: '국내주식',
  stock_us: '해외주식',
  crypto: '암호화폐',
  deposit: '예적금',
  real_estate: '부동산',
  other: '기타',
  loan: '대출',
}

export default function AssetChangeSummary({ summary, previousSnapshot }: AssetChangeSummaryProps) {
  if (!summary) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-warm-200/60 p-4 text-center">
        <p className="text-sm text-warm-500 mb-2">자산을 등록하면 더 풍부한 리포트를 볼 수 있어요</p>
        <Link to="/assets" className="text-sm font-medium text-grape-600 hover:text-grape-700">
          자산 등록하기 →
        </Link>
      </div>
    )
  }

  const change = previousSnapshot
    ? summary.net_worth - previousSnapshot.net_worth
    : null
  const changeRate = previousSnapshot && previousSnapshot.net_worth !== 0
    ? ((change ?? 0) / Math.abs(previousSnapshot.net_worth)) * 100
    : null

  // 유형별 증감 (이전 스냅샷이 있을 때만)
  const typeChanges = previousSnapshot?.breakdown
    ? Object.entries(summary.breakdown)
        .map(([type, amount]) => ({
          type,
          label: TYPE_LABELS[type] || type,
          current: amount,
          previous: previousSnapshot.breakdown?.[type] ?? 0,
          change: amount - (previousSnapshot.breakdown?.[type] ?? 0),
        }))
        .filter(tc => tc.current > 0 || tc.previous > 0)
        .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    : []

  // 만원/억원 포맷
  const formatLargeAmount = (amount: number): string => {
    const abs = Math.abs(amount)
    if (abs >= 100000000) return `${(amount / 100000000).toFixed(1)}억원`
    if (abs >= 10000) return `${Math.round(amount / 10000).toLocaleString()}만원`
    return formatAmount(amount)
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-warm-200/60 p-4">
      <h3 className="text-sm font-semibold text-warm-700 mb-3">자산 변동</h3>

      {/* 순자산 */}
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <p className="text-xs text-warm-500">순자산</p>
          <p className="text-xl font-bold text-warm-900">{formatLargeAmount(summary.net_worth)}</p>
        </div>
        {change !== null && (
          <div className={`flex items-center gap-1 ${change >= 0 ? 'text-leaf-600' : 'text-red-500'}`}>
            {change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            <span className="text-sm font-medium">
              전월 대비 {change >= 0 ? '+' : ''}{formatLargeAmount(change)}
            </span>
            {changeRate !== null && (
              <span className="text-xs text-warm-500">
                ({changeRate >= 0 ? '+' : ''}{changeRate.toFixed(1)}%)
              </span>
            )}
          </div>
        )}
      </div>

      {/* 유형별 증감 */}
      {typeChanges.length > 0 && (
        <div className="space-y-1.5 pt-3 border-t border-warm-100">
          {typeChanges.slice(0, 5).map(tc => (
            <div key={tc.type} className="flex items-center justify-between text-xs">
              <span className="text-warm-600">{tc.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-warm-700">{formatLargeAmount(tc.current)}</span>
                {tc.change !== 0 && (
                  <span className={tc.change > 0 ? 'text-leaf-600' : 'text-red-500'}>
                    {tc.change > 0 ? '+' : ''}{formatLargeAmount(tc.change)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

**Step 4: 테스트 실행 — 성공 확인**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/AssetChangeSummary.test.tsx
```

Expected: PASS

**Step 5: 커밋**

```bash
git add frontend/src/components/stats/AssetChangeSummary.tsx frontend/src/components/stats/__tests__/AssetChangeSummary.test.tsx
git commit -m "feat: 자산 변동 요약 컴포넌트 + 테스트"
```

---

### Task 10: 프론트엔드 — CategoryTopList 컴포넌트

상위 지출 카테고리를 비율 바와 함께 표시한다. 기존 `CategoryBreakdown.tsx`을 참고하되, 더 컴팩트하게 만든다.

**Files:**
- Create: `frontend/src/components/stats/CategoryTopList.tsx`
- Create: `frontend/src/components/stats/__tests__/CategoryTopList.test.tsx`

**Step 1: 테스트 작성**

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CategoryTopList from '../CategoryTopList'

describe('CategoryTopList', () => {
  const mockCategories = [
    { category: '식비', amount: 1200000, count: 45, percentage: 37.5 },
    { category: '주거', amount: 800000, count: 1, percentage: 25.0 },
    { category: '교통', amount: 400000, count: 20, percentage: 12.5 },
    { category: '쇼핑', amount: 300000, count: 8, percentage: 9.4 },
    { category: '통신', amount: 200000, count: 3, percentage: 6.3 },
    { category: '기타', amount: 100000, count: 5, percentage: 3.1 },
  ]

  it('상위 5개 카테고리를 표시한다', () => {
    render(<CategoryTopList categories={mockCategories} />)
    expect(screen.getByText('식비')).toBeInTheDocument()
    expect(screen.getByText('주거')).toBeInTheDocument()
    expect(screen.getByText('교통')).toBeInTheDocument()
    expect(screen.getByText('쇼핑')).toBeInTheDocument()
    expect(screen.getByText('통신')).toBeInTheDocument()
    // 6번째는 표시 안 됨
    expect(screen.queryByText('기타')).not.toBeInTheDocument()
  })

  it('빈 배열이면 null을 반환한다', () => {
    const { container } = render(<CategoryTopList categories={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('비율을 퍼센트로 표시한다', () => {
    render(<CategoryTopList categories={mockCategories} />)
    expect(screen.getByText('37.5%')).toBeInTheDocument()
  })
})
```

**Step 2: 구현**

`frontend/src/components/stats/CategoryTopList.tsx`:

```tsx
import type { CategoryStats } from '../../types'
import { formatAmount } from '../../utils/format'

interface CategoryTopListProps {
  categories: CategoryStats[]
  maxItems?: number
}

export default function CategoryTopList({ categories, maxItems = 5 }: CategoryTopListProps) {
  if (categories.length === 0) return null

  const top = categories.slice(0, maxItems)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-warm-200/60 p-4">
      <h3 className="text-sm font-semibold text-warm-700 mb-3">지출 카테고리 TOP</h3>
      <div className="space-y-2.5">
        {top.map((cat, i) => (
          <div key={cat.category}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-warm-400 w-4">{i + 1}</span>
                <span className="text-sm font-medium text-warm-800">{cat.category}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-warm-700">{formatAmount(cat.amount)}</span>
                <span className="text-xs text-warm-500 w-12 text-right">{cat.percentage.toFixed(1)}%</span>
              </div>
            </div>
            <div className="h-1.5 bg-warm-100 rounded-full overflow-hidden ml-6">
              <div
                className="h-full rounded-full bg-grape-500"
                style={{ width: `${cat.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Step 3: 테스트 실행**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/CategoryTopList.test.tsx
```

Expected: PASS

**Step 4: 커밋**

```bash
git add frontend/src/components/stats/CategoryTopList.tsx frontend/src/components/stats/__tests__/CategoryTopList.test.tsx
git commit -m "feat: 지출 카테고리 TOP 컴포넌트 + 테스트"
```

---

### Task 11: 프론트엔드 — StructuredInsightsView 컴포넌트

LLM이 반환한 구조화된 인사이트(findings, asset_analysis, action_items)를 표시한다. 면책 조항도 포함.

**Files:**
- Create: `frontend/src/components/stats/StructuredInsightsView.tsx`
- Create: `frontend/src/components/stats/__tests__/StructuredInsightsView.test.tsx`

**Step 1: 테스트 작성**

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StructuredInsightsView from '../StructuredInsightsView'
import type { StructuredInsights } from '../../../types'

describe('StructuredInsightsView', () => {
  const mockInsights: StructuredInsights = {
    findings: [
      {
        what: '식비가 전체 지출의 37.5%를 차지합니다',
        so_what: '전국 평균 대비 높은 수준입니다',
        now_what: '주 2회 도시락을 준비해보세요',
      },
    ],
    asset_analysis: {
      summary: '순자산 8,500만원',
      allocation_analysis: '예적금 비중이 높습니다',
      diversification_tip: '장기적으로 분산 투자를 고려하세요',
    },
    action_items: [
      { title: '식비 예산 설정', description: '월 100만원 이내로 관리해보세요' },
    ],
    encouragement: '저축률 36%는 매우 우수합니다!',
  }

  it('핵심 발견을 What/So What/Now What으로 표시한다', () => {
    render(<StructuredInsightsView insights={mockInsights} />)
    expect(screen.getByText(/식비가 전체 지출의/)).toBeInTheDocument()
    expect(screen.getByText(/전국 평균/)).toBeInTheDocument()
    expect(screen.getByText(/도시락/)).toBeInTheDocument()
  })

  it('자산 분석을 표시한다', () => {
    render(<StructuredInsightsView insights={mockInsights} />)
    expect(screen.getByText(/순자산/)).toBeInTheDocument()
    expect(screen.getByText(/분산 투자/)).toBeInTheDocument()
  })

  it('액션 아이템을 표시한다', () => {
    render(<StructuredInsightsView insights={mockInsights} />)
    expect(screen.getByText('식비 예산 설정')).toBeInTheDocument()
  })

  it('격려 메시지를 표시한다', () => {
    render(<StructuredInsightsView insights={mockInsights} />)
    expect(screen.getByText(/저축률 36%/)).toBeInTheDocument()
  })

  it('면책 조항을 표시한다', () => {
    render(<StructuredInsightsView insights={mockInsights} />)
    expect(screen.getByText(/투자 자문이 아닙니다/)).toBeInTheDocument()
  })

  it('asset_analysis가 null이면 자산 분석 섹션을 숨긴다', () => {
    const noAsset = { ...mockInsights, asset_analysis: null }
    render(<StructuredInsightsView insights={noAsset} />)
    expect(screen.queryByText('자산 분석')).not.toBeInTheDocument()
  })
})
```

**Step 2: 구현**

`frontend/src/components/stats/StructuredInsightsView.tsx`:

```tsx
import { Lightbulb, Target, TrendingUp, Info } from 'lucide-react'
import type { StructuredInsights } from '../../types'

interface StructuredInsightsViewProps {
  insights: StructuredInsights
}

export default function StructuredInsightsView({ insights }: StructuredInsightsViewProps) {
  return (
    <div className="space-y-4">
      {/* 격려 메시지 */}
      {insights.encouragement && (
        <div className="bg-leaf-50 rounded-xl p-3 text-sm text-leaf-700">
          {insights.encouragement}
        </div>
      )}

      {/* 핵심 발견 */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-warm-700 flex items-center gap-1.5">
          <Lightbulb className="w-4 h-4 text-grape-500" />
          핵심 발견
        </h4>
        {insights.findings.map((f, i) => (
          <div key={i} className="bg-warm-50 rounded-xl p-3 space-y-1.5">
            <p className="text-sm font-medium text-warm-800">{f.what}</p>
            <p className="text-xs text-warm-600">{f.so_what}</p>
            <p className="text-xs text-grape-600 font-medium">→ {f.now_what}</p>
          </div>
        ))}
      </div>

      {/* 자산 분석 */}
      {insights.asset_analysis && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-warm-700 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-grape-500" />
            자산 분석
          </h4>
          <div className="bg-warm-50 rounded-xl p-3 space-y-1.5">
            <p className="text-sm font-medium text-warm-800">{insights.asset_analysis.summary}</p>
            <p className="text-xs text-warm-600">{insights.asset_analysis.allocation_analysis}</p>
            <p className="text-xs text-warm-500 italic">{insights.asset_analysis.diversification_tip}</p>
          </div>
        </div>
      )}

      {/* 액션 아이템 */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-warm-700 flex items-center gap-1.5">
          <Target className="w-4 h-4 text-grape-500" />
          이번 달 액션
        </h4>
        <div className="space-y-2">
          {insights.action_items.map((item, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="shrink-0 w-5 h-5 rounded-full bg-grape-100 text-grape-600 text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-medium text-warm-800">{item.title}</p>
                <p className="text-xs text-warm-600">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 면책 조항 */}
      <div className="flex items-start gap-1.5 pt-2 border-t border-warm-100">
        <Info className="w-3.5 h-3.5 text-warm-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-warm-400 leading-relaxed">
          이 정보는 일반적인 재무 정보이며, 개인 맞춤 투자 자문이 아닙니다. 투자 결정은 전문가와 상담하세요.
        </p>
      </div>
    </div>
  )
}
```

**Step 3: 테스트 실행**

```bash
cd frontend && npx vitest run src/components/stats/__tests__/StructuredInsightsView.test.tsx
```

Expected: PASS

**Step 4: 커밋**

```bash
git add frontend/src/components/stats/StructuredInsightsView.tsx frontend/src/components/stats/__tests__/StructuredInsightsView.test.tsx
git commit -m "feat: 구조화된 AI 인사이트 표시 컴포넌트 + 테스트"
```

---

### Task 12: 프론트엔드 — 종합 요약 카드 확장

기존 `UnifiedSummaryCards`를 확장하여 순자산 카드를 추가한다. 자산 데이터가 없으면 기존 4카드만 표시.

**Files:**
- Modify: `frontend/src/components/stats/UnifiedSummaryCards.tsx`

**Step 1: Props 확장**

```typescript
interface UnifiedSummaryCardsProps {
  incomeTotal: number
  expenseTotal: number
  netWorth?: number | null           // 추가
  prevNetWorth?: number | null       // 추가
  prevIncome?: number | null         // 추가
  prevExpense?: number | null        // 추가
}
```

**Step 2: 카드 배열에 순자산 카드 추가**

순자산이 있으면 첫 번째 카드로 추가. 전월 대비 변동률 표시:

```tsx
// 순자산 카드 (자산 데이터가 있을 때만)
{netWorth != null && (
  <div className="bg-gradient-to-br from-warm-50 to-warm-100 rounded-xl p-3 text-center">
    <p className="text-xs text-warm-500 mb-0.5">순자산</p>
    <p className="text-lg font-bold text-warm-900">{formatLargeAmount(netWorth)}</p>
    {prevNetWorth != null && prevNetWorth !== 0 && (
      <ChangeIndicator current={netWorth} previous={prevNetWorth} />
    )}
  </div>
)}
```

그리고 기존 수입/지출/순수익/저축률 카드에도 전월 대비 변동을 작은 텍스트로 표시:

```tsx
// 수입 카드에 전월 대비 추가
{prevIncome != null && prevIncome > 0 && (
  <p className="text-[10px] text-warm-400 mt-0.5">
    전월 {((incomeTotal - prevIncome) / prevIncome * 100).toFixed(0)}%
  </p>
)}
```

**Step 3: 그리드 레이아웃 조정**

순자산이 있으면 첫 줄에 순자산 카드를 전체 너비(col-span-2)로 표시하고, 나머지 4카드는 아래:

```tsx
<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
  {netWorth != null && (
    <div className="col-span-2 lg:col-span-4 ...">순자산</div>
  )}
  {/* 기존 4 카드 */}
</div>
```

**Step 4: 기존 테스트 확인**

기존 `UnifiedSummaryCards` 테스트가 있다면 확인하고, 새 props 없이도 기존 동작이 유지되는지 확인.

```bash
cd frontend && npx vitest run --grep "UnifiedSummaryCards"
```

**Step 5: 커밋**

```bash
git add frontend/src/components/stats/UnifiedSummaryCards.tsx
git commit -m "feat: 종합 요약 카드에 순자산/전월 대비 변동 추가"
```

---

### Task 13: 프론트엔드 — MSW 핸들러 및 픽스처 업데이트

새 API 엔드포인트와 자산 API에 대한 MSW 핸들러를 추가한다.

**Files:**
- Modify: `frontend/src/mocks/fixtures.ts`
- Modify: `frontend/src/mocks/handlers.ts`

**Step 1: 자산 관련 픽스처 추가**

`fixtures.ts`에 추가:

```typescript
import type { AssetSummary, AssetSnapshot, StructuredInsights } from '../types'

export const mockAssetSummary: AssetSummary = {
  total_assets: 100000000,
  total_liabilities: 15000000,
  net_worth: 85000000,
  breakdown: {
    stock_kr: 30000000,
    deposit: 50000000,
    real_estate: 20000000,
  },
  total_profit_loss: 2000000,
  total_profit_loss_pct: 2.4,
}

export const mockAssetSnapshots: AssetSnapshot[] = [
  {
    snapshot_date: '2026-02-28',
    total_assets: 97000000,
    total_liabilities: 14000000,
    net_worth: 83000000,
    breakdown: { stock_kr: 28000000, deposit: 49000000, real_estate: 20000000 },
  },
  {
    snapshot_date: '2026-03-31',
    total_assets: 100000000,
    total_liabilities: 15000000,
    net_worth: 85000000,
    breakdown: { stock_kr: 30000000, deposit: 50000000, real_estate: 20000000 },
  },
]

export const mockStructuredInsights: StructuredInsights = {
  findings: [
    {
      what: '식비가 전체 지출의 37.5%를 차지합니다',
      so_what: '전국 평균(30%) 대비 높은 수준입니다',
      now_what: '주 2회 도시락을 준비하면 월 20만원 절약 가능합니다',
    },
    {
      what: '순자산이 전월 대비 200만원 증가했습니다',
      so_what: '꾸준한 저축과 투자 수익이 반영된 결과입니다',
      now_what: '현재 페이스를 유지하세요',
    },
  ],
  asset_analysis: {
    summary: '순자산 8,500만원으로 전월 대비 2.4% 증가',
    allocation_analysis: '예적금 비중이 59%로 안정적이나, 성장 자산 비중을 점진적으로 늘려볼 수 있습니다',
    diversification_tip: '일반적으로 연령과 위험 허용도에 따라 자산을 분산하는 것이 권장됩니다',
  },
  action_items: [
    { title: '식비 예산 100만원 설정', description: '이번 달 식비를 100만원 이내로 관리해보세요' },
    { title: '비상금 확인', description: '월 생활비 3~6개월치 비상금이 확보되어 있는지 점검하세요' },
  ],
  encouragement: '저축률 36%는 매우 우수합니다! 이 습관을 유지하세요 💪',
}
```

**Step 2: 자산 API 핸들러 추가**

`handlers.ts`에 추가:

```typescript
import { mockAssetSummary, mockAssetSnapshots, mockStructuredInsights } from './fixtures'

// ==================== 자산 API ====================

http.get(`${BASE_URL}/assets/summary`, () => {
  return HttpResponse.json(mockAssetSummary)
}),

http.get(`${BASE_URL}/assets/snapshots`, () => {
  return HttpResponse.json(mockAssetSnapshots)
}),

// ==================== 종합 인사이트 API ====================

http.post(`${BASE_URL}/insights/generate-comprehensive`, () => {
  return HttpResponse.json({
    month: '2026-03',
    insights: mockStructuredInsights,
  })
}),
```

**Step 3: 커밋**

```bash
git add frontend/src/mocks/fixtures.ts frontend/src/mocks/handlers.ts
git commit -m "chore: 자산/종합 인사이트 MSW 핸들러 및 픽스처 추가"
```

---

### Task 14: 프론트엔드 — InsightsPage 리라이트

기존 InsightsPage를 월간 전용 종합 재무 리포트로 완전히 리라이트한다.

**Files:**
- Modify: `frontend/src/pages/InsightsPage.tsx`

**Step 1: 기존 내용 전체 교체**

새 InsightsPage 구조:

```tsx
/**
 * @file InsightsPage.tsx
 * @description 종합 재무 리포트 페이지 (월간)
 * 종합 요약 → 지출 카테고리 TOP → 예산 현황 → 자산 변동 → 이달의 인사이트 → AI 심층 분석
 */

import { useEffect, useState, useCallback } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

// API
import { statsApi, insightsApi } from '../api/insights'
import { incomeApi } from '../api/income'
import { getMonthlyStats } from '../api/budgets'
import { assetApi } from '../api/assets'
import { useHouseholdStore } from '../stores/useHouseholdStore'

// 컴포넌트
import PeriodNavigator from '../components/stats/PeriodNavigator'
import UnifiedSummaryCards from '../components/stats/UnifiedSummaryCards'
import CategoryTopList from '../components/stats/CategoryTopList'
import BudgetVsActual from '../components/stats/BudgetVsActual'
import AssetChangeSummary from '../components/stats/AssetChangeSummary'
import MonthlyHighlights from '../components/stats/MonthlyHighlights'
import FinancialHealthScore from '../components/stats/FinancialHealthScore'
import StructuredInsightsView from '../components/stats/StructuredInsightsView'

// 유틸
import { calculateHealthScore } from '../utils/healthScore'

// 타입
import type {
  StatsResponse, ComparisonResponse, BudgetMonthlyStatsResponse,
  AssetSummary, AssetSnapshot, StructuredInsights, HealthScore,
} from '../types'

// ── 날짜 유틸 ──

function toMonthStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function shiftMonth(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return toMonthStr(d)
}

function getNavLabel(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number)
  return `${y}년 ${m}월`
}

// ── 메인 페이지 ──

export default function InsightsPage() {
  const [monthStr, setMonthStr] = useState(toMonthStr(new Date()))
  const [loading, setLoading] = useState(true)
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)

  // 데이터 상태
  const [expenseStats, setExpenseStats] = useState<StatsResponse | null>(null)
  const [incomeStats, setIncomeStats] = useState<StatsResponse | null>(null)
  const [budgetStats, setBudgetStats] = useState<BudgetMonthlyStatsResponse | null>(null)
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null)
  const [assetSummary, setAssetSummary] = useState<AssetSummary | null>(null)
  const [prevSnapshot, setPrevSnapshot] = useState<AssetSnapshot | null>(null)

  // AI 분석 상태
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null)
  const [structuredInsights, setStructuredInsights] = useState<StructuredInsights | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  // 데이터 로딩
  useEffect(() => {
    let cancelled = false
    async function fetchAll() {
      setLoading(true)
      setStructuredInsights(null)
      try {
        const dateStr = `${monthStr}-15`  // 월 중간 날짜로 stats API 호출
        const hhId = activeHouseholdId ?? undefined

        // 1차 병렬: 지출/수입 통계 + 비교 + 예산 + 자산
        const [expRes, incRes, compRes, budgetRes, assetRes, snapRes] = await Promise.allSettled([
          statsApi.getStats('monthly', dateStr, hhId),
          incomeApi.getStats('monthly', dateStr, hhId),
          statsApi.getComparison('monthly', dateStr, 3, hhId),
          getMonthlyStats(monthStr),
          assetApi.getSummary(hhId),
          assetApi.getSnapshots(hhId, 2),
        ])

        if (cancelled) return

        const exp = expRes.status === 'fulfilled' ? expRes.value.data : null
        const inc = incRes.status === 'fulfilled' ? incRes.value.data : null
        const comp = compRes.status === 'fulfilled' ? compRes.value.data : null
        const budget = budgetRes.status === 'fulfilled' ? budgetRes.value.data : null
        const asset = assetRes.status === 'fulfilled' ? assetRes.value.data : null
        const snaps = snapRes.status === 'fulfilled' ? snapRes.value.data : []

        setExpenseStats(exp)
        setIncomeStats(inc)
        setComparison(comp)
        setBudgetStats(budget)
        setAssetSummary(asset)

        // 이전 스냅샷 (가장 오래된 것)
        const sortedSnaps = (snaps ?? []).sort((a: AssetSnapshot, b: AssetSnapshot) =>
          a.snapshot_date.localeCompare(b.snapshot_date)
        )
        setPrevSnapshot(sortedSnaps.length >= 2 ? sortedSnaps[0] : null)

        // 건강 점수 계산
        if (exp || inc) {
          const avgLoanRate = asset
            ? 0 // TODO: 대출 평균 이자율은 별도 API 필요 시 추가
            : 0
          const score = calculateHealthScore({
            incomeTotal: inc?.total ?? 0,
            expenseTotal: exp?.total ?? 0,
            budgetTotal: budget?.total_budget ?? undefined,
            budgetSpent: budget?.total_spent ?? undefined,
            totalLiabilities: asset?.total_liabilities ?? 0,
            totalAssets: asset?.total_assets ?? 0,
            avgLoanRate,
          })
          setHealthScore(score)
        }
      } catch {
        toast.error('데이터를 불러오는데 실패했습니다')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchAll()
    return () => { cancelled = true }
  }, [monthStr, activeHouseholdId])

  // AI 분석 생성
  const handleGenerateAI = useCallback(async () => {
    if (!expenseStats && !incomeStats) {
      toast.error('분석할 데이터가 없습니다')
      return
    }

    setAiLoading(true)
    try {
      const requestData: Record<string, unknown> = {
        month: monthStr,
        income_total: incomeStats?.total ?? 0,
        expense_total: expenseStats?.total ?? 0,
        top_expense_categories: (expenseStats?.by_category ?? []).slice(0, 5).map(c => ({
          name: c.category,
          amount: c.amount,
          percentage: c.percentage,
        })),
        savings_rate: incomeStats && incomeStats.total > 0
          ? ((incomeStats.total - (expenseStats?.total ?? 0)) / incomeStats.total) * 100
          : 0,
        health_score: healthScore,
        previous_month_expense: comparison?.previous?.total ?? null,
        previous_month_income: null, // 수입 비교는 별도 API 필요
      }

      // 예산 데이터
      if (budgetStats?.total_budget) {
        requestData.budget = {
          total_budget: budgetStats.total_budget,
          total_spent: budgetStats.total_spent,
          over_categories: budgetStats.categories
            .filter(c => c.is_exceeded)
            .map(c => c.category_name),
        }
      }

      // 자산 데이터
      if (assetSummary) {
        requestData.assets = {
          total_assets: assetSummary.total_assets,
          total_liabilities: assetSummary.total_liabilities,
          net_worth: assetSummary.net_worth,
          breakdown: assetSummary.breakdown,
          monthly_change_amount: prevSnapshot
            ? assetSummary.net_worth - prevSnapshot.net_worth
            : 0,
          monthly_change_rate: prevSnapshot && prevSnapshot.net_worth !== 0
            ? ((assetSummary.net_worth - prevSnapshot.net_worth) / Math.abs(prevSnapshot.net_worth)) * 100
            : 0,
        }
      }

      const result = await insightsApi.generateComprehensive(requestData)
      setStructuredInsights(result.insights)
      toast.success('AI 분석이 완료되었습니다')
    } catch {
      toast.error('AI 분석 생성에 실패했습니다')
    } finally {
      setAiLoading(false)
    }
  }, [monthStr, expenseStats, incomeStats, budgetStats, assetSummary, prevSnapshot, healthScore, comparison])

  const handlePrev = useCallback(() => setMonthStr(m => shiftMonth(m, -1)), [])
  const handleNext = useCallback(() => setMonthStr(m => shiftMonth(m, 1)), [])

  return (
    <div className="space-y-4">
      {/* 월 네비게이션 */}
      <PeriodNavigator label={getNavLabel(monthStr)} onPrev={handlePrev} onNext={handleNext} />

      {/* 로딩 */}
      {loading && (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-8 h-8 animate-spin text-grape-600" />
        </div>
      )}

      {!loading && (
        <>
          {/* 1. 종합 요약 */}
          {(expenseStats || incomeStats) && (
            <UnifiedSummaryCards
              incomeTotal={incomeStats?.total ?? 0}
              expenseTotal={expenseStats?.total ?? 0}
              netWorth={assetSummary?.net_worth ?? null}
              prevNetWorth={prevSnapshot?.net_worth ?? null}
              prevIncome={comparison?.previous?.total ? null : null}
              prevExpense={comparison?.previous?.total ?? null}
            />
          )}

          {/* 2. 지출 카테고리 TOP */}
          <CategoryTopList categories={expenseStats?.by_category ?? []} />

          {/* 3. 예산 현황 */}
          <BudgetVsActual budgetStats={budgetStats} />

          {/* 4. 자산 변동 */}
          <AssetChangeSummary summary={assetSummary} previousSnapshot={prevSnapshot} />

          {/* 5. 이달의 인사이트 */}
          {expenseStats && incomeStats && (
            <MonthlyHighlights
              incomeTotal={incomeStats.total}
              expenseTotal={expenseStats.total}
              budgetStats={budgetStats}
              comparison={comparison}
            />
          )}

          {/* 6. AI 심층 분석 */}
          <div className="bg-white rounded-2xl shadow-sm border border-warm-200/60 p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-grape-600" />
                <h2 className="text-base font-semibold text-warm-900">AI 심층 분석</h2>
              </div>
              {!structuredInsights && (
                <button
                  onClick={handleGenerateAI}
                  disabled={aiLoading}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700 disabled:bg-warm-400 disabled:cursor-not-allowed transition-colors"
                >
                  {aiLoading ? '분석 중...' : '분석하기'}
                </button>
              )}
            </div>

            {/* 건강 점수 (항상 표시) */}
            <FinancialHealthScore score={healthScore} />

            {/* AI 로딩 */}
            {aiLoading && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="animate-spin h-8 w-8 text-grape-600" />
                <p className="text-sm text-warm-600">AI가 재무 데이터를 분석하고 있습니다...</p>
              </div>
            )}

            {/* 구조화된 AI 인사이트 */}
            {!aiLoading && structuredInsights && (
              <div className="mt-4">
                <StructuredInsightsView insights={structuredInsights} />
              </div>
            )}

            {/* 분석 전 안내 */}
            {!aiLoading && !structuredInsights && (
              <p className="text-sm text-warm-500 mt-3">
                AI가 수입, 지출, 예산, 자산을 종합 분석하여 맞춤 인사이트를 제공합니다.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
```

**Step 2: 빌드 확인**

```bash
cd frontend && npm run build
```

Expected: 성공 (타입 에러 없음)

**Step 3: 커밋**

```bash
git add frontend/src/pages/InsightsPage.tsx
git commit -m "feat: InsightsPage를 월간 종합 재무 리포트로 리라이트"
```

---

### Task 15: 프론트엔드 — InsightsPage 테스트 업데이트

기존 `InsightsPage.test.tsx`를 새 구조에 맞게 리라이트한다.

**Files:**
- Modify: `frontend/src/pages/__tests__/InsightsPage.test.tsx`

**Step 1: 테스트 리라이트**

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InsightsPage from '../InsightsPage'

vi.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="mock-line-chart" />,
  Bar: () => <div data-testid="mock-bar-chart" />,
  Chart: () => <div data-testid="mock-chart" />,
}))

vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  CategoryScale: class {},
  LinearScale: class {},
  BarElement: class {},
  LineElement: class {},
  PointElement: class {},
  BarController: class {},
  LineController: class {},
  Legend: class {},
  Tooltip: class {},
  Filler: class {},
}))

vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: (selector: (s: { activeHouseholdId: null }) => unknown) =>
    selector({ activeHouseholdId: null }),
}))

describe('InsightsPage', () => {
  it('로딩 완료 후 종합 요약 카드를 표시한다', async () => {
    render(<InsightsPage />)
    await waitFor(() => {
      expect(screen.getByText('총 수입')).toBeInTheDocument()
    })
    expect(screen.getByText('총 지출')).toBeInTheDocument()
  })

  it('월 네비게이션이 표시된다', async () => {
    render(<InsightsPage />)
    await waitFor(() => {
      // 현재 월이 표시됨
      const now = new Date()
      expect(screen.getByText(`${now.getFullYear()}년 ${now.getMonth() + 1}월`)).toBeInTheDocument()
    })
  })

  it('지출 카테고리 TOP이 표시된다', async () => {
    render(<InsightsPage />)
    await waitFor(() => {
      expect(screen.getByText('지출 카테고리 TOP')).toBeInTheDocument()
    })
  })

  it('AI 심층 분석 버튼이 표시된다', async () => {
    render(<InsightsPage />)
    await waitFor(() => {
      expect(screen.getByText('AI 심층 분석')).toBeInTheDocument()
    })
    expect(screen.getByText('분석하기')).toBeInTheDocument()
  })

  it('AI 분석 버튼 클릭 시 로딩 후 결과가 표시된다', async () => {
    const user = userEvent.setup()
    render(<InsightsPage />)

    await waitFor(() => {
      expect(screen.getByText('분석하기')).toBeInTheDocument()
    })

    await user.click(screen.getByText('분석하기'))

    await waitFor(() => {
      // 구조화된 인사이트가 표시됨
      expect(screen.getByText('핵심 발견')).toBeInTheDocument()
    })
  })

  it('주간/연간 토글이 없다 (월간 전용)', async () => {
    render(<InsightsPage />)
    await waitFor(() => {
      expect(screen.queryByText('주간')).not.toBeInTheDocument()
      expect(screen.queryByText('연간')).not.toBeInTheDocument()
    })
  })
})
```

**Step 2: 테스트 실행**

```bash
cd frontend && npx vitest run src/pages/__tests__/InsightsPage.test.tsx
```

Expected: PASS

**Step 3: 커밋**

```bash
git add frontend/src/pages/__tests__/InsightsPage.test.tsx
git commit -m "test: InsightsPage 테스트를 월간 종합 리포트 구조에 맞게 업데이트"
```

---

### Task 16: 전체 테스트 + 빌드 + 린트 확인

**Step 1: 프론트엔드 린트**

```bash
cd frontend && npm run lint
```

**Step 2: 프론트엔드 전체 테스트**

```bash
cd frontend && npm run test:run
```

**Step 3: 프론트엔드 빌드**

```bash
cd frontend && npm run build
```

**Step 4: 백엔드 린트**

```bash
cd backend && ruff check --fix . && ruff format .
```

**Step 5: 백엔드 테스트**

```bash
cd backend && pytest --ignore=tests/integration/test_api_budget_bulk.py
```

모두 통과하면 완료.

**Step 6: 커밋 (필요 시)**

```bash
git commit -m "chore: 종합 리포트 개편 후 전체 테스트/빌드 통과 확인"
```

---

### Task 17: 미사용 stats 컴포넌트 정리

리포트 개편으로 더 이상 사용되지 않는 컴포넌트를 정리한다.

**Files:**
- Delete candidates (사용 여부 확인 후):
  - `frontend/src/components/stats/ComparisonChart.tsx`
  - `frontend/src/components/stats/StatsSummaryCards.tsx`
  - `frontend/src/components/stats/TrendChart.tsx`
  - `frontend/src/components/stats/CombinedTrendChart.tsx` (InsightsPage에서 제거된 경우)

**Step 1: 각 컴포넌트의 import 여부 확인**

```bash
cd frontend && grep -r 'ComparisonChart\|StatsSummaryCards\|TrendChart\|CombinedTrendChart' src/ --include='*.tsx' --include='*.ts' -l
```

InsightsPage에서만 사용되고, 새 InsightsPage에서 import하지 않는 컴포넌트를 삭제.

**Step 2: 파일 삭제 + 관련 테스트 삭제**

**Step 3: 커밋**

```bash
git add -u
git commit -m "chore: 리포트 개편으로 미사용된 stats 컴포넌트 정리"
```

---

### Task 18: 문서 업데이트

**Files:**
- Modify: `CLAUDE.md` — InsightsPage 설명 업데이트
- Modify: `frontend/src/pages/GuidePage.tsx` — 리포트 관련 안내 업데이트
- Modify: `frontend/src/data/changelogs.ts` — 새소식 추가

**Step 1: CLAUDE.md 업데이트**

Pages 목록에서 InsightsPage 설명을 "종합 재무 리포트 (월간)" 으로 변경. 컴포넌트 목록에 새 컴포넌트 추가.

**Step 2: GuidePage 업데이트**

리포트 관련 안내에 "자산 정보를 연동하면 더 풍부한 분석을 받을 수 있어요" 추가.

**Step 3: changelogs.ts 업데이트**

```typescript
{
  version: '1.x.0',
  date: '2026-03-14',
  title: '종합 재무 리포트 개편',
  items: [
    { tag: '개선', text: '리포트에서 수입, 지출, 자산을 한눈에 볼 수 있습니다' },
    { tag: '신규', text: '재정 건강 점수로 재무 상태를 한눈에 파악할 수 있습니다' },
    { tag: '개선', text: 'AI 심층 분석이 구조화된 인사이트로 개선되었습니다' },
  ],
},
```

**Step 4: 커밋**

```bash
git commit -m "docs: 종합 재무 리포트 개편에 따른 문서 업데이트"
```
