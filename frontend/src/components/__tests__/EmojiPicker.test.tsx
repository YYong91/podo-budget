import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import EmojiPicker from '../EmojiPicker'

describe('EmojiPicker', () => {
  it('현재 이모지를 버튼으로 렌더링한다', () => {
    render(<EmojiPicker value="🍔" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: '이모지 선택' })).toHaveTextContent('🍔')
  })

  it('버튼 클릭 시 이모지 그리드가 열린다', () => {
    render(<EmojiPicker value="📌" onChange={vi.fn()} />)
    expect(screen.queryByRole('button', { name: '🍔' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '이모지 선택' }))
    expect(screen.getByRole('button', { name: '🍔' })).toBeInTheDocument()
  })

  it('이모지 선택 시 onChange가 호출되고 피커가 닫힌다', () => {
    const onChange = vi.fn()
    render(<EmojiPicker value="📌" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: '이모지 선택' }))
    fireEvent.click(screen.getByRole('button', { name: '🍔' }))

    expect(onChange).toHaveBeenCalledWith('🍔')
    expect(screen.queryByRole('button', { name: '🍔' })).not.toBeInTheDocument()
  })

  it('외부 클릭 시 피커가 닫힌다', () => {
    render(
      <div>
        <EmojiPicker value="📌" onChange={vi.fn()} />
        <button>외부 버튼</button>
      </div>
    )

    fireEvent.click(screen.getByRole('button', { name: '이모지 선택' }))
    expect(screen.getByRole('button', { name: '🍔' })).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByRole('button', { name: '외부 버튼' }))
    expect(screen.queryByRole('button', { name: '🍔' })).not.toBeInTheDocument()
  })

  it('버튼을 다시 클릭하면 피커가 닫힌다', () => {
    render(<EmojiPicker value="📌" onChange={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '이모지 선택' }))
    expect(screen.getByRole('button', { name: '🍔' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '이모지 선택' }))
    expect(screen.queryByRole('button', { name: '🍔' })).not.toBeInTheDocument()
  })
})
