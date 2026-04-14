import { useEffect } from 'react'

/** 모달/오버레이 오픈 시 배경 스크롤 잠금 훅 */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [locked])
}
