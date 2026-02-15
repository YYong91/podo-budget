# 수입(Income) 기능 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 가계부 앱에 수입(Income) CRUD + 통계 + 자연어 입력 + 프론트엔드 UI를 추가한다.

**Architecture:** 기존 Expense 모델과 동일한 패턴의 독립적인 Income 모델을 생성한다. Category 모델에 `type` 필드를 추가하여 수입/지출 카테고리를 구분한다. Chat API의 LLM 프롬프트를 확장하여 수입/지출을 자동 분류한다.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 (async), Alembic, Pydantic v2, React 18, TypeScript, Vite, Tailwind CSS v4, Chart.js, Zustand, MSW, Vitest

**설계 문서:** `docs/plans/2026-02-15-income-design.md`

---

## Task 1: Income 모델 생성

**Files:**
- Create: `backend/app/models/income.py`
- Modify: `backend/app/models/__init__.py`
- Modify: `backend/app/models/user.py`
- Modify: `backend/app/models/category.py`
- Test: `backend/tests/unit/test_income_model.py`

**Step 1: Write the failing test**

Create `backend/tests/unit/test_income_model.py`:

```python
"""수입 모델 단위 테스트"""

import pytest
from sqlalchemy import select

from app.models.income import Income


@pytest.mark.asyncio
async def test_create_income(db_session):
    """수입 레코드 생성 테스트"""
    from datetime import datetime

    from app.core.auth import hash_password
    from app.models.user import User

    user = User(username="income_test_user", hashed_password=hash_password("pw123456"))  # pragma: allowlist secret
    db_session.add(user)
    await db_session.flush()

    income = Income(
        user_id=user.id,
        amount=3500000,
        description="월급",
        date=datetime(2026, 2, 1, 9, 0, 0),
    )
    db_session.add(income)
    await db_session.commit()

    result = await db_session.execute(select(Income))
    incomes = result.scalars().all()
    assert len(incomes) == 1
    assert incomes[0].amount == 3500000
    assert incomes[0].description == "월급"
    assert incomes[0].user_id == user.id
    assert incomes[0].household_id is None


@pytest.mark.asyncio
async def test_income_with_category(db_session):
    """카테고리가 있는 수입 테스트"""
    from datetime import datetime

    from app.core.auth import hash_password
    from app.models.category import Category
    from app.models.user import User

    user = User(username="income_cat_user", hashed_password=hash_password("pw123456"))  # pragma: allowlist secret
    db_session.add(user)
    await db_session.flush()

    category = Category(name="급여", user_id=user.id)
    db_session.add(category)
    await db_session.flush()

    income = Income(
        user_id=user.id,
        amount=3500000,
        description="2월 월급",
        category_id=category.id,
        date=datetime(2026, 2, 1),
    )
    db_session.add(income)
    await db_session.commit()

    result = await db_session.execute(select(Income).where(Income.category_id == category.id))
    assert result.scalar_one().description == "2월 월급"


@pytest.mark.asyncio
async def test_income_with_household(db_session):
    """가구 공유 수입 테스트"""
    from datetime import datetime

    from app.core.auth import hash_password
    from app.models.household import Household
    from app.models.user import User

    user = User(username="income_hh_user", hashed_password=hash_password("pw123456"))  # pragma: allowlist secret
    db_session.add(user)
    await db_session.flush()

    household = Household(name="우리집", created_by=user.id)
    db_session.add(household)
    await db_session.flush()

    income = Income(
        user_id=user.id,
        household_id=household.id,
        amount=3500000,
        description="공유 수입",
        date=datetime(2026, 2, 1),
    )
    db_session.add(income)
    await db_session.commit()

    result = await db_session.execute(select(Income).where(Income.household_id == household.id))
    assert result.scalar_one().household_id == household.id
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/unit/test_income_model.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.models.income'`

**Step 3: Write minimal implementation**

Create `backend/app/models/income.py`:

```python
"""수입 엔티티 모델

사용자별 수입 기록을 저장하는 Income 엔티티입니다.
user_id를 통해 각 사용자의 수입을 격리하며,
household_id가 있는 경우 해당 가구의 공유 수입으로 기록됩니다.
"""

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Income(Base):
    """수입 엔티티

    Attributes:
        id: 수입 고유 식별자 (Primary Key)
        user_id: 수입을 기록한 사용자 ID (Foreign Key)
        household_id: 공유 가구 ID (Foreign Key, nullable - None이면 개인 수입)
        amount: 수입 금액
        description: 수입 설명
        category_id: 카테고리 ID (Foreign Key, nullable)
        raw_input: 사용자가 입력한 원본 텍스트 (자연어 입력 시 사용)
        date: 수입 발생 일시
        created_at: 레코드 생성 시각
        updated_at: 레코드 수정 시각
    """

    __tablename__ = "incomes"
    __table_args__ = (
        Index("ix_incomes_date", "date"),
        Index("ix_incomes_category_id", "category_id"),
        Index("ix_incomes_household_date", "household_id", "date"),
        Index("ix_incomes_user_date", "user_id", "date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="SET NULL"), nullable=True, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    description = Column(String, nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    raw_input = Column(Text, nullable=True)
    date = Column(DateTime, nullable=False, default=func.now())
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="incomes")
    category = relationship("Category", back_populates="incomes")
    household = relationship("Household", back_populates="incomes")
```

Modify `backend/app/models/__init__.py` — add Income import:

```python
from app.models.budget import Budget
from app.models.category import Category
from app.models.expense import Expense
from app.models.household import Household
from app.models.household_invitation import HouseholdInvitation
from app.models.household_member import HouseholdMember
from app.models.income import Income
from app.models.user import User

__all__ = [
    "Budget",
    "Category",
    "Expense",
    "Household",
    "HouseholdInvitation",
    "HouseholdMember",
    "Income",
    "User",
]
```

Modify `backend/app/models/user.py:38` — add incomes relationship:

```python
    incomes = relationship("Income", back_populates="user")
```

Modify `backend/app/models/category.py:40` — add incomes relationship:

```python
    incomes = relationship("Income", back_populates="category")
```

Modify `backend/app/models/household.py` — add incomes relationship (alongside existing `expenses`):

```python
    incomes = relationship("Income", back_populates="household")
```

**Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/unit/test_income_model.py -v`
Expected: 3 passed

**Step 5: Commit**

```bash
git add backend/app/models/income.py backend/app/models/__init__.py backend/app/models/user.py backend/app/models/category.py backend/app/models/household.py backend/tests/unit/test_income_model.py
git commit -m "feat: Income 모델 생성 및 관계 설정"
```

---

## Task 2: Category type 필드 추가

**Files:**
- Modify: `backend/app/models/category.py`
- Modify: `backend/app/schemas/category.py`
- Test: `backend/tests/unit/test_category_type.py`

**Step 1: Write the failing test**

Create `backend/tests/unit/test_category_type.py`:

```python
"""카테고리 type 필드 테스트"""

import pytest
from sqlalchemy import select

from app.models.category import Category


@pytest.mark.asyncio
async def test_category_default_type(db_session):
    """카테고리 기본 type은 'expense'"""
    category = Category(name="식비")
    db_session.add(category)
    await db_session.commit()

    result = await db_session.execute(select(Category))
    cat = result.scalar_one()
    assert cat.type == "expense"


@pytest.mark.asyncio
async def test_category_income_type(db_session):
    """수입 카테고리 생성"""
    category = Category(name="급여", type="income")
    db_session.add(category)
    await db_session.commit()

    result = await db_session.execute(select(Category).where(Category.type == "income"))
    cat = result.scalar_one()
    assert cat.name == "급여"
    assert cat.type == "income"


@pytest.mark.asyncio
async def test_category_both_type(db_session):
    """양쪽 모두 사용 가능한 카테고리"""
    category = Category(name="기타", type="both")
    db_session.add(category)
    await db_session.commit()

    result = await db_session.execute(select(Category).where(Category.type == "both"))
    assert result.scalar_one().type == "both"


@pytest.mark.asyncio
async def test_filter_by_income_type(db_session):
    """수입/지출 타입 필터링"""
    db_session.add_all([
        Category(name="식비", type="expense"),
        Category(name="급여", type="income"),
        Category(name="기타", type="both"),
    ])
    await db_session.commit()

    # 수입에서 사용 가능한 카테고리: income + both
    result = await db_session.execute(
        select(Category).where(Category.type.in_(["income", "both"])).order_by(Category.name)
    )
    cats = result.scalars().all()
    assert len(cats) == 2
    assert {c.name for c in cats} == {"급여", "기타"}
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/unit/test_category_type.py -v`
Expected: FAIL — `AttributeError: type object 'Category' has no attribute 'type'`

**Step 3: Write minimal implementation**

Modify `backend/app/models/category.py:36` — add type column after description:

```python
    type = Column(String(10), nullable=False, default="expense")  # expense | income | both
```

Modify `backend/app/schemas/category.py` — add type field:

```python
"""카테고리 스키마"""

from datetime import datetime

from pydantic import BaseModel


class CategoryBase(BaseModel):
    name: str
    description: str | None = None


class CategoryCreate(CategoryBase):
    type: str = "expense"


class CategoryUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    type: str | None = None


class CategoryResponse(CategoryBase):
    id: int
    type: str = "expense"
    created_at: datetime

    class Config:
        from_attributes = True
```

**Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/unit/test_category_type.py -v`
Expected: 4 passed

**Step 5: Run ALL existing tests to verify no regressions**

Run: `cd backend && python -m pytest -v`
Expected: All existing tests still pass (기존 카테고리의 default="expense"로 하위 호환)

**Step 6: Commit**

```bash
git add backend/app/models/category.py backend/app/schemas/category.py backend/tests/unit/test_category_type.py
git commit -m "feat: Category 모델에 type 필드 추가 (expense/income/both)"
```

---

## Task 3: Alembic 마이그레이션 생성

**Files:**
- Create: `backend/alembic/versions/xxxx_add_income_and_category_type.py` (auto-generated)

**Step 1: Generate migration**

```bash
cd backend && alembic revision --autogenerate -m "add_incomes_table_and_category_type"
```

**Step 2: Review generated migration**

확인 사항:
- `incomes` 테이블 생성 (id, user_id, household_id, amount, description, category_id, raw_input, date, created_at, updated_at)
- `categories` 테이블에 `type` 컬럼 추가 (server_default="expense")
- 인덱스 4개 생성 (ix_incomes_date, ix_incomes_category_id, ix_incomes_household_date, ix_incomes_user_date)

**Step 3: Apply migration**

```bash
cd backend && alembic upgrade head
```

**Step 4: Commit**

```bash
git add backend/alembic/versions/
git commit -m "feat: 수입 테이블 + 카테고리 type 필드 마이그레이션"
```

---

## Task 4: Income 스키마 생성

**Files:**
- Create: `backend/app/schemas/income.py`

**Step 1: Write the failing test**

Create `backend/tests/unit/test_income_schemas.py`:

```python
"""수입 스키마 유효성 테스트"""

from datetime import datetime

import pytest
from pydantic import ValidationError

from app.schemas.income import IncomeCreate, IncomeResponse, IncomeUpdate


def test_income_create_valid():
    """유효한 수입 생성 스키마"""
    income = IncomeCreate(
        amount=3500000,
        description="월급",
        date=datetime(2026, 2, 1),
    )
    assert income.amount == 3500000
    assert income.description == "월급"


def test_income_create_with_optional_fields():
    """선택 필드 포함 수입 생성"""
    income = IncomeCreate(
        amount=500000,
        description="보너스",
        date=datetime(2026, 2, 15),
        category_id=1,
        raw_input="보너스 50만원",
        household_id=1,
    )
    assert income.category_id == 1
    assert income.household_id == 1


def test_income_create_invalid_amount():
    """금액 0 이하 검증"""
    with pytest.raises(ValidationError):
        IncomeCreate(amount=0, description="무효", date=datetime(2026, 2, 1))

    with pytest.raises(ValidationError):
        IncomeCreate(amount=-1000, description="무효", date=datetime(2026, 2, 1))


def test_income_update_partial():
    """부분 수정 스키마"""
    update = IncomeUpdate(amount=4000000)
    assert update.amount == 4000000
    assert update.description is None
    assert update.date is None


def test_income_response_from_attributes():
    """응답 스키마 from_attributes"""
    data = {
        "id": 1,
        "user_id": 1,
        "household_id": None,
        "amount": 3500000,
        "description": "월급",
        "category_id": None,
        "raw_input": None,
        "date": datetime(2026, 2, 1),
        "created_at": datetime(2026, 2, 1),
        "updated_at": datetime(2026, 2, 1),
    }
    response = IncomeResponse(**data)
    assert response.id == 1
    assert response.amount == 3500000
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/unit/test_income_schemas.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.schemas.income'`

**Step 3: Write minimal implementation**

Create `backend/app/schemas/income.py`:

```python
"""수입 스키마"""

from datetime import datetime

from pydantic import BaseModel, Field


class IncomeBase(BaseModel):
    amount: float = Field(..., gt=0, description="수입 금액 (0보다 커야 함)")
    description: str
    category_id: int | None = None
    date: datetime


class IncomeCreate(IncomeBase):
    raw_input: str | None = None
    household_id: int | None = None


class IncomeUpdate(BaseModel):
    amount: float | None = Field(None, gt=0, description="수입 금액 (0보다 커야 함)")
    description: str | None = None
    category_id: int | None = None
    date: datetime | None = None


class IncomeResponse(IncomeBase):
    id: int
    raw_input: str | None = None
    household_id: int | None = None
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

**Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/unit/test_income_schemas.py -v`
Expected: 5 passed

**Step 5: Commit**

```bash
git add backend/app/schemas/income.py backend/tests/unit/test_income_schemas.py
git commit -m "feat: Income Pydantic 스키마 생성"
```

---

## Task 5: Income CRUD API 생성

**Files:**
- Create: `backend/app/api/income.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/integration/test_api_income.py`

**Step 1: Write the failing tests**

Create `backend/tests/integration/test_api_income.py`:

```python
"""수입 CRUD API 통합 테스트"""

import pytest
from sqlalchemy import select

from app.models.income import Income
from app.models.user import User


@pytest.mark.asyncio
async def test_create_income(authenticated_client, test_user: User, db_session):
    """수입 생성 API 테스트"""
    payload = {
        "amount": 3500000,
        "description": "2월 월급",
        "category_id": None,
        "date": "2026-02-01T09:00:00",
        "raw_input": "월급 350만원",
    }
    response = await authenticated_client.post("/api/income/", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["amount"] == 3500000
    assert data["description"] == "2월 월급"
    assert data["user_id"] == test_user.id

    # DB 검증
    result = await db_session.execute(select(Income))
    incomes = result.scalars().all()
    assert len(incomes) == 1


@pytest.mark.asyncio
async def test_create_income_invalid_amount(authenticated_client):
    """금액 0 이하면 422"""
    payload = {
        "amount": 0,
        "description": "무효",
        "date": "2026-02-01T00:00:00",
    }
    response = await authenticated_client.post("/api/income/", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_incomes(authenticated_client, test_user: User, db_session):
    """수입 목록 조회"""
    from datetime import datetime

    for i in range(3):
        db_session.add(Income(
            user_id=test_user.id,
            amount=1000000 * (i + 1),
            description=f"수입 {i + 1}",
            date=datetime(2026, 2, i + 1),
        ))
    await db_session.commit()

    response = await authenticated_client.get("/api/income/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 3


@pytest.mark.asyncio
async def test_get_incomes_with_date_filter(authenticated_client, test_user: User, db_session):
    """날짜 필터링"""
    from datetime import datetime

    db_session.add(Income(user_id=test_user.id, amount=100000, description="1월 수입", date=datetime(2026, 1, 15)))
    db_session.add(Income(user_id=test_user.id, amount=200000, description="2월 수입", date=datetime(2026, 2, 15)))
    await db_session.commit()

    response = await authenticated_client.get("/api/income/?start_date=2026-02-01T00:00:00&end_date=2026-02-28T23:59:59")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["description"] == "2월 수입"


@pytest.mark.asyncio
async def test_get_incomes_pagination(authenticated_client, test_user: User, db_session):
    """페이지네이션"""
    from datetime import datetime

    for i in range(5):
        db_session.add(Income(user_id=test_user.id, amount=100000, description=f"수입 {i}", date=datetime(2026, 2, 1)))
    await db_session.commit()

    response = await authenticated_client.get("/api/income/?skip=0&limit=2")
    assert response.status_code == 200
    assert len(response.json()) == 2

    response = await authenticated_client.get("/api/income/?skip=2&limit=2")
    assert len(response.json()) == 2


@pytest.mark.asyncio
async def test_get_income_by_id(authenticated_client, test_user: User, db_session):
    """단일 수입 조회"""
    from datetime import datetime

    income = Income(user_id=test_user.id, amount=3500000, description="월급", date=datetime(2026, 2, 1))
    db_session.add(income)
    await db_session.commit()
    await db_session.refresh(income)

    response = await authenticated_client.get(f"/api/income/{income.id}")
    assert response.status_code == 200
    assert response.json()["amount"] == 3500000


@pytest.mark.asyncio
async def test_get_income_not_found(authenticated_client):
    """존재하지 않는 수입 조회 → 404"""
    response = await authenticated_client.get("/api/income/99999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_other_user_income(authenticated_client, authenticated_client2, test_user2: User, db_session):
    """다른 사용자의 수입 조회 → 404"""
    from datetime import datetime

    income = Income(user_id=test_user2.id, amount=5000000, description="타인 수입", date=datetime(2026, 2, 1))
    db_session.add(income)
    await db_session.commit()
    await db_session.refresh(income)

    response = await authenticated_client.get(f"/api/income/{income.id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_income(authenticated_client, test_user: User, db_session):
    """수입 수정"""
    from datetime import datetime

    income = Income(user_id=test_user.id, amount=3500000, description="월급", date=datetime(2026, 2, 1))
    db_session.add(income)
    await db_session.commit()
    await db_session.refresh(income)

    response = await authenticated_client.put(f"/api/income/{income.id}", json={"amount": 4000000})
    assert response.status_code == 200
    assert response.json()["amount"] == 4000000


@pytest.mark.asyncio
async def test_update_other_user_income(authenticated_client, test_user2: User, db_session):
    """다른 사용자의 수입 수정 → 404"""
    from datetime import datetime

    income = Income(user_id=test_user2.id, amount=5000000, description="타인 수입", date=datetime(2026, 2, 1))
    db_session.add(income)
    await db_session.commit()
    await db_session.refresh(income)

    response = await authenticated_client.put(f"/api/income/{income.id}", json={"amount": 1})
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_income(authenticated_client, test_user: User, db_session):
    """수입 삭제"""
    from datetime import datetime

    income = Income(user_id=test_user.id, amount=3500000, description="월급", date=datetime(2026, 2, 1))
    db_session.add(income)
    await db_session.commit()
    await db_session.refresh(income)

    response = await authenticated_client.delete(f"/api/income/{income.id}")
    assert response.status_code == 204

    # DB 확인
    result = await db_session.execute(select(Income))
    assert result.scalars().all() == []


@pytest.mark.asyncio
async def test_delete_other_user_income(authenticated_client, test_user2: User, db_session):
    """다른 사용자의 수입 삭제 → 404"""
    from datetime import datetime

    income = Income(user_id=test_user2.id, amount=5000000, description="타인 수입", date=datetime(2026, 2, 1))
    db_session.add(income)
    await db_session.commit()
    await db_session.refresh(income)

    response = await authenticated_client.delete(f"/api/income/{income.id}")
    assert response.status_code == 404
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/integration/test_api_income.py -v`
Expected: FAIL — 404 (라우터 미등록)

**Step 3: Write minimal implementation**

Create `backend/app/api/income.py`:

```python
"""수입 CRUD API 라우트

사용자별로 수입 데이터를 격리하여 관리합니다.
모든 엔드포인트는 JWT 인증이 필요하며, 각 사용자는 자신의 수입만 조회/수정할 수 있습니다.

공유 가계부(Household) 연동:
- household_id가 있으면 해당 가구의 공유 수입으로 기록
- household_id가 없으면 사용자의 활성 가구를 자동 감지
- 가구 멤버 전체의 수입을 함께 조회할 수 있음
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_household_member, get_user_active_household_id
from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.income import Income
from app.models.user import User
from app.schemas.income import IncomeCreate, IncomeResponse, IncomeUpdate

router = APIRouter()


@router.post("/", response_model=IncomeResponse, status_code=status.HTTP_201_CREATED)
async def create_income(
    income: IncomeCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """수입 생성"""
    household_id = income.household_id
    if household_id is None:
        household_id = await get_user_active_household_id(current_user, db)

    if household_id is not None:
        await get_household_member(household_id, current_user, db)

    income_data = income.model_dump(exclude={"household_id"})
    db_income = Income(**income_data, user_id=current_user.id, household_id=household_id)
    db.add(db_income)
    await db.commit()
    await db.refresh(db_income)
    return db_income


@router.get("/", response_model=list[IncomeResponse])
async def get_incomes(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    category_id: int | None = None,
    household_id: int | None = None,
    member_user_id: int | None = Query(None, description="가구 내 특정 멤버의 수입만 조회"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """수입 목록 조회 (필터링, 페이지네이션)"""
    if household_id is not None:
        await get_household_member(household_id, current_user, db)
        query = select(Income).where(Income.household_id == household_id)
        if member_user_id is not None:
            query = query.where(Income.user_id == member_user_id)
    else:
        query = select(Income).where(Income.user_id == current_user.id)

    if start_date:
        query = query.where(Income.date >= start_date)
    if end_date:
        query = query.where(Income.date <= end_date)
    if category_id is not None:
        query = query.where(Income.category_id == category_id)

    query = query.order_by(Income.date.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{income_id}", response_model=IncomeResponse)
async def get_income(
    income_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """단일 수입 조회"""
    result = await db.execute(select(Income).where(Income.id == income_id))
    income = result.scalar_one_or_none()
    if not income:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="수입을 찾을 수 없습니다")

    if income.household_id is not None:
        await get_household_member(income.household_id, current_user, db)
    elif income.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="수입을 찾을 수 없습니다")

    return income


@router.put("/{income_id}", response_model=IncomeResponse)
async def update_income(
    income_id: int,
    income_update: IncomeUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """수입 수정 (본인 것만)"""
    result = await db.execute(select(Income).where(Income.id == income_id, Income.user_id == current_user.id))
    income = result.scalar_one_or_none()
    if not income:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="수입을 찾을 수 없습니다")

    update_data = income_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(income, key, value)

    await db.commit()
    await db.refresh(income)
    return income


@router.delete("/{income_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_income(
    income_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """수입 삭제 (본인 것만)"""
    result = await db.execute(select(Income).where(Income.id == income_id, Income.user_id == current_user.id))
    income = result.scalar_one_or_none()
    if not income:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="수입을 찾을 수 없습니다")

    await db.delete(income)
    await db.commit()
```

Modify `backend/app/main.py` — register income router (add import and include_router):

```python
# 기존 import에 추가
from app.api import auth, budget, categories, chat, expenses, households, income, insights, invitations, kakao, telegram

# 라우터 등록부에 추가
app.include_router(income.router, prefix="/api/income", tags=["income"])
```

**Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/integration/test_api_income.py -v`
Expected: 13 passed

**Step 5: Run ALL tests**

Run: `cd backend && python -m pytest -v`
Expected: All tests pass

**Step 6: Commit**

```bash
git add backend/app/api/income.py backend/app/main.py backend/tests/integration/test_api_income.py
git commit -m "feat: 수입 CRUD API 구현 + 통합 테스트"
```

---

## Task 6: Income 통계 API

**Files:**
- Modify: `backend/app/api/income.py`
- Create: `backend/app/schemas/income.py` (stats schemas 추가)
- Test: `backend/tests/integration/test_api_income_stats.py`

**Step 1: Write the failing tests**

Create `backend/tests/integration/test_api_income_stats.py`:

```python
"""수입 통계 API 통합 테스트"""

import pytest

from app.models.income import Income
from app.models.user import User


@pytest.mark.asyncio
async def test_income_stats_monthly(authenticated_client, test_user: User, db_session):
    """월간 수입 통계"""
    from datetime import datetime

    db_session.add_all([
        Income(user_id=test_user.id, amount=3500000, description="월급", date=datetime(2026, 2, 1)),
        Income(user_id=test_user.id, amount=500000, description="보너스", date=datetime(2026, 2, 15)),
    ])
    await db_session.commit()

    response = await authenticated_client.get("/api/income/stats?period=monthly&date=2026-02-15")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 4000000
    assert data["count"] == 2
    assert data["period"] == "monthly"


@pytest.mark.asyncio
async def test_income_stats_weekly(authenticated_client, test_user: User, db_session):
    """주간 수입 통계"""
    from datetime import datetime

    db_session.add(Income(user_id=test_user.id, amount=100000, description="용돈", date=datetime(2026, 2, 10)))
    await db_session.commit()

    response = await authenticated_client.get("/api/income/stats?period=weekly&date=2026-02-10")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 100000
    assert data["period"] == "weekly"


@pytest.mark.asyncio
async def test_income_stats_empty(authenticated_client):
    """수입 없는 기간의 통계"""
    response = await authenticated_client.get("/api/income/stats?period=monthly&date=2026-01-01")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert data["count"] == 0


@pytest.mark.asyncio
async def test_income_stats_by_category(authenticated_client, test_user: User, db_session):
    """카테고리별 수입 통계"""
    from datetime import datetime

    from app.models.category import Category

    cat1 = Category(name="급여", type="income", user_id=test_user.id)
    cat2 = Category(name="부수입", type="income", user_id=test_user.id)
    db_session.add_all([cat1, cat2])
    await db_session.flush()

    db_session.add_all([
        Income(user_id=test_user.id, amount=3500000, description="월급", category_id=cat1.id, date=datetime(2026, 2, 1)),
        Income(user_id=test_user.id, amount=200000, description="프리랜스", category_id=cat2.id, date=datetime(2026, 2, 10)),
    ])
    await db_session.commit()

    response = await authenticated_client.get("/api/income/stats?period=monthly&date=2026-02-15")
    assert response.status_code == 200
    data = response.json()
    assert len(data["by_category"]) == 2
    assert data["by_category"][0]["category"] == "급여"  # 금액 내림차순


@pytest.mark.asyncio
async def test_income_stats_trend(authenticated_client, test_user: User, db_session):
    """수입 추이 데이터"""
    from datetime import datetime

    db_session.add_all([
        Income(user_id=test_user.id, amount=3500000, description="월급", date=datetime(2026, 2, 1)),
        Income(user_id=test_user.id, amount=100000, description="용돈", date=datetime(2026, 2, 10)),
    ])
    await db_session.commit()

    response = await authenticated_client.get("/api/income/stats?period=monthly&date=2026-02-15")
    assert response.status_code == 200
    data = response.json()
    assert len(data["trend"]) >= 2
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/integration/test_api_income_stats.py -v`
Expected: FAIL — 404 (stats endpoint 미구현)

**Step 3: Write minimal implementation**

Modify `backend/app/api/income.py` — add stats endpoint (above `/{income_id}` route):

```python
# 날짜 유틸 함수들 — expenses.py와 동일한 패턴

from calendar import monthrange
from datetime import date, timedelta

from sqlalchemy import func

from app.schemas.expense import (
    CategoryStats,
    StatsPeriod,
    StatsResponse,
    TrendPoint,
)


def _get_week_range(d: date) -> tuple[date, date]:
    monday = d - timedelta(days=d.weekday())
    sunday = monday + timedelta(days=6)
    return monday, sunday


def _get_week_label(d: date) -> str:
    first_day = d.replace(day=1)
    week_num = (d.day + first_day.weekday() - 1) // 7 + 1
    return f"{d.month}월 {week_num}주차"


def _get_month_range(d: date) -> tuple[date, date]:
    first = d.replace(day=1)
    _, last_day = monthrange(d.year, d.month)
    last = d.replace(day=last_day)
    return first, last


def _get_year_range(d: date) -> tuple[date, date]:
    return date(d.year, 1, 1), date(d.year, 12, 31)


def _build_income_scope_filter(household_id: int | None, current_user: User):
    if household_id is not None:
        return Income.household_id == household_id
    return Income.user_id == current_user.id


@router.get("/stats", response_model=StatsResponse)
async def get_income_stats(
    period: StatsPeriod = Query(..., description="통계 기간: weekly, monthly, yearly"),
    date: str | None = Query(None, description="기준 날짜 YYYY-MM-DD", alias="date"),
    household_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """수입 기간별 통계 (주간/월간/연간)"""
    from datetime import date as date_type

    from app.models.category import Category

    ref_date = date_type.fromisoformat(date) if date else date_type.today()

    if period == StatsPeriod.weekly:
        start_d, end_d = _get_week_range(ref_date)
        label = _get_week_label(ref_date)
    elif period == StatsPeriod.monthly:
        start_d, end_d = _get_month_range(ref_date)
        label = f"{ref_date.year}년 {ref_date.month}월"
    else:
        start_d, end_d = _get_year_range(ref_date)
        label = f"{ref_date.year}년"

    start_dt = datetime(start_d.year, start_d.month, start_d.day)
    end_dt = datetime(end_d.year, end_d.month, end_d.day, 23, 59, 59)

    if household_id is not None:
        await get_household_member(household_id, current_user, db)
    scope_filter = _build_income_scope_filter(household_id, current_user)
    base_where = [scope_filter, Income.date >= start_dt, Income.date <= end_dt]

    total_result = await db.execute(
        select(func.coalesce(func.sum(Income.amount), 0), func.count(Income.id)).where(*base_where)
    )
    row = total_result.one()
    total = float(row[0])
    count = int(row[1])

    cat_result = await db.execute(
        select(Category.name, func.sum(Income.amount).label("amount"), func.count(Income.id).label("cnt"))
        .join(Category, Income.category_id == Category.id, isouter=True)
        .where(*base_where)
        .group_by(Category.name)
        .order_by(func.sum(Income.amount).desc())
    )
    by_category = []
    for r in cat_result.all():
        amt = float(r.amount)
        by_category.append(CategoryStats(
            category=r.name or "미분류",
            amount=amt,
            count=int(r.cnt),
            percentage=round(amt / total * 100, 1) if total > 0 else 0,
        ))

    trend: list[TrendPoint] = []
    if period == StatsPeriod.yearly:
        for m in range(1, 13):
            m_start = datetime(ref_date.year, m, 1)
            _, m_last = monthrange(ref_date.year, m)
            m_end = datetime(ref_date.year, m, m_last, 23, 59, 59)
            r = await db.execute(select(func.coalesce(func.sum(Income.amount), 0)).where(scope_filter, Income.date >= m_start, Income.date <= m_end))
            trend.append(TrendPoint(label=f"{m}월", amount=float(r.scalar())))
    else:
        day_col = func.date(Income.date).label("day")
        daily_result = await db.execute(select(day_col, func.sum(Income.amount).label("amount")).where(*base_where).group_by(day_col).order_by(day_col))
        for r in daily_result.all():
            if r.day is not None:
                day_str = str(r.day)[:10]
                trend.append(TrendPoint(label=day_str[5:].replace("-", "/"), amount=float(r.amount)))

    return StatsResponse(
        period=period.value, label=label, start_date=str(start_d), end_date=str(end_d),
        total=total, count=count, by_category=by_category, trend=trend,
    )
```

**중요:** stats endpoint는 `/{income_id}` 라우트보다 **위에** 배치해야 합니다 (FastAPI 경로 매칭 순서).

**Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/integration/test_api_income_stats.py -v`
Expected: 5 passed

**Step 5: Run ALL tests**

Run: `cd backend && python -m pytest -v`

**Step 6: Commit**

```bash
git add backend/app/api/income.py backend/tests/integration/test_api_income_stats.py
git commit -m "feat: 수입 통계 API 구현 (기간별/카테고리별/추이)"
```

---

## Task 7: Chat API 수입 분류 확장

**Files:**
- Modify: `backend/app/services/prompts.py`
- Modify: `backend/app/schemas/chat.py`
- Modify: `backend/app/api/chat.py`
- Test: `backend/tests/integration/test_chat_income.py`

**Step 1: Write the failing tests**

Create `backend/tests/integration/test_chat_income.py`:

```python
"""채팅 수입 분류 테스트"""

import pytest
from unittest.mock import AsyncMock, patch

from app.models.income import Income
from app.models.user import User
from sqlalchemy import select


@pytest.mark.asyncio
async def test_chat_income_preview(authenticated_client, mock_llm_parse_expense):
    """수입 프리뷰 — LLM이 type=income을 반환"""
    mock_llm_parse_expense.return_value = {
        "amount": 3500000,
        "category": "급여",
        "description": "월급",
        "date": "2026-02-01",
        "memo": "",
        "type": "income",
    }

    response = await authenticated_client.post("/api/chat/", json={"message": "월급 350만원 들어왔어", "preview": True})
    assert response.status_code == 201
    data = response.json()
    assert data["parsed_items"] is not None
    assert len(data["parsed_items"]) == 1
    assert data["parsed_items"][0]["type"] == "income"
    assert data["parsed_items"][0]["amount"] == 3500000


@pytest.mark.asyncio
async def test_chat_income_save(authenticated_client, test_user: User, db_session, mock_llm_parse_expense):
    """수입 저장 — type=income이면 Income 모델에 저장"""
    mock_llm_parse_expense.return_value = {
        "amount": 3500000,
        "category": "급여",
        "description": "월급",
        "date": "2026-02-01",
        "memo": "",
        "type": "income",
    }

    response = await authenticated_client.post("/api/chat/", json={"message": "월급 350만원"})
    assert response.status_code == 201
    data = response.json()
    assert "수입" in data["message"] or "기록" in data["message"]

    # Income 테이블에 저장 확인
    result = await db_session.execute(select(Income))
    incomes = result.scalars().all()
    assert len(incomes) == 1
    assert incomes[0].amount == 3500000


@pytest.mark.asyncio
async def test_chat_expense_still_works(authenticated_client, test_user: User, db_session, mock_llm_parse_expense):
    """기존 지출 파싱 기능이 여전히 동작"""
    mock_llm_parse_expense.return_value = {
        "amount": 8000,
        "category": "식비",
        "description": "김치찌개",
        "date": "2026-02-15",
        "memo": "",
    }

    response = await authenticated_client.post("/api/chat/", json={"message": "점심 김치찌개 8000원"})
    assert response.status_code == 201

    # Expense 테이블에 저장 확인 (type 필드 없으면 지출)
    from app.models.expense import Expense
    result = await db_session.execute(select(Expense))
    expenses = result.scalars().all()
    assert len(expenses) == 1
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/integration/test_chat_income.py -v`
Expected: FAIL (type=income 처리 미구현)

**Step 3: Write minimal implementation**

Modify `backend/app/services/prompts.py` — 프롬프트에 수입 분류 규칙 추가:

시스템 프롬프트에 다음 내용을 **추가**:

```
## 수입 vs 지출 분류

**수입 키워드**: 월급, 급여, 보너스, 상여금, 용돈 받음, 환불, 수입, 들어왔, 입금, 이자, 배당금, 임대 수익, 프리랜스 수입
**지출 키워드**: 그 외 모든 지출 관련 표현

수입인 경우 JSON에 `"type": "income"` 필드를 추가합니다.
지출인 경우 `"type"` 필드를 추가하지 않거나 `"type": "expense"`로 설정합니다.

입력: "월급 350만원 들어왔어"
```json
{{"amount": 3500000, "category": "급여", "description": "월급", "date": "{today}", "memo": "", "type": "income"}}
```

입력: "보너스 50만원"
```json
{{"amount": 500000, "category": "급여", "description": "보너스", "date": "{today}", "memo": "", "type": "income"}}
```
```

Modify `backend/app/schemas/chat.py` — ParsedExpenseItem에 type 필드 추가:

```python
class ParsedExpenseItem(BaseModel):
    """LLM이 파싱한 개별 항목 (저장 전 프리뷰용)"""

    amount: float
    description: str
    category: str
    date: str
    memo: str = ""
    household_id: int | None = None
    type: str = "expense"  # "expense" | "income"
```

ChatResponse 수정 — `parsed_expenses`를 `parsed_items`로 이름 변경하고, `incomes_created` 추가:

```python
class ChatResponse(BaseModel):
    message: str
    expenses_created: list[ExpenseResponse] | None = None
    incomes_created: list["IncomeResponse"] | None = None
    parsed_items: list[ParsedExpenseItem] | None = None
    # 하위 호환
    parsed_expenses: list[ParsedExpenseItem] | None = None
    insights: str | None = None
```

**주의:** `IncomeResponse`를 import할 때 순환 참조 방지를 위해 `from __future__ import annotations`를 사용하거나 문자열 참조를 사용합니다.

Modify `backend/app/api/chat.py` — 수입/지출 분류 로직 추가:

`_to_parsed_items` 함수에 type 필드 포함:

```python
def _to_parsed_items(parsed: dict | list, household_id: int | None = None) -> list[ParsedExpenseItem]:
    items = [parsed] if isinstance(parsed, dict) else parsed
    result = []
    for item in items:
        result.append(
            ParsedExpenseItem(
                amount=item["amount"],
                description=item.get("description", ""),
                category=item.get("category", "기타"),
                date=item.get("date", datetime.now().strftime("%Y-%m-%d")),
                memo=item.get("memo", ""),
                household_id=household_id,
                type=item.get("type", "expense"),
            )
        )
    return result
```

일반 모드 저장 로직에서 type에 따라 Expense 또는 Income 생성:

```python
    # 일반 모드: 파싱 후 DB에 저장
    items = [parsed] if isinstance(parsed, dict) else parsed
    created_expenses = []
    created_incomes = []

    for item in items:
        item_type = item.get("type", "expense")
        category = await get_or_create_category(db, item.get("category", "기타"), current_user.id)

        if item_type == "income":
            from app.models.income import Income
            record = Income(
                user_id=current_user.id,
                household_id=household_id,
                amount=item["amount"],
                description=item.get("description", chat_request.message),
                category_id=category.id,
                raw_input=chat_request.message,
                date=datetime.fromisoformat(item.get("date", datetime.now().isoformat())),
            )
            db.add(record)
            created_incomes.append(record)
        else:
            record = Expense(
                user_id=current_user.id,
                household_id=household_id,
                amount=item["amount"],
                description=item.get("description", chat_request.message),
                category_id=category.id,
                raw_input=chat_request.message,
                date=datetime.fromisoformat(item.get("date", datetime.now().isoformat())),
            )
            db.add(record)
            created_expenses.append(record)

    await db.commit()
    for r in created_expenses + created_incomes:
        await db.refresh(r)

    # 응답 메시지 생성
    all_items = items
    total_amount = sum(item["amount"] for item in all_items)
    count = len(all_items)
    income_count = len(created_incomes)
    expense_count = len(created_expenses)

    if count == 1:
        item_type = "수입" if income_count > 0 else "지출"
        msg = f"₩{int(all_items[0]['amount']):,}이(가) [{all_items[0].get('category', '기타')}] 카테고리로 {item_type} 기록되었습니다."
    else:
        parts = []
        if expense_count > 0:
            parts.append(f"지출 {expense_count}건")
        if income_count > 0:
            parts.append(f"수입 {income_count}건")
        msg = f"{' + '.join(parts)}(총 ₩{total_amount:,})이 기록되었습니다."

    from app.schemas.income import IncomeResponse

    return ChatResponse(
        message=msg,
        expenses_created=[ExpenseResponse.model_validate(exp) for exp in created_expenses] if created_expenses else None,
        incomes_created=[IncomeResponse.model_validate(inc) for inc in created_incomes] if created_incomes else None,
        parsed_items=None,
        parsed_expenses=None,
        insights=None,
    )
```

Preview 모드에서도 `parsed_items` 필드 사용:

```python
    if chat_request.preview:
        parsed_items = _to_parsed_items(parsed, household_id=household_id)
        count = len(parsed_items)
        total = sum(item.amount for item in parsed_items)
        income_count = sum(1 for item in parsed_items if item.type == "income")
        expense_count = count - income_count

        parts = []
        if expense_count > 0:
            parts.append(f"지출 {expense_count}건")
        if income_count > 0:
            parts.append(f"수입 {income_count}건")

        return ChatResponse(
            message=f"{'과 '.join(parts)}(총 ₩{total:,.0f})을 인식했습니다. 확인 후 저장해주세요.",
            expenses_created=None,
            incomes_created=None,
            parsed_items=parsed_items,
            parsed_expenses=parsed_items,  # 하위 호환
            insights=None,
        )
```

**Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/integration/test_chat_income.py -v`
Expected: 3 passed

**Step 5: Run ALL tests to check no regressions**

Run: `cd backend && python -m pytest -v`
Expected: All existing chat tests still pass (하위 호환 유지)

**Step 6: Commit**

```bash
git add backend/app/services/prompts.py backend/app/schemas/chat.py backend/app/api/chat.py backend/tests/integration/test_chat_income.py
git commit -m "feat: Chat API 수입/지출 자동 분류 확장"
```

---

## Task 8: Frontend 타입 + API 클라이언트

**Files:**
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/src/api/income.ts`

**Step 1: Add Income types**

Modify `frontend/src/types/index.ts` — add Income interface:

```typescript
export interface Income {
  id: number
  amount: number
  description: string
  category_id: number | null
  raw_input: string | null
  household_id: number | null
  user_id: number
  date: string
  created_at: string
  updated_at: string
}
```

**Step 2: Create API client**

Create `frontend/src/api/income.ts`:

```typescript
/* 수입 API */

import apiClient from './client'
import type { Income, StatsResponse } from '../types'

interface GetIncomesParams {
  skip?: number
  limit?: number
  start_date?: string
  end_date?: string
  category_id?: number
  household_id?: number
  member_user_id?: number
}

export const incomeApi = {
  getAll: (params?: GetIncomesParams) =>
    apiClient.get<Income[]>('/income', { params }),

  getById: (id: number) =>
    apiClient.get<Income>(`/income/${id}`),

  create: (data: Partial<Income>) =>
    apiClient.post<Income>('/income', data),

  update: (id: number, data: Partial<Income>) =>
    apiClient.put<Income>(`/income/${id}`, data),

  delete: (id: number) =>
    apiClient.delete(`/income/${id}`),

  getStats: (period: string, date?: string, householdId?: number) =>
    apiClient.get<StatsResponse>('/income/stats', {
      params: {
        period,
        ...(date && { date }),
        ...(householdId != null && { household_id: householdId }),
      },
    }),
}
```

**Step 3: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/api/income.ts
git commit -m "feat: 수입 TypeScript 타입 + API 클라이언트 생성"
```

---

## Task 9: Frontend MSW 모킹

**Files:**
- Modify: `frontend/src/mocks/fixtures.ts`
- Modify: `frontend/src/mocks/handlers.ts`

**Step 1: Add income fixtures**

Modify `frontend/src/mocks/fixtures.ts` — add Income fixtures:

```typescript
import type { Income } from '../types'  // 기존 import에 추가

export const mockIncomes: Income[] = [
  {
    id: 1,
    amount: 3500000,
    description: '2월 월급',
    category_id: null,
    raw_input: '월급 350만원',
    household_id: null,
    user_id: 1,
    date: '2026-02-01T09:00:00Z',
    created_at: '2026-02-01T09:00:00Z',
    updated_at: '2026-02-01T09:00:00Z',
  },
  {
    id: 2,
    amount: 500000,
    description: '프리랜스 수입',
    category_id: null,
    raw_input: null,
    household_id: null,
    user_id: 1,
    date: '2026-02-10T10:00:00Z',
    created_at: '2026-02-10T10:00:00Z',
    updated_at: '2026-02-10T10:00:00Z',
  },
]

export const mockIncomeStats: StatsResponse = {
  period: 'monthly',
  label: '2026년 2월',
  start_date: '2026-02-01',
  end_date: '2026-02-28',
  total: 4000000,
  count: 2,
  by_category: [
    { category: '급여', amount: 3500000, count: 1, percentage: 87.5 },
    { category: '부수입', amount: 500000, count: 1, percentage: 12.5 },
  ],
  trend: [
    { label: '02/01', amount: 3500000 },
    { label: '02/10', amount: 500000 },
  ],
}
```

**Step 2: Add income MSW handlers**

Modify `frontend/src/mocks/handlers.ts` — add income handlers:

```typescript
import { mockIncomes, mockIncomeStats } from './fixtures'  // 기존 import에 추가

// ==================== 수입 API ====================

http.get(`${BASE_URL}/income`, ({ request }) => {
  const url = new URL(request.url)
  const skip = Number(url.searchParams.get('skip')) || 0
  const limit = Number(url.searchParams.get('limit')) || 20
  const startDate = url.searchParams.get('start_date')
  const endDate = url.searchParams.get('end_date')

  let filtered = [...mockIncomes]
  if (startDate) filtered = filtered.filter((i) => i.date >= startDate)
  if (endDate) filtered = filtered.filter((i) => i.date <= endDate)

  const paginated = filtered.slice(skip, skip + limit)
  return HttpResponse.json(paginated)
}),

http.get(`${BASE_URL}/income/stats`, () => {
  return HttpResponse.json(mockIncomeStats)
}),

http.get(`${BASE_URL}/income/:id`, ({ params }) => {
  const income = mockIncomes.find((i) => i.id === Number(params.id))
  if (!income) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
  return HttpResponse.json(income)
}),

http.post(`${BASE_URL}/income`, async ({ request }) => {
  const body = await request.json() as Partial<typeof mockIncomes[0]>
  const newIncome = {
    id: Math.max(...mockIncomes.map((i) => i.id)) + 1,
    amount: body.amount ?? 0,
    description: body.description ?? '',
    category_id: body.category_id ?? null,
    raw_input: body.raw_input ?? null,
    household_id: body.household_id ?? null,
    user_id: 1,
    date: body.date ?? new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  return HttpResponse.json(newIncome, { status: 201 })
}),

http.put(`${BASE_URL}/income/:id`, async ({ params, request }) => {
  const income = mockIncomes.find((i) => i.id === Number(params.id))
  if (!income) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
  const body = await request.json() as Partial<typeof mockIncomes[0]>
  return HttpResponse.json({ ...income, ...body, updated_at: new Date().toISOString() })
}),

http.delete(`${BASE_URL}/income/:id`, ({ params }) => {
  const income = mockIncomes.find((i) => i.id === Number(params.id))
  if (!income) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
  return HttpResponse.json(null, { status: 204 })
}),
```

**Step 3: Run existing FE tests to verify no regressions**

Run: `cd frontend && npm test`

**Step 4: Commit**

```bash
git add frontend/src/mocks/fixtures.ts frontend/src/mocks/handlers.ts
git commit -m "feat: 수입 MSW 모킹 (fixtures + handlers)"
```

---

## Task 10: Frontend 수입 목록 페이지

**Files:**
- Create: `frontend/src/pages/IncomeList.tsx`
- Create: `frontend/src/pages/__tests__/IncomeList.test.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`

**Step 1: Write tests first**

Create `frontend/src/pages/__tests__/IncomeList.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'
import IncomeList from '../IncomeList'

function renderIncomeList() {
  return render(
    <MemoryRouter>
      <IncomeList />
    </MemoryRouter>
  )
}

describe('IncomeList', () => {
  it('페이지 제목을 표시한다', async () => {
    renderIncomeList()
    expect(screen.getByText('수입 목록')).toBeInTheDocument()
  })

  it('수입 목록을 표시한다', async () => {
    renderIncomeList()
    await waitFor(() => {
      expect(screen.getByText('2월 월급')).toBeInTheDocument()
    })
    expect(screen.getByText('프리랜스 수입')).toBeInTheDocument()
  })

  it('금액을 원화로 표시한다', async () => {
    renderIncomeList()
    await waitFor(() => {
      expect(screen.getByText('₩3,500,000')).toBeInTheDocument()
    })
  })

  it('수입이 없으면 빈 상태를 표시한다', async () => {
    server.use(
      http.get('/api/income', () => HttpResponse.json([]))
    )
    renderIncomeList()
    await waitFor(() => {
      expect(screen.getByText(/수입 내역이 없습니다/)).toBeInTheDocument()
    })
  })

  it('에러 발생 시 에러 상태를 표시한다', async () => {
    server.use(
      http.get('/api/income', () => HttpResponse.json({ detail: 'Error' }, { status: 500 }))
    )
    renderIncomeList()
    await waitFor(() => {
      expect(screen.getByText('문제가 발생했습니다')).toBeInTheDocument()
    })
  })
})
```

**Step 2: Run tests, verify they fail**

Run: `cd frontend && npx vitest run src/pages/__tests__/IncomeList.test.tsx`
Expected: FAIL — module not found

**Step 3: Create IncomeList page**

Create `frontend/src/pages/IncomeList.tsx` — mirror ExpenseList but for income:

```typescript
/**
 * @file IncomeList.tsx
 * @description 수입 목록 페이지 - 필터링, 정렬, 페이지네이션
 */

import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { incomeApi } from '../api/income'
import { categoryApi } from '../api/categories'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import type { Income, Category, HouseholdMember } from '../types'

type SortField = 'date' | 'amount'
type SortDirection = 'asc' | 'desc'

function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

export default function IncomeList() {
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)
  const currentHousehold = useHouseholdStore((s) => s.currentHousehold)
  const fetchHouseholdDetail = useHouseholdStore((s) => s.fetchHouseholdDetail)

  const [incomes, setIncomes] = useState<Income[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [members, setMembers] = useState<HouseholdMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [page, setPage] = useState(0)
  const limit = 20

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [categoryId, setCategoryId] = useState<number | undefined>()
  const [memberUserId, setMemberUserId] = useState<number | undefined>()

  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  async function fetchIncomes() {
    setLoading(true)
    setError(false)
    try {
      const res = await incomeApi.getAll({
        skip: page * limit,
        limit,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        category_id: categoryId,
        household_id: activeHouseholdId ?? undefined,
        member_user_id: memberUserId,
      })
      setIncomes(res.data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <span className="text-stone-300 ml-1">⇅</span>
    return <span className="text-emerald-600 ml-1">{sortDirection === 'asc' ? '▲' : '▼'}</span>
  }

  const sortedIncomes = useMemo(() => {
    const sorted = [...incomes]
    sorted.sort((a, b) => {
      let comparison = 0
      if (sortField === 'date') comparison = a.date.localeCompare(b.date)
      else if (sortField === 'amount') comparison = a.amount - b.amount
      return sortDirection === 'asc' ? comparison : -comparison
    })
    return sorted
  }, [incomes, sortField, sortDirection])

  useEffect(() => { categoryApi.getAll().then((res) => setCategories(res.data)).catch(() => {}) }, [])

  useEffect(() => {
    if (activeHouseholdId) fetchHouseholdDetail(activeHouseholdId).catch(() => {})
    else { setMembers([]); setMemberUserId(undefined) }
  }, [activeHouseholdId, fetchHouseholdDetail])

  useEffect(() => {
    if (currentHousehold && currentHousehold.id === activeHouseholdId) setMembers(currentHousehold.members)
    else setMembers([])
  }, [currentHousehold, activeHouseholdId])

  useEffect(() => { fetchIncomes() }, [page, startDate, endDate, categoryId, activeHouseholdId, memberUserId])

  function getCategoryName(catId: number | null): string {
    if (!catId) return '미분류'
    return categories.find((c) => c.id === catId)?.name ?? '미분류'
  }

  function getMemberName(userId: number | null): string {
    if (!userId) return ''
    return members.find((m) => m.user_id === userId)?.username ?? ''
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-stone-800">수입 목록</h1>
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200/60">
          <ErrorState onRetry={fetchIncomes} />
        </div>
      </div>
    )
  }

  const showMemberFilter = activeHouseholdId != null && members.length > 1

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-stone-800">수입 목록</h1>

      {/* 필터 바 */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200/60 p-4">
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${showMemberFilter ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
          <div>
            <label className="block text-xs text-stone-400 mb-1">시작일</label>
            <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(0) }}
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500" />
          </div>
          <div>
            <label className="block text-xs text-stone-400 mb-1">종료일</label>
            <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(0) }}
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500" />
          </div>
          <div>
            <label className="block text-xs text-stone-400 mb-1">카테고리</label>
            <select value={categoryId ?? ''} onChange={(e) => { setCategoryId(e.target.value ? Number(e.target.value) : undefined); setPage(0) }}
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500">
              <option value="">전체</option>
              {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
          </div>
          {showMemberFilter && (
            <div>
              <label className="block text-xs text-stone-400 mb-1">멤버</label>
              <select value={memberUserId ?? ''} onChange={(e) => { setMemberUserId(e.target.value ? Number(e.target.value) : undefined); setPage(0) }}
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500">
                <option value="">전체 멤버</option>
                {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.username}</option>)}
              </select>
            </div>
          )}
          <div className="flex items-end">
            <button onClick={() => { setStartDate(''); setEndDate(''); setCategoryId(undefined); setMemberUserId(undefined); setPage(0) }}
              className="w-full sm:w-auto px-4 py-2 text-sm text-stone-500 hover:text-stone-600 underline">
              필터 초기화
            </button>
          </div>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200/60 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          </div>
        ) : incomes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="text-left text-xs font-medium text-stone-400 uppercase px-4 py-3 cursor-pointer hover:bg-stone-100 select-none" onClick={() => handleSort('date')}>
                    <div className="flex items-center">날짜{renderSortIcon('date')}</div>
                  </th>
                  <th className="text-left text-xs font-medium text-stone-400 uppercase px-4 py-3">내용</th>
                  <th className="text-left text-xs font-medium text-stone-400 uppercase px-4 py-3 hidden sm:table-cell">카테고리</th>
                  {showMemberFilter && (
                    <th className="text-left text-xs font-medium text-stone-400 uppercase px-4 py-3 hidden md:table-cell">작성자</th>
                  )}
                  <th className="text-right text-xs font-medium text-stone-400 uppercase px-4 py-3 cursor-pointer hover:bg-stone-100 select-none" onClick={() => handleSort('amount')}>
                    <div className="flex items-center justify-end">금액{renderSortIcon('amount')}</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {sortedIncomes.map((income) => (
                  <tr key={income.id} className="hover:bg-emerald-50/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-stone-600 whitespace-nowrap">{income.date.slice(0, 10).replace(/-/g, '.')}</td>
                    <td className="px-4 py-3 max-w-[200px] sm:max-w-none">
                      <Link to={`/income/${income.id}`} className="text-sm font-medium text-stone-900 hover:text-emerald-600 transition-colors block truncate">
                        {income.description}
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="inline-block bg-emerald-50 text-emerald-700 text-xs px-2 py-1 rounded-full">
                        {getCategoryName(income.category_id)}
                      </span>
                    </td>
                    {showMemberFilter && (
                      <td className="px-4 py-3 hidden md:table-cell"><span className="text-xs text-stone-500">{getMemberName(income.user_id)}</span></td>
                    )}
                    <td className="px-4 py-3 text-sm font-semibold text-emerald-700 text-right whitespace-nowrap">
                      +{formatAmount(income.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="수입 내역이 없습니다" description="필터 조건을 변경하거나 채팅으로 수입을 입력해보세요." />
        )}
      </div>

      {/* 페이지네이션 */}
      <div className="flex items-center justify-between">
        <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
          className="px-4 py-2 text-sm border border-stone-300 rounded-lg disabled:opacity-40 hover:bg-stone-50">이전</button>
        <span className="text-sm text-stone-500">페이지 {page + 1}</span>
        <button onClick={() => setPage((p) => p + 1)} disabled={incomes.length < limit}
          className="px-4 py-2 text-sm border border-stone-300 rounded-lg disabled:opacity-40 hover:bg-stone-50">다음</button>
      </div>
    </div>
  )
}
```

**Step 4: Add route to App.tsx**

Modify `frontend/src/App.tsx` — add IncomeList and IncomeDetail lazy imports and routes:

```typescript
const IncomeList = lazy(() => import('./pages/IncomeList'))
const IncomeDetail = lazy(() => import('./pages/IncomeDetail'))

// Routes 내부에 추가 (expenses 라우트 아래):
<Route path="/income" element={<IncomeList />} />
<Route path="/income/:id" element={<IncomeDetail />} />
```

**Step 5: Add sidebar nav item**

Modify `frontend/src/components/Layout.tsx:24-33` — navItems 배열에 수입 항목 추가:

```typescript
import { Wallet } from 'lucide-react'  // import 추가

const navItems = [
  { path: '/', label: '대시보드', icon: LayoutDashboard },
  { path: '/expenses', label: '지출 목록', icon: Receipt },
  { path: '/income', label: '수입 목록', icon: Wallet },   // 새로 추가
  { path: '/expenses/new', label: '지출 입력', icon: PlusCircle },
  { path: '/categories', label: '카테고리', icon: Tags },
  { path: '/budgets', label: '예산 관리', icon: PiggyBank },
  { path: '/insights', label: '리포트', icon: TrendingUp },
  { path: '/households', label: '공유 가계부', icon: Users },
  { path: '/settings', label: '설정', icon: SettingsIcon },
]
```

**Step 6: Run tests**

Run: `cd frontend && npx vitest run src/pages/__tests__/IncomeList.test.tsx`
Expected: 5 passed

**Step 7: Commit**

```bash
git add frontend/src/pages/IncomeList.tsx frontend/src/pages/__tests__/IncomeList.test.tsx frontend/src/App.tsx frontend/src/components/Layout.tsx
git commit -m "feat: 수입 목록 페이지 + 사이드바 네비게이션 추가"
```

---

## Task 11: Frontend 수입 상세 페이지

**Files:**
- Create: `frontend/src/pages/IncomeDetail.tsx`
- Create: `frontend/src/pages/__tests__/IncomeDetail.test.tsx`

**Step 1: Write tests**

Create `frontend/src/pages/__tests__/IncomeDetail.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'
import IncomeDetail from '../IncomeDetail'

function renderIncomeDetail(id = '1') {
  return render(
    <MemoryRouter initialEntries={[`/income/${id}`]}>
      <Routes>
        <Route path="/income/:id" element={<IncomeDetail />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('IncomeDetail', () => {
  it('수입 상세를 표시한다', async () => {
    renderIncomeDetail()
    await waitFor(() => {
      expect(screen.getByText('2월 월급')).toBeInTheDocument()
    })
    expect(screen.getByText('₩3,500,000')).toBeInTheDocument()
  })

  it('존재하지 않는 수입은 에러를 표시한다', async () => {
    renderIncomeDetail('99999')
    await waitFor(() => {
      expect(screen.getByText('문제가 발생했습니다')).toBeInTheDocument()
    })
  })
})
```

**Step 2: Create IncomeDetail page**

Create `frontend/src/pages/IncomeDetail.tsx` — mirror ExpenseDetail:

```typescript
/**
 * @file IncomeDetail.tsx
 * @description 수입 상세 페이지 - 조회, 수정, 삭제
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Loader2, ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { incomeApi } from '../api/income'
import ErrorState from '../components/ErrorState'
import type { Income } from '../types'

function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

export default function IncomeDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [income, setIncome] = useState<Income | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editAmount, setEditAmount] = useState('')
  const [editDescription, setEditDescription] = useState('')

  async function fetchIncome() {
    if (!id) return
    setLoading(true)
    setError(false)
    try {
      const res = await incomeApi.getById(Number(id))
      setIncome(res.data)
      setEditAmount(String(res.data.amount))
      setEditDescription(res.data.description)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchIncome() }, [id])

  async function handleUpdate() {
    if (!id || !income) return
    try {
      const res = await incomeApi.update(Number(id), {
        amount: Number(editAmount),
        description: editDescription,
      })
      setIncome(res.data)
      setEditing(false)
    } catch {
      // 에러 처리
    }
  }

  async function handleDelete() {
    if (!id || !confirm('이 수입을 삭제하시겠습니까?')) return
    try {
      await incomeApi.delete(Number(id))
      navigate('/income')
    } catch {
      // 에러 처리
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (error || !income) {
    return (
      <div className="space-y-6">
        <Link to="/income" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700">
          <ArrowLeft className="w-4 h-4" /> 수입 목록
        </Link>
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200/60">
          <ErrorState onRetry={fetchIncome} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link to="/income" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-700">
        <ArrowLeft className="w-4 h-4" /> 수입 목록
      </Link>

      <div className="bg-white rounded-2xl shadow-sm border border-stone-200/60 p-6">
        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-stone-500 mb-1">금액</label>
              <input type="number" value={editAmount} onChange={(e) => setEditAmount(e.target.value)}
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm text-stone-500 mb-1">설명</label>
              <input type="text" value={editDescription} onChange={(e) => setEditDescription(e.target.value)}
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleUpdate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">저장</button>
              <button onClick={() => setEditing(false)} className="px-4 py-2 border border-stone-300 rounded-lg text-sm hover:bg-stone-50">취소</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-xl font-semibold text-stone-900">{income.description}</h1>
                <p className="text-sm text-stone-500 mt-1">{income.date.slice(0, 10).replace(/-/g, '.')}</p>
              </div>
              <p className="text-2xl font-bold text-emerald-700">+{formatAmount(income.amount)}</p>
            </div>

            {income.raw_input && (
              <div className="bg-stone-50 rounded-lg p-3 mb-4">
                <p className="text-xs text-stone-400 mb-1">원본 입력</p>
                <p className="text-sm text-stone-600">{income.raw_input}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 px-3 py-2 border border-stone-300 rounded-lg text-sm hover:bg-stone-50">
                <Pencil className="w-4 h-4" /> 수정
              </button>
              <button onClick={handleDelete} className="inline-flex items-center gap-1 px-3 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50">
                <Trash2 className="w-4 h-4" /> 삭제
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

**Step 3: Run tests**

Run: `cd frontend && npx vitest run src/pages/__tests__/IncomeDetail.test.tsx`
Expected: 2 passed

**Step 4: Commit**

```bash
git add frontend/src/pages/IncomeDetail.tsx frontend/src/pages/__tests__/IncomeDetail.test.tsx
git commit -m "feat: 수입 상세 페이지 구현"
```

---

## Task 12: Dashboard 수입/순수익 통합

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`
- Modify: `frontend/src/pages/__tests__/Dashboard.test.tsx`

**Step 1: Write new tests**

Add to existing `frontend/src/pages/__tests__/Dashboard.test.tsx`:

```typescript
it('수입 요약 카드를 표시한다', async () => {
  renderDashboard()
  await waitFor(() => {
    expect(screen.getByText('이번 달 수입')).toBeInTheDocument()
  })
})

it('순수익 카드를 표시한다', async () => {
  renderDashboard()
  await waitFor(() => {
    expect(screen.getByText('순수익')).toBeInTheDocument()
  })
})
```

**Step 2: Modify Dashboard**

Modify `frontend/src/pages/Dashboard.tsx` — add income API calls and summary cards:

1. Import `incomeApi`
2. Add `incomeTotal` state
3. In `fetchData()`, add `incomeApi.getStats('monthly')` call
4. Add 3-column summary row above existing cards:

```typescript
{/* 수입/지출/순수익 요약 */}
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl border border-emerald-200/60 shadow-sm p-5">
    <p className="text-sm text-emerald-700/70">이번 달 수입</p>
    <p className="text-2xl font-bold tracking-tight text-stone-900 mt-1">
      {formatAmount(incomeTotal)}
    </p>
  </div>
  <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200/60 shadow-sm p-5">
    <p className="text-sm text-amber-700/70">이번 달 지출</p>
    <p className="text-2xl font-bold tracking-tight text-stone-900 mt-1">
      {formatAmount(stats?.total ?? 0)}
    </p>
  </div>
  <div className={`bg-gradient-to-br ${netIncome >= 0 ? 'from-blue-50 to-indigo-50 border-blue-200/60' : 'from-red-50 to-rose-50 border-red-200/60'} rounded-2xl border shadow-sm p-5`}>
    <p className="text-sm text-stone-500">순수익</p>
    <p className={`text-2xl font-bold tracking-tight mt-1 ${netIncome >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
      {netIncome >= 0 ? '+' : ''}{formatAmount(netIncome)}
    </p>
  </div>
</div>
```

**Step 3: Run tests**

Run: `cd frontend && npx vitest run src/pages/__tests__/Dashboard.test.tsx`
Expected: All tests pass

**Step 4: Commit**

```bash
git add frontend/src/pages/Dashboard.tsx frontend/src/pages/__tests__/Dashboard.test.tsx
git commit -m "feat: 대시보드에 수입/순수익 요약 카드 추가"
```

---

## Task 13: 통계 페이지 수입 탭 확장

**Files:**
- Modify: `frontend/src/pages/InsightsPage.tsx`
- Modify: `frontend/src/pages/__tests__/InsightsPage.test.tsx`

**Step 1: Write new tests**

Add to existing `frontend/src/pages/__tests__/InsightsPage.test.tsx`:

```typescript
it('수입/지출 탭을 표시한다', async () => {
  renderInsightsPage()
  await waitFor(() => {
    expect(screen.getByRole('tab', { name: '지출' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '수입' })).toBeInTheDocument()
  })
})

it('수입 탭 클릭 시 수입 통계를 표시한다', async () => {
  const user = userEvent.setup()
  renderInsightsPage()
  await waitFor(() => {
    expect(screen.getByRole('tab', { name: '수입' })).toBeInTheDocument()
  })
  await user.click(screen.getByRole('tab', { name: '수입' }))
  await waitFor(() => {
    expect(screen.getByText('₩4,000,000')).toBeInTheDocument()
  })
})
```

**Step 2: Modify InsightsPage**

Add tab switching UI to InsightsPage:
1. Add `mode` state: `'expense' | 'income'`
2. Tab UI at the top
3. When mode = 'income', call `incomeApi.getStats()` instead of expense stats
4. Reuse existing chart components (StatsSummaryCards, TrendChart, CategoryBreakdown)

**Step 3: Run tests**

Run: `cd frontend && npx vitest run src/pages/__tests__/InsightsPage.test.tsx`

**Step 4: Commit**

```bash
git add frontend/src/pages/InsightsPage.tsx frontend/src/pages/__tests__/InsightsPage.test.tsx
git commit -m "feat: 통계 페이지에 수입/지출 탭 전환 추가"
```

---

## Task 14: 전체 테스트 + lint + 빌드 검증

**Files:** (수정 없음 — 검증만)

**Step 1: Backend 전체 테스트**

```bash
cd backend && python -m pytest -v
```
Expected: All pass (기존 + 신규 약 330개 이상)

**Step 2: Backend lint**

```bash
cd backend && ruff check --fix . && ruff format .
```

**Step 3: Frontend 전체 테스트**

```bash
cd frontend && npm test
```
Expected: All pass (기존 + 신규 약 360개 이상)

**Step 4: Frontend 빌드**

```bash
cd frontend && npm run build
```
Expected: 성공 (TypeScript 에러 없음)

**Step 5: Frontend lint**

```bash
cd frontend && npm run lint
```

**Step 6: Commit any lint fixes**

```bash
git add -A && git commit -m "chore: lint 수정"
```

---

## Task 15: 문서 업데이트 + 최종 커밋

**Files:**
- Modify: `CLAUDE.md` — 모델 수 업데이트 (7→8), 기능 설명 추가
- Modify: `docs/IMPLEMENTATION_STATUS.md` — 수입 기능 구현 현황
- Modify: `docs/PRODUCT.md` — 수입 기능 추가

**Step 1: Update docs**

CLAUDE.md의 Current State에 수입 기능 추가:
- "수입 CRUD + 통계 + 자연어 입력 구현됨"
- 모델 수: 8 (Income 추가)

**Step 2: Commit**

```bash
git add CLAUDE.md docs/
git commit -m "docs: 수입 기능 구현 현황 업데이트"
```

---

**Plan complete and saved to `docs/plans/2026-02-15-income-plan.md`.**

**Summary:**
- 15 tasks, backend-first then frontend
- Tasks 1-7: Backend (모델, 스키마, CRUD API, 통계 API, Chat 확장)
- Tasks 8-13: Frontend (타입, API, MSW, 페이지, 대시보드, 통계)
- Tasks 14-15: 검증 + 문서
- 예상 신규 테스트: BE ~25-30개, FE ~15-20개
