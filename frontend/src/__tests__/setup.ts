/**
 * @file setup.ts
 * @description Vitest 글로벌 테스트 설정
 * @testing-library/jest-dom matchers와 MSW 서버 설정을 초기화한다.
 */

import '@testing-library/jest-dom'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from '../mocks/server'

// jsdom에 window.matchMedia가 없으므로 polyfill
if (typeof window.matchMedia === 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

// CI 환경(Node.js)에서 ProgressEvent가 없는 경우 polyfill (MSW + jsdom 호환)
if (typeof globalThis.ProgressEvent === 'undefined') {
  globalThis.ProgressEvent = class ProgressEvent extends Event {
    readonly lengthComputable: boolean
    readonly loaded: number
    readonly total: number
    constructor(type: string, init?: ProgressEventInit) {
      super(type, init)
      this.lengthComputable = init?.lengthComputable ?? false
      this.loaded = init?.loaded ?? 0
      this.total = init?.total ?? 0
    }
  } as typeof globalThis.ProgressEvent
}

// MSW 서버 설정
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' })
})

afterEach(() => {
  server.resetHandlers()
  sessionStorage.clear()
})

afterAll(() => {
  server.close()
})
