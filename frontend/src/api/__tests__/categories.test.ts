/**
 * @file categories.test.ts
 * @description 카테고리 API 단위 테스트
 * categoryApi의 모든 메서드를 테스트한다.
 */

import { describe, it, expect } from 'vitest'
import { categoryApi } from '../categories'
import { mockCategories } from '../../mocks/fixtures'

describe('categoryApi', () => {
  describe('getAll', () => {
    it('모든 카테고리 목록을 조회한다', async () => {
      const response = await categoryApi.getAll()
      expect(response.data).toEqual(mockCategories)
      expect(Array.isArray(response.data)).toBe(true)
      expect(response.data.length).toBeGreaterThan(0)
    })

    it('각 카테고리는 필수 속성을 가지고 있다', async () => {
      const response = await categoryApi.getAll()
      response.data.forEach((category) => {
        expect(category).toHaveProperty('id')
        expect(category).toHaveProperty('name')
        expect(category).toHaveProperty('created_at')
      })
    })
  })

  describe('create', () => {
    it('새로운 카테고리를 생성한다', async () => {
      const newCategory = {
        name: '의료',
        description: '병원 및 약국',
      }
      const response = await categoryApi.create(newCategory)

      expect(response.data.name).toBe('의료')
      expect(response.data.description).toBe('병원 및 약국')
      expect(response.data.id).toBeGreaterThan(0)
    })

    it('설명 없이 카테고리를 생성할 수 있다', async () => {
      const newCategory = {
        name: '기타',
      }
      const response = await categoryApi.create(newCategory)

      expect(response.data.name).toBe('기타')
      expect(response.data.id).toBeGreaterThan(0)
    })
  })

  describe('update', () => {
    it('카테고리 이름을 수정한다', async () => {
      const updates = {
        name: '식비 (수정)',
      }
      const response = await categoryApi.update(1, updates)

      expect(response.data.name).toBe('식비 (수정)')
      expect(response.data.id).toBe(1)
    })

    it('카테고리 설명을 수정한다', async () => {
      const updates = {
        description: '새로운 설명',
      }
      const response = await categoryApi.update(1, updates)

      expect(response.data.description).toBe('새로운 설명')
    })

    it('존재하지 않는 카테고리를 수정 시 404 에러를 반환한다', async () => {
      await expect(categoryApi.update(999, { name: '테스트' })).rejects.toThrow()
    })
  })

  describe('delete', () => {
    it('카테고리를 삭제한다', async () => {
      const response = await categoryApi.delete(1)
      expect(response.status).toBe(204)
    })

    it('존재하지 않는 카테고리를 삭제 시 404 에러를 반환한다', async () => {
      await expect(categoryApi.delete(999)).rejects.toThrow()
    })
  })
})
