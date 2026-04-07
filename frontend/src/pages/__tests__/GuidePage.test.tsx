/**
 * @file GuidePage.test.tsx
 * @description 사용 가이드 페이지 테스트
 * 목차, 섹션 카드, 뒤로가기 버튼을 테스트한다.
 * FEATURES.assets 플래그에 따라 자산 관리 섹션 노출 여부도 검증한다.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import GuidePage from '../GuidePage'

// useNavigate 모킹 (useGoBack 내부에서 사용)
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => vi.fn(),
}))

function renderPage() {
  return render(
    <MemoryRouter>
      <GuidePage />
    </MemoryRouter>,
  )
}

describe('GuidePage', () => {
  describe('목차', () => {
    it('목차를 표시한다', () => {
      renderPage()
      expect(screen.getByText('목차')).toBeInTheDocument()
    })

    it('기본 섹션 링크를 목차에 표시한다', () => {
      renderPage()
      // 목차 링크와 섹션 제목이 각각 존재하므로 getAllByText 사용
      expect(screen.getAllByText('간편 입력 (자연어 AI 파싱)').length).toBeGreaterThanOrEqual(2)
      expect(screen.getAllByText('가계부 (지출/수입 관리)').length).toBeGreaterThanOrEqual(2)
      expect(screen.getAllByText('정기 거래').length).toBeGreaterThanOrEqual(2)
      expect(screen.getAllByText('예산 관리').length).toBeGreaterThanOrEqual(2)
      expect(screen.getAllByText('카테고리 관리').length).toBeGreaterThanOrEqual(2)
      expect(screen.getAllByText('리포트 (이달의 리포트)').length).toBeGreaterThanOrEqual(2)
      // 공유 가계부 — 목차에서는 "공유 가계부", 섹션에서는 "공유 가계부 (가구/초대)"
      expect(screen.getByText('공유 가계부')).toBeInTheDocument()
      expect(screen.getAllByText('텔레그램 봇 연동').length).toBeGreaterThanOrEqual(2)
      expect(screen.getAllByText('카카오톡 봇 연동').length).toBeGreaterThanOrEqual(2)
      expect(screen.getAllByText('팁과 단축키').length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('자산 관리 섹션 (FEATURES.assets 플래그)', () => {
    it('FEATURES.assets=false(기본값) 이면 자산 관리 섹션이 표시되지 않는다', () => {
      // VITE_FEATURE_ASSETS 환경변수가 설정되지 않으면 assets=false
      // vi.mock은 모듈 최상단에서만 사용 가능하므로,
      // 테스트 환경에서 import.meta.env.VITE_FEATURE_ASSETS가 undefined → false
      renderPage()
      expect(screen.queryByText('자산 관리')).not.toBeInTheDocument()
    })
  })

  describe('섹션 카드', () => {
    it('간편 입력 섹션을 렌더링한다', () => {
      renderPage()
      // 섹션 타이틀 (목차 링크 텍스트와 별도로 h2 내부에 존재)
      const headings = screen.getAllByRole('heading', { level: 2 })
      const naturalInputHeading = headings.find(h => h.textContent === '간편 입력 (자연어 AI 파싱)')
      expect(naturalInputHeading).toBeInTheDocument()
    })

    it('예시 박스를 표시한다', () => {
      renderPage()
      // 자연어 입력 예시
      expect(screen.getByText(/오늘 점심 김치찌개 8000원/)).toBeInTheDocument()
    })

    it('텔레그램 봇 주소를 표시한다', () => {
      renderPage()
      expect(screen.getByText('@homenrich_bot')).toBeInTheDocument()
    })

    it('카카오톡 채널 정보를 표시한다', () => {
      renderPage()
      expect(screen.getByText('포도가계부')).toBeInTheDocument()
    })

    it('팁과 단축키 섹션을 렌더링한다', () => {
      renderPage()
      expect(screen.getByText('홈 화면에 추가하기 (PWA)')).toBeInTheDocument()
      expect(screen.getByText('가계부가 첫 화면')).toBeInTheDocument()
    })
  })

  describe('뒤로가기', () => {
    it('뒤로가기 버튼을 표시한다', () => {
      renderPage()
      // ArrowLeft 아이콘이 있는 버튼
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })
  })
})
