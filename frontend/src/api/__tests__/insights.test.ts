/**
 * @file insights.test.ts
 * @description 인사이트 API 단위 테스트
 * insightsApi의 generate 메서드를 테스트한다.
 */

import { describe, it, expect } from 'vitest'
import { insightsApi } from '../insights'
import { mockInsights } from '../../mocks/fixtures'

describe('insightsApi', () => {
  describe('generate', () => {
    it('특정 월의 인사이트를 생성한다', async () => {
      const response = await insightsApi.generate('2024-01')

      expect(response.data).toMatchObject({
        month: '2024-01',
        total: mockInsights.total,
        by_category: mockInsights.by_category,
        insights: mockInsights.insights,
      })
    })

    it('인사이트 응답은 필수 속성을 가지고 있다', async () => {
      const response = await insightsApi.generate('2024-01')

      expect(response.data).toHaveProperty('month')
      expect(response.data).toHaveProperty('total')
      expect(response.data).toHaveProperty('by_category')
      expect(response.data).toHaveProperty('insights')
    })

    it('by_category는 객체 형태로 카테고리별 금액을 반환한다', async () => {
      const response = await insightsApi.generate('2024-01')

      expect(typeof response.data.by_category).toBe('object')
      expect(response.data.by_category).not.toBeNull()
    })

    it('insights는 문자열 형태의 AI 분석 결과를 반환한다', async () => {
      const response = await insightsApi.generate('2024-01')

      expect(typeof response.data.insights).toBe('string')
      expect(response.data.insights.length).toBeGreaterThan(0)
    })
  })
})
