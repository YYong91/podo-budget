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
const mockCaptureException = vi.fn()
vi.mock('../../utils/sentry', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}))

/** 인터셉터 reject 핸들러를 추출하는 헬퍼 */
async function getRejectHandler() {
  const { default: apiClient } = await import('../client')
  const handler = (apiClient.interceptors.response as unknown as {
    handlers: Array<{ rejected: (e: unknown) => Promise<unknown> }>
  }).handlers.find((h) => h.rejected)
  return handler!.rejected
}

describe('API client error interceptor', () => {
  beforeEach(() => {
    mockToastError.mockClear()
    mockCaptureException.mockClear()
  })

  it('4xx 에러 시 글로벌 toast가 표시된다', async () => {
    const reject = await getRejectHandler()
    const error = {
      response: { status: 400, data: { detail: '잘못된 요청입니다' } },
    }

    try {
      await reject(error)
    } catch {
      // reject은 에러를 다시 던짐
    }

    expect(mockToastError).toHaveBeenCalledWith('잘못된 요청입니다')
  })

  it('401 에러 시 toast가 표시되지 않는다', async () => {
    const reject = await getRejectHandler()
    const error = {
      response: { status: 401, data: { detail: 'Unauthorized' } },
    }

    try {
      await reject(error)
    } catch {
      // expected
    }

    expect(mockToastError).not.toHaveBeenCalled()
  })

  it('detail이 문자열이 아니면 기본 메시지를 표시한다', async () => {
    const reject = await getRejectHandler()
    const error = {
      response: { status: 422, data: { detail: [{ loc: ['body', 'amount'], msg: 'value is not valid' }] } },
    }

    try {
      await reject(error)
    } catch {
      // expected
    }

    expect(mockToastError).toHaveBeenCalledWith('요청 처리 중 오류가 발생했습니다')
  })

  it('네트워크 에러(status 없음) 시 toast가 표시된다', async () => {
    const reject = await getRejectHandler()
    const error = { response: undefined }

    try {
      await reject(error)
    } catch {
      // expected
    }

    expect(mockToastError).toHaveBeenCalledWith('요청 처리 중 오류가 발생했습니다')
  })

  it('5xx 에러 시 Sentry에 보고한다', async () => {
    const reject = await getRejectHandler()
    const error = {
      response: { status: 500, data: { detail: '서버 에러' } },
    }

    try {
      await reject(error)
    } catch {
      // expected
    }

    expect(mockCaptureException).toHaveBeenCalledWith(error)
    expect(mockToastError).toHaveBeenCalledWith('서버 에러')
  })

  it('네트워크 에러(status 없음) 시 Sentry에 보고한다', async () => {
    const reject = await getRejectHandler()
    const error = { response: undefined }

    try {
      await reject(error)
    } catch {
      // expected
    }

    expect(mockCaptureException).toHaveBeenCalledWith(error)
  })

  it('4xx 에러 시 Sentry에 보고하지 않는다', async () => {
    const reject = await getRejectHandler()
    const error = {
      response: { status: 400, data: { detail: '잘못된 요청' } },
    }

    try {
      await reject(error)
    } catch {
      // expected
    }

    expect(mockCaptureException).not.toHaveBeenCalled()
  })

  it('409 에러 시 재시도 로직이 실행된다 (toast 미표시)', async () => {
    const reject = await getRejectHandler()
    // 409 에러에 config가 없는 경우 — retryOn409에서 Promise.reject
    const error = {
      response: { status: 409, data: { detail: 'Conflict' } },
      config: undefined,
    }

    try {
      await reject(error)
    } catch {
      // expected — config 없으면 그냥 reject
    }

    // 409는 retryOn409로 위임되므로 toast.error가 호출되지 않아야 함
    expect(mockToastError).not.toHaveBeenCalled()
  })

  it('response.data.detail이 없을 때 기본 메시지를 사용한다', async () => {
    const reject = await getRejectHandler()
    const error = {
      response: { status: 403, data: {} },
    }

    try {
      await reject(error)
    } catch {
      // expected
    }

    expect(mockToastError).toHaveBeenCalledWith('요청 처리 중 오류가 발생했습니다')
  })

  it('409 에러 시 toast가 표시되지 않고 재시도 로직으로 전달된다', async () => {
    const { default: apiClient } = await import('../client')

    const handler = (apiClient.interceptors.response as unknown as { handlers: Array<{ rejected: (e: unknown) => Promise<unknown> }> }).handlers.find(
      (h) => h.rejected
    )

    const error = {
      response: { status: 409, data: { detail: 'Conflict' } },
      config: undefined, // config 없으면 retryOn409에서 reject
    }

    try {
      await handler!.rejected(error)
    } catch {
      // expected
    }

    // 409는 toast를 표시하지 않고 retryOn409로 넘김
    expect(mockToastError).not.toHaveBeenCalled()
  })
})
