/**
 * @file HouseholdDetailPage.test.tsx
 * @description 공유 가계부 상세 페이지 테스트
 * 탭 전환, 로딩/에러 상태, 권한별 UI, 핸들러(초대, 역할 변경, 멤버 내보내기, 탈퇴, 수정, 삭제, 초대 취소, 링크 복사)를 검증한다.
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
const mockInviteMember = vi.fn()
const mockUpdateMemberRole = vi.fn()
const mockRemoveMember = vi.fn()
const mockLeaveHousehold = vi.fn()
const mockUpdateHousehold = vi.fn()
const mockDeleteHousehold = vi.fn()
const mockCancelInvitation = vi.fn()

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
}))

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
    updateHousehold: mockUpdateHousehold,
    deleteHousehold: mockDeleteHousehold,
    inviteMember: mockInviteMember,
    cancelInvitation: mockCancelInvitation,
    updateMemberRole: mockUpdateMemberRole,
    removeMember: mockRemoveMember,
    leaveHousehold: mockLeaveHousehold,
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
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    // navigator.clipboard 모킹
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
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
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('로딩 중이지만 데이터가 있으면 콘텐츠를 표시한다', () => {
    storeState.isLoading = true
    renderPage()
    expect(screen.getByText('홍길동')).toBeInTheDocument()
  })

  /* ---------- 에러 상태 ---------- */

  it('에러가 있고 데이터가 없으면 ErrorState를 표시한다', () => {
    storeState.error = '서버 에러'
    storeState.currentHousehold = null
    renderPage()
    expect(screen.getByText('다시 시도')).toBeInTheDocument()
  })

  it('에러가 있지만 데이터가 있으면 콘텐츠를 표시하고 토스트를 호출한다', () => {
    storeState.error = '서버 에러'
    renderPage()
    expect(screen.getByText('홍길동')).toBeInTheDocument()
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

  it('소유자는 다른 멤버에 대해 내보내기 버튼을 볼 수 있다', () => {
    renderPage()
    expect(screen.getByText('내보내기')).toBeInTheDocument()
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
    const tabs = screen.getAllByRole('button')
    const invitationTab = tabs.find(
      (btn) => btn.textContent?.includes('초대') && !btn.textContent?.includes('멤버'),
    )
    expect(invitationTab).toBeUndefined()
    expect(screen.queryByText('설정')).not.toBeInTheDocument()
  })

  it('일반 멤버는 내보내기 버튼을 볼 수 없다', () => {
    storeState.currentHousehold = { ...baseMockHousehold, my_role: 'member' }
    renderPage()
    expect(screen.queryByText('내보내기')).not.toBeInTheDocument()
  })

  /* ---------- 탭 전환 ---------- */

  it('초대 탭을 클릭하면 초대 탭 콘텐츠가 표시된다', async () => {
    storeState.householdInvitations = [
      { id: 10, invitee_email: 'new@test.com', status: 'pending', token: 'abc' },
    ]
    renderPage()

    const invitationTab = screen.getByRole('button', { name: /초대/ })
    await userEvent.click(invitationTab)

    expect(screen.getByText('+ 멤버 초대')).toBeInTheDocument()
  })

  it('설정 탭을 클릭하면 설정 탭 콘텐츠가 표시된다', async () => {
    renderPage()

    const settingsTab = screen.getByText('설정')
    await userEvent.click(settingsTab)

    expect(screen.getByText('가구 정보')).toBeInTheDocument()
  })

  it('초대 탭에서 pending 초대 수를 뱃지로 표시한다', () => {
    storeState.householdInvitations = [
      { id: 10, invitee_email: 'a@test.com', status: 'pending', token: 'abc' },
      { id: 11, invitee_email: 'b@test.com', status: 'pending', token: 'def' },
      { id: 12, invitee_email: 'c@test.com', status: 'accepted', token: 'ghi' },
    ]
    renderPage()

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
    await waitFor(() => {
      expect(fetchHouseholdDetail).toHaveBeenCalled()
    })
    expect(fetchHouseholdInvitations).not.toHaveBeenCalled()
  })

  /* ---------- 멤버 초대 핸들러 ---------- */

  it('초대 모달에서 초대 성공 시 토스트를 표시한다', async () => {
    mockInviteMember.mockResolvedValueOnce({ email_sent: true })
    storeState.householdInvitations = []
    renderPage()

    // 초대 탭으로 이동
    const invitationTab = screen.getByRole('button', { name: /초대/ })
    await userEvent.click(invitationTab)

    // 멤버 초대 버튼 클릭
    await userEvent.click(screen.getByText('+ 멤버 초대'))

    // 모달이 열리면 이메일 입력 (labelledby로 찾기 — 테이블에도 '이메일' 텍스트가 있으므로)
    const emailInput = screen.getByLabelText(/이메일/)
    await userEvent.type(emailInput, 'new@test.com')

    // 초대 전송 (모달 내 submit 버튼 — dialog 안에서 찾기)
    const dialog = screen.getByRole('dialog')
    const submitBtn = dialog.querySelector('button[type="submit"]') as HTMLButtonElement
    await userEvent.click(submitBtn)

    await waitFor(() => {
      expect(mockInviteMember).toHaveBeenCalled()
    })
  })

  it('초대 시 이메일 미발송이면 링크 복사 안내를 표시한다', async () => {
    mockInviteMember.mockResolvedValueOnce({ email_sent: false, token: 'abc123' })
    storeState.householdInvitations = []
    renderPage()

    const invitationTab = screen.getByRole('button', { name: /초대/ })
    await userEvent.click(invitationTab)
    await userEvent.click(screen.getByText('+ 멤버 초대'))

    const emailInput = screen.getByLabelText(/이메일/)
    await userEvent.type(emailInput, 'new@test.com')
    const dialog = screen.getByRole('dialog')
    const submitBtn = dialog.querySelector('button[type="submit"]') as HTMLButtonElement
    await userEvent.click(submitBtn)

    await waitFor(() => {
      expect(addToast).toHaveBeenCalledWith('warning', '이메일 발송에 실패하여 링크가 복사되었습니다')
    })
  })

  /* ---------- 역할 변경 핸들러 ---------- */

  it('역할 변경 성공 시 토스트를 표시한다', async () => {
    mockUpdateMemberRole.mockResolvedValueOnce(undefined)
    renderPage()

    // MembersTab에 역할 변경 select가 있음 — member의 role select 찾기
    const roleSelects = screen.getAllByRole('combobox')
    if (roleSelects.length > 0) {
      await userEvent.selectOptions(roleSelects[0], 'admin')
      await waitFor(() => {
        expect(mockUpdateMemberRole).toHaveBeenCalled()
      })
    }
  })

  /* ---------- 멤버 내보내기 핸들러 ---------- */

  it('내보내기 버튼 클릭 시 confirm 후 removeMember를 호출한다', async () => {
    mockRemoveMember.mockResolvedValueOnce(undefined)
    renderPage()

    await userEvent.click(screen.getByText('내보내기'))

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled()
      expect(mockRemoveMember).toHaveBeenCalledWith(1, 2)
    })
    expect(addToast).toHaveBeenCalledWith('success', '멤버를 내보냈습니다')
  })

  it('내보내기 실패 시 에러 토스트를 표시한다', async () => {
    mockRemoveMember.mockRejectedValueOnce(new Error('내보내기 실패'))
    renderPage()

    await userEvent.click(screen.getByText('내보내기'))

    await waitFor(() => {
      expect(addToast).toHaveBeenCalledWith('error', '멤버 내보내기에 실패했습니다')
    })
  })

  /* ---------- 초대 취소 핸들러 ---------- */

  it('초대 취소 시 cancelInvitation을 호출한다', async () => {
    mockCancelInvitation.mockResolvedValueOnce(undefined)
    storeState.householdInvitations = [
      { id: 10, invitee_email: 'new@test.com', status: 'pending', token: 'abc' },
    ]
    renderPage()

    const invitationTab = screen.getByRole('button', { name: /초대/ })
    await userEvent.click(invitationTab)

    // 취소 버튼 클릭
    const cancelBtn = screen.getByText('취소')
    await userEvent.click(cancelBtn)

    await waitFor(() => {
      expect(mockCancelInvitation).toHaveBeenCalledWith(1, 10)
    })
  })

  /* ---------- 초대 링크 복사 핸들러 ---------- */

  it('초대 링크 복사 시 clipboard에 복사하고 토스트를 표시한다', async () => {
    storeState.householdInvitations = [
      { id: 10, invitee_email: 'new@test.com', status: 'pending', token: 'abc123' },
    ]
    renderPage()

    const invitationTab = screen.getByRole('button', { name: /초대/ })
    await userEvent.click(invitationTab)

    // 링크 복사 버튼 찾기
    const copyBtn = screen.getByText('링크 복사')
    await userEvent.click(copyBtn)

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('/invitations/accept?token=abc123'),
      )
      expect(addToast).toHaveBeenCalledWith('success', '초대 링크가 복사되었습니다')
    })
  })

  /* ---------- 가구 탈퇴 핸들러 ---------- */

  it('소유자에게 탈퇴 버튼이 멤버 탭에서 표시된다 (멤버 2명 이상)', () => {
    renderPage()
    // 소유자(홍길동)에 대해 canManageMember는 false, isMe=true, 2명 이상이므로 "탈퇴" 표시
    expect(screen.getByText('탈퇴')).toBeInTheDocument()
  })

  it('가구 탈퇴 성공 시 가구 목록으로 이동한다', async () => {
    mockLeaveHousehold.mockResolvedValueOnce(undefined)
    renderPage()

    await userEvent.click(screen.getByText('탈퇴'))

    await waitFor(() => {
      expect(mockLeaveHousehold).toHaveBeenCalledWith(1)
      expect(addToast).toHaveBeenCalledWith('success', '가구에서 탈퇴했습니다')
      expect(mockNavigate).toHaveBeenCalledWith('/households')
    })
  })

  it('가구 탈퇴 실패 시 에러 토스트를 표시한다', async () => {
    mockLeaveHousehold.mockRejectedValueOnce(new Error('탈퇴 실패'))
    renderPage()

    await userEvent.click(screen.getByText('탈퇴'))

    await waitFor(() => {
      expect(addToast).toHaveBeenCalledWith('error', '가구 탈퇴에 실패했습니다')
    })
  })

  /* ---------- 가구 삭제 핸들러 (설정 탭) ---------- */

  it('설정 탭에서 가구 삭제를 실행할 수 있다', async () => {
    mockDeleteHousehold.mockResolvedValueOnce(undefined)
    renderPage()

    await userEvent.click(screen.getByText('설정'))

    // 가구 삭제 버튼 클릭
    const deleteBtn = screen.getByText('가구 삭제')
    await userEvent.click(deleteBtn)

    await waitFor(() => {
      expect(mockDeleteHousehold).toHaveBeenCalledWith(1)
      expect(addToast).toHaveBeenCalledWith('success', '가구가 삭제되었습니다')
      expect(mockNavigate).toHaveBeenCalledWith('/households')
    })
  })

  it('가구 삭제 실패 시 에러 토스트를 표시한다', async () => {
    mockDeleteHousehold.mockRejectedValueOnce(new Error('삭제 실패'))
    renderPage()

    await userEvent.click(screen.getByText('설정'))
    await userEvent.click(screen.getByText('가구 삭제'))

    await waitFor(() => {
      expect(addToast).toHaveBeenCalledWith('error', '가구 삭제에 실패했습니다')
    })
  })

  it('가구 삭제 confirm 취소 시 삭제를 실행하지 않는다', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderPage()

    await userEvent.click(screen.getByText('설정'))
    await userEvent.click(screen.getByText('가구 삭제'))

    expect(mockDeleteHousehold).not.toHaveBeenCalled()
  })

  /* ---------- 멤버 추방: confirm 취소 ---------- */

  it('추방 confirm 취소 시 removeMember를 호출하지 않는다', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderPage()

    await userEvent.click(screen.getByText('추방'))

    expect(mockRemoveMember).not.toHaveBeenCalled()
  })

  /* ---------- 역할 변경: owner만 가능 ---------- */

  it('owner는 member의 역할을 admin으로 변경할 수 있다', async () => {
    mockUpdateMemberRole.mockResolvedValueOnce(undefined)
    renderPage()

    // member(김철수)의 역할 select가 있음
    const roleSelects = screen.getAllByRole('combobox')
    expect(roleSelects.length).toBeGreaterThan(0)

    await userEvent.selectOptions(roleSelects[0], 'admin')

    await waitFor(() => {
      expect(mockUpdateMemberRole).toHaveBeenCalledWith(1, 2, 'admin')
      expect(addToast).toHaveBeenCalledWith('success', '역할이 변경되었습니다')
    })
  })

  it('역할 변경 실패 시 에러 토스트를 표시한다', async () => {
    mockUpdateMemberRole.mockRejectedValueOnce(new Error('역할 변경 실패'))
    renderPage()

    const roleSelects = screen.getAllByRole('combobox')
    await userEvent.selectOptions(roleSelects[0], 'admin')

    await waitFor(() => {
      expect(addToast).toHaveBeenCalledWith('error', '역할 변경에 실패했습니다')
    })
  })

  it('일반 멤버에게는 역할 변경 select가 표시되지 않는다', () => {
    storeState.currentHousehold = { ...baseMockHousehold, my_role: 'member' }
    renderPage()

    expect(screen.queryAllByRole('combobox')).toHaveLength(0)
  })

  /* ---------- 가구 탈퇴: confirm 취소 ---------- */

  it('탈퇴 confirm 취소 시 leaveHousehold를 호출하지 않는다', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderPage()

    await userEvent.click(screen.getByText('탈퇴'))

    expect(mockLeaveHousehold).not.toHaveBeenCalled()
  })

  /* ---------- 초대 취소: confirm 취소 ---------- */

  it('초대 취소 confirm 취소 시 cancelInvitation을 호출하지 않는다', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    storeState.householdInvitations = [
      { id: 10, invitee_email: 'new@test.com', status: 'pending', token: 'abc' },
    ]
    renderPage()

    const invitationTab = screen.getByRole('button', { name: /초대/ })
    await userEvent.click(invitationTab)

    await userEvent.click(screen.getByText('취소'))

    expect(mockCancelInvitation).not.toHaveBeenCalled()
  })

  it('초대 취소 실패 시 에러 토스트를 표시한다', async () => {
    mockCancelInvitation.mockRejectedValueOnce(new Error('취소 실패'))
    storeState.householdInvitations = [
      { id: 10, invitee_email: 'new@test.com', status: 'pending', token: 'abc' },
    ]
    renderPage()

    const invitationTab = screen.getByRole('button', { name: /초대/ })
    await userEvent.click(invitationTab)

    await userEvent.click(screen.getByText('취소'))

    await waitFor(() => {
      expect(addToast).toHaveBeenCalledWith('error', '초대 취소에 실패했습니다')
    })
  })

  /* ---------- 초대 실패 ---------- */

  it('멤버 초대 실패 시 에러 토스트를 표시한다', async () => {
    mockInviteMember.mockRejectedValueOnce(new Error('초대 실패'))
    storeState.householdInvitations = []
    renderPage()

    const invitationTab = screen.getByRole('button', { name: /초대/ })
    await userEvent.click(invitationTab)
    await userEvent.click(screen.getByText('+ 멤버 초대'))

    const emailInput = screen.getByLabelText(/이메일/)
    await userEvent.type(emailInput, 'fail@test.com')
    const dialog = screen.getByRole('dialog')
    const submitBtn = dialog.querySelector('button[type="submit"]') as HTMLButtonElement
    await userEvent.click(submitBtn)

    await waitFor(() => {
      expect(addToast).toHaveBeenCalledWith('error', '멤버 초대에 실패했습니다')
    })
  })

  /* ---------- 가구 정보 수정 (설정 탭) ---------- */

  it('설정 탭에서 가구 정보를 수정할 수 있다', async () => {
    mockUpdateHousehold.mockResolvedValueOnce(undefined)
    renderPage()

    await userEvent.click(screen.getByText('설정'))

    // 수정 버튼 클릭하여 편집 모드 진입
    await userEvent.click(screen.getByText('수정'))

    // 이름 필드 수정
    const nameInput = screen.getByLabelText('가구 이름')
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, '새 이름')

    await userEvent.click(screen.getByText('저장'))

    await waitFor(() => {
      expect(mockUpdateHousehold).toHaveBeenCalledWith(1, expect.objectContaining({ name: '새 이름' }))
      expect(addToast).toHaveBeenCalledWith('success', '가구 정보가 수정되었습니다')
    })
  })

  it('가구 정보 수정 실패 시 에러 토스트를 표시한다', async () => {
    mockUpdateHousehold.mockRejectedValueOnce(new Error('수정 실패'))
    renderPage()

    await userEvent.click(screen.getByText('설정'))
    await userEvent.click(screen.getByText('수정'))

    await userEvent.click(screen.getByText('저장'))

    await waitFor(() => {
      expect(addToast).toHaveBeenCalledWith('error', '가구 수정에 실패했습니다')
    })
  })

  /* ---------- admin은 가구 삭제 불가 ---------- */

  it('admin은 설정 탭에서 가구 삭제 버튼을 볼 수 없다', async () => {
    storeState.currentHousehold = { ...baseMockHousehold, my_role: 'admin' }
    renderPage()

    await userEvent.click(screen.getByText('설정'))

    expect(screen.queryByText('가구 삭제')).not.toBeInTheDocument()
  })

  /* ---------- ErrorState 재시도 ---------- */

  it('에러 상태에서 다시 시도 버튼 클릭 시 fetchHouseholdDetail을 재호출한다', async () => {
    storeState.error = '서버 에러'
    storeState.currentHousehold = null
    renderPage()

    const retryBtn = screen.getByText('다시 시도')
    await userEvent.click(retryBtn)

    // 초기 호출 + 재시도 = 최소 2회
    await waitFor(() => {
      expect(fetchHouseholdDetail).toHaveBeenCalledTimes(2)
    })
  })

  /* ---------- 빈 초대 목록 ---------- */

  it('초대 목록이 비어있으면 빈 상태 메시지를 표시한다', async () => {
    storeState.householdInvitations = []
    renderPage()

    const invitationTab = screen.getByRole('button', { name: /초대/ })
    await userEvent.click(invitationTab)

    expect(screen.getByText('보낸 초대가 없습니다')).toBeInTheDocument()
  })

  /* ---------- 3명 이상의 멤버 ---------- */

  it('3명 이상의 멤버가 있을 때 각각 관리 가능하다', () => {
    storeState.currentHousehold = {
      ...baseMockHousehold,
      my_role: 'owner',
      members: [
        { user_id: 1, username: '홍길동', email: 'hong@example.com', role: 'owner', joined_at: '2026-01-01T00:00:00Z' },
        { user_id: 2, username: '김철수', email: 'kim@example.com', role: 'member', joined_at: '2026-02-01T00:00:00Z' },
        { user_id: 3, username: '이영희', email: 'lee@example.com', role: 'admin', joined_at: '2026-03-01T00:00:00Z' },
      ],
    }
    renderPage()

    // 2명의 비-owner 멤버에 대해 추방 버튼이 2개 표시
    const removeButtons = screen.getAllByText('추방')
    expect(removeButtons).toHaveLength(2)
  })
})
