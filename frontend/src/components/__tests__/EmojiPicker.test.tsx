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
    expect(screen.queryByRole('option', { name: '🍔' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '이모지 선택' }))
    expect(screen.getByRole('option', { name: '🍔' })).toBeInTheDocument()
  })

  it('이모지 선택 시 onChange가 호출되고 피커가 닫힌다', () => {
    const onChange = vi.fn()
    render(<EmojiPicker value="📌" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: '이모지 선택' }))
    fireEvent.click(screen.getByRole('option', { name: '🍔' }))

    expect(onChange).toHaveBeenCalledWith('🍔')
    expect(screen.queryByRole('option', { name: '🍔' })).not.toBeInTheDocument()
  })

  it('외부 클릭 시 onChange 미호출 + 피커가 닫힌다', () => {
    const onChange = vi.fn()
    render(
      <div>
        <EmojiPicker value="📌" onChange={onChange} />
        <button>외부 버튼</button>
      </div>
    )

    fireEvent.click(screen.getByRole('button', { name: '이모지 선택' }))
    expect(screen.getByRole('option', { name: '🍔' })).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByRole('button', { name: '외부 버튼' }))
    expect(screen.queryByRole('option', { name: '🍔' })).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('Escape 키로 피커가 닫힌다', () => {
    render(<EmojiPicker value="📌" onChange={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '이모지 선택' }))
    expect(screen.getByRole('option', { name: '🍔' })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('option', { name: '🍔' })).not.toBeInTheDocument()
  })

  it('버튼을 다시 클릭하면 피커가 닫힌다', () => {
    render(<EmojiPicker value="📌" onChange={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '이모지 선택' }))
    expect(screen.getByRole('option', { name: '🍔' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '이모지 선택' }))
    expect(screen.queryByRole('option', { name: '🍔' })).not.toBeInTheDocument()
  })

  it('현재 선택된 이모지에 aria-selected가 표시된다', () => {
    render(<EmojiPicker value="🍔" onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '이모지 선택' }))

    expect(screen.getByRole('option', { name: '🍔' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: '🍕' })).toHaveAttribute('aria-selected', 'false')
  })
})
