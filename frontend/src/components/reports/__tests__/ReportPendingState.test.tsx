import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ReportPendingState from '../ReportPendingState'

describe('ReportPendingState', () => {
  it('준비 중 메시지가 표시된다', () => {
    render(<ReportPendingState />)
    expect(screen.getByText(/준비하고 있어요/)).toBeInTheDocument()
  })
})
