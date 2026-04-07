# 자산 기능 비활성화 + 플로팅 탭바 + 즉시 입력 UX

## 목적

1. 자산 기능을 피처 플래그로 비활성화하여 가계부 핵심에 집중 + 성능 개선
2. 하단 네비게이션을 iOS 26 리퀴드 글래스 스타일 플로팅 아일랜드로 변경
3. 거래 입력 플로우를 메신저 스타일로 단순화 (4-5스텝 → 1스텝)

## 스코프

- **대상**: 프론트엔드 전체 (Layout, 라우팅, InsightsPage, GuidePage 등) + GitHub Actions + 백엔드 일부
- **제외**: 백엔드 API/모델 삭제 (피처 플래그로 숨기기만, DB 데이터 보존)
- **접근법**: 환경변수 `VITE_FEATURE_ASSETS=false`로 on/off 제어

---

## 서브프로젝트 1: 자산 기능 비활성화

### 피처 플래그 설계

환경변수: `VITE_FEATURE_ASSETS` (기본값: `'false'`)

```typescript
// frontend/src/config/features.ts (신규)
export const FEATURES = {
  assets: import.meta.env.VITE_FEATURE_ASSETS === 'true',
}
```

### 프론트엔드 변경 범위

**1) 네비게이션 (Layout.tsx)**
- `navItems`에서 자산 탭 조건부 제외
- 데스크톱 사이드바 + 모바일 하단 탭 모두 적용

**2) 라우팅 (App.tsx)**
- `/assets`, `/assets/new`, `/assets/:id` 라우트 조건부 제거
- `/accounts`, `/accounts/*` 라우트도 함께 제거
- 비활성 상태에서 `/assets/*`, `/accounts/*` 직접 URL 접근 시 `/home`으로 리다이렉트

**3) 돌아보기 (InsightsPage.tsx)**
- `assetApi.getSnapshots` 쿼리 제거 (피처 플래그 조건)
- `assetSummary` 파생 로직 제거 → 관련 변수 null/0으로 대체
- 건강점수 계산: `totalAssets=0`, `totalLiabilities=0`
- `AssetChangeSummary` 섹션 렌더링 조건에 피처 플래그 추가
- `SectionToggleModal`에서 "자산 변화" 토글 숨김
- AI 분석 요청 데이터에서 자산 부분 제외

**4) 요약카드 (UnifiedSummaryCards.tsx)**
- 순자산 카드 조건부 숨김 (`FEATURES.assets` 체크)

**5) 가이드 (GuidePage.tsx)**
- "자산 관리" 섹션 조건부 숨김

**6) 계좌 관리 (AccountManager.tsx)**
- 페이지 자체를 라우트와 함께 숨김

**7) 랜딩페이지 (LandingPage.tsx)**
- 자산 관련 문구가 있으면 조건부 숨김

**8) StructuredInsightsView.tsx**
- 자산 분석 섹션 조건부 숨김

### GitHub Actions 변경

**`daily-snapshot.yml`**
- `on` 트리거를 `workflow_dispatch`(수동 실행)만 남기고 `schedule` 제거
- 나중에 자산 기능 복원 시 schedule 재활성화

### 백엔드 변경

- API 라우터 등록은 유지 (DB 데이터 보존, 나중에 다시 활성화 대비)
- 변경 없음

### 테스트 변경

- Layout 테스트: 자산 탭 활성화 테스트를 피처 플래그 조건부로 변경
- InsightsPage 테스트: 자산 관련 assertion 제거 또는 조건부 스킵
- UnifiedSummaryCards 테스트: 순자산 카드 assertion 조건부
- 자산 전용 테스트 파일들: 피처 플래그 `true` 환경에서만 실행 (또는 스킵)

### 마무리

- `changelogs.ts`: "자산 기능 일시 비활성화" 항목 추가
- `CLAUDE.md`: Current State 섹션에 자산 비활성화 상태 반영

---

## 서브프로젝트 2: 플로팅 아일랜드 탭바

### 디자인 컨셉

iOS 26 리퀴드 글래스 스타일 — 하단 중앙에 둥근 아일랜드가 떠있는 형태.
Apple 시계/단축어 앱의 3탭 가운데 배치 참조.

### 레이아웃

```
[콘텐츠 영역]

      ┌──────────────────────────────────────┐
      │ [가계부] [돌아보기] [더보기]  │  [✏️] │
      └──────────────────────────────────────┘
              하나의 아일랜드, 화면 하단 중앙 정렬
```

**배치 규칙:**
- 3탭 + 구분선(|) + 입력 버튼이 **하나의 아일랜드** 안에 배치
- 입력 버튼은 grape-600 원형 배경으로 시각적 구분
- 아일랜드 전체가 **화면 하단 중앙 정렬**
- 하단 여백: `bottom: env(safe-area-inset-bottom) + 12px`
- 입력 모드 전환 시 아일랜드 내부만 변환 (외곽은 유지)

### 아일랜드 스타일

glass morphism 전용 CSS 변수를 `index.css`에 신규 정의:

```css
:root {
  --glass-bg: rgba(255, 255, 255, 0.7);
  --glass-border: rgba(255, 255, 255, 0.2);
}
.dark {
  --glass-bg: rgba(35, 30, 48, 0.7);   /* grape 톤 다크 — 기존 surface 팔레트 기반 */
  --glass-border: rgba(255, 255, 255, 0.1);
}
```

```css
/* 네비게이션 아일랜드 */
- 배경: bg-[var(--glass-bg)] backdrop-blur-xl
- 모서리: rounded-full (완전 둥글림)
- 테두리: border border-[var(--glass-border)]
- 그림자: shadow-lg
- 패딩: px-6 py-2
- 아이콘 + 라벨 (활성 탭: grape-600, 비활성: text-muted)

/* 입력 버튼 (아일랜드 내부 우측) */
- 배경: grape-600 (solid — 가장 중요한 액션이므로 불투명 강조)
- 크기: 40×40px 원형 (아일랜드 높이에 맞춤)
- 아이콘: Pencil (Lucide) — white
- 모서리: rounded-full
- 탭과의 구분: 좌측에 1px 구분선 (border-[var(--glass-border)])
```

### 데스크톱 (md 이상)

- 기존 사이드바 유지 (자산 탭만 피처 플래그로 제외)
- 하단 플로팅 탭바는 모바일(`md` 미만, <768px)에서만 표시
- 입력 버튼은 데스크톱에서도 우하단 플로팅으로 표시

### 콘텐츠 영역 패딩

- 기존: `pb-40` (전체 너비 탭바 높이만큼)
- 변경: `pb-24` — 아일랜드가 더 작고 떠있으므로 축소
- safe-area 대응: `pb-24 + env(safe-area-inset-bottom)` (CSS calc)

### PWA safe-area 처리

기존 `safe-area-bottom` 클래스를 플로팅 아일랜드에도 적용:
- 아일랜드 컨테이너에 `bottom: calc(env(safe-area-inset-bottom, 0px) + 12px)` 설정
- iPhone 노치/다이나믹 아일랜드 디바이스에서 탭바가 홈 인디케이터와 겹치지 않도록

### FAB 처리

PR 2 시점에서 FAB(FloatingActionButton)을 **즉시 제거**. 입력 버튼이 FAB을 대체하므로 공존 불필요.

### 테스트

- `FloatingTabBar.test.tsx`: 3개 탭 렌더링, 활성 탭 표시, 네비게이션 동작
- `Layout.test.tsx`: 기존 하단 탭 테스트를 FloatingTabBar 기준으로 업데이트
- 데스크톱/모바일 breakpoint 분기 테스트

### 마무리

- `changelogs.ts`: "하단 네비게이션 리뉴얼" 항목 추가

---

## 서브프로젝트 3: 즉시 입력 UX

### 입력 플로우

```
1. 입력 버튼(✏️) 탭
2. 탭바 영역이 입력창으로 전환 (fade 애니메이션)
3. 키보드 올라옴 + 텍스트 입력
4. 전송 버튼 탭 (또는 Enter)
5. LLM 파싱+저장 (preview=false) → 백엔드가 카테고리 매칭+저장까지 한 번에 처리
6. 입력창 → 탭바로 복귀 + 성공 토스트 표시
```

### 입력창 UI

```
[입력 모드 — 탭바 영역이 변환]
┌────────────────────────────────────────┐
│  점심 김치찌개 8000원              [→] │
└────────────────────────────────────────┘
           키보드
```

- 아일랜드 내부가 탭 → 입력창으로 전환 (아일랜드 외곽은 유지)
- 전송 버튼(→) 우측 (입력 버튼 위치에서 변환)
- 배경: 동일한 glass morphism 스타일
- placeholder: "오늘 점심 8000원"
- 좌측에 취소 버튼(×) — 명시적 종료 수단
- 입력창 밖 탭 또는 ESC → 입력 취소, 탭바 복귀

### 전환 애니메이션

CSS transition 기반 fade 전환 (Framer Motion 미도입 — 번들 크기 우선):

```
[탭바 상태]
  ┌─ 가계부 ─ 돌아보기 ─ 더보기 ─│─ ✏️ ─┐

  ↓ 0.2s ease-out fade

[입력 상태]
  ┌─ ✕ ─ placeholder...         ─ → ─┐
```

- 구현: 아일랜드 컨테이너 안에 탭바/입력창 두 레이어를 두고 `opacity` + `pointer-events` 전환
- 아일랜드 외곽(모서리, 배경, 블러)은 유지 — 내부 콘텐츠만 교체
- 키보드 높이에 따라 `bottom` 위치 조정

### 키보드 대응

iOS Safari에서 키보드가 올라올 때 `position: fixed` 요소 위치 문제 해결:

- `visualViewport` API로 키보드 높이 감지
- `window.visualViewport.addEventListener('resize', ...)` → 입력 바 `bottom` 값 동적 조정
- Android는 `resize` 이벤트로 대응 (기본 동작)
- PWA standalone 모드에서도 동일하게 동작하도록 테스트 필요

### LLM 파싱 → 즉시 저장

기존 `POST /api/chat` 엔드포인트를 **`preview=false`**로 호출 — 백엔드가 파싱+카테고리 매칭+저장을 한 번에 처리:

1. 텍스트를 `POST /api/chat` (`preview=false`)로 전송
2. 백엔드가 LLM 파싱 → 카테고리 매칭 → `expenses`/`income` 테이블에 저장까지 완료
3. 응답의 `expenses_created[0].id` 또는 `incomes_created[0].id`로 거래 ID 획득
4. **파싱 검증**: 응답에 `expenses_created`와 `incomes_created` 모두 비어있으면 파싱 실패 처리 (입력창 유지)
5. 성공 토스트에 거래 ID를 사용하여 "수정 →" 링크 생성

`preview=false` 사용 이유: `preview=true`로 파싱만 받으면 category가 문자열 이름("식비")으로 오는데, 저장 API는 `category_id`(숫자)를 요구. 카테고리 목록을 fetch해서 매칭하는 과정이 필요해지며 "1스텝" 철학에 반함. `preview=false`는 백엔드가 모든 매칭을 처리하므로 프론트에서 별도 저장 API 호출 불필요.

### 저장 후 캐시 무효화

```typescript
// QuickInput 저장 성공 후 필수
const queryClient = useQueryClient()
queryClient.invalidateQueries({ queryKey: monthlyTransactionsKeys.all })
```

`monthlyTransactionsKeys.all`은 `['monthly-transactions']`로 이미 `useMonthlyTransactions.ts`에 export. 어떤 페이지에서 입력하든 홈 캐시가 갱신됨.

### 다중 항목 처리

"점심 8000원, 커피 4500원" 같은 다중 파싱:
- `preview=false`가 여러 건을 한 번에 저장 (백엔드에서 처리)
- 성공 토스트: "2건 저장 · ₩12,500" 형태
- 토스트 탭 시 가계부 홈으로 이동 (최신 거래 확인)
- 부분 실패(1건 성공, 1건 실패): 성공 건만 저장 + "1건 저장, 1건 실패" 토스트

### 상태 관리

`isInputMode` 상태는 **Layout.tsx의 로컬 state**에 배치:

```typescript
const [isInputMode, setIsInputMode] = useState(false)
```

- `FloatingTabBar`에 `onInputOpen` prop으로 전달
- `QuickInput`에 `isOpen`, `onClose` prop으로 전달
- Context/전역 상태 불필요 — Layout 안에서만 사용되는 UI 상태

### 첫 사용자 온보딩

입력 버튼의 발견성을 높이기 위해:
- 첫 방문 시(localStorage 체크) 입력 버튼에 **펄스 애니메이션** + 말풍선 툴팁 "여기에 거래를 입력하세요"
- 첫 입력 완료 후 사라짐
- `localStorage.setItem('podo-quick-input-onboarded', 'true')` 저장

### 접근성

- 입력 버튼: `aria-label="거래 입력"`
- 입력 모드 전환 시 `input`에 자동 focus
- 성공/실패 토스트: `role="status"` + `aria-live="polite"`
- `prefers-reduced-motion: reduce` → fade/width transition 비활성화
- 탭바 네비게이션: 각 탭에 `aria-current="page"` (기존 유지)

### LLM 로딩 상태

전송 후 LLM 응답 대기 중:
- 전송 버튼(→) → 로딩 스피너로 전환
- 입력창 placeholder: "분석 중..."
- 입력 비활성화 (중복 전송 방지)
- 타임아웃: 15초 초과 시 에러 토스트 ("응답이 지연되고 있어요. 다시 시도해주세요")

### 성공 토스트 (하단 카드형 — ActionToast)

```
[성공 — 탭바 바로 위]
┌──────────────────────────────────┐
│  🍚 김치찌개                      │
│  식비 · ₩8,000         수정 →    │
└──────────────────────────────────┘
```

**스타일:**
- 배경: `surface-card` + `border-l-4 border-grape-400` (왼쪽 포인트 라인)
- Grape 디자인 시스템 톤 — 기존 앱과 조화
- 카테고리 이모지 좌측
- 우측 "수정 →" grape-600 텍스트 — 탭하면 해당 거래 상세 페이지(`/expense/{id}` 또는 `/income/{id}`)로 이동
- 3초 후 자동 사라짐 (slide-down 애니메이션)
- 위치: 탭바 아일랜드 바로 위 (`bottom: 탭바높이 + 12px`)

### 실패 토스트

**파싱 실패 (금액 없음 등):**
```
┌──────────────────────────────────────┐
│  ⚠️ 거래 정보를 인식하지 못했어요      │
│  금액을 포함해서 다시 입력해주세요      │
└──────────────────────────────────────┘
```
- **입력창 유지 (닫히지 않음)** — 바로 재입력 가능
- warm-500 왼쪽 포인트 라인

**서버 에러:**
```
┌──────────────────────────────────────┐
│  ❌ 저장에 실패했어요                  │
│  점심 김치찌개 8000원    다시 시도 →   │
└──────────────────────────────────────┘
```
- 입력 텍스트 보존 — "다시 시도 →" 탭하면 재전송
- rose-500 왼쪽 포인트 라인

### 입력 중 페이지 이동

사용자가 텍스트를 입력 중 다른 탭을 누른 경우:
- 입력 모드 해제 + 탭바 복귀
- 입력 내용은 **버려짐** (메신저에서 탭 이동하면 입력 중 텍스트가 사라지는 것과 동일)
- 별도 경고/확인 없음 — 경량 입력이므로 다시 치는 게 더 빠름

---

## 기존 입력 플로우와의 관계

### 삭제되는 것
- FAB (플로팅 액션 버튼) 컴포넌트 — `FloatingActionButton.tsx`
- 유형 선택 모달 (지출/수입 선택)

### 유지되는 것
- `TransactionForm` 컴포넌트 — 직접 입력 모드(폼 필드)는 유지
  - `/expense/new`, `/income/new` 라우트로 직접 접근 시 사용
  - 설정에서 "직접 입력 모드" 토글은 **이번 스코프에 미포함** — 현재 설정에 없는 옵션이므로 추후 검토
- `ExpenseDetail` / `IncomeDetail` — 수정 시 사용 (토스트 "수정 →"의 이동 대상)

### 지출/수입 자동 판별

현재는 유형 선택 모달에서 사용자가 직접 "지출"/"수입"을 고르는데, 즉시 입력에서는 **LLM이 자동 판별**:
- "월급 300만원" → 수입
- "점심 8000원" → 지출
- 애매한 경우 → 지출로 기본 처리 (가계부 앱에서 지출이 압도적 다수)

이미 백엔드 `/api/chat`에 컨텍스트 탐지 로직이 있으므로 활용.

---

## 기술 구현 노트

### 새로 만드는 컴포넌트

1. **`FloatingTabBar.tsx`** — 플로팅 아일랜드 네비게이션 (모바일 전용)
2. **`QuickInput.tsx`** — 즉시 입력 UI (탭바 전환 + LLM 전송 + 저장)
3. **`ActionToast.tsx`** — 하단 카드형 토스트 (성공/실패, 탭 가능)
4. **`frontend/src/config/features.ts`** — 피처 플래그 설정

### 수정하는 컴포넌트

1. **`Layout.tsx`** — 기존 하단 탭바 → `FloatingTabBar` 교체, FAB 제거
2. **`App.tsx`** — 자산/계좌 라우트 조건부
3. **`InsightsPage.tsx`** — 자산 쿼리/섹션 조건부 제거
4. **`UnifiedSummaryCards.tsx`** — 순자산 카드 조건부
5. **`GuidePage.tsx`** — 자산 섹션 조건부
6. **`SectionToggleModal.tsx`** — 자산 토글 조건부
7. **`StructuredInsightsView.tsx`** — 자산 분석 섹션 조건부
8. **`index.css`** — glass morphism CSS 변수 추가

### 삭제하는 것

1. **`FloatingActionButton.tsx`** — FAB 컴포넌트 (PR 2에서 제거)

### 테스트 전략

**서브프로젝트 2 (플로팅 탭바):**
- `FloatingTabBar.test.tsx`: 3개 탭 렌더링, 활성 탭 grape-600, 네비게이션 동작
- `Layout.test.tsx`: 기존 탭 테스트 업데이트
- 입력 버튼 렌더링 확인

**서브프로젝트 3 (즉시 입력):**
- `QuickInput.test.tsx`: 입력 모드 전환, 텍스트 입력, 전송, 로딩 상태
- `ActionToast.test.tsx`: 성공/실패 렌더링, "수정 →" 클릭 시 navigate
- MSW handler 활용: `/api/chat` mock으로 파싱 성공/실패 시나리오
- 에러 케이스: 파싱 실패(금액 없음), 서버 에러, 타임아웃
- 다중 항목 파싱 테스트

---

## 마무리 프로토콜

### changelogs.ts
```typescript
{
  version: '0.16.0',
  date: '2026-04-XX',
  title: '입력 UX 개편',
  items: [
    { tag: '개선', text: '거래 입력이 더 간편해졌어요 — 하단 입력창에 바로 타이핑' },
    { tag: '개선', text: '하단 메뉴 디자인 리뉴얼 — 플로팅 아일랜드 스타일' },
    { tag: '변경', text: '자산 기능 일시 비활성화 — 가계부에 집중합니다' },
  ],
},
```

### CLAUDE.md 업데이트
- Current State: 4탭 → 3탭 (자산 비활성화), FAB → 즉시 입력
- Frontend 구조: FloatingTabBar, QuickInput, ActionToast 추가

### PWA cacheId 업데이트
- `vite.config.ts`의 `workbox.cacheId`를 버전업 (Layout 대규모 변경 후 캐시 충돌 방지)
- PR 2 (플로팅 탭바) 완료 시 반드시 적용

---

## PR 분할

| PR | 내용 | 의존성 |
|---|---|---|
| **PR 1: 자산 비활성화** | 피처 플래그 + 네비/라우트/InsightsPage/GuidePage 조건부 처리 + cron 비활성화 | 없음 |
| **PR 2: 플로팅 탭바** | FloatingTabBar + glass morphism + safe-area + FAB 제거 + 데스크톱 호환 | PR 1 |
| **PR 3: 즉시 입력 UX** | QuickInput + 탭바 전환 + LLM 즉시 저장 + ActionToast + 키보드 대응 | PR 2 |

PR 1은 독립적으로 배포 가능. PR 2, 3은 순서대로.
