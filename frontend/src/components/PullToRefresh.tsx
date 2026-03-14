/**
 * @file PullToRefresh.tsx
 * @description 모바일 당겨서 새로고침 컴포넌트
 * 페이지 최상단에서 아래로 당기면 onRefresh 콜백을 실행한다.
 */

import { useRef, useState, useCallback, useEffect, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: ReactNode
}

const THRESHOLD = 60        // 새로고침 트리거 거리 (px)
const MAX_PULL = 100        // 최대 당김 거리 (px)
const RESISTANCE = 0.4      // 당김 저항 계수
const ACTIVATION_DELTA = 15 // 이 거리 이상 당겨야 pull-to-refresh 활성화 (px)

export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const currentY = useRef(0)
  const pulling = useRef(false)
  const activated = useRef(false) // 활성화 임계값 초과 여부

  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  // 스크롤이 최상단인지 확인
  const isAtTop = useCallback((): boolean => {
    // main 컨테이너 또는 window의 scrollTop 확인
    const main = containerRef.current?.closest('main')
    if (main) return main.scrollTop <= 0
    return window.scrollY <= 0
  }, [])

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (refreshing) return
    if (!isAtTop()) return
    startY.current = e.touches[0].clientY
    currentY.current = startY.current
    pulling.current = true
    activated.current = false
  }, [refreshing, isAtTop])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling.current || refreshing) return

    currentY.current = e.touches[0].clientY
    const delta = currentY.current - startY.current

    if (delta <= 0) {
      // 위로 스크롤 → 무시
      activated.current = false
      setPullDistance(0)
      return
    }

    if (!isAtTop()) {
      pulling.current = false
      activated.current = false
      setPullDistance(0)
      return
    }

    // 활성화 임계값 미달 → 브라우저 기본 스크롤에 맡김
    if (!activated.current) {
      if (delta < ACTIVATION_DELTA) return
      activated.current = true
    }

    // 활성화 이후에만 기본 스크롤 방지
    e.preventDefault()

    const distance = Math.min(delta * RESISTANCE, MAX_PULL)
    setPullDistance(distance)
  }, [refreshing, isAtTop])

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return
    pulling.current = false
    activated.current = false

    if (pullDistance >= THRESHOLD && !refreshing) {
      setRefreshing(true)
      setPullDistance(THRESHOLD) // 고정 위치에서 스피너 표시
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
        setPullDistance(0)
      }
    } else {
      setPullDistance(0)
    }
  }, [pullDistance, refreshing, onRefresh])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchmove', handleTouchMove, { passive: false })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  const progress = Math.min(pullDistance / THRESHOLD, 1)
  const showIndicator = pullDistance > 10 || refreshing

  return (
    <div ref={containerRef} className="relative">
      {/* 새로고침 인디케이터 */}
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-200 ease-out"
        style={{ height: showIndicator ? `${Math.max(pullDistance, refreshing ? THRESHOLD : 0)}px` : 0 }}
      >
        <div className="flex items-center gap-2">
          {refreshing ? (
            <Loader2 className="w-5 h-5 animate-spin text-grape-500" />
          ) : (
            <div
              className="w-5 h-5 rounded-full border-2 border-grape-400 border-t-transparent transition-transform"
              style={{
                transform: `rotate(${progress * 360}deg)`,
                opacity: progress,
              }}
            />
          )}
          <span className="text-xs text-warm-500">
            {refreshing ? '새로고침 중...' : progress >= 1 ? '놓으면 새로고침' : '당겨서 새로고침'}
          </span>
        </div>
      </div>

      {/* 콘텐츠 */}
      {children}
    </div>
  )
}
