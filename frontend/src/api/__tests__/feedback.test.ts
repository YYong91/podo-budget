/**
 * @file feedback.test.ts
 * @description 피드백 API 단위 테스트
 */

import { describe, it, expect } from 'vitest'
import { feedbackApi } from '../feedback'
import { mockFeedbacks } from '../../mocks/fixtures'

describe('feedbackApi', () => {
  describe('create', () => {
    it('피드백을 제출한다', async () => {
      const response = await feedbackApi.create({
        type: 'feature',
        title: '다크모드',
        content: '다크모드 추가 부탁드립니다',
      })
      expect(response.data).toMatchObject({
        type: 'feature',
        title: '다크모드',
        content: '다크모드 추가 부탁드립니다',
        status: 'new',
      })
      expect(response.data.id).toBeDefined()
    })

    it('버그 신고를 제출한다', async () => {
      const response = await feedbackApi.create({
        type: 'bug',
        title: '버그 발견',
        content: '특정 상황에서 에러가 발생합니다',
      })
      expect(response.data.type).toBe('bug')
    })
  })

  describe('getMine', () => {
    it('내 피드백 목록을 조회한다', async () => {
      const response = await feedbackApi.getMine()
      expect(response.data).toEqual(mockFeedbacks)
      expect(Array.isArray(response.data)).toBe(true)
    })
  })

  describe('getAll', () => {
    it('전체 피드백 목록을 조회한다 (관리자)', async () => {
      const response = await feedbackApi.getAll()
      expect(response.data).toEqual(mockFeedbacks)
      expect(Array.isArray(response.data)).toBe(true)
    })
  })

  describe('updateStatus', () => {
    it('피드백 상태를 변경한다', async () => {
      const response = await feedbackApi.updateStatus(1, 'done')
      expect(response.data.status).toBe('done')
    })
  })
})
