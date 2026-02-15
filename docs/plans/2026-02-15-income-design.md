# 수입(Income) 기능 설계서

**날짜:** 2026-02-15
**상태:** 승인됨

## 개요

현재 지출(Expense)만 관리하는 가계부 앱에 수입(Income) 기능을 추가한다.
자연어 입력을 통한 LLM 자동 분류, 가구 공유, 통계 분석 등 기존 지출과 동일한 수준의 기능을 제공한다.

## 설계 결정

### 접근 방식: 별도 Income 모델 (Approach A)

**선택 이유:**
- 기존 Expense 코드(313 BE + 368 FE 테스트) 변경 없음
- 독립적으로 개발/테스트 가능
- Expense와 동일한 검증된 패턴 재사용
- 향후 수입 전용 기능(반복 수입 등) 추가 용이

**기각된 대안:**
- B: Transaction 통합 모델 — 전체 리팩토링 필요, 리스크 높음
- C: Expense에 is_income 플래그 — 의미적으로 어색, 쿼리 복잡도 증가

---

## 섹션 1: Backend

### Income 모델

```python
class Income(Base):
    __tablename__ = "incomes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="SET NULL"), nullable=True)
    amount = Column(Numeric(12, 2), nullable=False)
    description = Column(String(500), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    raw_input = Column(String(1000), nullable=True)
    date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="incomes")
    category = relationship("Category")
    household = relationship("Household")

    # Indexes
    __table_args__ = (
        Index("ix_incomes_date", "date"),
        Index("ix_incomes_user_date", "user_id", "date"),
    )
```

### Category 모델 확장

```python
# 기존 Category 모델에 추가
type = Column(String(10), nullable=False, default="expense")
# 값: "expense" | "income" | "both"
```

- 기존 카테고리는 자동으로 `type="expense"` 유지
- 새 수입 카테고리 생성 시 `type="income"` 설정
- `type="both"`는 식비 등 양쪽 모두 사용 가능한 카테고리

### API 엔드포인트

| Method | Path | Status | 설명 |
|--------|------|--------|------|
| POST | `/api/income` | 201 | 수입 생성 |
| GET | `/api/income` | 200 | 수입 목록 (필터링/페이지네이션) |
| GET | `/api/income/{id}` | 200 | 수입 상세 |
| PUT | `/api/income/{id}` | 200 | 수입 수정 |
| DELETE | `/api/income/{id}` | 204 | 수입 삭제 |
| GET | `/api/income/stats` | 200 | 수입 통계 |

### 쿼리 파라미터 (목록 조회)

```
GET /api/income?skip=0&limit=20&start_date=2026-01-01&end_date=2026-01-31
    &category_id=5&household_id=1&member_user_id=2
```

### Chat API 확장

기존 Chat API의 LLM 프롬프트를 확장하여 수입/지출을 자동 분류:
- "월급 350만원" → 수입으로 분류
- "점심 김치찌개 8000원" → 지출으로 분류
- 프리뷰 응답에 `type: "income" | "expense"` 필드 추가

---

## 섹션 2: Frontend UI

### 페이지 구성

1. **수입 목록 페이지 (`/income`)** — ExpenseList와 동일한 레이아웃
2. **수입 상세 페이지 (`/income/:id`)** — ExpenseDetail과 동일 (수정/삭제)
3. **수입 입력** — 기존 Chat 페이지 확장 (LLM이 수입/지출 자동 분류)

### 대시보드 통합

```
┌─────────────┬─────────────┬─────────────┐
│  총 수입     │  총 지출     │  순수익      │
│  ₩3,500,000 │  ₩2,800,000 │  ₩700,000   │
│  ▲ 5.2%     │  ▼ 3.1%     │  ▲ 12.5%    │
└─────────────┴─────────────┴─────────────┘
```

- 최근 거래 목록에 수입/지출 통합 표시 (색상 구분: 수입=초록, 지출=빨강)

### 사이드바 네비게이션

```
📊 대시보드
💬 입력 (Chat)
📋 지출 목록
💰 수입 목록     ← 새로 추가
📁 카테고리
💵 예산
📈 통계/리포트
```

### 통계 페이지 확장

- "수입" 탭 또는 토글 추가
- 수입 추이 차트, 카테고리별 수입 분석
- 수입 vs 지출 비교 차트

### TypeScript 타입

```typescript
interface Income {
  id: number
  user_id: number
  household_id: number | null
  amount: number
  description: string
  category_id: number | null
  category_name: string | null
  raw_input: string | null
  date: string
  created_at: string
  updated_at: string
}
```

### Zustand Store

- `useIncomeStore` — Expense store 패턴 미러링
- `useDashboardStore`에 수입 합계/순수익 추가

---

## 섹션 3: 구현 범위 및 테스트

### MVP 범위

| 포함 | 미포함 (추후) |
|------|--------------|
| Income 모델 + CRUD API + 통계 API | 반복 수입 자동등록 |
| Category `type` 필드 추가 | 수입 전용 예산 관리 |
| Chat API 수입/지출 분류 확장 | 현금흐름 예측 |
| 수입 목록/상세 페이지 | 수입 목표 설정 |
| 대시보드 수입/순수익 카드 | 수입원별 분석 리포트 |
| 사이드바 네비게이션 추가 | |
| 통계 페이지 수입 탭 | |

### DB 마이그레이션

1. `incomes` 테이블 생성
2. `categories.type` 컬럼 추가 (`VARCHAR(10)`, default="expense")
3. 기존 카테고리는 자동으로 "expense" 유지

### 테스트 전략

**Backend (~40-50개)**
- Unit: Income 모델, Category type 필터링
- Integration: Income CRUD API, 통계 API, Chat 수입 분류
- 가구 수입 접근 권한

**Frontend (~30-40개)**
- 수입 목록/상세 페이지 렌더링
- 대시보드 수입/순수익 카드
- MSW 핸들러 API 모킹
- 수입 폼 입력/수정

### 기존 코드 영향

- **Expense**: 변경 없음
- **Category**: `type` 필드 추가만 (기존 쿼리 영향 없음)
- **Chat API**: LLM 프롬프트 확장
- **Dashboard**: 기존 카드 유지 + 수입/순수익 카드 추가
