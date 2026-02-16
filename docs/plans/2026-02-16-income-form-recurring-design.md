# 수입 입력 UI + 정기 거래 설계서

**작성일**: 2026-02-16
**상태**: 승인됨

---

## 기능 1: 수입 입력 UI (IncomeForm)

### 개요

ExpenseForm.tsx 패턴을 미러링하여 수입 입력 페이지를 추가한다. 백엔드 Chat API가 이미 `type=income` 분류를 지원하므로 프론트엔드만 추가.

### 구성

- **IncomeForm.tsx**: 자연어 모드 + 직접 입력 폼 (emerald 테마)
- **자연어 모드**: `chatApi.sendMessage()` → `ParsedExpenseItem[]` 중 `type=income` 필터 → 프리뷰 편집 → `incomeApi.create()`
- **폼 모드**: 금액, 설명, 카테고리(income/both), 날짜, 가구 선택 → `incomeApi.create()`
- **라우트**: `/income/new` 추가
- **IncomeList**: "수입 등록" 버튼 추가

### 자연어 파싱 시 혼합 처리

자연어에서 지출/수입이 섞여 나올 수 있음. income만 필터링해서 보여주되, expense 항목은 "지출로 분류된 항목은 별도 저장됩니다" 안내 메시지 표시.

### 카테고리 필터링

카테고리 드롭다운에서 `type=income` 또는 `type=both`인 카테고리만 표시.

---

## 기능 2: 정기 거래 (Recurring Transaction)

### 개요

정기 지출(넷플릭스, 월세)과 정기 수입(급여, 이자)을 관리하는 기능. 알림 + 수동 확인 방식으로 레코드 생성.

### 데이터 모델

```
RecurringTransaction:
  id: Integer (PK)
  user_id: Integer (FK → users)
  household_id: Integer | null (FK → households)
  type: Enum('expense', 'income')
  amount: Numeric(12, 2), > 0
  description: String
  category_id: Integer | null (FK → categories)
  frequency: Enum('monthly', 'weekly', 'yearly', 'custom')
  interval: Integer | null (custom일 때 N일마다)
  day_of_month: Integer | null (1-31, monthly/yearly용)
  day_of_week: Integer | null (0-6, weekly용)
  month_of_year: Integer | null (1-12, yearly용)
  start_date: Date
  end_date: Date | null (null = 무기한)
  next_due_date: Date
  is_active: Boolean (default True)
  created_at: DateTime
  updated_at: DateTime

인덱스:
  - (user_id, is_active)
  - (next_due_date, is_active)
  - (household_id, is_active)
```

### 알림 + 수동 확인 플로우

1. 사용자 앱 접속 시 `GET /recurring/pending` 호출
2. `next_due_date ≤ today`인 활성 정기 거래 조회
3. 대시보드에 "오늘의 정기 거래" 카드 표시
4. 사용자 선택:
   - **[등록]** → `POST /recurring/{id}/execute` → Expense/Income 생성, next_due_date 갱신
   - **[건너뛰기]** → `POST /recurring/{id}/skip` → next_due_date만 갱신
   - **[수정]** → 금액 등 수정 후 등록

### next_due_date 계산 로직

- **monthly**: 현재 next_due_date에서 1개월 추가 (day_of_month 유지)
- **weekly**: 7일 추가
- **yearly**: 1년 추가
- **custom**: interval일 추가
- end_date 초과 시 is_active = False

### API 엔드포인트

| Method | Path | 설명 | 응답 |
|--------|------|------|------|
| POST | /recurring | 생성 | 201 Created |
| GET | /recurring | 목록 (type 필터) | 200 OK |
| GET | /recurring/{id} | 상세 | 200 OK |
| PUT | /recurring/{id} | 수정 | 200 OK |
| DELETE | /recurring/{id} | 삭제 | 204 No Content |
| POST | /recurring/{id}/execute | 실행 (Expense/Income 생성) | 201 Created |
| POST | /recurring/{id}/skip | 건너뛰기 | 200 OK |
| GET | /recurring/pending | 처리 대기 항목 | 200 OK |

### 프론트엔드 UI

- **정기 거래 관리 페이지** (`/recurring`): 목록 (지출/수입 탭) + 추가/수정/삭제/일시정지
- **정기 거래 폼**: 타입(지출/수입), 금액, 설명, 카테고리, 빈도, 시작일, 종료일
- **대시보드 카드**: 오늘 처리할 정기 거래 알림 (등록/건너뛰기/수정 버튼)
- **사이드바**: "정기 거래" 메뉴 추가 (CalendarClock 아이콘)

### 빈도별 입력 필드

| 빈도 | 추가 필드 |
|------|----------|
| monthly | day_of_month (1-31) |
| weekly | day_of_week (월-일) |
| yearly | month_of_year + day_of_month |
| custom | interval (N일마다) |

### Household 연동

- 정기 거래도 household_id 지원
- 실행(execute) 시 생성되는 Expense/Income에 household_id 전달
- 가구 멤버만 해당 가구의 정기 거래 조회 가능

---

## 참조

- ExpenseForm.tsx: 자연어/폼 입력 패턴 레퍼런스
- Chat API (backend/app/api/chat.py): LLM 파싱 + income 분류
- Income API (backend/app/api/income.py): CRUD + 통계
