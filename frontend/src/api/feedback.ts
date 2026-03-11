/* 피드백 API */

import apiClient from './client'
import type { Feedback, FeedbackCreateRequest, FeedbackStatus } from '../types'

export const feedbackApi = {
  create: (data: FeedbackCreateRequest) =>
    apiClient.post<Feedback>('/feedback', data),

  getMine: () =>
    apiClient.get<Feedback[]>('/feedback/mine'),

  getAll: () =>
    apiClient.get<Feedback[]>('/feedback'),

  updateStatus: (id: number, status: FeedbackStatus) =>
    apiClient.patch<Feedback>(`/feedback/${id}`, { status }),
}
