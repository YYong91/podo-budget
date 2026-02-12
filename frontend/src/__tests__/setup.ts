/**
 * @file setup.ts
 * @description Vitest 글로벌 테스트 설정
 * @testing-library/jest-dom matchers와 MSW 서버 설정을 초기화한다.
 */

import '@testing-library/jest-dom'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from '../mocks/server'

// MSW 서버 설정
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' })
})

afterEach(() => {
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})
