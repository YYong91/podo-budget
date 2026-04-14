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

  /** 리스트 뷰 탭으로 전환하는 헬퍼 */
  async function switchToListView() {
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '리스트 보기' }))
    return user
  }

  it('기본 뷰는 그래프 모드이다', () => {
    render(<MemoryRouter><CategoryTopList categories={mockCategories} /></MemoryRouter>)
    // 그래프 모드에서는 범례에 카테고리가 표시됨
    expect(screen.getByText('식비')).toBeInTheDocument()
    // 리스트 모드의 더보기 버튼은 없어야 함
    expect(screen.queryByText(/더보기/)).not.toBeInTheDocument()
  })

  it('리스트 뷰에서 상위 5개 카테고리를 표시한다', async () => {
    render(<MemoryRouter><CategoryTopList categories={mockCategories} /></MemoryRouter>)
    await switchToListView()
    expect(screen.getByText('식비')).toBeInTheDocument()
    expect(screen.getByText('주거')).toBeInTheDocument()
    expect(screen.getByText('교통')).toBeInTheDocument()
    expect(screen.getByText('쇼핑')).toBeInTheDocument()
    expect(screen.getByText('통신')).toBeInTheDocument()
  })

  it('빈 배열이면 null을 반환한다', () => {
    const { container } = render(<MemoryRouter><CategoryTopList categories={[]} /></MemoryRouter>)
    expect(container.firstChild).toBeNull()
  })

  it('리스트 뷰에서 비율을 퍼센트로 표시한다', async () => {
    render(<MemoryRouter><CategoryTopList categories={mockCategories} /></MemoryRouter>)
    await switchToListView()
    expect(screen.getByText('37.5%')).toBeInTheDocument()
  })

  it('리스트 뷰에서 6개 이상일 때 더보기 버튼을 표시한다', async () => {
    render(<MemoryRouter><CategoryTopList categories={mockCategories} /></MemoryRouter>)
    await switchToListView()
    expect(screen.getByText(/더보기/)).toBeInTheDocument()
  })

  it('리스트 뷰에서 더보기 클릭 시 전체 목록을 표시한다', async () => {
    render(<MemoryRouter><CategoryTopList categories={mockCategories} /></MemoryRouter>)
    const user = await switchToListView()

    await user.click(screen.getByText(/더보기/))
    expect(screen.getByText('기타')).toBeInTheDocument()
    expect(screen.getByText(/접기/)).toBeInTheDocument()
  })

  it('리스트 뷰에서 5개 이하이면 더보기 버튼이 없다', async () => {
    render(<MemoryRouter><CategoryTopList categories={mockCategories.slice(0, 5)} /></MemoryRouter>)
    await switchToListView()
    expect(screen.queryByText(/더보기/)).not.toBeInTheDocument()
  })

  it('리스트 뷰에서 카테고리 항목은 링크가 아니다', async () => {
    render(<MemoryRouter><CategoryTopList categories={mockCategories} /></MemoryRouter>)
    await switchToListView()
    expect(screen.getByText('식비').closest('a')).toBeNull()
  })

  it('그래프 뷰에서 초기 도넛 중앙 텍스트는 "총 지출"이다', () => {
    render(<MemoryRouter><CategoryTopList categories={mockCategories} /></MemoryRouter>)
    expect(screen.getByText('총 지출')).toBeInTheDocument()
  })

  it('헤더가 text-base 크기로 표시된다', () => {
    render(<MemoryRouter><CategoryTopList categories={mockCategories} /></MemoryRouter>)
    const heading = screen.getByRole('heading', { name: /지출 카테고리/ })
    expect(heading).toHaveClass('text-base')
  })

  it('헤더에 이모지가 포함된다', () => {
    render(<MemoryRouter><CategoryTopList categories={mockCategories} /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: /지출 카테고리/ }).textContent).toMatch(/📋/)
  })

  it('카테고리가 1개일 때 추가 유도 메시지를 표시한다', () => {
    const single = [{ category: '기타', amount: 50000, count: 3, percentage: 100 }]
    render(<MemoryRouter><CategoryTopList categories={single} /></MemoryRouter>)
    expect(screen.getByText(/카테고리를 더 추가하면/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /카테고리 설정/ })).toBeInTheDocument()
  })
})
