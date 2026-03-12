/**
 * @file changelogs.test.ts
 * @description changelog 데이터 무결성 테스트
 */

import { describe, it, expect } from 'vitest'
import { changelogs } from '../changelogs'

describe('changelogs 데이터', () => {
  it('최소 1개 이상의 항목이 존재한다', () => {
    expect(changelogs.length).toBeGreaterThan(0)
  })

  it('최신순으로 정렬되어 있다 (첫 번째 항목이 가장 최신)', () => {
    for (let i = 0; i < changelogs.length - 1; i++) {
      expect(changelogs[i].date >= changelogs[i + 1].date).toBe(true)
    }
  })

  it('모든 항목에 필수 필드가 존재한다', () => {
    changelogs.forEach((log) => {
      expect(log.version).toBeTruthy()
      expect(log.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(log.title).toBeTruthy()
      expect(log.items.length).toBeGreaterThan(0)
    })
  })

  it('모든 아이템의 tag가 유효한 값이다', () => {
    const validTags = ['신규', '개선', '수정']
    changelogs.forEach((log) => {
      log.items.forEach((item) => {
        expect(validTags).toContain(item.tag)
        expect(item.text).toBeTruthy()
      })
    })
  })

  it('버전이 중복되지 않는다', () => {
    const versions = changelogs.map((log) => log.version)
    expect(new Set(versions).size).toBe(versions.length)
  })
})
