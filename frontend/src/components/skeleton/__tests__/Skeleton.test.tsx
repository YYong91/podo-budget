import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Skeleton, SkeletonCircle } from '../Skeleton'

describe('Skeleton', () => {
  it('기본 스켈레톤을 렌더한다', () => {
    render(<Skeleton data-testid="sk" />)
    const el = screen.getByTestId('sk')
    expect(el).toBeInTheDocument()
    expect(el.className).toContain('animate-pulse')
  })

  it('className을 병합한다', () => {
    render(<Skeleton className="h-8 w-48" data-testid="sk" />)
    const el = screen.getByTestId('sk')
    expect(el.className).toContain('h-8')
    expect(el.className).toContain('w-48')
  })
})

describe('SkeletonCircle', () => {
  it('원형 스켈레톤을 렌더한다', () => {
    render(<SkeletonCircle className="w-10 h-10" data-testid="sc" />)
    const el = screen.getByTestId('sc')
    expect(el.className).toContain('rounded-full')
  })
})
