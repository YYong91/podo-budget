import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { useQueryClient } from '@tanstack/react-query'
import { renderWithQueryClient, createWrapper } from '../test-utils'

function TestComponent() {
  const queryClient = useQueryClient()
  return <div data-testid="has-client">{queryClient ? 'yes' : 'no'}</div>
}

describe('QueryClient 설정', () => {
  it('QueryClientProvider가 정상 동작한다', () => {
    const { getByTestId } = renderWithQueryClient(<TestComponent />)
    expect(getByTestId('has-client').textContent).toBe('yes')
  })

  it('createWrapper로 감싼 컴포넌트에서 QueryClient에 접근 가능하다', () => {
    const { getByTestId } = render(<TestComponent />, { wrapper: createWrapper() })
    expect(getByTestId('has-client').textContent).toBe('yes')
  })
})
