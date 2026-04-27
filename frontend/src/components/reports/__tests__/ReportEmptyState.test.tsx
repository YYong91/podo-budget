import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import ReportEmptyState from '../ReportEmptyState'
import type { ReportEligibility } from '../../../types/report'

// useNavigate mock
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => vi.fn(),
}))

const baseEligibility: ReportEligibility = {
  has_profile: true,
  transaction_count: 8,
  transactions_needed: 7,
  category_count: 2,
  total_spend: 80000,
  is_eligible: false,
  blocker: 'transactions_short',
}

describe('ReportEmptyState', () => {
  it('거래 부족 시 15건 이상 안내가 표시된다', () => {
    render(
      <MemoryRouter>
        <ReportEmptyState eligibility={baseEligibility} />
      </MemoryRouter>
    )
    expect(screen.getByText(/15건 이상/)).toBeInTheDocument()
  })

  it('프로필 미완성 시 프로필 완성 안내가 표시된다', () => {
    render(
      <MemoryRouter>
        <ReportEmptyState
          eligibility={{ ...baseEligibility, has_profile: false, blocker: 'profile_missing' }}
        />
      </MemoryRouter>
    )
    // 제목과 설명 및 CTA 모두 "프로필" 포함 — 최소 1개 이상 있으면 통과
    expect(screen.getAllByText(/프로필/).length).toBeGreaterThan(0)
  })

  it('첫 달 가입 시 다음달 안내가 표시된다', () => {
    render(
      <MemoryRouter>
        <ReportEmptyState
          eligibility={{ ...baseEligibility, blocker: 'first_month' }}
        />
      </MemoryRouter>
    )
    expect(screen.getByText(/다음 달/)).toBeInTheDocument()
  })

  it('eligibility null이면 기본 안내 표시', () => {
    render(
      <MemoryRouter>
        <ReportEmptyState eligibility={null} />
      </MemoryRouter>
    )
    // "결산 리포트를 준비 중이에요" 제목 텍스트로 검증
    expect(screen.getByText(/결산 리포트를 준비 중이에요/)).toBeInTheDocument()
  })
})
