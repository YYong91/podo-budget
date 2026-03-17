# #113 가구 관리자 권한 확장 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** owner/admin이 같은 가구 내 모든 거래를 수정/삭제할 수 있도록 권한 확장

**Architecture:** expenses.py와 income.py의 PUT/DELETE에서 user_id 필터 대신 household_id로 조회 후 역할 기반 권한 체크. `get_household_member()`가 반환하는 HouseholdMember.role로 admin/owner 판별.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async, pytest-asyncio, React + TypeScript

---

### Task 1: expenses.py — update_expense 권한 확장

**Files:**
- Modify: `backend/app/api/expenses.py:588-610`
- Test: `tests/integration/test_api_expense_permission.py` (새 파일)

**Step 1: 테스트 파일 생성 — update 권한 테스트**

```python
# tests/integration/test_api_expense_permission.py
"""지출 수정/삭제 권한 테스트

owner/admin은 가구 내 모든 거래를 수정/삭제할 수 있고,
member는 본인 거래만 수정/삭제할 수 있다.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expense import Expense
from app.models.household_member import HouseholdMember


@pytest.fixture
async def other_user_expense(db_session: AsyncSession, test_user2, test_household):
    """test_user2가 생성한 지출 (test_household 소속)"""
    # test_user2를 가구 멤버로 추가
    member = HouseholdMember(
        household_id=test_household.id,
        user_id=test_user2.id,
        role="member",
    )
    db_session.add(member)
    await db_session.flush()

    expense = Expense(
        user_id=test_user2.id,
        household_id=test_household.id,
        description="다른 멤버 지출",
        amount=5000,
        category_id=None,
    )
    db_session.add(expense)
    await db_session.commit()
    await db_session.refresh(expense)
    return expense


@pytest.mark.asyncio
async def test_owner_can_update_other_member_expense(
    authenticated_client: AsyncClient,
    other_user_expense: Expense,
):
    """owner는 다른 멤버의 지출을 수정할 수 있다"""
    response = await authenticated_client.put(
        f"/api/expenses/{other_user_expense.id}",
        json={"description": "수정됨", "amount": 9999},
    )
    assert response.status_code == 200
    assert response.json()["description"] == "수정됨"
    assert float(response.json()["amount"]) == 9999


@pytest.mark.asyncio
async def test_member_cannot_update_other_member_expense(
    authenticated_client_user2: AsyncClient,
    test_user,
    test_household,
    db_session: AsyncSession,
):
    """member는 다른 멤버의 지출을 수정할 수 없다 (403)"""
    # test_user(owner)가 만든 지출
    expense = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        description="owner 지출",
        amount=10000,
    )
    db_session.add(expense)
    await db_session.commit()
    await db_session.refresh(expense)

    response = await authenticated_client_user2.put(
        f"/api/expenses/{expense.id}",
        json={"description": "수정 시도"},
    )
    assert response.status_code == 403
    assert "권한" in response.json()["detail"]


@pytest.mark.asyncio
async def test_member_can_update_own_expense(
    authenticated_client_user2: AsyncClient,
    other_user_expense: Expense,
):
    """member는 본인 지출은 수정할 수 있다"""
    response = await authenticated_client_user2.put(
        f"/api/expenses/{other_user_expense.id}",
        json={"description": "내 지출 수정"},
    )
    assert response.status_code == 200
    assert response.json()["description"] == "내 지출 수정"
```

**Step 2: conftest에 authenticated_client_user2 fixture 확인/추가**

`tests/conftest.py`에 `authenticated_client_user2` fixture가 없으면 추가:

```python
@pytest.fixture
async def authenticated_client_user2(
    async_client_factory, test_user2
) -> AsyncClient:
    """test_user2로 인증된 클라이언트"""
    from app.core.auth import create_access_token
    token = create_access_token({"sub": str(test_user2.auth_user_id)})
    client = await async_client_factory()
    client.headers["Authorization"] = f"Bearer {token}"
    return client
```

> 기존 conftest 패턴을 따라 정확한 구현 조정. `test_user2`가 test_household의 member로 등록되어 있는지도 확인.

**Step 3: 테스트 실행 — 실패 확인**

Run: `cd backend && pytest tests/integration/test_api_expense_permission.py -v`
Expected: FAIL (현재 update_expense가 user_id 필터로만 조회하므로 owner 테스트 실패)

**Step 4: update_expense 구현 수정**

`backend/app/api/expenses.py:588-610`을 다음으로 교체:

```python
@router.put("/{expense_id}", response_model=ExpenseResponse)
async def update_expense(
    expense_id: int,
    expense_update: ExpenseUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """지출 수정

    본인 거래는 무조건 수정 가능.
    타인 거래는 admin/owner만 수정 가능, member는 403.
    """
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="지출을 찾을 수 없습니다")

    # 본인 거래가 아니면 역할 체크
    if expense.user_id != current_user.id:
        member = await get_household_member(expense.household_id, current_user, db)
        if member.role not in ("admin", "owner"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="이 항목을 수정할 권한이 없습니다",
            )

    update_data = expense_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(expense, key, value)

    await db.commit()
    await db.refresh(expense)
    return expense
```

**Step 5: 테스트 실행 — update 테스트 통과 확인**

Run: `cd backend && pytest tests/integration/test_api_expense_permission.py -k "update" -v`
Expected: PASS

**Step 6: 커밋**

```bash
git add backend/app/api/expenses.py tests/integration/test_api_expense_permission.py tests/conftest.py
git commit -m "feat: 지출 수정 시 admin/owner 권한 허용 (#113)"
```

---

### Task 2: expenses.py — delete_expense 권한 확장

**Files:**
- Modify: `backend/app/api/expenses.py:613-630`
- Test: `tests/integration/test_api_expense_permission.py` (추가)

**Step 1: delete 권한 테스트 추가**

`tests/integration/test_api_expense_permission.py`에 추가:

```python
@pytest.mark.asyncio
async def test_owner_can_delete_other_member_expense(
    authenticated_client: AsyncClient,
    other_user_expense: Expense,
):
    """owner는 다른 멤버의 지출을 삭제할 수 있다"""
    response = await authenticated_client.delete(
        f"/api/expenses/{other_user_expense.id}",
    )
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_member_cannot_delete_other_member_expense(
    authenticated_client_user2: AsyncClient,
    test_user,
    test_household,
    db_session: AsyncSession,
):
    """member는 다른 멤버의 지출을 삭제할 수 없다 (403)"""
    expense = Expense(
        user_id=test_user.id,
        household_id=test_household.id,
        description="owner 지출",
        amount=10000,
    )
    db_session.add(expense)
    await db_session.commit()
    await db_session.refresh(expense)

    response = await authenticated_client_user2.delete(
        f"/api/expenses/{expense.id}",
    )
    assert response.status_code == 403
    assert "권한" in response.json()["detail"]
```

**Step 2: 테스트 실행 — 실패 확인**

Run: `cd backend && pytest tests/integration/test_api_expense_permission.py -k "delete" -v`
Expected: FAIL

**Step 3: delete_expense 구현 수정**

`backend/app/api/expenses.py:613-630`을 다음으로 교체:

```python
@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """지출 삭제

    본인 거래는 무조건 삭제 가능.
    타인 거래는 admin/owner만 삭제 가능, member는 403.
    """
    result = await db.execute(select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="지출을 찾을 수 없습니다")

    if expense.user_id != current_user.id:
        member = await get_household_member(expense.household_id, current_user, db)
        if member.role not in ("admin", "owner"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="이 항목을 삭제할 권한이 없습니다",
            )

    await db.delete(expense)
    await db.commit()
```

**Step 4: 테스트 실행 — 전체 통과 확인**

Run: `cd backend && pytest tests/integration/test_api_expense_permission.py -v`
Expected: PASS (모든 expense 권한 테스트)

**Step 5: 커밋**

```bash
git add backend/app/api/expenses.py tests/integration/test_api_expense_permission.py
git commit -m "feat: 지출 삭제 시 admin/owner 권한 허용 (#113)"
```

---

### Task 3: income.py — update_income / delete_income 권한 확장

**Files:**
- Modify: `backend/app/api/income.py:236-271`
- Test: `tests/integration/test_api_income_permission.py` (새 파일)

**Step 1: 수입 권한 테스트 파일 생성**

```python
# tests/integration/test_api_income_permission.py
"""수입 수정/삭제 권한 테스트"""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.income import Income
from app.models.household_member import HouseholdMember


@pytest.fixture
async def other_user_income(db_session: AsyncSession, test_user2, test_household):
    """test_user2가 생성한 수입"""
    # test_user2를 가구 멤버로 추가 (이미 있으면 스킵)
    from sqlalchemy import select
    result = await db_session.execute(
        select(HouseholdMember).where(
            HouseholdMember.household_id == test_household.id,
            HouseholdMember.user_id == test_user2.id,
        )
    )
    if not result.scalar_one_or_none():
        member = HouseholdMember(
            household_id=test_household.id,
            user_id=test_user2.id,
            role="member",
        )
        db_session.add(member)
        await db_session.flush()

    income = Income(
        user_id=test_user2.id,
        household_id=test_household.id,
        description="다른 멤버 수입",
        amount=50000,
        category_id=None,
    )
    db_session.add(income)
    await db_session.commit()
    await db_session.refresh(income)
    return income


@pytest.mark.asyncio
async def test_owner_can_update_other_member_income(
    authenticated_client: AsyncClient,
    other_user_income: Income,
):
    """owner는 다른 멤버의 수입을 수정할 수 있다"""
    response = await authenticated_client.put(
        f"/api/income/{other_user_income.id}",
        json={"description": "수정됨", "amount": 99999},
    )
    assert response.status_code == 200
    assert response.json()["description"] == "수정됨"


@pytest.mark.asyncio
async def test_member_cannot_update_other_member_income(
    authenticated_client_user2: AsyncClient,
    test_user,
    test_household,
    db_session: AsyncSession,
):
    """member는 다른 멤버의 수입을 수정할 수 없다"""
    income = Income(
        user_id=test_user.id,
        household_id=test_household.id,
        description="owner 수입",
        amount=100000,
    )
    db_session.add(income)
    await db_session.commit()
    await db_session.refresh(income)

    response = await authenticated_client_user2.put(
        f"/api/income/{income.id}",
        json={"description": "수정 시도"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_owner_can_delete_other_member_income(
    authenticated_client: AsyncClient,
    other_user_income: Income,
):
    """owner는 다른 멤버의 수입을 삭제할 수 있다"""
    response = await authenticated_client.delete(
        f"/api/income/{other_user_income.id}",
    )
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_member_cannot_delete_other_member_income(
    authenticated_client_user2: AsyncClient,
    test_user,
    test_household,
    db_session: AsyncSession,
):
    """member는 다른 멤버의 수입을 삭제할 수 없다"""
    income = Income(
        user_id=test_user.id,
        household_id=test_household.id,
        description="owner 수입",
        amount=100000,
    )
    db_session.add(income)
    await db_session.commit()
    await db_session.refresh(income)

    response = await authenticated_client_user2.delete(
        f"/api/income/{income.id}",
    )
    assert response.status_code == 403
```

**Step 2: 테스트 실행 — 실패 확인**

Run: `cd backend && pytest tests/integration/test_api_income_permission.py -v`
Expected: FAIL

**Step 3: update_income 구현 수정**

`backend/app/api/income.py:236-255`을 다음으로 교체:

```python
@router.put("/{income_id}", response_model=IncomeResponse)
async def update_income(
    income_id: int,
    income_update: IncomeUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """수입 수정 — 본인 또는 admin/owner"""
    result = await db.execute(select(Income).where(Income.id == income_id))
    income = result.scalar_one_or_none()
    if not income:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="수입을 찾을 수 없습니다")

    if income.user_id != current_user.id:
        member = await get_household_member(income.household_id, current_user, db)
        if member.role not in ("admin", "owner"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="이 항목을 수정할 권한이 없습니다",
            )

    update_data = income_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(income, key, value)

    await db.commit()
    await db.refresh(income)
    return income
```

**Step 4: delete_income 구현 수정**

`backend/app/api/income.py:258-271`을 다음으로 교체:

```python
@router.delete("/{income_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_income(
    income_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """수입 삭제 — 본인 또는 admin/owner"""
    result = await db.execute(select(Income).where(Income.id == income_id))
    income = result.scalar_one_or_none()
    if not income:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="수입을 찾을 수 없습니다")

    if income.user_id != current_user.id:
        member = await get_household_member(income.household_id, current_user, db)
        if member.role not in ("admin", "owner"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="이 항목을 삭제할 권한이 없습니다",
            )

    await db.delete(income)
    await db.commit()
```

> Note: `get_household_member`를 import에 추가 필요 (`from app.api.dependencies import get_household_member`)

**Step 5: 테스트 실행 — 통과 확인**

Run: `cd backend && pytest tests/integration/test_api_income_permission.py -v`
Expected: PASS

**Step 6: 커밋**

```bash
git add backend/app/api/income.py tests/integration/test_api_income_permission.py
git commit -m "feat: 수입 수정/삭제 시 admin/owner 권한 허용 (#113)"
```

---

### Task 4: 프론트엔드 403 에러 처리

**Files:**
- Modify: `frontend/src/pages/ExpenseDetail.tsx:105-106,120-121`
- Modify: `frontend/src/pages/IncomeDetail.tsx:95-96,107-108`

**Step 1: ExpenseDetail.tsx — 403 분기 추가**

`frontend/src/pages/ExpenseDetail.tsx`의 catch 블록 수정:

수정 저장 catch (L105-106):
```typescript
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 403) {
        addToast('error', '이 항목을 수정할 권한이 없습니다')
      } else {
        addToast('error', '저장에 실패했습니다')
      }
    }
```

삭제 catch (L120-121):
```typescript
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 403) {
        addToast('error', '이 항목을 삭제할 권한이 없습니다')
      } else {
        addToast('error', '삭제에 실패했습니다')
      }
    }
```

**Step 2: IncomeDetail.tsx — 동일 패턴 적용**

`frontend/src/pages/IncomeDetail.tsx`의 catch 블록도 동일하게 수정 (L95-96, L107-108).

**Step 3: 프론트엔드 빌드 확인**

Run: `cd frontend && npm run lint && npm run build`
Expected: 에러 없음

**Step 4: 커밋**

```bash
git add frontend/src/pages/ExpenseDetail.tsx frontend/src/pages/IncomeDetail.tsx
git commit -m "feat: 지출/수입 수정·삭제 시 403 권한 에러 토스트 (#113)"
```

---

### Task 5: 문서 업데이트 + 전체 테스트

**Files:**
- Modify: `docs/PRODUCT.md:148-151`

**Step 1: PRODUCT.md D4 업데이트**

`docs/PRODUCT.md:148-151`을 다음으로 교체:

```markdown
### D4: 공유 지출 수정 권한
- **결정**: owner/admin은 가구 내 모든 거래를 수정/삭제 가능. member는 본인 거래만
- **이유**: 가계부 관리자가 오류 데이터를 직접 수정할 수 있어야 함
- **구현**: expenses.py, income.py PUT/DELETE에서 역할 기반 권한 체크. 403 응답 + 프론트엔드 토스트
```

**Step 2: 전체 백엔드 테스트**

Run: `cd backend && pytest --ignore=tests/integration/test_api_budget_bulk.py -v`
Expected: 기존 테스트 + 새 권한 테스트 모두 PASS

**Step 3: 프론트엔드 전체 체크**

Run: `cd frontend && npm run lint && npm run test:run && npm run build`
Expected: 모두 PASS

**Step 4: 커밋**

```bash
git add docs/PRODUCT.md
git commit -m "docs: D4 공유 지출 수정 권한 정책 업데이트 (#113)"
```
