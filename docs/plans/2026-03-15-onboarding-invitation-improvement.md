# 온보딩 + 초대 플로우 개선 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 새로고침 시 온보딩 재진입 버그 수정, 초대 딥링크 보호, 온보딩에서 초대 수락 지원, 보낸 초대 관리 UI 추가

**Architecture:** useHouseholdStore에 `hasInitialized` 플래그를 추가하여 fetch 완료 전 리디렉션을 방지한다. ProtectedRoute에서 초기 데이터를 fetch하고, 초대 수락 라우트를 Layout 밖으로 이동하여 가계부 0개 유저도 접근 가능하게 한다. 온보딩 페이지에서 초대 목록을 표시하여 가계부 생성 없이 참여 가능하게 한다.

**Tech Stack:** React 19, TypeScript, Zustand, React Router v7, Tailwind CSS v4 (Grape 디자인 시스템), FastAPI, SQLAlchemy

---

## Batch 1: 초기화 안정화 — 새로고침 버그 수정

### Task 1: useHouseholdStore에 hasInitialized 플래그 추가

**Files:**
- Modify: `frontend/src/stores/useHouseholdStore.ts`

**Step 1: 스토어 상태에 hasInitialized + initError 추가**

`HouseholdState` 인터페이스에 필드 추가:

```typescript
interface HouseholdState {
  households: Household[]
  currentHousehold: HouseholdDetail | null
  myInvitations: HouseholdInvitation[]
  activeHouseholdId: number | null
  isLoading: boolean
  error: string | null
  /** 초기 fetch 완료 여부 (새로고침 시 premature redirect 방지) */
  hasInitialized: boolean
  /** 초기 fetch 실패 에러 */
  initError: string | null
}
```

초기값 추가:

```typescript
hasInitialized: false,
initError: null,
```

**Step 2: fetchHouseholds에서 hasInitialized 설정**

`fetchHouseholds` 수정 — 성공/실패 모두 `hasInitialized: true` 설정:

```typescript
fetchHouseholds: async () => {
  set({ isLoading: true, error: null })
  try {
    const response = await householdApi.getHouseholds()
    const households = response.data
    const currentActive = get().activeHouseholdId
    const activeId = currentActive && households.some((h) => h.id === currentActive)
      ? currentActive
      : households.length > 0 ? households[0].id : null
    set({ households, activeHouseholdId: activeId, isLoading: false, hasInitialized: true, initError: null })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '목록 조회 중 오류가 발생했습니다'
    set({ error: errorMessage, isLoading: false, hasInitialized: true, initError: errorMessage })
    throw error
  }
},
```

**Step 3: HouseholdActions 인터페이스에 initializeApp 추가**

ProtectedRoute에서 사용할 초기화 액션:

```typescript
interface HouseholdActions {
  // ... 기존 액션들 ...
  /** 앱 초기화 (households + invitations 동시 fetch) */
  initializeApp: () => Promise<void>
}
```

구현:

```typescript
initializeApp: async () => {
  if (get().hasInitialized) return // 중복 호출 방지
  try {
    await Promise.all([
      get().fetchHouseholds(),
      get().fetchMyInvitations(),
    ])
  } catch {
    // fetchHouseholds에서 이미 hasInitialized=true 설정됨
  }
},
```

**Step 4: 빌드 확인**

```bash
cd frontend && npm run build
```

**Step 5: 커밋**

```bash
git add frontend/src/stores/useHouseholdStore.ts
git commit -m "feat: useHouseholdStore에 hasInitialized 플래그 추가"
```

---

### Task 2: ProtectedRoute에서 초기 fetch + 초기화 대기

**Files:**
- Modify: `frontend/src/components/ProtectedRoute.tsx`

**Step 1: ProtectedRoute 수정**

```tsx
import { useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useHouseholdStore } from '../stores/useHouseholdStore'

const AUTH_URL = import.meta.env.VITE_AUTH_URL || 'https://auth.podonest.com'
const CALLBACK_URL =
  typeof window !== 'undefined'
    ? import.meta.env.VITE_AUTH_CALLBACK_URL || `${window.location.origin}/auth/callback`
    : ''

export default function ProtectedRoute() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { households, hasInitialized, initError, initializeApp } = useHouseholdStore()

  // 미인증 → SSO 로그인
  useEffect(() => {
    if (!isAuthenticated) {
      sessionStorage.setItem(
        'intended_path',
        window.location.pathname + window.location.search
      )
      window.location.href = `${AUTH_URL}/login?redirect_uri=${encodeURIComponent(CALLBACK_URL)}`
    }
  }, [isAuthenticated])

  // 인증 후 앱 초기화 (households + invitations fetch)
  useEffect(() => {
    if (isAuthenticated) {
      initializeApp().catch(() => {})
    }
  }, [isAuthenticated, initializeApp])

  // 초기화 완료 + 가구 없음 → 온보딩 (단, 초대 수락 경로는 제외)
  useEffect(() => {
    if (
      isAuthenticated &&
      hasInitialized &&
      !initError &&
      households.length === 0 &&
      location.pathname !== '/onboarding' &&
      !location.pathname.startsWith('/invitations/accept')
    ) {
      navigate('/onboarding', { replace: true })
    }
  }, [isAuthenticated, hasInitialized, initError, households.length, location.pathname, navigate])

  if (!isAuthenticated) return null

  // 초기화 중 → 로딩 UI
  if (!hasInitialized) {
    return (
      <div className="min-h-screen bg-cream-50 flex flex-col items-center justify-center gap-3">
        <div className="text-4xl">🍇</div>
        <Loader2 className="w-6 h-6 text-grape-600 animate-spin" />
      </div>
    )
  }

  // 초기화 실패 → 재시도 UI
  if (initError) {
    return (
      <div className="min-h-screen bg-cream-50 flex flex-col items-center justify-center gap-4 p-4">
        <div className="text-4xl">🍇</div>
        <p className="text-sm text-warm-600">서버에 연결할 수 없습니다</p>
        <button
          onClick={() => {
            useHouseholdStore.setState({ hasInitialized: false, initError: null })
            initializeApp().catch(() => {})
          }}
          className="px-4 py-2 text-sm font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700"
        >
          다시 시도
        </button>
      </div>
    )
  }

  return <Outlet />
}
```

**Step 2: 빌드 확인**

```bash
cd frontend && npm run build
```

**Step 3: 커밋**

```bash
git add frontend/src/components/ProtectedRoute.tsx
git commit -m "fix: ProtectedRoute에서 초기화 대기 후 온보딩 리디렉션"
```

---

### Task 3: Layout에서 중복 초기 fetch 제거

**Files:**
- Modify: `frontend/src/components/Layout.tsx`

**Step 1: Layout.tsx에서 fetchHouseholds/fetchMyInvitations 초기 호출 제거**

기존 코드 (lines 31-34):
```typescript
useEffect(() => {
  fetchHouseholds().catch(() => {})
  fetchMyInvitations().catch(() => {})
}, [fetchHouseholds, fetchMyInvitations])
```

삭제. ProtectedRoute에서 `initializeApp()`이 이미 fetch하므로 중복.

**주의**: Layout의 스토어 구독(`households`, `activeHouseholdId`, `myInvitations` 등)은 그대로 유지. 초기 fetch만 제거.

**Step 2: 빌드 확인**

```bash
cd frontend && npm run build
```

**Step 3: 커밋**

```bash
git add frontend/src/components/Layout.tsx
git commit -m "refactor: Layout에서 중복 초기 fetch 제거 (ProtectedRoute로 이동)"
```

---

## Batch 2: 딥링크 보호 + 온보딩 개편

### Task 4: /invitations/accept 라우트를 Layout 밖으로 이동

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/AcceptInvitationPage.tsx`

**Step 1: App.tsx 라우트 재배치**

`/invitations/accept`를 Layout 밖, OnboardingPage와 같은 레벨로 이동:

```tsx
<Route element={<ProtectedRoute />}>
  <Route path="onboarding" element={<OnboardingPage />} />
  <Route path="/invitations/accept" element={<AcceptInvitationPage />} />
  <Route element={<Layout />}>
    <Route path="/" element={<TransactionList />} />
    {/* ... 나머지 라우트들 ... */}
    <Route path="/invitations" element={<InvitationListPage />} />
    {/* /invitations/accept는 여기서 제거 */}
    {/* ... */}
  </Route>
</Route>
```

**Step 2: AcceptInvitationPage에 독립 레이아웃 추가**

Layout 없이 렌더링되므로, 자체적으로 전체 화면 레이아웃을 가져야 함. 기존 내용을 전체 화면 래퍼로 감싸기:

기존 `return` 부분을 수정:

```tsx
// 토큰 없는 경우 — 독립 레이아웃
if (!token) {
  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <EmptyState
          title="유효하지 않은 초대 링크입니다"
          description="초대 링크가 올바르지 않습니다. 초대를 보낸 사람에게 다시 요청해주세요."
          action={{
            label: '홈으로',
            onClick: () => navigate('/'),
          }}
        />
      </div>
    </div>
  )
}

// 에러 발생 시
if (error) {
  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <EmptyState
          title="초대 처리에 실패했습니다"
          description={error}
          action={{
            label: '홈으로',
            onClick: () => navigate('/'),
          }}
        />
      </div>
    </div>
  )
}

// 정상 렌더링
return (
  <div className="min-h-screen bg-cream-50 flex items-center justify-center p-4">
    <div className="w-full max-w-md">
      {/* 기존 헤더 + 버튼 UI 그대로 */}
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">📨</div>
        {/* ... */}
      </div>
      {/* ... */}
    </div>
  </div>
)
```

수락 성공 후 navigate 대상도 변경 — 가구가 있으면 `/households/{id}`, 없으면 `/` (ProtectedRoute가 알아서 처리):

```tsx
const handleAccept = async () => {
  // ... 기존 코드 ...
  try {
    const result = await acceptInvitation(token)
    addToast('success', `${result.household_name} 가구에 가입했습니다`)
    navigate('/', { replace: true })
  } catch (err) {
    // ...
  }
}
```

거절 후:

```tsx
const handleReject = async () => {
  // ...
  try {
    await rejectInvitation(token)
    addToast('success', '초대를 거절했습니다')
    navigate('/', { replace: true })
  } catch (err) {
    // ...
  }
}
```

**Step 3: 빌드 확인**

```bash
cd frontend && npm run build
```

**Step 4: 커밋**

```bash
git add frontend/src/App.tsx frontend/src/pages/AcceptInvitationPage.tsx
git commit -m "fix: 초대 수락 라우트를 Layout 밖으로 이동 (딥링크 보호)"
```

---

### Task 5: 온보딩 페이지에서 초대 수락 지원

**Files:**
- Modify: `frontend/src/pages/OnboardingPage.tsx`

**Step 1: 온보딩 페이지 전면 개편**

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Loader2, Mail } from 'lucide-react'
import { onboardingApi } from '../api/onboarding'
import { useHouseholdStore } from '../stores/useHouseholdStore'

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { myInvitations, fetchHouseholds, fetchMyInvitations, acceptInvitation } = useHouseholdStore()

  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [acceptingToken, setAcceptingToken] = useState<string | null>(null)

  const pendingInvitations = myInvitations.filter((inv) => inv.status === 'pending')

  // 새 가계부 만들기
  const handleCreate = async () => {
    setLoading(true)
    try {
      await onboardingApi.createHousehold(name.trim() || undefined)
      await fetchHouseholds()
      toast.success('가계부가 생성되었습니다!')
      navigate('/', { replace: true })
    } catch {
      toast.error('가계부 생성에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  // 초대 수락
  const handleAccept = async (token: string, householdName?: string) => {
    setAcceptingToken(token)
    try {
      await acceptInvitation(token)
      toast.success(`${householdName || '가계부'}에 참여했습니다!`)
      navigate('/', { replace: true })
    } catch {
      toast.error('초대 수락에 실패했습니다')
      // 실패 시 초대 목록 새로고침 (만료 등)
      await fetchMyInvitations().catch(() => {})
    } finally {
      setAcceptingToken(null)
    }
  }

  const isDisabled = loading || !!acceptingToken

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* 아이콘 + 제목 */}
        <div className="text-center space-y-2">
          <div className="text-5xl">🍇</div>
          <h1 className="text-2xl font-bold text-grape-900">포도가계부 시작하기</h1>
          <p className="text-sm text-warm-500">
            {pendingInvitations.length > 0
              ? '초대받은 가계부에 참여하거나 새로 만들어보세요'
              : '나만의 가계부를 만들어보세요'}
          </p>
        </div>

        {/* 받은 초대 섹션 */}
        {pendingInvitations.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-warm-200/60 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-warm-700">
              <Mail className="w-4 h-4" />
              <span>받은 초대 ({pendingInvitations.length}건)</span>
            </div>

            {pendingInvitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between p-3 bg-grape-50/50 rounded-xl"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-grape-900 truncate">
                    {inv.household_name || '가계부'}
                  </p>
                  {inv.inviter_username && (
                    <p className="text-xs text-warm-500 truncate">
                      {inv.inviter_username}님이 초대
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleAccept(inv.token!, inv.household_name)}
                  disabled={isDisabled}
                  className="ml-3 shrink-0 px-3 py-1.5 text-xs font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                >
                  {acceptingToken === inv.token && <Loader2 className="w-3 h-3 animate-spin" />}
                  참여
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 구분선 (초대가 있을 때만) */}
        {pendingInvitations.length > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-warm-200" />
            <span className="text-xs text-warm-400">또는</span>
            <div className="flex-1 h-px bg-warm-200" />
          </div>
        )}

        {/* 새 가계부 만들기 */}
        <div className="bg-white rounded-2xl shadow-sm border border-warm-200/60 p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1.5">
              가계부 이름
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="가계부 이름 (비워두면 기본 이름)"
              className="w-full border border-warm-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/40 focus:border-grape-400"
              disabled={isDisabled}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
            />
          </div>

          <button
            onClick={handleCreate}
            disabled={isDisabled}
            className="w-full py-3 bg-grape-600 text-white rounded-lg text-sm font-medium hover:bg-grape-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            새 가계부 만들기
          </button>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: 빌드 확인**

```bash
cd frontend && npm run build
```

**Step 3: 커밋**

```bash
git add frontend/src/pages/OnboardingPage.tsx
git commit -m "feat: 온보딩에서 초대 수락 지원 — 가계부 생성 없이 참여 가능"
```

---

## Batch 3: 보낸 초대 관리 UI

### Task 6: HouseholdDetailPage에 보낸 초대 목록 + 취소 기능 추가

**Files:**
- Modify: `frontend/src/pages/HouseholdDetailPage.tsx`
- Modify: `frontend/src/stores/useHouseholdStore.ts`

**Step 1: 스토어에 가구별 초대 목록 조회 액션 추가**

`useHouseholdStore.ts`에 추가:

상태:
```typescript
interface HouseholdState {
  // ... 기존 ...
  /** 현재 가구의 보낸 초대 목록 */
  householdInvitations: HouseholdInvitation[]
}
```

초기값:
```typescript
householdInvitations: [],
```

액션:
```typescript
interface HouseholdActions {
  // ... 기존 ...
  /** 가구 초대 목록 조회 (admin용) */
  fetchHouseholdInvitations: (householdId: number) => Promise<void>
}
```

구현:
```typescript
fetchHouseholdInvitations: async (householdId: number) => {
  try {
    const response = await householdApi.getHouseholdInvitations(householdId)
    set({ householdInvitations: response.data })
  } catch {
    set({ householdInvitations: [] })
  }
},
```

`cancelInvitation` 수정 — 취소 후 목록 새로고침:
```typescript
cancelInvitation: async (householdId: number, invitationId: number) => {
  set({ isLoading: true, error: null })
  try {
    await householdApi.cancelInvitation(householdId, invitationId)
    // 취소 후 목록 새로고침
    await get().fetchHouseholdInvitations(householdId)
    set({ isLoading: false })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '초대 취소 중 오류가 발생했습니다'
    set({ error: errorMessage, isLoading: false })
    throw error
  }
},
```

**Step 2: HouseholdDetailPage에 "초대" 탭 추가**

탭 타입 수정:
```typescript
type TabType = 'members' | 'invitations' | 'settings'
```

스토어에서 추가로 가져오기:
```typescript
const {
  // ... 기존 ...
  householdInvitations,
  fetchHouseholdInvitations,
  cancelInvitation,
} = useHouseholdStore()
```

마운트 시 초대 목록도 조회 (admin인 경우):
```typescript
useEffect(() => {
  if (id && currentHousehold && (currentHousehold.my_role === 'owner' || currentHousehold.my_role === 'admin')) {
    fetchHouseholdInvitations(Number(id)).catch(() => {})
  }
}, [id, currentHousehold?.my_role, fetchHouseholdInvitations])
```

탭 버튼에 "초대" 추가 (admin 이상):
```tsx
{isAdmin && (
  <button
    onClick={() => setActiveTab('invitations')}
    className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
      activeTab === 'invitations'
        ? 'border-grape-600 text-grape-600'
        : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
    }`}
  >
    초대
    {householdInvitations.filter(i => i.status === 'pending').length > 0 && (
      <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-grape-500 rounded-full">
        {householdInvitations.filter(i => i.status === 'pending').length}
      </span>
    )}
  </button>
)}
```

초대 탭 콘텐츠:
```tsx
{activeTab === 'invitations' && isAdmin && (
  <div className="space-y-4">
    <div className="flex justify-end">
      <button
        onClick={() => setShowInviteModal(true)}
        className="px-4 py-2 text-sm font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700 transition-colors"
      >
        + 멤버 초대
      </button>
    </div>

    {householdInvitations.length === 0 ? (
      <div className="text-center py-8 text-sm text-warm-400">
        보낸 초대가 없습니다
      </div>
    ) : (
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] overflow-hidden">
        <div className="divide-y divide-[var(--border-default)]">
          {householdInvitations.map((inv) => {
            const isPending = inv.status === 'pending'
            const statusText: Record<string, string> = {
              pending: '대기 중',
              accepted: '수락됨',
              rejected: '거절됨',
              expired: '만료됨',
            }
            const statusColor: Record<string, string> = {
              pending: 'bg-yellow-100 text-yellow-800',
              accepted: 'bg-green-100 text-green-800',
              rejected: 'bg-warm-100 text-warm-600',
              expired: 'bg-warm-100 text-warm-500',
            }

            return (
              <div key={inv.id} className="flex items-center justify-between p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {inv.invitee_email}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor[inv.status] || ''}`}>
                      {statusText[inv.status] || inv.status}
                    </span>
                    <span className="text-xs text-warm-400">
                      {inv.role === 'admin' ? '관리자' : '멤버'}
                    </span>
                  </div>
                </div>
                {isPending && (
                  <button
                    onClick={async () => {
                      if (!confirm(`${inv.invitee_email}의 초대를 취소하시겠습니까?`)) return
                      try {
                        await cancelInvitation(Number(id), inv.id)
                        addToast('success', '초대를 취소했습니다')
                      } catch {
                        addToast('error', '초대 취소에 실패했습니다')
                      }
                    }}
                    className="ml-3 text-xs text-rose-600 hover:text-rose-700 font-medium"
                  >
                    취소
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )}
  </div>
)}
```

멤버 탭에서 "+ 멤버 초대" 버튼 제거 (초대 탭으로 이동했으므로). 단, admin이 아닌 경우 기존대로 초대 버튼 없음.

**Step 3: 빌드 확인**

```bash
cd frontend && npm run build
```

**Step 4: 커밋**

```bash
git add frontend/src/stores/useHouseholdStore.ts frontend/src/pages/HouseholdDetailPage.tsx
git commit -m "feat: 가계부 상세에 보낸 초대 관리 탭 추가"
```

---

## Batch 4: 초대 이메일 피드백

### Task 7: 초대 API 응답에 email_sent 필드 추가

**Files:**
- Modify: `backend/app/schemas/household.py`
- Modify: `backend/app/api/households.py`

**Step 1: InvitationResponse 스키마에 email_sent 필드 추가**

`backend/app/schemas/household.py`에서 `InvitationResponse` 찾아서 수정:

```python
class InvitationResponse(BaseModel):
    # ... 기존 필드 ...
    email_sent: bool = True  # 기본값 True (기존 API 호환)
```

**Step 2: 초대 생성 API에서 email_sent 반환**

`backend/app/api/households.py`의 `create_invitation` 함수에서:

```python
# 초대 이메일 발송 (비동기, 실패해도 초대 자체는 성공)
email_sent = await send_invitation_email(
    to_email=invitation.invitee_email,
    household_name=household.name,
    inviter_name=inviter.username,
    invite_token=token,
)

return InvitationResponse(
    # ... 기존 필드 ...
    token=token,
    email_sent=email_sent,
)
```

**Step 3: 테스트 실행**

```bash
cd backend && pytest tests/integration/test_api_households.py -v -x
```

**Step 4: 커밋**

```bash
git add backend/app/schemas/household.py backend/app/api/households.py
git commit -m "feat: 초대 API 응답에 email_sent 필드 추가"
```

---

### Task 8: 프론트에서 이메일 미발송 시 초대 링크 복사 안내

**Files:**
- Modify: `frontend/src/types/household.ts`
- Modify: `frontend/src/pages/HouseholdDetailPage.tsx`
- Modify: `frontend/src/components/InviteMemberModal.tsx`

**Step 1: HouseholdInvitation 타입에 email_sent 추가**

`frontend/src/types/household.ts`:

```typescript
interface HouseholdInvitation {
  // ... 기존 ...
  email_sent?: boolean
}
```

**Step 2: InviteMemberModal에서 초대 결과를 반환하도록 수정**

`onSubmit` prop 타입을 변경하여 결과를 받을 수 있게:

```typescript
interface InviteMemberModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: InviteMemberDto) => Promise<HouseholdInvitation | void>
  isLoading?: boolean
}
```

import 추가:
```typescript
import type { InviteMemberDto, HouseholdInvitation } from '../types'
```

**Step 3: HouseholdDetailPage에서 이메일 미발송 시 토큰 링크 복사**

`handleInvite` 함수 수정:

```typescript
const handleInvite = async (data: InviteMemberDto) => {
  if (!id) return

  setIsInviting(true)
  try {
    const result = await inviteMember(Number(id), data)
    if (result.email_sent === false && result.token) {
      // 이메일 미발송 — 링크 복사 안내
      const link = `${window.location.origin}/invitations/accept?token=${result.token}`
      await navigator.clipboard.writeText(link)
      addToast('warning', '이메일 발송 실패 — 초대 링크가 클립보드에 복사되었습니다')
    } else {
      addToast('success', '초대를 전송했습니다')
    }
    setShowInviteModal(false)
    // 초대 목록 새로고침
    await fetchHouseholdInvitations(Number(id)).catch(() => {})
  } catch (err) {
    console.error('멤버 초대 실패:', err)
    addToast('error', '멤버 초대에 실패했습니다')
  } finally {
    setIsInviting(false)
  }
}
```

**Step 4: 빌드 확인**

```bash
cd frontend && npm run build
```

**Step 5: 커밋**

```bash
git add frontend/src/types/household.ts frontend/src/pages/HouseholdDetailPage.tsx frontend/src/components/InviteMemberModal.tsx
git commit -m "feat: 이메일 미발송 시 초대 링크 클립보드 복사 안내"
```

---

## Batch 5: 테스트 + 최종 확인

### Task 9: 프론트엔드 빌드 + 린트 + 기존 테스트 확인

**Step 1: 린트**

```bash
cd frontend && npm run lint
```

**Step 2: 기존 테스트**

```bash
cd frontend && npm run test:run
```

**Step 3: 프로덕션 빌드**

```bash
cd frontend && npm run build
```

**Step 4: 백엔드 테스트**

```bash
cd backend && pytest --ignore=tests/integration/test_api_budget_bulk.py -x -q
```

**Step 5: 커밋 (필요시 수정 후)**

수정사항 있으면 커밋.

---

### Task 10: 새소식(changelog) + 가이드 업데이트

**Files:**
- Modify: `frontend/src/data/changelogs.ts`
- Modify: `frontend/src/pages/GuidePage.tsx` (해당 섹션이 있다면)

**Step 1: changelogs.ts 업데이트**

배열 맨 앞에 추가:

```typescript
{
  version: '1.x.0',
  date: '2026-03-15',
  title: '온보딩 & 초대 개선',
  items: [
    { tag: '개선', text: '초대받은 가계부에 바로 참여할 수 있습니다' },
    { tag: '개선', text: '가계부 상세에서 보낸 초대를 관리할 수 있습니다' },
    { tag: '수정', text: '새로고침 시 온보딩 페이지가 다시 나오는 문제를 수정했습니다' },
  ],
},
```

**Step 2: 커밋**

```bash
git add frontend/src/data/changelogs.ts
git commit -m "docs: 온보딩/초대 개선 새소식 추가"
```

---

## 개발환경 테스트 시나리오

배포 후 아래 시나리오를 dev 환경 (`podo-budget-dev.pages.dev`)에서 수행한다.

### 시나리오 1: 새로고침 시 온보딩 재진입 방지

| # | 단계 | 기대 결과 |
|---|------|-----------|
| 1 | dev 환경 로그인 (kimsy_0327@naver.com) | 가계부 목록 정상 표시 |
| 2 | 가계부 페이지에서 브라우저 강제 새로고침 (Cmd+Shift+R) | 포도 로딩 → 가계부 페이지 (온보딩 안 나옴) |
| 3 | URL에 직접 `/insights` 입력 후 Enter | 리포트 페이지 표시 (온보딩 안 나옴) |

### 시나리오 2: 신규 유저 온보딩 — 초대 없는 경우

| # | 단계 | 기대 결과 |
|---|------|-----------|
| 1 | DB에서 테스트 유저의 household_members 모두 삭제 | — |
| 2 | dev 환경 접속 | 온보딩 페이지 표시 ("나만의 가계부를 만들어보세요") |
| 3 | 초대 섹션 없음 확인 | "받은 초대" 카드 미표시 |
| 4 | "새 가계부 만들기" 클릭 | 가계부 생성 → 홈 이동 |

### 시나리오 3: 신규 유저 온보딩 — 초대가 있는 경우

| # | 단계 | 기대 결과 |
|---|------|-----------|
| 1 | 기존 계정에서 테스트 유저 이메일로 초대 발송 | — |
| 2 | 테스트 유저의 household_members 모두 삭제 | — |
| 3 | 테스트 유저로 로그인 | 온보딩 페이지에 "받은 초대 (1건)" 표시 |
| 4 | [참여] 버튼 클릭 | 가계부 참여 → 홈 이동 (가계부 전환 드롭다운에 표시) |

### 시나리오 4: 초대 딥링크 — 가계부 0개 유저

| # | 단계 | 기대 결과 |
|---|------|-----------|
| 1 | 테스트 유저의 household_members 모두 삭제 | — |
| 2 | `/invitations/accept?token=xxx` 직접 접속 | 초대 수락 페이지 표시 (온보딩으로 안 감) |
| 3 | "초대 수락" 클릭 | 가계부 참여 → 홈 이동 |

### 시나리오 5: 보낸 초대 관리

| # | 단계 | 기대 결과 |
|---|------|-----------|
| 1 | 가계부 상세 페이지 진입 (owner 계정) | — |
| 2 | "초대" 탭 클릭 | 보낸 초대 목록 표시 (대기 중/수락됨/만료됨 상태) |
| 3 | "+ 멤버 초대" → 이메일 입력 → 초대 | 목록에 새 초대 추가 (대기 중) |
| 4 | 대기 중 초대의 "취소" 클릭 | 확인 후 목록에서 제거 |

### 시나리오 6: 이메일 미발송 시 링크 복사

| # | 단계 | 기대 결과 |
|---|------|-----------|
| 1 | RESEND_API_KEY가 미설정된 환경에서 초대 발송 | "이메일 발송 실패 — 초대 링크가 클립보드에 복사되었습니다" 토스트 |
| 2 | 클립보드 내용 확인 | `/invitations/accept?token=xxx` 형태 URL |

### 시나리오 7: 초기화 실패 시 재시도

| # | 단계 | 기대 결과 |
|---|------|-----------|
| 1 | 백엔드 서버 중지 상태에서 접속 | 포도 로딩 → "서버에 연결할 수 없습니다" + 재시도 버튼 |
| 2 | 백엔드 재시작 후 "다시 시도" 클릭 | 정상 진입 |
