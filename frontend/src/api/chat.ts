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
   * @param message - 사용자가 입력한 자연어 메시지
   * @param householdId - 가구 ID (선택)
   * @param preview - true이면 파싱 결과만 반환 (저장하지 않음)
   */
  /** LLM 호출이 포함되므로 30초 타임아웃 적용 */
  sendMessage: (message: string, householdId?: number, preview?: boolean) =>
    apiClient.post<ChatResponse>(
      '/chat',
      {
        message,
        ...(householdId != null && { household_id: householdId }),
        ...(preview != null && { preview }),
      },
      { timeout: 30000 },
    ),
}
