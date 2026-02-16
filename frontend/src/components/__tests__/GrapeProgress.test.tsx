import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import GrapeProgress from '../GrapeProgress'

describe('GrapeProgress', () => {
  it('거래 0건일 때 첫 거래 안내 메시지를 표시한다', () => {
    render(<GrapeProgress count={0} />)
    expect(screen.getByText(/첫 번째 거래를 기록하고/)).toBeInTheDocument()
  })

  it('포도알 진행 상태를 표시한다 (7/10)', () => {
    render(<GrapeProgress count={7} />)
    expect(screen.getByText('7/10')).toBeInTheDocument()
    expect(screen.getByText(/포도송이까지 3개 남았어요/)).toBeInTheDocument()
  })

  it('포도송이 완성 시 축하 메시지를 표시한다', () => {
    render(<GrapeProgress count={10} />)
    expect(screen.getByText(/포도송이 1개 완성/)).toBeInTheDocument()
  })

  it('여러 송이 + 잔여 포도알을 표시한다', () => {
    render(<GrapeProgress count={23} />)
    expect(screen.getByText(/×2 \+ 3\/10/)).toBeInTheDocument()
  })

  it('제목을 표시한다', () => {
    render(<GrapeProgress count={5} />)
    expect(screen.getByText('이번 달 포도알')).toBeInTheDocument()
  })
})
