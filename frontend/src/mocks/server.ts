/**
 * @file server.ts
 * @description MSW 서버 설정
 * Node.js 환경(테스트)에서 사용할 MSW 서버 인스턴스를 생성한다.
 */

import { setupServer } from 'msw/node'
import { handlers } from './handlers'

/**
 * MSW 서버 인스턴스
 * Vitest 테스트 환경에서 API 요청을 가로채고 모의 응답을 반환한다.
 */
export const server = setupServer(...handlers)
