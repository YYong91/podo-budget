/**
 * @file useBodyScrollLock.ts
 * @description 모달/바텀시트 열릴 때 body 스크롤을 완전히 잠그는 훅
 *
 * html.scroll-locked 클래스를 토글하여 CSS에서 body 고정 + overscroll 차단.
 * iOS Safari/PWA에서 pull-to-refresh와 rubber-band 효과까지 차단.
 *
 * @see index.css — html.scroll-locked 스타일 정의
 */

import { useEffect } from 'react'

export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return

    const scrollY = window.scrollY
    const html = document.documentElement

    // html에 클래스 추가 → CSS가 body 고정 + 터치 차단
    html.classList.add('scroll-locked')
    document.body.style.top = `-${scrollY}px`

    return () => {
      html.classList.remove('scroll-locked')
      document.body.style.top = ''
      window.scrollTo(0, scrollY)
    }
  }, [isLocked])
}
