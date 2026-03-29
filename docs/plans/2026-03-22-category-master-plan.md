# 카테고리 마스터 정립 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 시스템 카테고리 25개를 DB에 seed하고, 기존 데이터를 정리하고, 프론트엔드에서 시스템 카테고리 UI를 구분한다.

**Architecture:** Alembic data migration으로 시스템 카테고리 INSERT + 기존 FK re-link. CategoryResponse에 is_system 필드 추가. 프론트엔드 CategoryManager에서 시스템 카테고리 수정/삭제 버튼 숨김.

**Tech Stack:** Python/FastAPI/SQLAlchemy/Alembic (백엔드), React/TypeScript (프론트엔드)

---

### Task 1: 백엔드 — CategoryResponse에 is_system 필드 추가

**Files:**
- Modify: `backend/app/schemas/category.py:29-35`
- Test: `backend/tests/integration/test_api_categories_extra.py`

**Step 1: 테스트 추가 — is_system 필드가 응답에 포함되는지 검증**

`backend/tests/integration/test_api_categories_extra.py` 끝에 추가:

```python
@pytest.mark.asyncio
async def test_category_response_includes_is_system_field(
    authenticated_client: AsyncClient, test_user: User, test_household, db_session: AsyncSession
):
    """카테고리 응답에 is_system 필드가 포함됨"""
    # 시스템 카테고리
    sys_cat = Category(user_id=None, household_id=None, name="시스템테스트")
    db_session.add(sys_cat)
    # 가구 카테고리
    hh_cat = Category(user_id=None, household_id=test_household.id, name="가구테스트")
    db_session.add(hh_cat)
    await db_session.commit()

    response = await authenticated_client.get("/api/categories")
    assert response.status_code == 200

    data = response.json()
    sys_item = next(c for c in data if c["name"] == "시스템테스트")
    hh_item = next(c for c in data if c["name"] == "가구테스트")

    assert sys_item["is_system"] is True
    assert hh_item["is_system"] is False
```

**Step 2: 테스트 실행 → 실패 확인**

Run: `cd /Users/yyong/Developer/podo-budget/backend && python -m pytest tests/integration/test_api_categories_extra.py::test_category_response_includes_is_system_field -v`
Expected: FAIL — `is_system` 필드 없음

**Step 3: CategoryResponse에 is_system computed 필드 추가**

`backend/app/schemas/category.py` — CategoryResponse 수정:

```python
class CategoryResponse(CategoryBase):
    id: int
    type: str = "expense"
    sort_order: int = 0
    is_system: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
```

`backend/app/api/categories.py` — GET 응답에서 is_system 계산하여 반환.
기존 `return result.scalars().all()` 대신 변환 로직 추가:

```python
@router.get("", response_model=list[CategoryResponse])
async def get_categories(...):
    ...
    categories = result.scalars().all()
    return [
        CategoryResponse(
            id=cat.id,
            name=cat.name,
            description=cat.description,
            type=cat.type,
            sort_order=cat.sort_order,
            is_system=cat.user_id is None and cat.household_id is None,
            created_at=cat.created_at,
        )
        for cat in categories
    ]
```

동일하게 `create_category`, `update_category`, `reorder_categories`의 반환값에도 `is_system` 계산 적용. 이 3개 엔드포인트는 시스템 카테고리를 반환하지 않으므로 항상 `is_system=False`.

**Step 4: 테스트 실행 → 통과 확인**

Run: `cd /Users/yyong/Developer/podo-budget/backend && python -m pytest tests/integration/test_api_categories_extra.py -v`
Expected: ALL PASS

**Step 5: 기존 전체 백엔드 테스트 통과 확인**

Run: `cd /Users/yyong/Developer/podo-budget/backend && python -m pytest --ignore=tests/integration/test_api_budget_bulk.py -v`
Expected: ALL PASS

**Step 6: 커밋**

```bash
git add backend/app/schemas/category.py backend/app/api/categories.py backend/tests/integration/test_api_categories_extra.py
git commit -m "feat: CategoryResponse에 is_system 필드 추가"
```

---

### Task 2: Alembic migration — 시스템 카테고리 seed + 기존 데이터 re-link

**Files:**
- Create: `backend/alembic/versions/s2t3u4v5w6x7_seed_system_categories.py`

**Step 1: Alembic migration 파일 생성**

Run: `cd /Users/yyong/Developer/podo-budget/backend && alembic revision -m "seed system categories and relink existing data"`

**Step 2: migration 코드 작성**

```python
"""시스템 카테고리 seed 및 기존 데이터 re-link

기존 가구/개인 카테고리 중 시스템 카테고리와 이름이 같거나
이름 변경 대상인 것은 FK를 시스템 카테고리로 re-link 후 삭제합니다.

Revision ID: (auto)
Revises: r1s2t3u4v5w6
Create Date: 2026-03-22
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "(auto)"
down_revision: str = "r1s2t3u4v5w6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# 시스템 카테고리 마스터
SYSTEM_CATEGORIES = [
    # 지출 (sort_order: 높을수록 상위)
    {"name": "식비", "type": "expense", "description": "식료품, 외식, 배달", "sort_order": 18},
    {"name": "카페/음료", "type": "expense", "description": "커피, 음료, 디저트", "sort_order": 17},
    {"name": "교통", "type": "expense", "description": "대중교통, 택시, 주유", "sort_order": 16},
    {"name": "주거/관리비", "type": "expense", "description": "월세, 관리비, 수도광열비", "sort_order": 15},
    {"name": "통신", "type": "expense", "description": "휴대폰, 인터넷", "sort_order": 14},
    {"name": "생활용품", "type": "expense", "description": "일용품, 가전, 가구", "sort_order": 13},
    {"name": "의류/미용", "type": "expense", "description": "옷, 신발, 미용실, 화장품", "sort_order": 12},
    {"name": "의료/건강", "type": "expense", "description": "병원, 약국, 건강식품", "sort_order": 11},
    {"name": "교육/자기계발", "type": "expense", "description": "학원, 수강, 도서, 운동", "sort_order": 10},
    {"name": "문화/여가", "type": "expense", "description": "영화, 공연, 취미, 여행", "sort_order": 9},
    {"name": "경조사", "type": "expense", "description": "축의금, 부의금, 선물", "sort_order": 8},
    {"name": "자녀/육아", "type": "expense", "description": "육아용품, 교육, 돌봄", "sort_order": 7},
    {"name": "반려동물", "type": "expense", "description": "사료, 병원, 용품", "sort_order": 6},
    {"name": "보험", "type": "expense", "description": "생명보험, 실손보험", "sort_order": 5},
    {"name": "대출/이자", "type": "expense", "description": "대출 상환, 이자", "sort_order": 4},
    {"name": "세금/공과금", "type": "expense", "description": "소득세, 재산세, 국민연금", "sort_order": 3},
    {"name": "구독", "type": "expense", "description": "정기결제 서비스", "sort_order": 2},
    {"name": "기타", "type": "expense", "description": "미분류 지출", "sort_order": 1},
    # 수입
    {"name": "급여", "type": "income", "description": "월급, 상여금", "sort_order": 7},
    {"name": "부수입", "type": "income", "description": "부업, 프리랜서, 아르바이트", "sort_order": 6},
    {"name": "사업소득", "type": "income", "description": "자영업, 사업 수익", "sort_order": 5},
    {"name": "투자/배당", "type": "income", "description": "이자, 배당금, 매매차익", "sort_order": 4},
    {"name": "용돈/지원", "type": "income", "description": "가족 용돈, 정부지원금", "sort_order": 3},
    {"name": "중고판매", "type": "income", "description": "중고거래, 환불", "sort_order": 2},
    {"name": "기타수입", "type": "income", "description": "미분류 수입", "sort_order": 1},
]

# 이름 변경 매핑: 기존 이름 → 새 시스템 카테고리 이름
RENAME_MAP = {
    "카페/간식": "카페/음료",
    "의료": "의료/건강",
    "교육": "교육/자기계발",
    "구독서비스": "구독",
    "이자/배당": "투자/배당",
}


def upgrade() -> None:
    conn = op.get_bind()

    # 1. 시스템 카테고리 25개 INSERT
    categories_table = sa.table(
        "categories",
        sa.column("id", sa.Integer),
        sa.column("user_id", sa.Integer),
        sa.column("household_id", sa.Integer),
        sa.column("name", sa.String),
        sa.column("type", sa.String),
        sa.column("description", sa.String),
        sa.column("sort_order", sa.BigInteger),
    )
    for cat in SYSTEM_CATEGORIES:
        conn.execute(
            categories_table.insert().values(
                user_id=None,
                household_id=None,
                name=cat["name"],
                type=cat["type"],
                description=cat["description"],
                sort_order=cat["sort_order"],
            )
        )

    # 시스템 카테고리 ID 조회 (방금 INSERT한 것)
    sys_cats = conn.execute(
        sa.text("SELECT id, name FROM categories WHERE user_id IS NULL AND household_id IS NULL")
    ).fetchall()
    sys_id_by_name = {row[1]: row[0] for row in sys_cats}

    # 2. 이름 변경 대상 re-link: 기존 "카페/간식" → 시스템 "카페/음료"로 FK 이전
    for old_name, new_name in RENAME_MAP.items():
        new_sys_id = sys_id_by_name.get(new_name)
        if new_sys_id is None:
            continue

        # 이전 이름의 비시스템 카테고리 조회
        old_cats = conn.execute(
            sa.text(
                "SELECT id FROM categories WHERE name = :name "
                "AND NOT (user_id IS NULL AND household_id IS NULL)"
            ),
            {"name": old_name},
        ).fetchall()

        for (old_id,) in old_cats:
            # expenses, incomes, budgets FK re-link
            conn.execute(sa.text("UPDATE expenses SET category_id = :new WHERE category_id = :old"), {"new": new_sys_id, "old": old_id})
            conn.execute(sa.text("UPDATE incomes SET category_id = :new WHERE category_id = :old"), {"new": new_sys_id, "old": old_id})
            conn.execute(sa.text("UPDATE budgets SET category_id = :new WHERE category_id = :old"), {"new": new_sys_id, "old": old_id})
            # 가구 카테고리 삭제
            conn.execute(sa.text("DELETE FROM categories WHERE id = :id"), {"id": old_id})

    # 3. 이름 동일한 기존 가구/개인 카테고리 re-link
    all_system_names = [cat["name"] for cat in SYSTEM_CATEGORIES]
    for sys_name in all_system_names:
        sys_id = sys_id_by_name.get(sys_name)
        if sys_id is None:
            continue

        # 동일 이름의 비시스템 카테고리 조회
        dup_cats = conn.execute(
            sa.text(
                "SELECT id FROM categories WHERE name = :name AND id != :sys_id "
                "AND NOT (user_id IS NULL AND household_id IS NULL)"
            ),
            {"name": sys_name, "sys_id": sys_id},
        ).fetchall()

        for (dup_id,) in dup_cats:
            conn.execute(sa.text("UPDATE expenses SET category_id = :new WHERE category_id = :old"), {"new": sys_id, "old": dup_id})
            conn.execute(sa.text("UPDATE incomes SET category_id = :new WHERE category_id = :old"), {"new": sys_id, "old": dup_id})
            conn.execute(sa.text("UPDATE budgets SET category_id = :new WHERE category_id = :old"), {"new": sys_id, "old": dup_id})
            conn.execute(sa.text("DELETE FROM categories WHERE id = :id"), {"id": dup_id})

    # 4. CategoryMapping seed — 이름 변경 매핑 (시스템 스코프)
    #    household_id가 NOT NULL 제약이므로 각 가구별로 생성
    households = conn.execute(sa.text("SELECT id FROM households")).fetchall()
    for (hh_id,) in households:
        for old_name, new_name in RENAME_MAP.items():
            new_sys_id = sys_id_by_name.get(new_name)
            if new_sys_id is None:
                continue
            # 이미 존재하는지 체크
            existing = conn.execute(
                sa.text(
                    "SELECT id FROM category_mappings "
                    "WHERE source_name = :src AND household_id = :hh"
                ),
                {"src": old_name, "hh": hh_id},
            ).fetchone()
            if existing is None:
                conn.execute(
                    sa.text(
                        "INSERT INTO category_mappings (household_id, user_id, source_name, target_category_id) "
                        "VALUES (:hh, NULL, :src, :target)"
                    ),
                    {"hh": hh_id, "src": old_name, "target": new_sys_id},
                )


def downgrade() -> None:
    conn = op.get_bind()
    # 시스템 카테고리 삭제 (FK가 걸린 expenses/incomes는 category_id=NULL로)
    sys_cats = conn.execute(
        sa.text("SELECT id FROM categories WHERE user_id IS NULL AND household_id IS NULL")
    ).fetchall()
    for (sys_id,) in sys_cats:
        conn.execute(sa.text("UPDATE expenses SET category_id = NULL WHERE category_id = :id"), {"id": sys_id})
        conn.execute(sa.text("UPDATE incomes SET category_id = NULL WHERE category_id = :id"), {"id": sys_id})
        conn.execute(sa.text("UPDATE budgets SET category_id = NULL WHERE category_id = :id"), {"id": sys_id})
        conn.execute(sa.text("DELETE FROM categories WHERE id = :id"), {"id": sys_id})

    # CategoryMapping에서 이름 변경 매핑 삭제
    for old_name in ["카페/간식", "의료", "교육", "구독서비스", "이자/배당"]:
        conn.execute(sa.text("DELETE FROM category_mappings WHERE source_name = :src"), {"src": old_name})
```

**Step 3: 로컬에서 migration 테스트**

Run: `cd /Users/yyong/Developer/podo-budget/backend && alembic upgrade head`
Expected: 성공, 에러 없음

**Step 4: DB에 시스템 카테고리 25개가 있는지 확인**

Run: `cd /Users/yyong/Developer/podo-budget/backend && python -c "import sqlite3; conn = sqlite3.connect('data/db.sqlite3'); print(conn.execute('SELECT name, type FROM categories WHERE user_id IS NULL AND household_id IS NULL ORDER BY sort_order DESC').fetchall()); conn.close()"`
Expected: 25개 카테고리 출력

**Step 5: 백엔드 전체 테스트 통과 확인**

Run: `cd /Users/yyong/Developer/podo-budget/backend && python -m pytest --ignore=tests/integration/test_api_budget_bulk.py -v`
Expected: ALL PASS

**Step 6: 커밋**

```bash
git add backend/alembic/versions/
git commit -m "feat: 시스템 카테고리 25개 seed + 기존 데이터 re-link 마이그레이션"
```

---

### Task 3: prompts.py 업데이트

**Files:**
- Modify: `backend/app/services/prompts.py:14-29` (EXPENSE_PARSER_SYSTEM_PROMPT 카테고리 목록)
- Modify: `backend/app/services/prompts.py:213-228` (OCR_EXPENSE_PARSER_PROMPT 카테고리 목록)
- Test: `backend/tests/unit/test_prompts.py` (있으면 수정, 없으면 확인)

**Step 1: EXPENSE_PARSER_SYSTEM_PROMPT 카테고리 목록 교체**

기존 15개 지출 카테고리를 새 18개로 교체, 수입 카테고리 목록도 추가:

```
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
```

수입 카테고리 목록 (기존 수입 키워드 섹션에 카테고리 목록 추가):
```
수입인 경우 아래 수입 카테고리 중 선택:
   - 급여: 월급, 상여금, 보너스
   - 부수입: 부업, 프리랜서, 아르바이트
   - 사업소득: 자영업, 사업 수익
   - 투자/배당: 이자, 배당금, 매매차익
   - 용돈/지원: 용돈 받음, 정부지원금, 환급금
   - 중고판매: 중고거래, 환불, 반품
   - 기타수입: 위 카테고리에 해당하지 않는 수입
```

**Step 2: OCR_EXPENSE_PARSER_PROMPT 카테고리 목록도 동일하게 교체**

기존 OCR 프롬프트의 카테고리 목록(line 213-228)을 새 18개 지출 카테고리로 교체.

**Step 3: 테스트 실행**

Run: `cd /Users/yyong/Developer/podo-budget/backend && python -m pytest --ignore=tests/integration/test_api_budget_bulk.py -v`
Expected: ALL PASS

**Step 4: 커밋**

```bash
git add backend/app/services/prompts.py
git commit -m "feat: LLM 프롬프트 카테고리 마스터를 새 25개 체계로 교체"
```

---

### Task 4: 프론트엔드 — Category 타입 + mock 업데이트

**Files:**
- Modify: `frontend/src/types/index.ts:129-136`
- Modify: `frontend/src/mocks/fixtures.ts:12-30`
- Modify: `frontend/src/mocks/handlers.ts:296-311`

**Step 1: Category 인터페이스에 is_system 추가**

`frontend/src/types/index.ts`:

```typescript
export interface Category {
  id: number
  name: string
  type: 'expense' | 'income' | 'both'
  description: string | null
  sort_order: number
  is_system: boolean
  created_at: string
}
```

**Step 2: mock fixtures 업데이트**

`frontend/src/mocks/fixtures.ts` — mockCategories에 `is_system` 필드 추가:

```typescript
export const mockCategories: Category[] = [
  {
    id: 1,
    name: '식비',
    type: 'expense',
    description: '식료품, 외식, 배달',
    sort_order: 18,
    is_system: true,
    created_at: '2026-01-01T00:00:00',
  },
  {
    id: 2,
    name: '교통',
    type: 'expense',
    description: '대중교통, 택시, 주유',
    sort_order: 16,
    is_system: true,
    created_at: '2026-01-01T00:00:00',
  },
  {
    id: 3,
    name: '쇼핑',
    type: 'expense',
    description: '온라인/오프라인 쇼핑',
    sort_order: 0,
    is_system: false,
    created_at: '2026-01-15T00:00:00',
  },
]
```

mockIncomeCategoriesAll에도 `is_system` 추가.

**Step 3: MSW handlers 업데이트**

`frontend/src/mocks/handlers.ts` — POST /categories 응답에 `is_system: false` 추가:

```typescript
const newCategory = {
  id: Math.max(...mockCategories.map((c) => c.id)) + 1,
  name: body.name,
  type: body.type ?? 'expense',
  description: body.description ?? null,
  sort_order: 0,
  is_system: false,
  created_at: new Date().toISOString(),
}
```

PUT /categories 응답에도 `is_system` 유지.

**Step 4: 프론트엔드 빌드 확인**

Run: `cd /Users/yyong/Developer/podo-budget/frontend && npm run build`
Expected: 성공 (타입 에러 없음)

**Step 5: 프론트엔드 테스트 통과 확인**

Run: `cd /Users/yyong/Developer/podo-budget/frontend && npm run test:run`
Expected: ALL PASS

**Step 6: 커밋**

```bash
git add frontend/src/types/index.ts frontend/src/mocks/fixtures.ts frontend/src/mocks/handlers.ts
git commit -m "feat: Category 타입에 is_system 필드 추가"
```

---

### Task 5: 프론트엔드 — CategoryManager 시스템 카테고리 UI 처리

**Files:**
- Modify: `frontend/src/pages/CategoryManager.tsx`

**Step 1: 시스템 카테고리 수정/삭제 버튼 숨김 + 시각적 구분**

CategoryManager.tsx의 카테고리 목록 렌더링 부분 수정:

- `is_system=true`인 행: 수정/삭제 버튼 대신 잠금 아이콘 + "기본" 뱃지 표시
- 순서 변경 버튼도 비활성화
- 행 배경색 약간 구분 (예: bg-grape-50/30)

```tsx
import { ArrowLeft, Lock, Plus } from 'lucide-react'

// ... 카테고리 행 렌더링 부분:
{category.is_system ? (
  <div className="flex justify-end items-center gap-2">
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[var(--text-tertiary)] bg-[var(--surface-elevated)] rounded-md">
      <Lock className="w-3 h-3" />
      기본
    </span>
  </div>
) : (
  // 기존 수정/삭제 버튼
)}
```

순서 변경 버튼:
```tsx
<button
  onClick={() => handleMove(index, 'up')}
  disabled={index === 0 || reordering || category.is_system}
  ...
>
```

**Step 2: 프론트엔드 빌드 + 테스트 확인**

Run: `cd /Users/yyong/Developer/podo-budget/frontend && npm run lint && npm run test:run && npm run build`
Expected: ALL PASS

**Step 3: 커밋**

```bash
git add frontend/src/pages/CategoryManager.tsx
git commit -m "feat: CategoryManager에서 시스템 카테고리 수정/삭제 불가 UI 처리"
```

---

### Task 6: main.py startup에서 sort_order 초기화 로직 확인

**Files:**
- Modify: `backend/app/main.py` (필요시)

**Step 1: main.py의 sort_order 초기화가 시스템 카테고리 sort_order를 덮어쓰지 않는지 확인**

현재 startup에서 `WHERE sort_order = 0`인 카테고리만 사용 횟수 기반으로 sort_order를 업데이트한다.
시스템 카테고리는 sort_order > 0으로 seed되므로 덮어쓰지 않음. 변경 필요 없음.

확인만 하고 넘어간다.

**Step 2: 커밋 불필요**

---

### Task 7: changelogs + CLAUDE.md 업데이트

**Files:**
- Modify: `frontend/src/data/changelogs.ts`
- Modify: `CLAUDE.md` (필요시)

**Step 1: changelogs에 카테고리 마스터 정립 항목 추가**

```typescript
{
  version: '0.X.0',  // 현재 최신 버전 확인 후 설정
  date: '2026-03-22',
  title: '카테고리 체계 개편',
  items: [
    { tag: '개선', text: '카테고리 체계를 25개(지출 18 + 수입 7)로 정립' },
    { tag: '신규', text: '자녀/육아, 대출/이자, 세금/공과금 카테고리 추가' },
    { tag: '개선', text: '시스템 기본 카테고리 구분 표시 (잠금 아이콘)' },
  ],
},
```

**Step 2: CLAUDE.md 업데이트**

Current State 섹션에 시스템 카테고리 seed 반영 정보 추가.

**Step 3: 커밋**

```bash
git add frontend/src/data/changelogs.ts CLAUDE.md
git commit -m "docs: 카테고리 마스터 정립 changelog 및 CLAUDE.md 업데이트"
```

---

### Task 8: 전체 검증

**Step 1: 백엔드 전체 테스트**

Run: `cd /Users/yyong/Developer/podo-budget/backend && python -m pytest --ignore=tests/integration/test_api_budget_bulk.py -v`
Expected: ALL PASS

**Step 2: 프론트엔드 전체 검증**

Run: `cd /Users/yyong/Developer/podo-budget/frontend && npm run lint && npm run test:run && npm run build`
Expected: ALL PASS

**Step 3: ruff 린트/포맷**

Run: `cd /Users/yyong/Developer/podo-budget/backend && ruff check --fix . && ruff format .`
Expected: 에러 없음
