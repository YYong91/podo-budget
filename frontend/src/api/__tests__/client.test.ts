/**
 * @file client.test.ts
 * @description API 클라이언트 에러 인터셉터 테스트
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// toast 모킹
const mockToastError = vi.fn()
vi.mock('react-hot-toast', () => ({
  default: { error: (msg: string) => mockToastError(msg) },
}))

// sentry 모킹
vi.mock('../../utils/sentry', () => ({
  captureException: vi.fn(),
}))

describe('API client error interceptor', () => {
  beforeEach(() => {
    mockToastError.mockClear()
  })

  it('4xx 에러 시 글로벌 toast가 표시된다', async () => {
    const { default: apiClient } = await import('../client')

    // response interceptor의 reject 핸들러 추출
    const handler = (apiClient.interceptors.response as unknown as { handlers: Array<{ rejected: (e: unknown) => Promise<unknown> }> }).handlers.find(
      (h) => h.rejected
    )

    const error = {
      response: { status: 400, data: { detail: '잘못된 요청입니다' } },
    }

    try {
      await handler!.rejected(error)
    } catch {
      // reject은 에러를 다시 던짐
    }

    expect(mockToastError).toHaveBeenCalledWith('잘못된 요청입니다')
  })

  it('401 에러 시 toast가 표시되지 않는다', async () => {
    const { default: apiClient } = await import('../client')

    const handler = (apiClient.interceptors.response as unknown as { handlers: Array<{ rejected: (e: unknown) => Promise<unknown> }> }).handlers.find(
      (h) => h.rejected
    )

    const error = {
      response: { status: 401, data: { detail: 'Unauthorized' } },
    }

    try {
      await handler!.rejected(error)
    } catch {
      // expected
    }

    expect(mockToastError).not.toHaveBeenCalled()
  })

  it('detail이 문자열이 아니면 기본 메시지를 표시한다', async () => {
    const { default: apiClient } = await import('../client')

    const handler = (apiClient.interceptors.response as unknown as { handlers: Array<{ rejected: (e: unknown) => Promise<unknown> }> }).handlers.find(
      (h) => h.rejected
    )

    const error = {
      response: { status: 422, data: { detail: [{ loc: ['body', 'amount'], msg: 'value is not valid' }] } },
    }

    try {
      await handler!.rejected(error)
    } catch {
      // expected
    }

    expect(mockToastError).toHaveBeenCalledWith('요청 처리 중 오류가 발생했습니다')
  })

  it('네트워크 에러(status 없음) 시 toast가 표시된다', async () => {
    const { default: apiClient } = await import('../client')

    const handler = (apiClient.interceptors.response as unknown as { handlers: Array<{ rejected: (e: unknown) => Promise<unknown> }> }).handlers.find(
      (h) => h.rejected
    )

    const error = { response: undefined }

    try {
      await handler!.rejected(error)
    } catch {
      // expected
    }

    expect(mockToastError).toHaveBeenCalledWith('요청 처리 중 오류가 발생했습니다')
  })
})
