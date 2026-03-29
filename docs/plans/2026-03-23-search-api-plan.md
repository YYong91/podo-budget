# 거래 내역 검색 API 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 지출/수입 API에 텍스트 검색(query) 파라미터와 검색 합계 엔드포인트를 추가한다.

**Architecture:** 기존 GET /api/expenses, GET /api/income 엔드포인트에 `query` 파라미터를 추가하여 description 필드를 ILIKE 검색. 검색 합계는 별도 엔드포인트(/api/expenses/search/summary, /api/income/search/summary)로 건수+총액 반환. SQLite(테스트)와 PostgreSQL(프로덕션) 모두 지원.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 (async), Pydantic v2, pytest-asyncio

**Sub-issue:** #318
**Design doc:** `docs/plans/2026-03-23-transaction-search-design.md`

---

### Task 1: 지출 API에 query 파라미터 추가

**Files:**
- Modify: `backend/app/api/expenses.py:77-120` (get_expenses 함수)
- Test: `backend/tests/integration/test_api_expenses.py`

**Step 1: 검색 테스트 작성**

`backend/tests/integration/test_api_expenses.py` 끝에 추가:

```python
@pytest.mark.asyncio
async def test_search_expenses_by_query(authenticated_client, test_user: User, test_household: Household, db_session):
    """query 파라미터로 description 검색"""
    e1 = Expense(user_id=test_user.id, household_id=test_household.id, amount=8000, description="점심 김치찌개", date=datetime(2026, 3, 1))
    e2 = Expense(user_id=test_user.id, household_id=test_household.id, amount=45000, description="정형외과 병원", date=datetime(2026, 3, 2))
    e3 = Expense(user_id=test_user.id, household_id=test_household.id, amount=5000, description="버스 교통비", date=datetime(2026, 3, 3))
    db_session.add_all([e1, e2, e3])
    await db_session.commit()

    # "병원" 검색 → 1건
    response = await authenticated_client.get("/api/expenses?query=병원")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["description"] == "정형외과 병원"


@pytest.mark.asyncio
async def test_search_expenses_no_match(authenticated_client, test_user: User, test_household: Household, db_session):
    """query 파라미터로 검색 — 결과 없음"""
    e1 = Expense(user_id=test_user.id, household_id=test_household.id, amount=8000, description="점심 김치찌개", date=datetime(2026, 3, 1))
    db_session.add(e1)
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses?query=병원")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_search_expenses_with_filters(authenticated_client, test_user: User, test_household: Household, db_session):
    """query + category_id 필터 조합"""
    cat = Category(name="의료", type="expense", household_id=test_household.id)
    db_session.add(cat)
    await db_session.flush()

    e1 = Expense(user_id=test_user.id, household_id=test_household.id, amount=45000, description="정형외과 병원", category_id=cat.id, date=datetime(2026, 3, 1))
    e2 = Expense(user_id=test_user.id, household_id=test_household.id, amount=5000, description="약국 병원약", category_id=None, date=datetime(2026, 3, 2))
    db_session.add_all([e1, e2])
    await db_session.commit()

    # "병원" + category_id → 1건 (카테고리 필터 적용)
    response = await authenticated_client.get(f"/api/expenses?query=병원&category_id={cat.id}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["description"] == "정형외과 병원"
```

**Step 2: 테스트 실행 → 실패 확인**

```bash
cd backend && pytest tests/integration/test_api_expenses.py -v -k "search"
```
Expected: PASS (query 파라미터가 무시되어 전체 결과 반환) 또는 422 에러.
실제로 FastAPI는 정의하지 않은 query param을 무시하므로 테스트가 의도대로 실패하는지 확인 필요.

**Step 3: get_expenses에 query 파라미터 구현**

`backend/app/api/expenses.py`의 `get_expenses` 함수에:

```python
query: str | None = Query(None, description="설명(description) 텍스트 검색"),
```

필터 적용 부분에 추가:
```python
if query:
    query_filter = Expense.description.ilike(f"%{query}%")
    stmt = stmt.where(query_filter)
```

주의: 변수명 충돌 — `query`는 파라미터 이름이고 `select()` 결과도 `query`로 되어있음. 기존 코드의 SQLAlchemy query 변수를 `stmt`로 리네임하거나 파라미터 이름을 `search_query`로 변경.

→ 파라미터명을 `query`로 유지하고 SQLAlchemy 쿼리 변수를 `stmt`로 변경하는 것이 API 사용자 관점에서 깔끔.

**Step 4: 테스트 통과 확인**

```bash
cd backend && pytest tests/integration/test_api_expenses.py -v -k "search"
```

**Step 5: ruff + 전체 테스트**

```bash
cd backend && ruff check --fix . && ruff format .
cd backend && pytest tests/integration/test_api_expenses.py -v
```

**Step 6: 커밋**

```bash
git add backend/app/api/expenses.py backend/tests/integration/test_api_expenses.py
git commit -m "feat: 지출 API에 query 검색 파라미터 추가 (#318)"
```

---

### Task 2: 수입 API에 query 파라미터 추가

**Files:**
- Modify: `backend/app/api/income.py:56-92` (get_incomes 함수)
- Test: `backend/tests/integration/test_api_income.py`

**Step 1: 검색 테스트 작성**

`backend/tests/integration/test_api_income.py` 끝에 추가 (지출과 동일 패턴):

```python
@pytest.mark.asyncio
async def test_search_incomes_by_query(authenticated_client, test_user: User, test_household: Household, db_session):
    """query 파라미터로 description 검색"""
    i1 = Income(user_id=test_user.id, household_id=test_household.id, amount=3000000, description="3월 급여", date=datetime(2026, 3, 1))
    i2 = Income(user_id=test_user.id, household_id=test_household.id, amount=50000, description="용돈", date=datetime(2026, 3, 2))
    db_session.add_all([i1, i2])
    await db_session.commit()

    response = await authenticated_client.get("/api/income?query=급여")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["description"] == "3월 급여"


@pytest.mark.asyncio
async def test_search_incomes_no_match(authenticated_client, test_user: User, test_household: Household, db_session):
    """query 검색 — 결과 없음"""
    i1 = Income(user_id=test_user.id, household_id=test_household.id, amount=50000, description="용돈", date=datetime(2026, 3, 1))
    db_session.add(i1)
    await db_session.commit()

    response = await authenticated_client.get("/api/income?query=급여")
    assert response.status_code == 200
    assert response.json() == []
```

**Step 2: 테스트 실행 → 실패 확인**

```bash
cd backend && pytest tests/integration/test_api_income.py -v -k "search"
```

**Step 3: get_incomes에 query 파라미터 구현**

Task 1과 동일 패턴. `backend/app/api/income.py`의 `get_incomes` 함수에 `query` 파라미터 + `ilike` 필터 추가. SQLAlchemy 쿼리 변수명도 `stmt`로 통일.

**Step 4: 테스트 통과 확인**

```bash
cd backend && pytest tests/integration/test_api_income.py -v -k "search"
```

**Step 5: ruff + 전체 테스트**

```bash
cd backend && ruff check --fix . && ruff format .
cd backend && pytest tests/integration/test_api_income.py -v
```

**Step 6: 커밋**

```bash
git add backend/app/api/income.py backend/tests/integration/test_api_income.py
git commit -m "feat: 수입 API에 query 검색 파라미터 추가 (#318)"
```

---

### Task 3: 검색 합계 엔드포인트 (지출)

**Files:**
- Modify: `backend/app/api/expenses.py` — 새 엔드포인트 추가
- Modify: `backend/app/schemas/expense.py` — 합계 응답 스키마
- Test: `backend/tests/integration/test_api_expenses.py`

**Step 1: 합계 응답 스키마 작성**

`backend/app/schemas/expense.py` 끝에 추가:

```python
class SearchSummary(BaseModel):
    """검색 결과 합계"""
    total_count: int
    total_amount: float
```

**Step 2: 합계 테스트 작성**

```python
@pytest.mark.asyncio
async def test_search_summary_expenses(authenticated_client, test_user: User, test_household: Household, db_session):
    """검색 합계 — 건수 + 총액"""
    e1 = Expense(user_id=test_user.id, household_id=test_household.id, amount=45000, description="정형외과 병원", date=datetime(2026, 3, 1))
    e2 = Expense(user_id=test_user.id, household_id=test_household.id, amount=12000, description="약국 병원약", date=datetime(2026, 3, 2))
    e3 = Expense(user_id=test_user.id, household_id=test_household.id, amount=8000, description="점심", date=datetime(2026, 3, 3))
    db_session.add_all([e1, e2, e3])
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses/search/summary?query=병원")
    assert response.status_code == 200
    data = response.json()
    assert data["total_count"] == 2
    assert data["total_amount"] == 57000.0


@pytest.mark.asyncio
async def test_search_summary_expenses_no_query(authenticated_client, test_user: User, test_household: Household, db_session):
    """검색 합계 — query 없이 전체 합계"""
    e1 = Expense(user_id=test_user.id, household_id=test_household.id, amount=10000, description="택시", date=datetime(2026, 3, 1))
    db_session.add(e1)
    await db_session.commit()

    response = await authenticated_client.get("/api/expenses/search/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["total_count"] == 1
    assert data["total_amount"] == 10000.0
```

**Step 3: 테스트 실행 → 실패 확인**

```bash
cd backend && pytest tests/integration/test_api_expenses.py -v -k "summary"
```

**Step 4: 합계 엔드포인트 구현**

`backend/app/api/expenses.py`에 추가 (CRUD 엔드포인트 뒤, 통계 API 앞):

```python
@router.get("/search/summary", response_model=SearchSummary)
async def get_expenses_search_summary(
    query: str | None = Query(None, description="설명(description) 텍스트 검색"),
    start_date: str | None = Query(None),
    end_date: str | None = Query(None),
    category_id: int | None = None,
    household_id: int | None = None,
    member_user_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """검색 결과 합계 (건수 + 총액)"""
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)
    await get_household_member(household_id, current_user, db)

    stmt = select(func.count(), func.coalesce(func.sum(Expense.amount), 0)).where(
        Expense.household_id == household_id
    )
    if member_user_id is not None:
        stmt = stmt.where(Expense.user_id == member_user_id)
    if query:
        stmt = stmt.where(Expense.description.ilike(f"%{query}%"))
    if start_date:
        stmt = stmt.where(Expense.date >= datetime.fromisoformat(start_date))
    if end_date:
        end_dt = datetime.fromisoformat(end_date)
        if len(end_date) == 10:
            end_dt = end_dt.replace(hour=23, minute=59, second=59)
        stmt = stmt.where(Expense.date <= end_dt)
    if category_id is not None:
        stmt = stmt.where(Expense.category_id == category_id)

    result = await db.execute(stmt)
    count, total = result.one()
    return SearchSummary(total_count=count, total_amount=float(total))
```

주의: `/search/summary`는 `/{expense_id}` 보다 먼저 등록해야 함 (FastAPI 라우팅 순서). 기존 코드에서 `@router.get("/{expense_id}")` 위치를 확인하고 그 위에 배치.

**Step 5: 테스트 통과 확인**

```bash
cd backend && pytest tests/integration/test_api_expenses.py -v -k "summary"
```

**Step 6: ruff + 전체 지출 테스트**

```bash
cd backend && ruff check --fix . && ruff format .
cd backend && pytest tests/integration/test_api_expenses.py -v
```

**Step 7: 커밋**

```bash
git add backend/app/api/expenses.py backend/app/schemas/expense.py backend/tests/integration/test_api_expenses.py
git commit -m "feat: 지출 검색 합계 엔드포인트 추가 (#318)"
```

---

### Task 4: 검색 합계 엔드포인트 (수입)

**Files:**
- Modify: `backend/app/api/income.py` — 새 엔드포인트 추가
- Modify: `backend/app/schemas/income.py` — SearchSummary import 또는 공유
- Test: `backend/tests/integration/test_api_income.py`

Task 3과 동일 패턴. SearchSummary 스키마는 `schemas/expense.py`에서 import하거나, 공용 스키마 파일로 분리.

**Step 1: 합계 테스트 작성**

```python
@pytest.mark.asyncio
async def test_search_summary_incomes(authenticated_client, test_user: User, test_household: Household, db_session):
    """수입 검색 합계"""
    i1 = Income(user_id=test_user.id, household_id=test_household.id, amount=3000000, description="3월 급여", date=datetime(2026, 3, 1))
    i2 = Income(user_id=test_user.id, household_id=test_household.id, amount=50000, description="용돈", date=datetime(2026, 3, 2))
    db_session.add_all([i1, i2])
    await db_session.commit()

    response = await authenticated_client.get("/api/income/search/summary?query=급여")
    assert response.status_code == 200
    data = response.json()
    assert data["total_count"] == 1
    assert data["total_amount"] == 3000000.0
```

**Step 2~6: Task 3과 동일 패턴**

**Step 7: 커밋**

```bash
git add backend/app/api/income.py backend/app/schemas/ backend/tests/integration/test_api_income.py
git commit -m "feat: 수입 검색 합계 엔드포인트 추가 (#318)"
```

---

### Task 5: 전체 테스트 + FE API 클라이언트 업데이트

**Files:**
- Modify: `frontend/src/api/expenses.ts` — query 파라미터 + summary 메서드
- Modify: `frontend/src/api/income.ts` — 동일
- Test: 전체 백엔드 테스트 스위트

**Step 1: 전체 백엔드 테스트 통과 확인**

```bash
cd backend && pytest --ignore=tests/integration/test_api_budget_bulk.py -v
```

**Step 2: FE API 클라이언트 업데이트**

`frontend/src/api/expenses.ts`의 `GetExpensesParams`에:
```typescript
query?: string
```

새 메서드 추가:
```typescript
searchSummary: (params?: GetExpensesParams) =>
  apiClient.get<{ total_count: number; total_amount: number }>('/expenses/search/summary', { params }),
```

`frontend/src/api/income.ts`도 동일.

**Step 3: FE 빌드 확인**

```bash
cd frontend && npm run lint && npm run build
```

**Step 4: 커밋**

```bash
git add frontend/src/api/expenses.ts frontend/src/api/income.ts
git commit -m "feat: FE API 클라이언트에 검색 파라미터 + 합계 메서드 추가 (#318)"
```
