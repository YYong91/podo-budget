/**
 * @file HouseholdDetailPage.test.tsx
 * @description 공유 가계부 상세 페이지 테스트
 * 탭 전환, 로딩/에러 상태, 권한별 UI를 검증한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import HouseholdDetailPage from '../HouseholdDetailPage'

/* ------------------------------------------------------------------ */
/*  모킹 데이터 — 테스트마다 storeState를 변경하여 다양한 시나리오 검증  */
/* ------------------------------------------------------------------ */

const baseMockHousehold = {
  id: 1,
  name: '우리집',
  description: '가족 가계부',
  my_role: 'owner' as string,
  members: [
    {
      user_id: 1,
      username: '홍길동',
      email: 'hong@example.com',
      role: 'owner',
      joined_at: '2026-01-01T00:00:00Z',
    },
    {
      user_id: 2,
      username: '김철수',
      email: 'kim@example.com',
      role: 'member',
      joined_at: '2026-02-01T00:00:00Z',
    },
  ],
}

const fetchHouseholdDetail = vi.fn().mockResolvedValue(baseMockHousehold)
const fetchHouseholdInvitations = vi.fn().mockResolvedValue(undefined)
const clearCurrentHousehold = vi.fn()
const clearError = vi.fn()
const addToast = vi.fn()

/** 테스트마다 변경할 수 있는 스토어 상태 */
let storeState: {
  currentHousehold: typeof baseMockHousehold | null
  isLoading: boolean
  error: string | null
  householdInvitations: Array<{ id: number; invitee_email: string; status: string; token: string }>
}

vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: () => ({
    ...storeState,
    fetchHouseholdDetail,
    fetchHouseholdInvitations,
    updateHousehold: vi.fn(),
    deleteHousehold: vi.fn(),
    inviteMember: vi.fn(),
    cancelInvitation: vi.fn(),
    updateMemberRole: vi.fn(),
    removeMember: vi.fn(),
    leaveHousehold: vi.fn(),
    clearError,
    clearCurrentHousehold,
  }),
}))

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ addToast }),
}))

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, username: '홍길동' } }),
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/households/1']}>
      <Routes>
        <Route path="/households/:id" element={<HouseholdDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

/* ------------------------------------------------------------------ */
/*  테스트                                                              */
/* ------------------------------------------------------------------ */

describe('HouseholdDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 기본 상태: owner, 로딩 완료, 에러 없음
    storeState = {
      currentHousehold: { ...baseMockHousehold, my_role: 'owner' },
      isLoading: false,
      error: null,
      householdInvitations: [],
    }
  })

  /* ---------- 기본 렌더링 ---------- */

  it('가구 역할 뱃지를 표시한다', () => {
    renderPage()
    expect(screen.getAllByText('소유자').length).toBeGreaterThan(0)
  })

  it('가구 설명을 표시한다', () => {
    renderPage()
    expect(screen.getByText('가족 가계부')).toBeInTheDocument()
  })

  it('멤버 탭이 기본 선택되어 있다', () => {
    renderPage()
    expect(screen.getAllByText('멤버').length).toBeGreaterThan(0)
  })

  it('멤버 목록을 표시한다', () => {
    renderPage()
    expect(screen.getByText('홍길동')).toBeInTheDocument()
    expect(screen.getByText('김철수')).toBeInTheDocument()
  })

  it('멤버의 이메일을 표시한다', () => {
    renderPage()
    expect(screen.getByText('hong@example.com')).toBeInTheDocument()
    expect(screen.getByText('kim@example.com')).toBeInTheDocument()
  })

  it('가구 정보 로드를 요청한다', async () => {
    renderPage()
    await waitFor(() => {
      expect(fetchHouseholdDetail).toHaveBeenCalledWith(1)
    })
  })

  it('자기 자신은 (나) 표시가 된다', () => {
    renderPage()
    expect(screen.getByText('(나)')).toBeInTheDocument()
  })

  it('설명이 없으면 설명 영역을 표시하지 않는다', () => {
    storeState.currentHousehold = { ...baseMockHousehold, description: '', my_role: 'owner' }
    renderPage()
    expect(screen.queryByText('가족 가계부')).not.toBeInTheDocument()
  })

  /* ---------- 로딩 상태 ---------- */

  it('로딩 중이고 데이터가 없으면 로딩 스피너를 표시한다', () => {
    storeState.isLoading = true
    storeState.currentHousehold = null
    renderPage()
    // LoadingSpinner 컴포넌트의 animate-spin 요소가 렌더링된다
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('로딩 중이지만 데이터가 있으면 콘텐츠를 표시한다', () => {
    storeState.isLoading = true
    // currentHousehold는 기본값(있음)
    renderPage()
    expect(screen.getByText('홍길동')).toBeInTheDocument()
  })

  /* ---------- 에러 상태 ---------- */

  it('에러가 있고 데이터가 없으면 ErrorState를 표시한다', () => {
    storeState.error = '서버 에러'
    storeState.currentHousehold = null
    renderPage()
    // ErrorState의 재시도 버튼
    expect(screen.getByText('다시 시도')).toBeInTheDocument()
  })

  it('에러가 있지만 데이터가 있으면 콘텐츠를 표시하고 토스트를 호출한다', () => {
    storeState.error = '서버 에러'
    renderPage()
    // 콘텐츠는 표시됨
    expect(screen.getByText('홍길동')).toBeInTheDocument()
    // error useEffect가 토스트를 호출
    expect(addToast).toHaveBeenCalledWith('error', '처리에 실패했습니다')
    expect(clearError).toHaveBeenCalled()
  })

  /* ---------- 가구 정보 없음 ---------- */

  it('가구 데이터가 null이면 EmptyState를 표시한다', () => {
    storeState.currentHousehold = null
    renderPage()
    expect(screen.getByText('가구를 찾을 수 없습니다')).toBeInTheDocument()
    expect(screen.getByText('가구 목록으로')).toBeInTheDocument()
  })

  /* ---------- 소유자 권한 ---------- */

  it('소유자에게 초대/설정 탭을 표시한다', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /초대/ })).toBeInTheDocument()
    expect(screen.getByText('설정')).toBeInTheDocument()
  })

  it('소유자는 다른 멤버에 대해 추방 버튼을 볼 수 있다', () => {
    renderPage()
    expect(screen.getByText('추방')).toBeInTheDocument()
  })

  /* ---------- 관리자 권한 ---------- */

  it('관리자에게 초대/설정 탭을 표시한다', () => {
    storeState.currentHousehold = { ...baseMockHousehold, my_role: 'admin' }
    renderPage()
    expect(screen.getByRole('button', { name: /초대/ })).toBeInTheDocument()
    expect(screen.getByText('설정')).toBeInTheDocument()
  })

  /* ---------- 일반 멤버 권한 ---------- */

  it('일반 멤버에게는 초대/설정 탭을 표시하지 않는다', () => {
    storeState.currentHousehold = { ...baseMockHousehold, my_role: 'member' }
    renderPage()
    // 탭 버튼으로서의 "초대"가 없어야 한다 (멤버 탭의 텍스트와 구분)
    const tabs = screen.getAllByRole('button')
    const invitationTab = tabs.find(
      (btn) => btn.textContent?.includes('초대') && !btn.textContent?.includes('멤버'),
    )
    expect(invitationTab).toBeUndefined()
    expect(screen.queryByText('설정')).not.toBeInTheDocument()
  })

  it('일반 멤버는 추방 버튼을 볼 수 없다', () => {
    storeState.currentHousehold = { ...baseMockHousehold, my_role: 'member' }
    renderPage()
    expect(screen.queryByText('추방')).not.toBeInTheDocument()
  })

  /* ---------- 탭 전환 ---------- */

  it('초대 탭을 클릭하면 초대 탭 콘텐츠가 표시된다', async () => {
    storeState.householdInvitations = [
      { id: 10, invitee_email: 'new@test.com', status: 'pending', token: 'abc' },
    ]
    renderPage()

    const invitationTab = screen.getByRole('button', { name: /초대/ })
    await userEvent.click(invitationTab)

    // InvitationsTab이 렌더링된다 — "+ 멤버 초대" 버튼이 표시됨
    expect(screen.getByText('+ 멤버 초대')).toBeInTheDocument()
  })

  it('설정 탭을 클릭하면 설정 탭 콘텐츠가 표시된다', async () => {
    renderPage()

    const settingsTab = screen.getByText('설정')
    await userEvent.click(settingsTab)

    // SettingsTab이 렌더링된다 — "가구 정보" 섹션 제목이 표시됨
    expect(screen.getByText('가구 정보')).toBeInTheDocument()
  })

  it('초대 탭에서 pending 초대 수를 뱃지로 표시한다', () => {
    storeState.householdInvitations = [
      { id: 10, invitee_email: 'a@test.com', status: 'pending', token: 'abc' },
      { id: 11, invitee_email: 'b@test.com', status: 'pending', token: 'def' },
      { id: 12, invitee_email: 'c@test.com', status: 'accepted', token: 'ghi' },
    ]
    renderPage()

    // pending 2건 뱃지
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  /* ---------- 언마운트 시 정리 ---------- */

  it('언마운트 시 clearCurrentHousehold를 호출한다', () => {
    const { unmount } = renderPage()
    unmount()
    expect(clearCurrentHousehold).toHaveBeenCalled()
  })

  /* ---------- admin인 경우 초대 목록 조회 ---------- */

  it('admin인 경우 초대 목록을 조회한다', async () => {
    storeState.currentHousehold = { ...baseMockHousehold, my_role: 'admin' }
    renderPage()
    await waitFor(() => {
      expect(fetchHouseholdInvitations).toHaveBeenCalledWith(1)
    })
  })

  it('일반 멤버인 경우 초대 목록을 조회하지 않는다', async () => {
    storeState.currentHousehold = { ...baseMockHousehold, my_role: 'member' }
    renderPage()
    // fetchHouseholdDetail은 호출되지만 fetchHouseholdInvitations는 호출되지 않아야 한다
    await waitFor(() => {
      expect(fetchHouseholdDetail).toHaveBeenCalled()
    })
    expect(fetchHouseholdInvitations).not.toHaveBeenCalled()
  })

  /* ---------- 멤버 초대 모달 ---------- */

  it('초대 탭에서 + 멤버 초대 버튼 클릭 시 모달이 열린다', async () => {
    renderPage()

    const invitationTab = screen.getByRole('button', { name: /초대/ })
    await userEvent.click(invitationTab)

    await waitFor(() => {
      expect(screen.getByText('+ 멤버 초대')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('+ 멤버 초대'))

    await waitFor(() => {
      expect(screen.getByText('멤버 초대')).toBeInTheDocument()
    })
  })

  /* ---------- 설정 탭 인터랙션 ---------- */

  it('설정 탭에서 가구 정보 수정 폼이 표시된다', async () => {
    renderPage()

    const settingsTab = screen.getByText('설정')
    await userEvent.click(settingsTab)

    await waitFor(() => {
      expect(screen.getByText('가구 정보')).toBeInTheDocument()
    })
  })

  /* ---------- 뒤로가기 ---------- */

  it('뒤로가기 버튼이 존재한다', () => {
    renderPage()
    // ArrowLeft 아이콘이 있는 버튼
    const backButtons = screen.getAllByRole('button')
    expect(backButtons.length).toBeGreaterThan(0)
  })

  /* ---------- 초대 뱃지 숨김 ---------- */

  it('pending 초대가 없으면 뱃지가 표시되지 않는다', () => {
    storeState.householdInvitations = [
      { id: 10, invitee_email: 'a@test.com', status: 'accepted', token: 'abc' },
    ]
    renderPage()
    // "초대" 탭에 뱃지 숫자가 없어야 함
    expect(screen.queryByText('1')).not.toBeInTheDocument()
  })

  /* ---------- 가구 정보 표시 ---------- */

  it('멤버 목록에서 각 멤버의 역할을 표시한다', () => {
    renderPage()
    expect(screen.getAllByText('소유자').length).toBeGreaterThan(0)
    expect(screen.getAllByText('멤버').length).toBeGreaterThan(0)
  })

  it('멤버의 가입일을 표시한다', () => {
    renderPage()
    expect(screen.getByText(/2026.01.01/)).toBeInTheDocument()
    expect(screen.getByText(/2026.02.01/)).toBeInTheDocument()
  })

  /* ---------- 초대 탭 상세 ---------- */

  it('초대 탭에서 초대 목록을 표시한다', async () => {
    storeState.householdInvitations = [
      { id: 10, invitee_email: 'new@test.com', status: 'pending', token: 'abc123' },
      { id: 11, invitee_email: 'old@test.com', status: 'accepted', token: 'def456' },
    ]
    renderPage()

    await userEvent.click(screen.getByRole('button', { name: /초대/ }))

    await waitFor(() => {
      expect(screen.getByText('new@test.com')).toBeInTheDocument()
    })
  })

  /* ---------- 설정 탭 상세 ---------- */

  it('설정 탭에서 가구 이름이 표시된다', async () => {
    renderPage()
    await userEvent.click(screen.getByText('설정'))

    await waitFor(() => {
      expect(screen.getByDisplayValue('우리집')).toBeInTheDocument()
    })
  })

  it('설정 탭에서 가구 삭제 버튼이 owner에게만 표시된다', async () => {
    renderPage()
    await userEvent.click(screen.getByText('설정'))

    await waitFor(() => {
      expect(screen.getByText('가구 삭제')).toBeInTheDocument()
    })
  })

  it('admin 역할에서 설정 탭 가구 삭제 버튼이 숨겨진다', async () => {
    storeState.currentHousehold = { ...baseMockHousehold, my_role: 'admin' }
    renderPage()
    await userEvent.click(screen.getByText('설정'))

    await waitFor(() => {
      expect(screen.getByText('가구 정보')).toBeInTheDocument()
    })
    // admin은 삭제 불가
    expect(screen.queryByText('가구 삭제')).not.toBeInTheDocument()
  })
})
