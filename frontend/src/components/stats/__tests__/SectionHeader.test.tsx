import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import SectionHeader from '../SectionHeader'

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('SectionHeader', () => {
  it('타이틀과 이모지를 렌더한다', () => {
    wrap(<SectionHeader icon="💰" title="예산 상황" expanded={false} onToggle={vi.fn()} />)
    expect(screen.getByRole('heading', { name: /예산 상황/ })).toBeInTheDocument()
  })

  it('접힌 상태에서 aria-label="펼치기" 버튼을 표시한다', () => {
    wrap(<SectionHeader icon="💰" title="예산 상황" expanded={false} onToggle={vi.fn()} />)
    expect(screen.getByRole('button', { name: '펼치기' })).toBeInTheDocument()
  })

  it('펼친 상태에서 aria-label="접기" 버튼을 표시한다', () => {
    wrap(<SectionHeader icon="💰" title="예산 상황" expanded={true} onToggle={vi.fn()} />)
    expect(screen.getByRole('button', { name: '접기' })).toBeInTheDocument()
  })

  it('헤더 클릭 시 onToggle이 호출된다', async () => {
    const onToggle = vi.fn()
    wrap(<SectionHeader icon="💰" title="예산 상황" expanded={false} onToggle={onToggle} />)
    await userEvent.click(screen.getByRole('button', { name: '펼치기' }))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('collapsible=false이면 토글 버튼이 없다', () => {
    wrap(<SectionHeader icon="💰" title="예산 상황" expanded={false} onToggle={vi.fn()} collapsible={false} />)
    expect(screen.queryByRole('button', { name: /펼치기|접기/ })).toBeNull()
  })

  it('collapsible=false이면 헤더 영역 클릭 시 onToggle이 호출되지 않는다', async () => {
    const onToggle = vi.fn()
    wrap(<SectionHeader icon="💰" title="예산 상황" expanded={false} onToggle={onToggle} collapsible={false} />)
    await userEvent.click(screen.getByRole('heading', { name: /예산 상황/ }))
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('manageTo가 있으면 관리 링크를 표시한다', () => {
    wrap(<SectionHeader icon="💰" title="예산 상황" expanded={false} onToggle={vi.fn()} manageTo="/budgets" />)
    expect(screen.getByRole('link', { name: '관리' })).toHaveAttribute('href', '/budgets')
  })

  it('관리 링크 클릭 시 onToggle이 호출되지 않는다', async () => {
    const onToggle = vi.fn()
    wrap(<SectionHeader icon="💰" title="예산 상황" expanded={false} onToggle={onToggle} manageTo="/budgets" />)
    await userEvent.click(screen.getByRole('link', { name: '관리' }))
    expect(onToggle).not.toHaveBeenCalled()
  })
})
