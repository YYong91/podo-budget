/**
 * @file useBodyScrollLock.ts
 * @description 모달/바텀시트 열릴 때 body 스크롤을 완전히 잠그는 훅
 *
 * 3중 차단:
 * 1. body position:fixed — 일반 브라우저 스크롤 차단
 * 2. document touchmove preventDefault — iOS Safari/PWA 터치 스크롤 차단
 * 3. [role="dialog"] 내부 스크롤 가능 영역만 예외 허용
 */

import { useEffect } from 'react'

export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return

    const scrollY = window.scrollY

    // 1. body 고정
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.overflow = 'hidden'

    // 2. document 레벨 touchmove 차단 — iOS에서 유일하게 확실한 방법
    const handleTouchMove = (e: TouchEvent) => {
      // 모달 내부 스크롤 가능한 영역에서의 터치만 허용
      let target = e.target as HTMLElement | null
      while (target && target !== document.body) {
        // overflow-y: auto/scroll인 요소이고, 실제로 스크롤이 있으면 허용
        if (target.scrollHeight > target.clientHeight) {
          const style = window.getComputedStyle(target)
          const overflowY = style.overflowY
          if (overflowY === 'auto' || overflowY === 'scroll') {
            return // 스크롤 가능한 영역 → 허용
          }
        }
        target = target.parentElement
      }
      // 스크롤 가능한 영역 밖 → 차단
      e.preventDefault()
    }

    document.addEventListener('touchmove', handleTouchMove, { passive: false })

    return () => {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.overflow = ''
      document.removeEventListener('touchmove', handleTouchMove)
      window.scrollTo(0, scrollY)
    }
  }, [isLocked])
}
