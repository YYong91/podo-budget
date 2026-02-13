/**
 * @file chat.ts
 * @description 자연어 입력 처리 API
 * LLM을 통해 자연어로 입력된 지출을 파싱하여 저장한다.
 */

import apiClient from './client'
import type { ChatResponse } from '../types'

export const chatApi = {
  /**
   * 자연어 메시지를 전송하여 지출을 자동으로 파싱하고 저장
   * @param message - 사용자가 입력한 자연어 메시지 (예: "오늘 점심에 김치찌개 8000원 먹었어")
   * @returns LLM 응답 및 생성된 지출 내역
   */
  sendMessage: (message: string, householdId?: number) =>
    apiClient.post<ChatResponse>('/chat', {
      message,
      ...(householdId != null && { household_id: householdId }),
    }),
}
