/**
 * @file useChangelog.test.ts
 * @description useChangelog 훅 테스트 — localStorage 기반 읽음 상태 관리
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChangelog } from '../useChangelog'
import { changelogs } from '../../data/changelogs'

const STORAGE_KEY = 'podo-changelog-last-seen'

describe('useChangelog', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('localStorage가 비어있으면 hasUnread가 true이다', () => {
    const { result } = renderHook(() => useChangelog())
    expect(result.current.hasUnread).toBe(true)
  })

  it('최신 버전을 이미 봤으면 hasUnread가 false이다', () => {
    localStorage.setItem(STORAGE_KEY, changelogs[0].version)
    const { result } = renderHook(() => useChangelog())
    expect(result.current.hasUnread).toBe(false)
  })

  it('이전 버전을 봤으면 hasUnread가 true이다', () => {
    localStorage.setItem(STORAGE_KEY, '0.0.1')
    const { result } = renderHook(() => useChangelog())
    expect(result.current.hasUnread).toBe(true)
  })

  it('markAsRead 호출 시 hasUnread가 false로 변경된다', () => {
    const { result } = renderHook(() => useChangelog())
    expect(result.current.hasUnread).toBe(true)

    act(() => {
      result.current.markAsRead()
    })

    expect(result.current.hasUnread).toBe(false)
  })

  it('markAsRead 호출 시 localStorage에 최신 버전이 저장된다', () => {
    const { result } = renderHook(() => useChangelog())

    act(() => {
      result.current.markAsRead()
    })

    expect(localStorage.getItem(STORAGE_KEY)).toBe(changelogs[0].version)
  })

  it('changelogs 배열을 반환한다', () => {
    const { result } = renderHook(() => useChangelog())
    expect(result.current.changelogs).toBe(changelogs)
  })
})
