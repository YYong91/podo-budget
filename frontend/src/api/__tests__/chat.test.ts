/**
 * @file chat.test.ts
 * @description 자연어 채팅 API 단위 테스트
 */

import { describe, it, expect } from 'vitest'
import { chatApi } from '../chat'
import { mockChatResponse } from '../../mocks/fixtures'

describe('chatApi', () => {
  describe('sendMessage', () => {
    it('자연어 메시지를 전송하여 지출을 저장한다', async () => {
      const response = await chatApi.sendMessage('오늘 점심에 김치찌개 8000원 먹었어', 1)
      expect(response.data.message).toBe(mockChatResponse.message)
      expect(response.data.expenses_created).toHaveLength(1)
      expect(response.data.expenses_created![0].amount).toBe(8000)
    })

    it('preview 모드에서 파싱 결과만 반환한다', async () => {
      const response = await chatApi.sendMessage('점심 8000원', 1, true)
      expect(response.data.expenses_created).toBeNull()
      expect(response.data.parsed_items).toBeDefined()
      expect(response.data.parsed_items!.length).toBeGreaterThan(0)
    })

    it('householdId를 포함하여 전송한다', async () => {
      const response = await chatApi.sendMessage('점심 8000원', 1)
      expect(response.data.message).toBeDefined()
    })

    it('preview와 householdId를 함께 전송한다', async () => {
      const response = await chatApi.sendMessage('점심 8000원', 1, true)
      expect(response.data.parsed_items).toBeDefined()
    })
  })
})
