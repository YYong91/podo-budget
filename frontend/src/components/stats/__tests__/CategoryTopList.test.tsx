import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import CategoryTopList from '../CategoryTopList'

describe('CategoryTopList', () => {
  const mockCategories = [
    { category: '식비', amount: 1200000, count: 45, percentage: 37.5 },
    { category: '주거', amount: 800000, count: 1, percentage: 25.0 },
    { category: '교통', amount: 400000, count: 20, percentage: 12.5 },
    { category: '쇼핑', amount: 300000, count: 8, percentage: 9.4 },
    { category: '통신', amount: 200000, count: 3, percentage: 6.3 },
    { category: '기타', amount: 100000, count: 5, percentage: 3.1 },
  ]

  it('상위 5개 카테고리를 표시한다', () => {
    render(<MemoryRouter><CategoryTopList categories={mockCategories} /></MemoryRouter>)
    expect(screen.getByText('식비')).toBeInTheDocument()
    expect(screen.getByText('주거')).toBeInTheDocument()
    expect(screen.getByText('교통')).toBeInTheDocument()
    expect(screen.getByText('쇼핑')).toBeInTheDocument()
    expect(screen.getByText('통신')).toBeInTheDocument()
    // 6번째는 표시 안 됨
    expect(screen.queryByText('기타')).not.toBeInTheDocument()
  })

  it('빈 배열이면 null을 반환한다', () => {
    const { container } = render(<MemoryRouter><CategoryTopList categories={[]} /></MemoryRouter>)
    expect(container.firstChild).toBeNull()
  })

  it('비율을 퍼센트로 표시한다', () => {
    render(<MemoryRouter><CategoryTopList categories={mockCategories} /></MemoryRouter>)
    expect(screen.getByText('37.5%')).toBeInTheDocument()
  })

  it('6개 이상일 때 더보기 버튼을 표시한다', () => {
    render(<MemoryRouter><CategoryTopList categories={mockCategories} /></MemoryRouter>)
    expect(screen.getByText(/더보기/)).toBeInTheDocument()
  })

  it('더보기 클릭 시 전체 목록을 표시한다', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><CategoryTopList categories={mockCategories} /></MemoryRouter>)

    await user.click(screen.getByText(/더보기/))
    expect(screen.getByText('기타')).toBeInTheDocument()
    expect(screen.getByText(/접기/)).toBeInTheDocument()
  })

  it('5개 이하이면 더보기 버튼이 없다', () => {
    render(<MemoryRouter><CategoryTopList categories={mockCategories.slice(0, 5)} /></MemoryRouter>)
    expect(screen.queryByText(/더보기/)).not.toBeInTheDocument()
  })

  it('카테고리 클릭 시 해당 카테고리 필터 목록으로 이동한다', () => {
    render(<MemoryRouter><CategoryTopList categories={mockCategories} monthStr="2026-03" /></MemoryRouter>)
    const link = screen.getByText('식비').closest('a')
    expect(link).toHaveAttribute('href', '/?month=2026-03&category=식비')
  })
})
