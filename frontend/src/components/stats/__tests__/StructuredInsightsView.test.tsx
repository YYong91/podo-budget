import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StructuredInsightsView from '../StructuredInsightsView'
import type { StructuredInsights } from '../../../types'

describe('StructuredInsightsView', () => {
  const mockInsights: StructuredInsights = {
    findings: [
      {
        what: '식비가 전체 지출의 37.5%를 차지합니다',
        so_what: '전국 평균 대비 높은 수준입니다',
        now_what: '주 2회 도시락을 준비해보세요',
      },
    ],
    asset_analysis: {
      summary: '순자산 8,500만원',
      allocation_analysis: '예적금 비중이 높습니다',
      diversification_tip: '장기적으로 분산 투자를 고려하세요',
    },
    action_items: [{ title: '식비 예산 설정', description: '월 100만원 이내로 관리해보세요' }],
    encouragement: '저축률 36%는 매우 우수합니다!',
  }

  it('핵심 발견을 What/So What/Now What으로 표시한다', () => {
    render(<StructuredInsightsView insights={mockInsights} />)
    expect(screen.getByText(/식비가 전체 지출의/)).toBeInTheDocument()
    expect(screen.getByText(/전국 평균/)).toBeInTheDocument()
    expect(screen.getByText(/도시락/)).toBeInTheDocument()
  })

  it('FEATURES.assets가 false이면 자산 분석 섹션을 숨긴다', () => {
    // FEATURES.assets 기본값이 false이므로 자산 분석 섹션이 렌더링되지 않음
    render(<StructuredInsightsView insights={mockInsights} />)
    expect(screen.queryByText('자산 분석')).not.toBeInTheDocument()
    expect(screen.queryByText(/분산 투자/)).not.toBeInTheDocument()
  })

  it('액션 아이템을 표시한다', () => {
    render(<StructuredInsightsView insights={mockInsights} />)
    expect(screen.getByText('식비 예산 설정')).toBeInTheDocument()
  })

  it('격려 메시지를 표시한다', () => {
    render(<StructuredInsightsView insights={mockInsights} />)
    expect(screen.getByText(/저축률 36%/)).toBeInTheDocument()
  })

  it('참고 사항을 표시한다', () => {
    render(<StructuredInsightsView insights={mockInsights} />)
    expect(screen.getByText(/투자 자문이 아닙니다/)).toBeInTheDocument()
  })

  it('asset_analysis가 null이면 자산 분석 섹션을 숨긴다', () => {
    const noAsset = { ...mockInsights, asset_analysis: null }
    render(<StructuredInsightsView insights={noAsset} />)
    expect(screen.queryByText('자산 분석')).not.toBeInTheDocument()
  })
})
