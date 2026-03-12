/**
 * @file useChangelog.ts
 * @description 새소식(changelog) 읽음 상태 관리 훅.
 *   localStorage에 마지막으로 확인한 버전을 저장하여
 *   새 업데이트 여부를 판단한다.
 */

import { useState, useCallback } from 'react'
import { changelogs } from '../data/changelogs'

const STORAGE_KEY = 'podo-changelog-last-seen'

/** 마지막으로 본 버전을 localStorage에서 읽기 */
function getLastSeenVersion(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/** 마지막으로 본 버전을 localStorage에 저장 */
function setLastSeenVersion(version: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, version)
  } catch {
    // localStorage 사용 불가 시 무시
  }
}

export function useChangelog() {
  const latestVersion = changelogs[0]?.version ?? null
  const [lastSeen, setLastSeen] = useState(getLastSeenVersion)

  /** 읽지 않은 업데이트가 있는지 여부 */
  const hasUnread = latestVersion !== null && lastSeen !== latestVersion

  /** 새소식을 확인한 것으로 표시 */
  const markAsRead = useCallback(() => {
    if (latestVersion) {
      setLastSeenVersion(latestVersion)
      setLastSeen(latestVersion)
    }
  }, [latestVersion])

  return { hasUnread, markAsRead, changelogs }
}
