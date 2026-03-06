# Phase 3: 재무 인사이트/조언 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 규칙 기반 재무 수치 요약 + LLM 기반 맞춤 재무 조언. 자산/부채, 저축 목표, 지출/수입 데이터를 종합하여 인사이트 제공.

**Architecture:** 기존 insights API 확장. 규칙 기반 계산은 서비스 함수로 구현, LLM 조언은 기존 LLMProvider 패턴 재사용. 프론트엔드는 기존 인사이트 페이지에 "자산/저축" 탭 추가.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, React 19, Tailwind CSS v4 (Grape), Recharts, LLMProvider (Anthropic/OpenAI)

**선행 조건:** Phase 1 (자산/부채) + Phase 2 (저축 목표) 완료

---

### Task 1: 재무 인사이트 서비스

**Files:**
- Create: `backend/app/services/financial_insight_service.py`

**Step 1: 규칙 기반 인사이트 계산**

```python
# backend/app/services/financial_insight_service.py
"""재무 인사이트 서비스 — 규칙 기반 수치 + LLM 조언"""
import json
from datetime import date, timedelta

from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.asset import Asset
from app.models.expense import Expense
from app.models.income import Income
from app.models.user import User
from app.services.asset_service import get_asset_summary
from app.services.goal_service import get_goals, calculate_goal, get_goals_summary
from app.services.llm_service import get_llm_provider


async def get_financial_summary(db: AsyncSession, user: User, household_id: int | None = None) -> dict:
    """규칙 기반 재무 수치 요약

    Returns:
        {
            asset_summary: {total_assets, total_liabilities, net_worth, breakdown, ...},
            debt_ratio: float | None,
            savings_speed: {...},
            goal_projections: [...],
            monthly_cashflow: {...},
        }
    """
    # 1. 자산/부채 현황
    asset_summary = await get_asset_summary(db, user, household_id)

    # 2. 부채 비율
    debt_ratio = None
    if asset_summary["total_assets"] > 0:
        debt_ratio = round(asset_summary["total_liabilities"] / asset_summary["total_assets"] * 100, 1)

    # 3. 자산 배분 현황 (비중 %)
    allocation = {}
    total_a = asset_summary["total_assets"]
    if total_a > 0:
        for asset_type, value in asset_summary["breakdown"].items():
            allocation[asset_type] = round(value / total_a * 100, 1)

    # 4. 목표별 진행 상황
    goals = await get_goals(db, user, household_id)
    goal_projections = []
    for goal in goals:
        calc = await calculate_goal(db, goal)
        goal_projections.append({
            "name": goal.name,
            "target_amount": float(goal.target_amount),
            "target_date": goal.target_date.isoformat(),
            "achievement_pct": calc["achievement_pct"],
            "required_monthly_savings": calc["required_monthly_savings"],
            "required_annual_return_pct": calc["required_annual_return_pct"],
            "estimated_completion_date": calc["estimated_completion_date"].isoformat() if calc.get("estimated_completion_date") else None,
            "on_track": calc.get("estimated_completion_date") is not None and calc["estimated_completion_date"] <= goal.target_date if calc.get("estimated_completion_date") else None,
        })

    # 5. 월별 캐시플로우 (최근 3개월)
    monthly_cashflow = await _get_monthly_cashflow(db, user, household_id)

    # 6. 저축 여력
    goals_summary = await get_goals_summary(db, user, household_id)

    # 7. 카테고리별 지출 상위 5개 (최근 3개월)
    top_expenses = await _get_top_expense_categories(db, user, household_id)

    return {
        "asset_summary": asset_summary,
        "debt_ratio": debt_ratio,
        "asset_allocation": allocation,
        "goal_projections": goal_projections,
        "monthly_cashflow": monthly_cashflow,
        "savings_summary": {
            "total_required_monthly": goals_summary["total_required_monthly_savings"],
            "monthly_capacity": goals_summary["monthly_savings_capacity"],
            "gap": goals_summary["savings_gap"],
        },
        "top_expense_categories": top_expenses,
    }


async def _get_monthly_cashflow(db: AsyncSession, user: User, household_id: int | None) -> dict:
    """최근 3개월 월별 수입/지출/순수익"""
    today = date.today()
    months = []

    for i in range(3):
        # i개월 전
        year = today.year
        month = today.month - i
        if month <= 0:
            month += 12
            year -= 1
        start = date(year, month, 1)
        if month == 12:
            end = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end = date(year, month + 1, 1) - timedelta(days=1)

        # 수입
        income_q = select(sa_func.coalesce(sa_func.sum(Income.amount), 0))
        if household_id:
            income_q = income_q.where(Income.household_id == household_id)
        else:
            income_q = income_q.where(Income.user_id == user.id)
        income_q = income_q.where(Income.date >= start, Income.date <= end)
        income_r = await db.execute(income_q)
        total_income = float(income_r.scalar() or 0)

        # 지출
        expense_q = select(sa_func.coalesce(sa_func.sum(Expense.amount), 0))
        if household_id:
            expense_q = expense_q.where(Expense.household_id == household_id)
        else:
            expense_q = expense_q.where(Expense.user_id == user.id)
        expense_q = expense_q.where(Expense.date >= start, Expense.date <= end)
        expense_r = await db.execute(expense_q)
        total_expense = float(expense_r.scalar() or 0)

        months.append({
            "month": f"{year}-{month:02d}",
            "income": total_income,
            "expense": total_expense,
            "net": total_income - total_expense,
        })

    return {
        "months": months,
        "avg_monthly_income": sum(m["income"] for m in months) / 3,
        "avg_monthly_expense": sum(m["expense"] for m in months) / 3,
        "avg_monthly_net": sum(m["net"] for m in months) / 3,
    }


async def _get_top_expense_categories(db: AsyncSession, user: User, household_id: int | None) -> list[dict]:
    """최근 3개월 카테고리별 지출 상위 5개"""
    from app.models.category import Category

    three_months_ago = date.today() - timedelta(days=90)

    query = (
        select(
            Category.name,
            sa_func.sum(Expense.amount).label("total"),
            sa_func.count(Expense.id).label("count"),
        )
        .join(Category, Expense.category_id == Category.id)
        .where(Expense.date >= three_months_ago)
    )
    if household_id:
        query = query.where(Expense.household_id == household_id)
    else:
        query = query.where(Expense.user_id == user.id)
    query = query.group_by(Category.name).order_by(sa_func.sum(Expense.amount).desc()).limit(5)

    result = await db.execute(query)
    rows = result.all()
    return [{"category": row[0], "total": float(row[1]), "count": row[2]} for row in rows]


FINANCIAL_ADVICE_PROMPT = """당신은 가계부 앱의 재무 어드바이저입니다. 사용자의 재무 데이터를 분석하고 실행 가능한 조언을 한국어로 제공하세요.

## 재무 현황

### 자산/부채
- 총 자산: {total_assets:,.0f}원
- 총 부채: {total_liabilities:,.0f}원
- 순자산: {net_worth:,.0f}원
- 부채 비율: {debt_ratio}%
- 자산 배분: {asset_allocation}

### 저축 목표
{goal_projections}

### 월 캐시플로우 (최근 3개월 평균)
- 평균 수입: {avg_income:,.0f}원
- 평균 지출: {avg_expense:,.0f}원
- 평균 순수익: {avg_net:,.0f}원

### 저축 여력
- 총 필요 월 저축액: {required_monthly:,.0f}원
- 월 저축 가능액: {capacity}원
- 부족/여유: {gap}원

### 지출 상위 카테고리 (최근 3개월)
{top_expenses}

## 지시사항

1. 현재 재무 상태를 간단히 진단하세요 (2-3문장)
2. 가장 효과적인 개선 포인트 3가지를 제안하세요:
   - 각 제안은 구체적 금액과 효과를 포함 (예: "외식비를 월 10만원 줄이면 내 집 마련 6개월 앞당길 수 있어요")
   - 실행 가능하고 현실적인 조언만
3. 대출이 있다면 상환 전략 제안 (고금리 우선 등)
4. 자산 배분에 대한 의견 (목표 기한 대비 적절한지)

마크다운 형식으로 작성하세요. 섹션 제목은 ##, 목록은 - 사용.
응답은 500자 이내로 간결하게."""


async def generate_financial_advice(db: AsyncSession, user: User, household_id: int | None = None) -> str:
    """LLM 기반 재무 조언 생성"""
    summary = await get_financial_summary(db, user, household_id)

    # 목표 정보 포맷
    goal_text = ""
    for g in summary["goal_projections"]:
        status = "순조로움" if g.get("on_track") else "지연 예상" if g.get("on_track") is not None else "데이터 부족"
        goal_text += f"- {g['name']}: 목표 {g['target_amount']:,.0f}원 ({g['target_date']}까지), 달성률 {g['achievement_pct']}%, 필요 월 저축 {g['required_monthly_savings']:,.0f}원, 상태: {status}\n"
    if not goal_text:
        goal_text = "설정된 목표 없음"

    # 지출 카테고리 포맷
    expense_text = ""
    for e in summary["top_expense_categories"]:
        expense_text += f"- {e['category']}: 3개월 합계 {e['total']:,.0f}원 ({e['count']}건)\n"
    if not expense_text:
        expense_text = "지출 데이터 없음"

    savings = summary["savings_summary"]
    capacity_str = f"{savings['monthly_capacity']:,.0f}" if savings["monthly_capacity"] is not None else "계산 불가"
    gap_str = f"{savings['gap']:,.0f}" if savings["gap"] is not None else "계산 불가"

    prompt = FINANCIAL_ADVICE_PROMPT.format(
        total_assets=summary["asset_summary"]["total_assets"],
        total_liabilities=summary["asset_summary"]["total_liabilities"],
        net_worth=summary["asset_summary"]["net_worth"],
        debt_ratio=summary["debt_ratio"] or 0,
        asset_allocation=json.dumps(summary["asset_allocation"], ensure_ascii=False),
        goal_projections=goal_text,
        avg_income=summary["monthly_cashflow"]["avg_monthly_income"],
        avg_expense=summary["monthly_cashflow"]["avg_monthly_expense"],
        avg_net=summary["monthly_cashflow"]["avg_monthly_net"],
        required_monthly=savings["total_required_monthly"],
        capacity=capacity_str,
        gap=gap_str,
        top_expenses=expense_text,
    )

    llm = get_llm_provider()
    response = await llm.generate(prompt)
    return response
```

**Step 2: Commit**

```bash
git add backend/app/services/financial_insight_service.py
git commit -m "feat: 재무 인사이트 서비스 (규칙 기반 수치 + LLM 조언)"
```

---

### Task 2: Pydantic 스키마

**Files:**
- Create: `backend/app/schemas/financial_insight.py`

**Step 1: 스키마 정의**

```python
# backend/app/schemas/financial_insight.py
from pydantic import BaseModel


class MonthCashflow(BaseModel):
    month: str
    income: float
    expense: float
    net: float


class CashflowSummary(BaseModel):
    months: list[MonthCashflow]
    avg_monthly_income: float
    avg_monthly_expense: float
    avg_monthly_net: float


class GoalProjection(BaseModel):
    name: str
    target_amount: float
    target_date: str
    achievement_pct: float
    required_monthly_savings: float
    required_annual_return_pct: float | None
    estimated_completion_date: str | None
    on_track: bool | None


class TopExpenseCategory(BaseModel):
    category: str
    total: float
    count: int


class SavingsSummary(BaseModel):
    total_required_monthly: float
    monthly_capacity: float | None
    gap: float | None


class AssetSummaryBrief(BaseModel):
    total_assets: float
    total_liabilities: float
    net_worth: float
    breakdown: dict[str, float]
    total_profit_loss: float
    total_profit_loss_pct: float | None


class FinancialSummaryResponse(BaseModel):
    asset_summary: AssetSummaryBrief
    debt_ratio: float | None
    asset_allocation: dict[str, float]
    goal_projections: list[GoalProjection]
    monthly_cashflow: CashflowSummary
    savings_summary: SavingsSummary
    top_expense_categories: list[TopExpenseCategory]


class FinancialAdviceResponse(BaseModel):
    advice: str  # 마크다운
```

**Step 2: Commit**

```bash
git add backend/app/schemas/financial_insight.py
git commit -m "feat: 재무 인사이트 Pydantic 스키마"
```

---

### Task 3: API 엔드포인트

**Files:**
- Modify: `backend/app/api/insights.py` (기존 파일에 엔드포인트 추가)

**Step 1: 기존 insights.py 확인**

기존 `insights.py`를 읽고, 하단에 재무 인사이트 엔드포인트 추가.

**Step 2: 엔드포인트 추가**

```python
# backend/app/api/insights.py 하단에 추가

from app.schemas.financial_insight import FinancialAdviceResponse, FinancialSummaryResponse
from app.services.financial_insight_service import generate_financial_advice, get_financial_summary


@router.get("/financial-summary", response_model=FinancialSummaryResponse)
async def financial_summary(
    household_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """규칙 기반 재무 수치 요약 — 자산/부채, 부채비율, 자산배분, 목표진행, 캐시플로우, 저축여력"""
    if household_id is not None:
        from app.api.dependencies import get_household_member
        await get_household_member(household_id, current_user, db)
    return await get_financial_summary(db, current_user, household_id)


@router.post("/financial-advice", response_model=FinancialAdviceResponse)
async def financial_advice(
    household_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """LLM 기반 맞춤 재무 조언 생성"""
    if household_id is not None:
        from app.api.dependencies import get_household_member
        await get_household_member(household_id, current_user, db)
    advice = await generate_financial_advice(db, current_user, household_id)
    return FinancialAdviceResponse(advice=advice)
```

**Step 3: Commit**

```bash
git add backend/app/api/insights.py
git commit -m "feat: 재무 인사이트 API (financial-summary, financial-advice)"
```

---

### Task 4: 백엔드 테스트

**Files:**
- Create: `backend/tests/test_financial_insights.py`

**Step 1: 테스트 작성**

```python
# backend/tests/test_financial_insights.py
"""재무 인사이트 API 테스트"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_financial_summary_empty(authenticated_client: AsyncClient):
    """데이터 없을 때 financial-summary 정상 응답"""
    resp = await authenticated_client.get("/api/insights/financial-summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["asset_summary"]["net_worth"] == 0
    assert data["debt_ratio"] is None
    assert data["goal_projections"] == []
    assert data["top_expense_categories"] == []


@pytest.mark.asyncio
async def test_financial_summary_with_data(authenticated_client: AsyncClient):
    """자산+목표+지출 데이터가 있을 때 종합 요약"""
    # 자산 등록
    await authenticated_client.post("/api/assets", json={
        "name": "예금", "type": "deposit", "manual_value": 50000000,
    })
    await authenticated_client.post("/api/assets", json={
        "name": "대출", "type": "loan", "is_liability": True, "manual_value": 20000000,
    })

    # 목표 등록
    await authenticated_client.post("/api/goals", json={
        "name": "목표", "target_amount": 100000000, "target_date": "2028-01-01",
    })

    resp = await authenticated_client.get("/api/insights/financial-summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["asset_summary"]["total_assets"] == 50000000
    assert data["asset_summary"]["total_liabilities"] == 20000000
    assert data["asset_summary"]["net_worth"] == 30000000
    assert data["debt_ratio"] == 40.0  # 20M / 50M * 100
    assert len(data["goal_projections"]) == 1


@pytest.mark.asyncio
async def test_financial_summary_cashflow(authenticated_client: AsyncClient):
    """캐시플로우 계산 (최근 3개월 수입/지출)"""
    from datetime import datetime

    # 이번 달 수입/지출 등록
    today = datetime.now().strftime("%Y-%m-%dT00:00:00")
    await authenticated_client.post("/api/income", json={
        "amount": 5000000, "description": "월급", "date": today,
    })
    await authenticated_client.post("/api/expenses", json={
        "amount": 3000000, "description": "생활비", "date": today,
    })

    resp = await authenticated_client.get("/api/insights/financial-summary")
    assert resp.status_code == 200
    cashflow = resp.json()["monthly_cashflow"]
    assert len(cashflow["months"]) == 3
    # 이번 달에만 데이터가 있으므로 평균은 /3
    assert cashflow["avg_monthly_income"] > 0


@pytest.mark.asyncio
async def test_financial_advice_returns_markdown(authenticated_client: AsyncClient, monkeypatch):
    """LLM 조언이 마크다운 문자열로 반환"""
    # LLM mock
    async def mock_generate(self, prompt):
        return "## 재무 진단\n\n순자산이 양호합니다.\n\n## 개선 포인트\n\n- 외식비 절감 권장"

    from app.services import llm_service
    monkeypatch.setattr(llm_service.get_llm_provider().__class__, "generate", mock_generate)

    resp = await authenticated_client.post("/api/insights/financial-advice")
    assert resp.status_code == 200
    data = resp.json()
    assert "advice" in data
    assert isinstance(data["advice"], str)
    assert len(data["advice"]) > 0
```

**Step 2: 테스트 실행**

```bash
cd backend && pytest tests/test_financial_insights.py -v
```

**Step 3: Commit**

```bash
git add backend/tests/test_financial_insights.py
git commit -m "test: 재무 인사이트 API 테스트 (요약, 캐시플로우, LLM 조언)"
```

---

### Task 5: 프론트엔드 타입 + API 클라이언트

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/api/insights.ts` (기존 파일 확장)

**Step 1: 타입 정의 추가**

`frontend/src/types/index.ts`에 추가:

```typescript
export interface MonthCashflow {
  month: string
  income: number
  expense: number
  net: number
}

export interface GoalProjection {
  name: string
  target_amount: number
  target_date: string
  achievement_pct: number
  required_monthly_savings: number
  required_annual_return_pct: number | null
  estimated_completion_date: string | null
  on_track: boolean | null
}

export interface TopExpenseCategory {
  category: string
  total: number
  count: number
}

export interface FinancialSummary {
  asset_summary: AssetSummary
  debt_ratio: number | null
  asset_allocation: Record<string, number>
  goal_projections: GoalProjection[]
  monthly_cashflow: {
    months: MonthCashflow[]
    avg_monthly_income: number
    avg_monthly_expense: number
    avg_monthly_net: number
  }
  savings_summary: {
    total_required_monthly: number
    monthly_capacity: number | null
    gap: number | null
  }
  top_expense_categories: TopExpenseCategory[]
}
```

**Step 2: API 클라이언트 확장**

기존 `frontend/src/api/insights.ts`에 추가 (없으면 생성):

```typescript
import apiClient from './client'
import type { FinancialSummary } from '../types'

export const financialInsightApi = {
  getSummary: (householdId?: number) =>
    apiClient.get<FinancialSummary>('/insights/financial-summary', {
      params: householdId != null ? { household_id: householdId } : undefined,
    }),

  getAdvice: (householdId?: number) =>
    apiClient.post<{ advice: string }>('/insights/financial-advice', null, {
      params: householdId != null ? { household_id: householdId } : undefined,
    }),
}
```

**Step 3: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/api/insights.ts
git commit -m "feat: 재무 인사이트 프론트엔드 타입 및 API 클라이언트"
```

---

### Task 6: 재무 인사이트 페이지

**Files:**
- Create: `frontend/src/pages/FinancialInsights.tsx`
- Modify: `frontend/src/App.tsx` (라우트 추가)

**Step 1: FinancialInsights 컴포넌트**

기존 인사이트 페이지에 탭으로 추가하거나, 별도 페이지로 구현. 구성:

**상단: 핵심 수치 카드 4개** (규칙 기반)
- 순자산 (총자산 - 총부채)
- 부채 비율 (%)
- 월 저축 여력 (수입-지출-대출상환)
- 저축 부족/여유 금액

**중단: 차트 영역**
- 자산 배분 파이차트 (유형별 비중)
- 월별 캐시플로우 바차트 (수입/지출/순수익, 최근 3개월)

**목표 진행 현황**
- 각 목표: 프로그레스 바 + 달성률 + on_track 여부 (순조/지연)
- 필요 월 저축액 + 필요 수익률

**지출 상위 카테고리**
- 상위 5개 카테고리 바차트 또는 리스트

**하단: LLM 조언**
- "AI 재무 조언 받기" 버튼
- 클릭 → loading → 마크다운 렌더링
- react-markdown 또는 기존 마크다운 렌더링 패턴 재사용 (InsightsPage 참고)

Grape 디자인 시스템 사용.

**Step 2: App.tsx 라우트**

기존 `/insights` 라우트와 별도로 추가하거나, InsightsPage 내 탭으로 통합:

```typescript
const FinancialInsights = lazy(() => import('./pages/FinancialInsights'))

// Option A: 별도 라우트
<Route path="/financial" element={<FinancialInsights />} />

// Option B: 기존 인사이트 페이지 내 탭 (InsightsPage 수정)
```

기존 InsightsPage에 탭이 있는지 확인 후 결정. 별도 라우트를 기본으로.

**Step 3: Layout.tsx 사이드바**

navItems에 추가 (저축 목표 아래):
```typescript
{ path: '/financial', label: '재무 인사이트', icon: LineChart },
```

또는 기존 "리포트" 메뉴를 확장.

**Step 4: Commit**

```bash
git add frontend/src/pages/FinancialInsights.tsx frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat: 재무 인사이트 페이지 (수치 카드, 차트, LLM 조언)"
```

---

### Task 7: 프론트엔드 테스트

**Files:**
- Create: `frontend/src/__tests__/FinancialInsights.test.tsx`

**Step 1: 테스트 작성**

```typescript
// frontend/src/__tests__/FinancialInsights.test.tsx
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, test, expect } from 'vitest'

vi.mock('../api/insights', () => ({
  financialInsightApi: {
    getSummary: vi.fn().mockResolvedValue({
      data: {
        asset_summary: { total_assets: 50000000, total_liabilities: 20000000, net_worth: 30000000, breakdown: { deposit: 50000000 }, total_profit_loss: 0, total_profit_loss_pct: null },
        debt_ratio: 40.0,
        asset_allocation: { deposit: 100 },
        goal_projections: [{ name: '내 집 마련', target_amount: 500000000, target_date: '2030-01-01', achievement_pct: 6, required_monthly_savings: 8000000, required_annual_return_pct: null, estimated_completion_date: null, on_track: null }],
        monthly_cashflow: { months: [], avg_monthly_income: 5000000, avg_monthly_expense: 3000000, avg_monthly_net: 2000000 },
        savings_summary: { total_required_monthly: 8000000, monthly_capacity: 2000000, gap: 6000000 },
        top_expense_categories: [{ category: '식비', total: 900000, count: 30 }],
      },
    }),
    getAdvice: vi.fn().mockResolvedValue({ data: { advice: '## 재무 진단\n\n순자산이 양호합니다.' } }),
  },
}))

describe('FinancialInsights', () => {
  test('핵심 수치 카드 표시', async () => {
    render(<MemoryRouter><FinancialInsights /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByText(/순자산/)).toBeInTheDocument()
      expect(screen.getByText(/부채 비율/)).toBeInTheDocument()
    })
  })

  test('목표 진행 현황 표시', async () => {
    render(<MemoryRouter><FinancialInsights /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByText('내 집 마련')).toBeInTheDocument()
    })
  })

  test('지출 상위 카테고리 표시', async () => {
    render(<MemoryRouter><FinancialInsights /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByText('식비')).toBeInTheDocument()
    })
  })
})
```

**Step 2: 테스트 실행**

```bash
cd frontend && npm test
```

**Step 3: Commit**

```bash
git add frontend/src/__tests__/FinancialInsights.test.tsx
git commit -m "test: 재무 인사이트 프론트엔드 테스트"
```

---

### Task 8: 통합 테스트 + 린트 + 최종 확인

**Step 1: 백엔드 전체 테스트**

```bash
cd backend && pytest -v
```

**Step 2: 프론트엔드 빌드 + 테스트**

```bash
cd frontend && npm run build && npm test
```

**Step 3: 린트**

```bash
cd backend && ruff check --fix . && ruff format .
```

**Step 4: 최종 커밋**

```bash
git add -A
git commit -m "chore: Phase 3 재무 인사이트 통합 테스트 및 린트 정리"
```

---

## 요약

| Task | 내용 | 파일 수 |
|------|------|---------|
| 1 | 재무 인사이트 서비스 (규칙 기반 + LLM) | 1 |
| 2 | Pydantic 스키마 | 1 |
| 3 | API 엔드포인트 (기존 insights.py 확장) | 1 |
| 4 | 백엔드 테스트 | 1 |
| 5 | 프론트엔드 타입 + API | 2 |
| 6 | 재무 인사이트 페이지 + 라우팅 | 3 |
| 7 | 프론트엔드 테스트 | 1 |
| 8 | 통합 테스트 + 린트 | 0 |

**Phase 3는 새 모델/마이그레이션 없음** — Phase 1, 2의 데이터를 조합하여 인사이트 생성.
