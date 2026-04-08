/**
 * @file useBodyScrollLock.ts
 * @description 모달/바텀시트 열릴 때 body 스크롤을 완전히 잠그는 훅
 *
 * iOS Safari/PWA에서 overflow:hidden만으로는 스크롤 차단이 안 되므로
 * body를 position:fixed로 고정하고, 닫힐 때 원래 스크롤 위치를 복원한다.
 */

import { useEffect } from 'react'

export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return

    // 현재 스크롤 위치 저장
    const scrollY = window.scrollY

    // body 고정 — iOS Safari에서 유일하게 확실한 방법
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.overflow = 'hidden'

    return () => {
      // body 고정 해제 + 스크롤 위치 복원
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.overflow = ''
      window.scrollTo(0, scrollY)
    }
  }, [isLocked])
}
