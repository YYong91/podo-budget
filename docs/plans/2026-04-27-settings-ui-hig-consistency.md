# 더보기 섹션 HIG/디자인 일관성 개선 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 더보기(Settings) 섹션 전체 페이지의 HIG 위반, 다크모드 색상 깨짐, 컴포넌트 불일치를 3개 PR로 수정하여 통일감 있는 설정 UX를 제공한다.

**Architecture:** 분석된 위반 사항을 심각도 순으로 PR1(HIG Critical) → PR2(Dark Mode) → PR3(Consistency) 3단계로 나눠 수정한다. 모두 프론트엔드 전용 변경으로 백엔드 수정 없음. 각 PR은 독립적으로 리뷰/머지 가능.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, Vite 7

---

## 배경: 발견된 위반 목록

### HIG Critical
- `window.confirm()` 3곳 (HouseholdDetailPage) — 브라우저 네이티브 다이얼로그, 브랜드 스타일 없음
- 뒤로가기 버튼 터치 타겟 미달 (FeedbackPage, HouseholdDetailPage) — HIG 최소 44×44pt 불만족

### Dark Mode (raw 컬러 직접 사용 — code-style.md 위반)
- `bg-warm-300` (ChangelogSection:29)
- `bg-warm-100` (PaymentMethodManager:310)
- `hover:bg-grape-50` (SettingsPage:58, PaymentMethodManager:541)
- `bg-leaf-50` (MyAccountSection:73, 197) — 다크모드에서 너무 밝음
- `bg-grape-50` (MyAccountSection:105, 114, 238 — 연동 코드 박스, AppearanceSection:35)
- `hover:bg-rose-50` (RecurringList:182)
- `bg-rose-50/50`, `border-rose-100` (RecurringList:193) — 반투명이라 허용 가능 판단 → 유지
- `hover:border-grape-300` (HouseholdListPage:171)
- `hover:text-red-500`, `hover:text-red-600` (MyAccountSection:78, 202, 323) — rose 사용해야 함
- `text-red-500`, `text-red-600`, `bg-red-600` (MyAccountSection:467,478,496 — 계정 삭제 위험 구역), (FeedbackPage:139 — 버그 버튼)
- `bg-yellow-500`, `text-yellow-600` (BudgetManager:326, 455) — amber로 통일
- `bg-red-500` (SettingsPage:184 — 새소식 뱃지) — rose-500이 올바름
- `border-grape-300` (MyAccountSection:122, 246 — copy 버튼) — `border-grape-500/30`이 다크모드 대응

### Consistency
- 진행 막대 높이: `h-3` (BudgetManager:405,407) → `h-1.5`
- 폼 input border: `border-[var(--border-default)]` (FeedbackPage:155, 165) → `border-[var(--input-border)]`
- HouseholdDetailPage 탭: 언더라인 스타일 → 필 탭 (다른 페이지와 통일)
- `bg-red-100 text-red-600` (FeedbackPage:238 — 피드백 버그 배지) → rose
- `bg-blue-50 text-blue-600`, `bg-sky-50 text-sky-600`, `bg-yellow-50 text-yellow-700` (FeedbackPage:19-22 — 소스 배지) → 시스템 컬러

---

## PR1: HIG Critical — 뒤로가기 터치 타겟 + confirm() 제거

### Task 1: FeedbackPage 뒤로가기 버튼 표준화

**Files:**
- Modify: `frontend/src/pages/FeedbackPage.tsx:100-115`

**Step 1: 변경 적용**

FeedbackPage.tsx의 두 뒤로가기 버튼 (에러 상태 + 일반 상태, 동일 패턴)을 수정한다.

```tsx
// Before (L102, L112 — 두 곳 동일):
<button onClick={goBack} aria-label="뒤로가기" className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] inline-block">
  <ArrowLeft className="w-5 h-5" />
</button>

// After:
<button onClick={goBack} aria-label="뒤로가기" className="p-2.5 -ml-2.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors">
  <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
</button>
```

또한 FeedbackPage는 에러 상태에서 back 버튼만 단독으로 있어 맥락이 없다. 에러 상태 헤더에도 페이지 제목 추가:

```tsx
// 에러 상태 return 블록 (L99-108):
if (error) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={goBack} aria-label="뒤로가기" className="p-2.5 -ml-2.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors">
          <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
        <MessageSquarePlus className="w-5 h-5 text-grape-500" />
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">피드백</h1>
      </div>
      <ErrorState onRetry={loadData} />
    </div>
  )
}
```

일반 상태 return 블록의 back 버튼 (L112) 도 동일하게 수정 + 헤더로 감싸기:

```tsx
// Before (L110-114):
<div className="space-y-6">
  <button onClick={goBack} aria-label="뒤로가기" className="text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] inline-block">
    <ArrowLeft className="w-5 h-5" />
  </button>

// After:
<div className="space-y-6">
  <div className="flex items-center gap-3">
    <button onClick={goBack} aria-label="뒤로가기" className="p-2.5 -ml-2.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors">
      <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
    </button>
    <MessageSquarePlus className="w-5 h-5 text-grape-500" />
    <h1 className="text-lg font-semibold text-[var(--text-primary)]">피드백</h1>
  </div>
```

`MessageSquarePlus`는 이미 import되어 있음 (L8 확인).

**Step 2: lint 확인**

```bash
cd frontend && npm run lint 2>&1 | grep -E "FeedbackPage|error"
```

Expected: 에러 없음

**Step 3: 커밋**

```bash
git add frontend/src/pages/FeedbackPage.tsx
git commit -m "fix: FeedbackPage 뒤로가기 버튼 터치 타겟 + 헤더 추가"
```

---

### Task 2: HouseholdDetailPage 뒤로가기 버튼 표준화

**Files:**
- Modify: `frontend/src/pages/HouseholdDetailPage.tsx:297-303`

**Step 1: 변경 적용**

```tsx
// Before (L299-302):
<button
  onClick={() => navigate('/households')}
  className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
>
  <ArrowLeft className="w-5 h-5" />
</button>

// After:
<button
  onClick={() => navigate('/households')}
  aria-label="뒤로가기"
  className="p-2.5 -ml-2.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
>
  <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
</button>
```

**Step 2: lint 확인**

```bash
cd frontend && npm run lint 2>&1 | grep -E "HouseholdDetailPage|error"
```

**Step 3: 커밋**

```bash
git add frontend/src/pages/HouseholdDetailPage.tsx
git commit -m "fix: HouseholdDetailPage 뒤로가기 버튼 터치 타겟 (HIG 44px)"
```

---

### Task 3: HouseholdDetailPage window.confirm() → ConfirmSheet

**Files:**
- Modify: `frontend/src/pages/HouseholdDetailPage.tsx`

`window.confirm()`은 브라우저 네이티브 다이얼로그로 HIG 위반. 하단에서 슬라이드업되는 테마드 ConfirmSheet로 교체한다.

**Step 1: 상태 추가 및 핸들러 수정**

파일 상단 state 선언부 (약 L80 근처 `const [showInviteModal` 바로 아래)에 추가:

```tsx
const [pendingConfirm, setPendingConfirm] = useState<{
  message: string
  confirmLabel?: string
  onConfirm: () => Promise<void>
} | null>(null)
const [isConfirming, setIsConfirming] = useState(false)
```

`handleRemoveMember` 수정 (L167-178):

```tsx
const handleRemoveMember = (userId: number, username: string) => {
  if (!id) return
  setPendingConfirm({
    message: `${username}님을 가구에서 내보내시겠습니까?`,
    confirmLabel: '내보내기',
    onConfirm: async () => {
      try {
        await removeMember(Number(id), userId)
        addToast('success', TOAST.MEMBER_REMOVED)
      } catch (err) {
        console.error('멤버 내보내기 실패:', err)
        addToast('error', TOAST.PROCESS_FAILED)
      }
    },
  })
}
```

`handleLeave` 수정 (L183-195):

```tsx
const handleLeave = () => {
  if (!id) return
  setPendingConfirm({
    message: '이 가구에서 탈퇴하시겠습니까?',
    confirmLabel: '탈퇴',
    onConfirm: async () => {
      try {
        await leaveHousehold(Number(id))
        addToast('success', TOAST.HOUSEHOLD_LEFT)
        navigate('/households')
      } catch (err) {
        console.error('가구 탈퇴 실패:', err)
        addToast('error', TOAST.PROCESS_FAILED)
      }
    },
  })
}
```

`handleDelete` 수정 (L215-227):

```tsx
const handleDelete = () => {
  if (!id) return
  setPendingConfirm({
    message: '가구를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
    confirmLabel: '삭제',
    onConfirm: async () => {
      try {
        await deleteHousehold(Number(id))
        addToast('success', TOAST.HOUSEHOLD_DELETED)
        navigate('/households')
      } catch (err) {
        console.error('가구 삭제 실패:', err)
        addToast('error', TOAST.DELETE_FAILED)
      }
    },
  })
}
```

**`handleCancelInvitation` 수정 (L232-244):**

```tsx
const handleCancelInvitation = async (invitationId: number) => {
  if (!id) return
  const inv = householdInvitations.find(i => i.id === invitationId)
  if (!inv) return
  setPendingConfirm({
    message: `${inv.invitee_email}의 초대를 취소하시겠습니까?`,
    confirmLabel: '초대 취소',
    onConfirm: async () => {
      try {
        await cancelInvitation(Number(id), invitationId)
        addToast('success', TOAST.INVITE_CANCELLED)
      } catch {
        addToast('error', TOAST.PROCESS_FAILED)
      }
    },
  })
}
```

**Step 2: ConfirmSheet 렌더링 추가**

`return` 블록 맨 끝, `</div>` 바로 위에 추가:

```tsx
      {/* ConfirmSheet — window.confirm() 대체. isConfirming 중에는 배경 탭으로 닫히지 않음 */}
      {pendingConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40"
          onClick={() => { if (!isConfirming) setPendingConfirm(null) }}
        >
          <div
            className="w-full bg-[var(--surface-card)] rounded-t-2xl shadow-lg border-t border-[var(--border-default)] p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {pendingConfirm.message}
            </p>
            <div className="flex gap-2">
              <button
                disabled={isConfirming}
                onClick={() => setPendingConfirm(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] bg-[var(--surface-hover)] rounded-xl transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                disabled={isConfirming}
                onClick={async () => {
                  setIsConfirming(true)
                  try {
                    await pendingConfirm.onConfirm()
                  } finally {
                    setIsConfirming(false)
                    setPendingConfirm(null)
                  }
                }}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition-colors disabled:opacity-50"
              >
                {isConfirming ? '처리 중...' : (pendingConfirm.confirmLabel ?? '확인')}
              </button>
            </div>
          </div>
        </div>
      )}
```

**Step 3: HouseholdDetailPage.test.tsx 업데이트**

`window.confirm` mock에 의존하는 테스트를 ConfirmSheet UI 클릭 방식으로 변경한다.

L109 전역 `vi.spyOn(window, 'confirm')` 제거.

**L379-390 "내보내기 버튼 클릭 시 confirm 후 removeMember를 호출한다" 수정:**

```tsx
it('내보내기 버튼 클릭 시 확인 후 removeMember를 호출한다', async () => {
  mockRemoveMember.mockResolvedValueOnce(undefined)
  renderPage()

  await userEvent.click(screen.getByText('내보내기'))
  // ConfirmSheet 노출 후 확인 버튼 클릭
  await userEvent.click(screen.getByRole('button', { name: '내보내기' }))

  await waitFor(() => {
    expect(mockRemoveMember).toHaveBeenCalledWith(1, 2)
  })
  expect(addToast).toHaveBeenCalledWith('success', '멤버를 내보냈어요')
})
```

**L510-518 "가구 삭제 confirm 취소 시 삭제를 실행하지 않는다" 수정:**

```tsx
it('가구 삭제 취소 시 삭제를 실행하지 않는다', async () => {
  renderPage()

  await userEvent.click(screen.getByText('설정'))
  await userEvent.click(screen.getByText('가구 삭제'))
  // ConfirmSheet 노출 → 취소 클릭
  const cancelBtns = screen.getAllByRole('button', { name: '취소' })
  await userEvent.click(cancelBtns[cancelBtns.length - 1]) // ConfirmSheet의 취소

  expect(mockDeleteHousehold).not.toHaveBeenCalled()
})
```

**L522-529 "내보내기 confirm 취소 시 removeMember를 호출하지 않는다" 수정:**

```tsx
it('내보내기 취소 시 removeMember를 호출하지 않는다', async () => {
  renderPage()

  await userEvent.click(screen.getByText('내보내기'))
  // ConfirmSheet 취소 클릭
  const cancelBtns = screen.getAllByRole('button', { name: '취소' })
  await userEvent.click(cancelBtns[cancelBtns.length - 1])

  expect(mockRemoveMember).not.toHaveBeenCalled()
})
```

**L570-577 "탈퇴 confirm 취소 시 leaveHousehold를 호출하지 않는다" 수정:**

```tsx
it('탈퇴 취소 시 leaveHousehold를 호출하지 않는다', async () => {
  renderPage()

  await userEvent.click(screen.getByText('탈퇴'))
  const cancelBtns = screen.getAllByRole('button', { name: '취소' })
  await userEvent.click(cancelBtns[cancelBtns.length - 1])

  expect(mockLeaveHousehold).not.toHaveBeenCalled()
})
```

**L581-594 "초대 취소 confirm 취소 시 cancelInvitation을 호출하지 않는다" 수정:**

```tsx
it('초대 취소 취소 시 cancelInvitation을 호출하지 않는다', async () => {
  storeState.householdInvitations = [
    { id: 10, invitee_email: 'new@test.com', status: 'pending', token: 'abc' },
  ]
  renderPage()

  const invitationTab = screen.getByRole('button', { name: /초대/ })
  await userEvent.click(invitationTab)

  // InvitationsTab의 초대취소 버튼 클릭
  await userEvent.click(screen.getByText('취소'))
  // ConfirmSheet 노출 → ConfirmSheet 취소 버튼 클릭
  const cancelBtns = screen.getAllByRole('button', { name: '취소' })
  await userEvent.click(cancelBtns[cancelBtns.length - 1])

  expect(mockCancelInvitation).not.toHaveBeenCalled()
})
```

**Step 4: 타입스크립트 확인**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep HouseholdDetailPage
```

Expected: 에러 없음

**Step 4: lint 확인**

```bash
cd frontend && npm run lint 2>&1 | grep HouseholdDetailPage
```

**Step 5: 커밋**

```bash
git add frontend/src/pages/HouseholdDetailPage.tsx
git commit -m "fix: HouseholdDetailPage window.confirm() → ConfirmSheet (HIG 준수)"
```

---

### Task 4: PR1 빌드 확인 및 PR 생성

**Step 1: 전체 빌드 확인**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

Expected: `✓ built in` 메시지 (에러 없음)

**Step 2: PR 생성**

```bash
git push -u origin HEAD
gh pr create \
  --base develop \
  --title "fix: 더보기 HIG Critical — 뒤로가기 터치 타겟 + confirm() 제거" \
  --body "$(cat <<'EOF'
## Summary
- FeedbackPage, HouseholdDetailPage 뒤로가기 버튼을 HIG 44px 터치 타겟 표준 패턴으로 통일
- HouseholdDetailPage `window.confirm()` 3곳을 브랜드 테마 ConfirmSheet로 교체
- FeedbackPage 에러 상태에 페이지 제목/아이콘 헤더 추가

## 변경 파일
- `frontend/src/pages/FeedbackPage.tsx`
- `frontend/src/pages/HouseholdDetailPage.tsx`

## Test plan
- [ ] FeedbackPage 뒤로가기 버튼 탭 영역이 충분히 큰지 확인
- [ ] HouseholdDetailPage 멤버 내보내기 → ConfirmSheet 노출 확인
- [ ] HouseholdDetailPage 가구 탈퇴 → ConfirmSheet 노출 확인
- [ ] HouseholdDetailPage 가구 삭제 → ConfirmSheet 노출 확인
- [ ] ConfirmSheet 배경 탭 시 닫히는지 확인
- [ ] 다크모드에서 ConfirmSheet 렌더링 확인

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## PR2: Dark Mode — raw 컬러 위반 전체 수정

### Task 5: ChangelogSection bg-warm-300 수정

**Files:**
- Modify: `frontend/src/components/settings/ChangelogSection.tsx:29`

```tsx
// Before:
idx === 0 ? 'bg-grape-500' : 'bg-warm-300'

// After:
idx === 0 ? 'bg-grape-500' : 'bg-[var(--border-default)]'
```

**Step 1: 변경 적용 후 lint**

```bash
cd frontend && npm run lint 2>&1 | grep ChangelogSection
```

**Step 2: 커밋**

```bash
git add frontend/src/components/settings/ChangelogSection.tsx
git commit -m "fix: ChangelogSection bg-warm-300 → semantic border 토큰"
```

---

### Task 6: PaymentMethodManager raw 컬러 2곳 수정

**Files:**
- Modify: `frontend/src/pages/PaymentMethodManager.tsx:310, 541`

```tsx
// L310 — 시스템 배지 bg-warm-100:
// Before:
<span className="text-[10px] px-1.5 py-0.5 rounded-full bg-warm-100 text-[var(--text-muted)]">기본</span>
// After:
<span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--surface-elevated)] text-[var(--text-muted)]">기본</span>

// L541 — 추가 버튼 hover:bg-grape-50:
// Before:
className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-grape-600 bg-[var(--surface-card)] border border-dashed border-grape-300 rounded-2xl hover:bg-grape-50 transition-colors"
// After:
className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-grape-600 bg-[var(--surface-card)] border border-dashed border-grape-300 rounded-2xl hover:bg-[var(--surface-hover)] transition-colors"
```

**Step 1: 변경 후 lint**

```bash
cd frontend && npm run lint 2>&1 | grep PaymentMethodManager
```

**Step 2: 커밋**

```bash
git add frontend/src/pages/PaymentMethodManager.tsx
git commit -m "fix: PaymentMethodManager bg-warm-100, hover:bg-grape-50 → semantic 토큰"
```

---

### Task 7: SettingsPage 메뉴 아이템 hover 수정

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx:58`

```tsx
// Before:
const className = `flex items-center gap-4 px-5 py-4 hover:bg-grape-50 transition-colors ${

// After:
const className = `flex items-center gap-4 px-5 py-4 hover:bg-[var(--surface-hover)] transition-colors ${
```

또한 L184의 새소식 알림 뱃지도 수정:

```tsx
// L184 — 새소식 읽지 않음 뱃지:
// Before:
<span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[var(--surface-card)]" />
// After:
<span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-[var(--surface-card)]" />
```

**Step 1: 변경 후 lint + 커밋**

```bash
cd frontend && npm run lint 2>&1 | grep SettingsPage
git add frontend/src/pages/SettingsPage.tsx
git commit -m "fix: SettingsPage hover:bg-grape-50 → semantic, 새소식 뱃지 red → rose"
```

---

### Task 8: MyAccountSection raw 컬러 배치 수정

**Files:**
- Modify: `frontend/src/components/settings/MyAccountSection.tsx`

수정 지점이 많으므로 한 번에 처리한다.

**L73 — 텔레그램 연동됨 배경:**
```tsx
// Before:
<div className="flex items-center justify-between py-2 px-3 bg-leaf-50 rounded-xl">
// After:
<div className="flex items-center justify-between py-2 px-3 bg-leaf-500/10 rounded-xl">
```

**L78 — 텔레그램 연동해제 hover:**
```tsx
// Before:
className="text-sm text-[var(--text-tertiary)] hover:text-red-500 underline disabled:opacity-50"
// After:
className="text-sm text-[var(--text-tertiary)] hover:text-rose-500 underline disabled:opacity-50"
```

**L105 — 텔레그램 기능 안내 박스:**
```tsx
// Before:
<div className="mt-3 bg-grape-50 rounded-lg p-3 text-xs text-[var(--text-secondary)] space-y-1">
// After:
<div className="mt-3 bg-[var(--surface-elevated)] rounded-lg p-3 text-xs text-[var(--text-secondary)] space-y-1">
```

**L114 — 텔레그램 발급된 연동 코드 박스:**
```tsx
// Before:
<div className="bg-grape-50 rounded-xl p-4 space-y-3">
// After:
<div className="bg-grape-500/10 rounded-xl p-4 space-y-3">
```

**L131 — 텔레그램 코드 복사 박스 active 상태:**
```tsx
// Before:
className="bg-[var(--surface-card)] rounded-lg p-3 border border-grape-200 cursor-pointer active:bg-grape-50"
// After:
className="bg-[var(--surface-card)] rounded-lg p-3 border border-grape-200 cursor-pointer active:bg-[var(--surface-hover)]"
```

**L197 — 카카오 연동됨 배경:**
```tsx
// Before:
<div className="flex items-center justify-between py-2 px-3 bg-leaf-50 rounded-xl">
// After:
<div className="flex items-center justify-between py-2 px-3 bg-leaf-500/10 rounded-xl">
```

**L202 — 카카오 연동해제 hover:**
```tsx
// Before:
className="text-sm text-[var(--text-tertiary)] hover:text-red-500 underline disabled:opacity-50"
// After:
className="text-sm text-[var(--text-tertiary)] hover:text-rose-500 underline disabled:opacity-50"
```

**L229 — 카카오 기능 안내 박스:**
```tsx
// Before:
<div className="mt-3 bg-grape-50 rounded-lg p-3 text-xs text-[var(--text-secondary)] space-y-1">
// After:
<div className="mt-3 bg-[var(--surface-elevated)] rounded-lg p-3 text-xs text-[var(--text-secondary)] space-y-1">
```

**L238 — 카카오 발급된 연동 코드 박스:**
```tsx
// Before:
<div className="bg-grape-50 rounded-xl p-4 space-y-3">
// After:
<div className="bg-grape-500/10 rounded-xl p-4 space-y-3">
```

**L122 — 텔레그램 복사 버튼 border:**
```tsx
// Before:
className="text-xs text-grape-600 border border-grape-300 rounded-lg px-3 py-1 hover:bg-grape-100"
// After:
className="text-xs text-grape-600 border border-grape-500/30 rounded-lg px-3 py-1 hover:bg-grape-500/10"
```

**L246 — 카카오 복사 버튼 border:**
```tsx
// Before:
className="text-xs text-grape-600 border border-grape-300 rounded-lg px-3 py-1 hover:bg-grape-100"
// After:
className="text-xs text-grape-600 border border-grape-500/30 rounded-lg px-3 py-1 hover:bg-grape-500/10"
```

**L255 — 카카오 코드 복사 박스:**
```tsx
// Before:
className="bg-[var(--surface-card)] rounded-lg p-3 border border-grape-200 cursor-pointer active:bg-grape-50"
// After:
className="bg-[var(--surface-card)] rounded-lg p-3 border border-grape-200 cursor-pointer active:bg-[var(--surface-hover)]"
```

**L323 — 로그아웃 버튼 위험 hover 색상:**
```tsx
// Before:
className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)] text-sm font-medium hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors"
// After:
className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border-default)] text-[var(--text-secondary)] text-sm font-medium hover:bg-rose-500/10 hover:border-rose-300 hover:text-rose-600 transition-colors"
```

**L467 — 계정 삭제 버튼 (idle 상태) — red → rose:**
```tsx
// Before:
className="inline-flex items-center gap-2 text-sm font-medium text-red-500 hover:text-red-600 transition-colors"
// After:
className="inline-flex items-center gap-2 text-sm font-medium text-rose-500 hover:text-rose-600 transition-colors"
```

**L478 — 계정 삭제 confirm 제목 — red → rose:**
```tsx
// Before:
<h3 className="text-sm font-semibold text-red-600">계정을 정말 삭제하시겠습니까?</h3>
// After:
<h3 className="text-sm font-semibold text-rose-600">계정을 정말 삭제하시겠습니까?</h3>
```

**L496 — 계정 삭제 버튼 (confirm 상태) — red → rose:**
```tsx
// Before:
className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
// After:
className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-xl hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
```

**Step 1: 변경 후 lint**

```bash
cd frontend && npm run lint 2>&1 | grep MyAccountSection
```

**Step 2: 커밋**

```bash
git add frontend/src/components/settings/MyAccountSection.tsx
git commit -m "fix: MyAccountSection raw 컬러 → semantic 토큰 (leaf-50, grape-50, red → rose)"
```

---

### Task 9: HouseholdListPage hover:border-grape-300 수정

**Files:**
- Modify: `frontend/src/pages/HouseholdListPage.tsx:171`

```tsx
// Before:
className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-5 hover:shadow-md hover:border-grape-300 transition-all cursor-pointer"
// After:
className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-5 hover:shadow-md hover:border-grape-500/40 transition-all cursor-pointer"
```

**Step 1: 커밋**

```bash
git add frontend/src/pages/HouseholdListPage.tsx
git commit -m "fix: HouseholdListPage 카드 hover border를 opacity 방식으로 수정"
```

---

### Task 10: RecurringList 드롭다운 삭제 버튼 hover 수정

**Files:**
- Modify: `frontend/src/pages/RecurringList.tsx:182`

인라인 삭제 확인 행(`bg-rose-50/50`, `border-rose-100`) 은 반투명이라 다크모드에서도 허용 가능 — 유지.
드롭다운 메뉴의 삭제 버튼 hover만 수정.

```tsx
// Before (L182):
className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-500 hover:bg-rose-50"
// After:
className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-500 hover:bg-rose-500/10"
```

**Step 1: 커밋**

```bash
git add frontend/src/pages/RecurringList.tsx
git commit -m "fix: RecurringList 드롭다운 삭제 hover:bg-rose-50 → opacity 방식"
```

---

### Task 11: AppearanceSection 선택 상태 bg-grape-50 수정

**Files:**
- Modify: `frontend/src/components/settings/AppearanceSection.tsx:35`

```tsx
// Before:
? 'bg-grape-50 border-2 border-grape-500'
// After:
? 'bg-grape-500/10 border-2 border-grape-500'
```

**Step 1: 커밋**

```bash
git add frontend/src/components/settings/AppearanceSection.tsx
git commit -m "fix: AppearanceSection 선택 상태 bg-grape-50 → opacity 방식"
```

---

### Task 12: FeedbackPage raw 컬러 배치 수정

**Files:**
- Modify: `frontend/src/pages/FeedbackPage.tsx:19-22, 139, 238`

**소스 배지 (L19-22) — 비시스템 컬러 → 시스템 컬러:**
```tsx
// Before:
const SOURCE_LABELS: Record<FeedbackSource, { text: string; className: string }> = {
  web: { text: '웹', className: 'bg-blue-50 text-blue-600' },
  telegram: { text: 'TG', className: 'bg-sky-50 text-sky-600' },
  kakao: { text: '카톡', className: 'bg-yellow-50 text-yellow-700' },
}

// After:
const SOURCE_LABELS: Record<FeedbackSource, { text: string; className: string }> = {
  web: { text: '웹', className: 'bg-[var(--surface-elevated)] text-[var(--text-secondary)]' },
  telegram: { text: 'TG', className: 'bg-grape-500/10 text-grape-600' },
  kakao: { text: '카톡', className: 'bg-amber-500/10 text-amber-700' },
}
```

**버그 타입 버튼 active (L139) — red → rose:**
```tsx
// Before:
? 'bg-red-600 text-white'
// After:
? 'bg-rose-600 text-white'
```

**피드백 카드 버그 배지 (L238) — red → rose:**
```tsx
// Before:
isFeature ? 'bg-grape-50 text-grape-600' : 'bg-red-100 text-red-600'
// After:
isFeature ? 'bg-grape-500/10 text-grape-600' : 'bg-rose-500/10 text-rose-600'
```

**Step 1: 변경 후 lint**

```bash
cd frontend && npm run lint 2>&1 | grep FeedbackPage
```

**Step 2: 커밋**

```bash
git add frontend/src/pages/FeedbackPage.tsx
git commit -m "fix: FeedbackPage 비시스템 컬러(blue/sky/yellow/red) → 시스템 컬러로 통일"
```

---

### Task 13: BudgetManager yellow → amber 수정

**Files:**
- Modify: `frontend/src/pages/BudgetManager.tsx:326, 455`

```tsx
// L326 — getProgressColor 함수:
// Before:
if (usagePct >= 80) return 'bg-yellow-500'
// After:
if (usagePct >= 80) return 'bg-amber-500'

// L455 — 카테고리 사용률 배지:
// Before:
alert.is_exceeded ? 'text-rose-600' : alert.is_warning ? 'text-yellow-600' : 'text-leaf-600'
// After:
alert.is_exceeded ? 'text-rose-600' : alert.is_warning ? 'text-amber-600' : 'text-leaf-600'
```

또한 L321 주석도 업데이트:
```tsx
// Before:
* - 경고 (80% 이상): yellow-500
// After:
* - 경고 (80% 이상): amber-500
```

**Step 1: 커밋**

```bash
git add frontend/src/pages/BudgetManager.tsx
git commit -m "fix: BudgetManager 경고 색상 yellow → amber (디자인 시스템 통일)"
```

---

### Task 14: PR2 빌드 확인 및 PR 생성

**Step 1: 전체 lint + 빌드**

```bash
cd frontend && npm run lint && npm run build 2>&1 | tail -10
```

Expected: lint 에러 없음, build 성공

**Step 2: PR 생성**

```bash
git push -u origin HEAD
gh pr create \
  --base develop \
  --title "fix: 더보기 Dark Mode — raw 컬러 위반 일괄 수정" \
  --body "$(cat <<'EOF'
## Summary
- warm-*, grape-50, leaf-50 등 raw 컬러 직접 사용을 semantic 토큰 또는 opacity 방식으로 교체
- red-* → rose-* 통일 (디자인 시스템 내 rose가 에러/위험 컬러)
- yellow-* → amber-* 통일 (경고 컬러)
- 수정 파일: ChangelogSection, PaymentMethodManager, SettingsPage, MyAccountSection, HouseholdListPage, RecurringList, AppearanceSection, FeedbackPage, BudgetManager

## Test plan
- [ ] 다크모드에서 설정 메인 메뉴 hover 확인
- [ ] 다크모드에서 ChangelogSection 타임라인 도트 확인
- [ ] 다크모드에서 텔레그램/카카오 연동됨 배경 확인
- [ ] 다크모드에서 BudgetManager 경고(80%+) 진행 막대 색상 확인
- [ ] 라이트/다크 모드에서 AppearanceSection 선택 상태 확인

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## PR3: Consistency — 진행 막대, 폼 border, 탭 패턴

### Task 15: BudgetManager 총예산 진행 막대 높이 수정

**Files:**
- Modify: `frontend/src/pages/BudgetManager.tsx:405, 407`

카테고리별 예산 진행 막대(L465)는 이미 `h-1.5`로 올바름. 총예산 배분 진행 막대만 수정.

```tsx
// L405:
// Before:
<div className="w-full bg-[var(--border-default)] rounded-full h-3">
// After:
<div className="w-full bg-[var(--border-default)] rounded-full h-1.5 overflow-hidden">

// L407:
// Before:
className={`h-3 rounded-full transition-all ${
// After:
className={`h-1.5 rounded-full transition-all ${
```

**Step 1: 커밋**

```bash
git add frontend/src/pages/BudgetManager.tsx
git commit -m "fix: BudgetManager 총예산 진행 막대 h-3 → h-1.5 (표준 통일)"
```

---

### Task 16: FeedbackPage 폼 input border 토큰 통일

**Files:**
- Modify: `frontend/src/pages/FeedbackPage.tsx:155, 165`

모든 input/textarea/select는 `border-[var(--input-border)]`를 사용해야 함 (PaymentMethodManager, CategoryManager 등과 동일).

```tsx
// L155 — title input:
// Before:
className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-default)] text-sm focus:outline-none focus:ring-2 focus:ring-grape-300 focus:border-grape-300"
// After:
className="w-full px-4 py-2.5 rounded-xl border border-[var(--input-border)] text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"

// L165 — content textarea:
// Before:
className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-default)] text-sm focus:outline-none focus:ring-2 focus:ring-grape-300 focus:border-grape-300 resize-none"
// After:
className="w-full px-4 py-2.5 rounded-xl border border-[var(--input-border)] text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500 resize-none"
```

focus 링 색상도 `grape-300` → `grape-500/30`으로 통일 (PaymentMethodManager 패턴과 동일).

**Step 1: 커밋**

```bash
git add frontend/src/pages/FeedbackPage.tsx
git commit -m "fix: FeedbackPage 폼 border border-default → input-border 토큰, focus 링 통일"
```

---

### Task 17: HouseholdDetailPage 탭 언더라인 → 필 탭 통일

**Files:**
- Modify: `frontend/src/pages/HouseholdDetailPage.tsx:322-364`

다른 페이지(RecurringList, FeedbackPage, CategoryManager)는 필 탭 사용. HouseholdDetailPage만 언더라인 탭으로 달라 통일 필요.

**Step 1: 탭 컨테이너 변경**

```tsx
// Before (L322-324):
<div className="border-b border-[var(--border-default)]">
  <div className="flex gap-6">

// After:
<div className="flex gap-2">
```

**Step 2: 탭 버튼 스타일 변경 — 멤버 탭 (L325-332):**

```tsx
// Before:
<button
  onClick={() => setActiveTab('members')}
  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
    activeTab === 'members'
      ? 'border-grape-600 text-grape-600'
      : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
  }`}
>
  멤버
</button>

// After:
<button
  onClick={() => setActiveTab('members')}
  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
    activeTab === 'members'
      ? 'bg-grape-100 text-grape-600'
      : 'bg-[var(--surface-hover)] text-[var(--text-secondary)]'
  }`}
>
  멤버
</button>
```

**Step 3: 초대 탭 (L334-350) 동일 패턴 적용:**

```tsx
// Before:
<button
  onClick={() => setActiveTab('invitations')}
  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
    activeTab === 'invitations'
      ? 'border-grape-600 text-grape-600'
      : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
  }`}
>

// After:
<button
  onClick={() => setActiveTab('invitations')}
  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
    activeTab === 'invitations'
      ? 'bg-grape-100 text-grape-600'
      : 'bg-[var(--surface-hover)] text-[var(--text-secondary)]'
  }`}
>
```

**Step 4: 설정 탭 (L352-362) 동일 패턴 적용:**

```tsx
// Before:
<button
  onClick={() => setActiveTab('settings')}
  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
    activeTab === 'settings'
      ? 'border-grape-600 text-grape-600'
      : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
  }`}
>

// After:
<button
  onClick={() => setActiveTab('settings')}
  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
    activeTab === 'settings'
      ? 'bg-grape-100 text-grape-600'
      : 'bg-[var(--surface-hover)] text-[var(--text-secondary)]'
  }`}
>
```

닫는 태그 정리: `<div className="border-b border-[var(--border-default)]">` 컨테이너를 제거했으므로 그에 맞는 `</div>` 하나도 제거.

**Step 5: lint + tsc 확인**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep HouseholdDetailPage
cd frontend && npm run lint 2>&1 | grep HouseholdDetailPage
```

**Step 6: 커밋**

```bash
git add frontend/src/pages/HouseholdDetailPage.tsx
git commit -m "fix: HouseholdDetailPage 탭 언더라인 → 필 탭 (다른 페이지와 통일)"
```

---

### Task 18: PR3 전체 테스트 + PR 생성

**Step 1: 전체 lint + tsc + build**

```bash
cd frontend && npm run lint && npx tsc --noEmit && npm run build 2>&1 | tail -10
```

Expected: 모두 통과

**Step 2: 프론트엔드 테스트**

```bash
cd frontend && npm run test:run 2>&1 | tail -20
```

Expected: 기존 테스트 모두 통과 (변경은 스타일만이라 기능 테스트 영향 없어야 함)

**Step 3: PR 생성**

```bash
git push -u origin HEAD
gh pr create \
  --base develop \
  --title "fix: 더보기 Consistency — 진행 막대, 폼 border, 탭 패턴 통일" \
  --body "$(cat <<'EOF'
## Summary
- BudgetManager 총예산 진행 막대 h-3 → h-1.5 (전체 표준 h-1.5)
- FeedbackPage 폼 input border 토큰을 input-border로 통일, focus 링 grape-500/30으로 통일
- HouseholdDetailPage 탭 스타일을 언더라인 → 필 탭으로 변경 (RecurringList, FeedbackPage 등과 동일)

## Test plan
- [ ] BudgetManager 총예산 진행 막대 높이가 카테고리 막대와 동일한지 확인
- [ ] FeedbackPage 폼 입력 필드 focus 링 색상/스타일 확인
- [ ] HouseholdDetailPage 탭 스타일 시각 확인 (멤버/초대/설정 탭)
- [ ] 다크모드에서 HouseholdDetailPage 탭 선택 상태 확인

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## 마무리 체크리스트

PR1, PR2, PR3 모두 머지 완료 후:

- [ ] `docs/IMPLEMENTATION_STATUS.md` — 더보기 섹션 UI 일관성 항목 업데이트
- [ ] `frontend/src/data/changelogs.ts` — 사용자 대상 변경은 없음 (내부 UX 개선만), changelog 업데이트 불필요
- [ ] CLAUDE.md 업데이트 사항 없음 (아키텍처 변경 없음)
