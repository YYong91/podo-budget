# 온보딩 웰컴 카드 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 홈화면 상단에 시작 가이드 카드를 표시하여 첫 사용자의 핵심 기능 안착을 유도한다.

**Architecture:** WelcomeCard 컴포넌트를 생성하여 TransactionList 상단에 배치. 완료 판정은 기존 API 데이터(거래, 예산, 봇 연동) + 브라우저 API(PWA)를 활용. dismissed 상태는 localStorage에 저장.

**Tech Stack:** React, TypeScript, Tailwind CSS (Grape 디자인 시스템), Lucide Icons, localStorage

**설계 문서:** `docs/plans/2026-03-23-onboarding-welcome-card-design.md`

---

### Task 1: WelcomeCard 컴포넌트 생성

**Files:**
- Create: `frontend/src/components/WelcomeCard.tsx`

**Step 1: WelcomeCard 컴포넌트 작성**

체크리스트 4개 항목을 표시하는 카드 컴포넌트. props로 완료 상태를 받고, 링크와 닫기 기능을 제공한다.

```typescript
// Props 인터페이스
interface WelcomeCardProps {
  hasTransaction: boolean    // 거래 1건 이상 존재
  hasBudget: boolean         // 예산 1건 이상 설정
  isBotLinked: boolean       // 텔레그램 or 카카오 연동
  isPwaInstalled: boolean    // PWA standalone 모드
  onDismiss: () => void      // 닫기 클릭
}
```

UI 구조:
- 카드 헤더: "시작 가이드" + 진행률 (N/4) + X 닫기 버튼
- 체크리스트: 4개 항목, 각각 체크 아이콘 + 텍스트 + 화살표 링크
- 완료 항목: grape-500 체크 + 취소선 스타일
- 미완료 항목: 빈 원 + 클릭 가능 링크
- 전부 완료 시: 축하 메시지 표시 후 3초 뒤 자동 닫기

Grape 디자인 시스템 카드: `bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]`

링크 대상:
- 첫 거래 입력하기 → `/expenses/new` (useNavigate)
- 예산 설정하기 → `/budgets` (useNavigate)
- 봇 연동하기 → `/settings/my-account` (useNavigate)
- 홈화면에 추가하기 → PWA 설치 프롬프트 트리거 (beforeinstallprompt 이벤트) 또는 안내 텍스트

**Step 2: 빌드 확인**

Run: `cd frontend && npm run build`
Expected: 빌드 성공 (아직 사용하는 곳 없으므로 tree-shaking됨)

**Step 3: 커밋**

```bash
git add frontend/src/components/WelcomeCard.tsx
git commit -m "feat: WelcomeCard 컴포넌트 생성 (#80)"
```

---

### Task 2: TransactionList에 WelcomeCard 통합

**Files:**
- Modify: `frontend/src/pages/TransactionList.tsx`
- Read: `frontend/src/api/budgets.ts` (getBudgets 함수)
- Read: `frontend/src/contexts/AuthContext.tsx` (userProfile.is_telegram_linked, is_kakao_linked)

**Step 1: TransactionList에 WelcomeCard 연동**

데이터 소스별 완료 판정 로직:
- `hasTransaction`: 기존 expenses + income 데이터 길이 > 0 (추가 API 없음)
- `hasBudget`: budgetApi.getBudgets() 호출 → length > 0 (새 API 호출 1개)
- `isBotLinked`: AuthContext의 userProfile.is_telegram_linked || is_kakao_linked
- `isPwaInstalled`: `window.matchMedia('(display-mode: standalone)').matches`

localStorage 관리:
- 키: `podo-welcome-dismissed`
- 닫기 클릭 시 `true` 저장
- 표시 조건: dismissed가 아니고, 4개 중 미완료 있을 때

WelcomeCard 위치: PendingRecurring 카드 위, 캘린더 위

**Step 2: 빌드 + 린트 확인**

Run: `cd frontend && npm run lint && npm run build`
Expected: 에러 없음

**Step 3: 커밋**

```bash
git add frontend/src/pages/TransactionList.tsx
git commit -m "feat: TransactionList에 WelcomeCard 통합 (#80)"
```

---

### Task 3: 테스트 작성

**Files:**
- Create: `frontend/src/components/__tests__/WelcomeCard.test.tsx`

**Step 1: WelcomeCard 테스트 작성**

테스트 케이스:
1. 모든 항목 미완료 시 4개 체크리스트 렌더링
2. 완료 항목은 체크 표시 + 취소선
3. 진행률 텍스트 (N/4) 정확성
4. 닫기 버튼 클릭 시 onDismiss 호출
5. 전부 완료 시 축하 메시지 표시
6. 미완료 항목 클릭 시 navigate 호출

**Step 2: 테스트 실행**

Run: `cd frontend && npm run test:run`
Expected: 전체 통과

**Step 3: 커밋**

```bash
git add frontend/src/components/__tests__/WelcomeCard.test.tsx
git commit -m "test: WelcomeCard 컴포넌트 테스트 (#80)"
```

---

### Task 4: PWA 설치 프롬프트 훅

**Files:**
- Create: `frontend/src/hooks/usePwaInstall.ts`

**Step 1: usePwaInstall 훅 작성**

`beforeinstallprompt` 이벤트를 캡처하여 PWA 설치 프롬프트를 프로그래밍 방식으로 트리거하는 훅.
- `isPwaInstalled`: standalone 모드 여부
- `canPromptInstall`: beforeinstallprompt 이벤트 캡처 여부
- `promptInstall()`: 설치 프롬프트 표시

iOS Safari는 beforeinstallprompt 미지원 → 이 경우 "공유 → 홈 화면에 추가" 안내 텍스트로 폴백.

**Step 2: 빌드 확인**

Run: `cd frontend && npm run build`
Expected: 빌드 성공

**Step 3: 커밋**

```bash
git add frontend/src/hooks/usePwaInstall.ts
git commit -m "feat: usePwaInstall 훅 — PWA 설치 프롬프트 (#80)"
```

---

### Task 5: 최종 통합 및 마무리

**Files:**
- Modify: `frontend/src/components/WelcomeCard.tsx` (usePwaInstall 연동)
- Modify: `frontend/src/pages/TransactionList.tsx` (usePwaInstall 사용)

**Step 1: PWA 설치 프롬프트를 WelcomeCard에 연동**

- "홈화면에 추가하기" 항목 클릭 시 `promptInstall()` 호출
- iOS는 안내 텍스트 표시 ("공유 버튼 → 홈 화면에 추가")

**Step 2: 전체 테스트 실행**

Run: `cd frontend && npm run lint && npm run test:run && npm run build`
Expected: 전체 통과

**Step 3: 커밋 + 푸시 + PR**

```bash
git add -A
git commit -m "feat: 온보딩 웰컴 카드 완성 (#80)"
git push -u origin feature/onboarding-welcome-card
gh pr create --base develop --title "feat: 온보딩 웰컴 카드 (#80)"
```
