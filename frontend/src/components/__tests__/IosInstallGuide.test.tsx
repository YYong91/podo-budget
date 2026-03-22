import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import IosInstallGuide from '../IosInstallGuide'

describe('IosInstallGuide', () => {
  it('3단계 안내를 표시한다', () => {
    render(<IosInstallGuide onClose={vi.fn()} />)
    expect(screen.getAllByText(/공유 버튼/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/홈 화면에 추가/).length).toBeGreaterThan(0)
  })

  it('확인 버튼 클릭 시 onClose 호출', () => {
    const onClose = vi.fn()
    render(<IosInstallGuide onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('배경 딤 클릭 시 onClose 호출', () => {
    const onClose = vi.fn()
    render(<IosInstallGuide onClose={onClose} />)
    fireEvent.click(screen.getByTestId('ios-guide-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Escape 키로 모달을 닫는다', () => {
    const onClose = vi.fn()
    render(<IosInstallGuide onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('role=dialog, aria-modal 속성이 있다', () => {
    render(<IosInstallGuide onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-label', 'iOS 설치 안내')
  })
})
