# 카테고리 이모지 + 거래 목록 아이콘 레이아웃 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 카테고리에 이모지를 추가하고, 거래 목록에 왼쪽 아이콘 원을 도입하여 시각적 다양성을 높인다.

**Architecture:** Category 모델에 emoji 컬럼 추가 → 시스템 카테고리 이모지 시딩 → FE 타입/UI 반영 → TransactionItem 레이아웃 변경. 커스텀 카테고리 기본값은 📌. `get_or_create_category`는 모델 default로 자동 처리.

**Tech Stack:** SQLAlchemy/Alembic (BE), React/TypeScript/Tailwind (FE), Vitest/pytest (Test)

**PR 전략:** 2개로 분리하여 위험 최소화.
- **PR 1 (Task 1-3):** emoji 필드 + 마이그레이션 + CategoryManager UI — 저위험
- **PR 2 (Task 4-5):** TransactionItem 레이아웃 변경 + 테스트 수정 — PR 1 머지 후 진행

---

## PR 1: 카테고리 이모지 데이터 + UI (Task 1-3)

### Task 1: BE — Category 모델 + 스키마에 emoji 추가

**Files:**
- Modify: `backend/app/models/category.py` (emoji 컬럼 추가)
- Modify: `backend/app/schemas/category.py` (emoji 필드 추가)
- Test: `backend/tests/integration/test_api_categories_extra.py`

**Step 1: 테스트 작성**

`backend/tests/integration/test_api_categories_extra.py` 끝에 추가:

```python
@pytest.mark.asyncio
async def test_create_category_with_emoji(authenticated_client):
    """이모지와 함께 카테고리 생성"""
    response = await authenticated_client.post("/api/categories", json={
        "name": "테스트이모지",
        "type": "expense",
        "emoji": "🧪",
    })
    assert response.status_code == 201
    assert response.json()["emoji"] == "🧪"


@pytest.mark.asyncio
async def test_create_category_without_emoji_uses_default(authenticated_client):
    """이모지 없이 생성하면 기본값 📌"""
    response = await authenticated_client.post("/api/categories", json={
        "name": "이모지없음",
        "type": "expense",
    })
    assert response.status_code == 201
    assert response.json()["emoji"] == "📌"


@pytest.mark.asyncio
async def test_system_categories_have_emoji(authenticated_client):
    """시스템 카테고리에 이모지가 있는지 확인"""
    response = await authenticated_client.get("/api/categories?type=expense")
    assert response.status_code == 200
    categories = response.json()
    system_cats = [c for c in categories if c["is_system"]]
    for cat in system_cats:
        assert cat["emoji"] is not None and len(cat["emoji"]) > 0
```

**Step 2: 테스트 실행 → 실패 확인**

Run: `cd backend && pytest tests/integration/test_api_categories_extra.py::test_create_category_with_emoji -v`
Expected: FAIL (emoji 필드 없음)

**Step 3: 모델 수정**

`backend/app/models/category.py` — `created_at` 위에 추가:
```python
emoji = Column(String(10), nullable=True, default="📌", server_default="📌")  # 카테고리 이모지 (#570)
```

**주의:** `server_default="📌"` — SQLite/PostgreSQL 모두 UTF-8 이모지 리터럴을 DEFAULT 값으로 지원. Alembic autogenerate 시 생성된 마이그레이션 파일에서 이모지가 올바르게 렌더링되는지 반드시 확인.

**Note:** `get_or_create_category` (category_service.py)는 모델 default를 사용하므로 변경 불필요. LLM 파싱, 봇 핸들러 등에서 자동 생성되는 커스텀 카테고리는 모두 📌 기본값.

**Step 4: 스키마 수정**

`backend/app/schemas/category.py`:

CategoryBase에 추가:
```python
emoji: str | None = Field("📌", max_length=10, description="카테고리 이모지")
```

CategoryUpdate에 추가:
```python
emoji: str | None = Field(None, max_length=10, description="카테고리 이모지")
```

CategoryResponse에 추가:
```python
emoji: str | None = "📌"
```

**Step 5: 테스트 실행 → 통과 확인**

Run: `cd backend && pytest tests/integration/test_api_categories_extra.py -x -q`
Expected: PASS (시스템 카테고리 이모지 테스트는 Task 2에서 해결)

**Step 6: 커밋**

```
feat: Category 모델/스키마에 emoji 컬럼 추가 (#570)

기본값 📌, 커스텀 카테고리 생성 시 이모지 미지정이면 자동 적용.
get_or_create_category는 모델 default로 자동 처리.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

---

### Task 2: BE — Alembic 마이그레이션 + 시스템 카테고리 이모지 시딩

**Files:**
- Create: `backend/alembic/versions/xxxx_add_emoji_to_categories.py` (자동 생성)

**Step 1: 마이그레이션 생성**

Run: `cd backend && alembic revision --autogenerate -m "add emoji to categories"`

**Step 2: 생성된 마이그레이션 파일 검증**

이모지 리터럴이 `server_default`에 올바르게 렌더링되었는지 확인. escape 시퀀스(`\U0001F4CC`)로 렌더링되었다면 수동으로 `"📌"`로 수정.

**Step 3: 마이그레이션 파일에 시스템 카테고리 이모지 업데이트 추가**

생성된 마이그레이션 파일의 `upgrade()` 끝에 추가:

```python
# 시스템 카테고리 이모지 시딩
EMOJI_MAP = {
    # 지출 (18종)
    "식비": "🍚",
    "카페/음료": "☕",
    "교통": "🚗",
    "주거/관리비": "🏠",
    "통신": "📱",
    "생활용품": "🛒",
    "의류/미용": "✨",
    "의료/건강": "🏥",
    "교육/자기계발": "📚",
    "문화/여가": "🎬",
    "경조사": "🎁",
    "자녀/육아": "👶",
    "반려동물": "🐾",
    "보험": "☂️",
    "대출/이자": "💸",
    "세금/공과금": "📋",
    "구독": "📺",
    "기타": "📌",
    # 수입 (7종)
    "급여": "💰",
    "부수입": "💵",
    "사업소득": "🏢",
    "투자/배당": "📈",
    "용돈/지원": "🎉",
    "중고판매": "🥕",
    "기타수입": "📌",
}

conn = op.get_bind()
for name, emoji in EMOJI_MAP.items():
    conn.execute(
        sa.text("UPDATE categories SET emoji = :emoji WHERE name = :name AND user_id IS NULL AND household_id IS NULL"),
        {"emoji": emoji, "name": name},
    )
```

**Step 4: 마이그레이션 실행**

Run: `cd backend && alembic upgrade head`
Expected: 성공

**Step 5: 전체 BE 테스트 (시스템 카테고리 이모지 테스트 포함)**

Run: `cd backend && pytest -x -q`
Expected: 전체 PASS

**Step 6: 커밋**

```
feat: 카테고리 emoji 마이그레이션 + 시스템 카테고리 25종 이모지 시딩

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

---

### Task 3: FE — Category 타입 + API 클라이언트 + CategoryManager 이모지 입력 + MSW mock

**Files:**
- Modify: `frontend/src/types/index.ts` (Category interface에 emoji 추가)
- Modify: `frontend/src/api/categories.ts` (create/update 파라미터에 emoji 추가)
- Modify: `frontend/src/pages/CategoryManager.tsx` (이모지 입력 필드 + 표시)
- Modify: `frontend/src/mocks/fixtures.ts` (Category mock에 emoji 추가)
- Modify: `frontend/src/mocks/handlers.ts` (MSW 카테고리 응답에 emoji 추가)
- Test: `frontend/src/pages/__tests__/CategoryManager.test.tsx`

**Step 1: FE 타입 수정**

`frontend/src/types/index.ts` Category interface에 추가:
```typescript
export interface Category {
  id: number
  name: string
  type: 'expense' | 'income' | 'both'
  description: string | null
  emoji: string | null  // 추가
  sort_order: number
  is_savings: boolean
  is_system: boolean
  exclude_auto_payment: boolean
  created_at: string
}
```

**Step 2: API 클라이언트 수정**

`frontend/src/api/categories.ts`의 create/update 파라미터 타입에 `emoji?: string` 추가.
이 수정이 없으면 CategoryManager에서 emoji를 보내도 TypeScript가 무시함.

**Step 3: Mock fixture + MSW handler 업데이트**

`frontend/src/mocks/fixtures.ts`의 Category 객체들에 `emoji: "📌"` 추가.

`frontend/src/mocks/handlers.ts`의 카테고리 create/update mock 응답에 `emoji` 필드 포함:
```typescript
// POST /api/categories 핸들러의 응답에 추가
emoji: body.emoji ?? "📌",
```

**Step 4: CategoryManager에 이모지 입력 추가**

추가 폼:
```typescript
// 상태 추가
const [newEmoji, setNewEmoji] = useState('📌')

// JSX — 카테고리 이름 input 앞에:
<input
  type="text"
  value={newEmoji}
  onChange={(e) => {
    const val = e.target.value
    if (val.length <= 2) setNewEmoji(val || '📌')
  }}
  className="input-base w-16 text-center text-xl"
  maxLength={2}
/>
```

`handleAdd`의 create 호출에 `emoji: newEmoji` 추가.

편집 폼에도 동일한 이모지 필드 추가 (editForm에 emoji 포함).

카테고리 목록 각 행의 이름 앞에 `{category.emoji}` 표시.

**Step 5: FE 테스트 + lint**

Run: `cd frontend && npx vitest run && npm run lint`
Expected: PASS

**Step 6: 커밋**

```
feat: FE 카테고리 이모지 — 타입/API/CategoryManager/mock 업데이트 (#570)

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

---

## PR 2: 거래 목록 아이콘 레이아웃 (Task 4-5, PR 1 머지 후)

### Task 4: FE — TransactionItem 아이콘 레이아웃 변경

**Files:**
- Modify: `frontend/src/components/TransactionItem.tsx`
- Modify: `frontend/src/components/__tests__/TransactionItem.test.tsx`
- Modify: `frontend/src/pages/__tests__/TransactionList.test.tsx` (카테고리 클릭 테스트 수정)

**Step 1: 카테고리 배경색 매핑 (전체 시스템 카테고리 + 다크모드)**

TransactionItem.tsx에 매핑 추가. **18개 지출 카테고리 전체 + 다크모드 클래스 포함:**

```typescript
// 시스템 카테고리 이름 → 배경색 (light + dark)
const CATEGORY_COLORS: Record<string, string> = {
  // 지출 (18종 전체)
  '식비': 'bg-orange-100 dark:bg-orange-900/30',
  '카페/음료': 'bg-amber-100 dark:bg-amber-900/30',
  '교통': 'bg-blue-100 dark:bg-blue-900/30',
  '주거/관리비': 'bg-stone-200 dark:bg-stone-800/30',
  '통신': 'bg-sky-100 dark:bg-sky-900/30',
  '생활용품': 'bg-teal-100 dark:bg-teal-900/30',
  '의류/미용': 'bg-fuchsia-100 dark:bg-fuchsia-900/30',
  '의료/건강': 'bg-rose-100 dark:bg-rose-900/30',
  '교육/자기계발': 'bg-indigo-100 dark:bg-indigo-900/30',
  '문화/여가': 'bg-purple-100 dark:bg-purple-900/30',
  '경조사': 'bg-red-100 dark:bg-red-900/30',
  '자녀/육아': 'bg-pink-100 dark:bg-pink-900/30',
  '반려동물': 'bg-yellow-100 dark:bg-yellow-900/30',
  '보험': 'bg-slate-100 dark:bg-slate-800/30',
  '대출/이자': 'bg-zinc-100 dark:bg-zinc-800/30',
  '세금/공과금': 'bg-neutral-100 dark:bg-neutral-800/30',
  '구독': 'bg-violet-100 dark:bg-violet-900/30',
  '기타': 'bg-gray-100 dark:bg-gray-800/30',
}

function getCategoryBgColor(categoryName: string | undefined, type: 'expense' | 'income'): string {
  if (type === 'income') return 'bg-leaf-100 dark:bg-leaf-900/30'
  if (!categoryName) return 'bg-grape-100 dark:bg-grape-900/30'
  return CATEGORY_COLORS[categoryName] ?? 'bg-grape-100 dark:bg-grape-900/30'
}
```

**Step 2: TransactionItem 레이아웃 변경**

전체 JSX를 아래로 교체. `<Link>` 안에 아이콘 `<button>` + 텍스트 영역:

```tsx
return (
  <Link
    to={detailPath}
    className={`flex items-start gap-3 px-4 py-3.5 hover:bg-[var(--surface-hover)] transition-colors ${
      excludeFromStats ? 'opacity-50' : ''
    }`}
  >
    {/* 왼쪽 아이콘 원 — 카테고리 변경 트리거 */}
    <button
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onCategoryClick()
      }}
      className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors hover:opacity-80 ${getCategoryBgColor(category?.name, type)}`}
      aria-label="카테고리 변경"
    >
      <span className="text-lg">{category?.emoji ?? '📌'}</span>
    </button>

    {/* 오른쪽 텍스트 영역 */}
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-medium text-[var(--text-primary)] truncate">
          {description}
        </span>
        <span className={`text-amount whitespace-nowrap ${
          type === 'income' ? 'text-leaf-600' : 'text-[var(--text-primary)]'
        }`}>
          {type === 'expense' ? '-' : '+'}{formatAmount(amount)}
        </span>
      </div>
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className="text-xs text-[var(--text-muted)]">
          {category?.name ?? '분류 안 됨'}
        </span>
        {isRecurring && (
          <span className="text-xs bg-[var(--border-default)] text-[var(--text-secondary)] px-1.5 py-0.5 rounded-full">정기</span>
        )}
        {excludeFromStats && (
          <span className="text-xs bg-[var(--surface-hover)] text-[var(--text-tertiary)] px-1.5 py-0.5 rounded-full">통계제외</span>
        )}
        {recordedBy && (
          <span className="text-xs text-[var(--text-tertiary)]">{recordedBy}</span>
        )}
      </div>
    </div>
  </Link>
)
```

**Step 3: 깨지는 테스트 수정**

아래 테스트 파일들이 카테고리 뱃지 `<button>` 클릭을 테스트하는데, 이제 아이콘 원 `<button aria-label="카테고리 변경">`으로 변경됨:

`frontend/src/components/__tests__/TransactionItem.test.tsx`:
```typescript
// 기존: await user.click(screen.getByText('식비'))
// 변경: await user.click(screen.getByRole('button', { name: '카테고리 변경' }))
```

`frontend/src/pages/__tests__/TransactionList.test.tsx` (카테고리 뱃지 클릭 관련):
```typescript
// 기존: screen.getByText('식비') 클릭
// 변경: screen.getByRole('button', { name: '카테고리 변경' }) 또는 getAllByRole 후 인덱스
```

**Step 4: FE 전체 테스트 + lint**

Run: `cd frontend && npx vitest run && npm run lint`
Expected: PASS

**Step 5: 커밋**

```
feat: 거래 목록 아이콘 레이아웃 — 이모지 원 + 성격별 배경색 + 다크모드 (#570)

TransactionItem 좌측에 카테고리 이모지 원형 아이콘 추가.
카테고리 뱃지 → 서브텍스트로 전환.
시스템 카테고리 18종 전체 배경색 매핑 + dark:bg-*-900/30 다크모드 대응.
카테고리 클릭 테스트를 aria-label 기반으로 수정.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

---

### Task 5: 전체 회귀 테스트 + 최종 확인

**Step 1: BE 전체 테스트**

Run: `cd backend && pytest -x -q`
Expected: 전체 PASS

**Step 2: FE 전체 테스트**

Run: `cd frontend && npx vitest run && npm run lint`
Expected: PASS

**Step 3: FE build 확인**

Run: `cd frontend && npm run build`
Expected: PASS (기존 타입 에러 제외)

**Step 4: 최종 커밋 (필요 시)**

---

## 수정 파일 요약

### PR 1 (Task 1-3)
| Task | 파일 | 변경 |
|------|------|------|
| 1 | `backend/app/models/category.py` | emoji 컬럼 추가 |
| 1 | `backend/app/schemas/category.py` | emoji 필드 추가 (Base, Create, Update, Response) |
| 1 | `backend/tests/integration/test_api_categories_extra.py` | 이모지 생성/기본값/시스템 테스트 |
| 2 | `backend/alembic/versions/xxxx_...py` | emoji 컬럼 마이그레이션 + 시스템 카테고리 시딩 |
| 3 | `frontend/src/types/index.ts` | Category에 emoji 필드 |
| 3 | `frontend/src/api/categories.ts` | create/update 파라미터에 emoji 추가 |
| 3 | `frontend/src/pages/CategoryManager.tsx` | 이모지 입력/표시 |
| 3 | `frontend/src/mocks/fixtures.ts` | mock에 emoji 추가 |
| 3 | `frontend/src/mocks/handlers.ts` | MSW 카테고리 응답에 emoji 추가 |

### PR 2 (Task 4-5)
| Task | 파일 | 변경 |
|------|------|------|
| 4 | `frontend/src/components/TransactionItem.tsx` | 아이콘 원 레이아웃 + 배경색 매핑 |
| 4 | `frontend/src/components/__tests__/TransactionItem.test.tsx` | 카테고리 클릭 테스트 수정 |
| 4 | `frontend/src/pages/__tests__/TransactionList.test.tsx` | 카테고리 클릭 테스트 수정 |

## 시스템 카테고리 이모지 매핑 (25종)

| 카테고리 | 이모지 | 배경색 (light/dark) |
|---------|--------|-------------------|
| 식비 | 🍚 | orange-100 / orange-900/30 |
| 카페/음료 | ☕ | amber-100 / amber-900/30 |
| 교통 | 🚗 | blue-100 / blue-900/30 |
| 주거/관리비 | 🏠 | stone-200 / stone-800/30 |
| 통신 | 📱 | sky-100 / sky-900/30 |
| 생활용품 | 🛒 | teal-100 / teal-900/30 |
| 의류/미용 | ✨ | fuchsia-100 / fuchsia-900/30 |
| 의료/건강 | 🏥 | rose-100 / rose-900/30 |
| 교육/자기계발 | 📚 | indigo-100 / indigo-900/30 |
| 문화/여가 | 🎬 | purple-100 / purple-900/30 |
| 경조사 | 🎁 | red-100 / red-900/30 |
| 자녀/육아 | 👶 | pink-100 / pink-900/30 |
| 반려동물 | 🐾 | yellow-100 / yellow-900/30 |
| 보험 | ☂️ | slate-100 / slate-800/30 |
| 대출/이자 | 💸 | zinc-100 / zinc-800/30 |
| 세금/공과금 | 📋 | neutral-100 / neutral-800/30 |
| 구독 | 📺 | violet-100 / violet-900/30 |
| 기타 | 📌 | gray-100 / gray-800/30 |
| 급여 | 💰 | leaf-100 (다크모드 자동) |
| 부수입 | 💵 | leaf-100 (다크모드 자동) |
| 사업소득 | 🏢 | leaf-100 (다크모드 자동) |
| 투자/배당 | 📈 | leaf-100 (다크모드 자동) |
| 용돈/지원 | 🎉 | leaf-100 (다크모드 자동) |
| 중고판매 | 🥕 | leaf-100 (다크모드 자동) |
| 기타수입 | 📌 | leaf-100 (다크모드 자동) |

## 알려진 제한사항
- 커스텀 카테고리는 모두 `bg-grape-100` fallback (이름 기반 매핑 한계)
- 향후 개선: Category 모델에 `color` 필드 추가 또는 카테고리명 해시 기반 색상 자동 배정
- ExpenseDetail/IncomeDetail 카테고리 셀렉터에 이모지 표시는 follow-up
