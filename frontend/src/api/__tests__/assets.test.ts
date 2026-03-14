/**
 * @file assets.test.ts
 * @description 자산 관리 API 단위 테스트
 */

import { describe, it, expect } from 'vitest'
import { assetApi } from '../assets'
import {
  mockAssets,
  mockAssetSummary,
  mockAssetSnapshots,
  mockAssetGoal,
  mockMonthlySavings,
} from '../../mocks/fixtures'

describe('assetApi', () => {
  describe('getAll', () => {
    it('모든 자산 목록을 조회한다', async () => {
      const response = await assetApi.getAll()
      expect(response.data).toEqual(mockAssets)
      expect(Array.isArray(response.data)).toBe(true)
    })
  })

  describe('getById', () => {
    it('ID로 단일 자산을 조회한다', async () => {
      const response = await assetApi.getById(1)
      expect(response.data).toEqual(mockAssets[0])
    })

    it('존재하지 않는 ID로 조회 시 에러를 반환한다', async () => {
      await expect(assetApi.getById(999)).rejects.toThrow()
    })
  })

  describe('create', () => {
    it('새로운 자산을 생성한다', async () => {
      const newAsset = {
        name: '카카오',
        type: 'stock_kr',
        purchase_price: 50000,
        current_price: 55000,
      }
      const response = await assetApi.create(newAsset)
      expect(response.data).toMatchObject({ name: '카카오', type: 'stock_kr' })
      expect(response.data.id).toBeDefined()
    })
  })

  describe('update', () => {
    it('자산을 수정한다', async () => {
      const response = await assetApi.update(1, { name: '삼성전자 수정' })
      expect(response.data.name).toBe('삼성전자 수정')
    })

    it('존재하지 않는 ID로 수정 시 에러를 반환한다', async () => {
      await expect(assetApi.update(999, { name: 'x' })).rejects.toThrow()
    })
  })

  describe('delete', () => {
    it('자산을 삭제한다', async () => {
      const response = await assetApi.delete(1)
      expect(response.status).toBe(204)
    })

    it('존재하지 않는 ID로 삭제 시 에러를 반환한다', async () => {
      await expect(assetApi.delete(999)).rejects.toThrow()
    })
  })

  describe('getSummary', () => {
    it('자산 요약을 조회한다', async () => {
      const response = await assetApi.getSummary()
      expect(response.data).toEqual(mockAssetSummary)
      expect(response.data.net_worth).toBeDefined()
    })
  })

  describe('getSnapshots', () => {
    it('자산 스냅샷을 조회한다', async () => {
      const response = await assetApi.getSnapshots()
      expect(response.data).toEqual(mockAssetSnapshots)
      expect(Array.isArray(response.data)).toBe(true)
    })
  })

  describe('search', () => {
    it('자산을 검색한다', async () => {
      const response = await assetApi.search('삼성')
      expect(Array.isArray(response.data)).toBe(true)
    })
  })

  describe('parse', () => {
    it('자연어로 자산을 파싱한다', async () => {
      const response = await assetApi.parse('비상금 통장 100만원')
      expect(response.data.items).toBeDefined()
      expect(response.data.items.length).toBeGreaterThan(0)
    })
  })

  describe('goal', () => {
    it('자산 목표를 조회한다', async () => {
      const response = await assetApi.getGoal()
      expect(response.data).toEqual(mockAssetGoal)
      expect(response.data!.target_net_worth).toBeDefined()
    })

    it('자산 목표를 설정한다', async () => {
      const response = await assetApi.setGoal({
        target_net_worth: 200000000,
        target_date: '2028-12-31',
      })
      expect(response.data.target_net_worth).toBe(200000000)
    })

    it('자산 목표를 삭제한다', async () => {
      const response = await assetApi.deleteGoal()
      expect(response.status).toBe(204)
    })
  })

  describe('getMonthlySavings', () => {
    it('월별 저축 추이를 조회한다', async () => {
      const response = await assetApi.getMonthlySavings()
      expect(response.data).toEqual(mockMonthlySavings)
      expect(Array.isArray(response.data)).toBe(true)
    })
  })
})
