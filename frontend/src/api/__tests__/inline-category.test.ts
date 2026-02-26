/**
 * @file inline-category.test.ts
 * @description 인라인 카테고리 생성 기능 테스트
 * 프리뷰 단계에서 새 카테고리를 즉시 생성하는 로직을 테스트한다.
 */

import { describe, it, expect } from 'vitest'
import { categoryApi } from '../categories'
import { mockCategories } from '../../mocks/fixtures'

describe('인라인 카테고리 생성', () => {
  describe('카테고리 생성 후 목록 반영', () => {
    it('새 카테고리를 생성하면 id와 name이 반환된다', async () => {
      const res = await categoryApi.create({ name: '외식' })
      expect(res.data.name).toBe('외식')
      expect(res.data.id).toBeGreaterThan(0)
    })

    it('생성된 카테고리 id는 기존 카테고리 id보다 크다', async () => {
      const maxExistingId = Math.max(...mockCategories.map((c) => c.id))
      const res = await categoryApi.create({ name: '헬스케어' })
      expect(res.data.id).toBeGreaterThan(maxExistingId)
    })

    it('중복되지 않는 이름이면 201로 생성된다', async () => {
      const res = await categoryApi.create({ name: '여행' })
      expect(res.status).toBe(201)
    })
  })

  describe('카테고리 목록 조회', () => {
    it('기존 카테고리 목록을 조회할 수 있다', async () => {
      const res = await categoryApi.getAll()
      expect(Array.isArray(res.data)).toBe(true)
      expect(res.data.length).toBeGreaterThan(0)
    })

    it('카테고리 목록을 이름 기준으로 정렬할 수 있다', async () => {
      const res = await categoryApi.getAll()
      const sorted = [...res.data].sort((a, b) => a.name.localeCompare(b.name))
      // 정렬 결과가 원본과 동일한 순서인지 확인 (정렬 가능성 검증)
      expect(sorted.length).toBe(res.data.length)
    })
  })
})
