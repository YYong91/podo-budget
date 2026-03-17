/**
 * @file PullToRefresh.tsx
 * @description PWA 전용 당겨서 새로고침 컴포넌트
 *
 * 모바일 브라우저: 네이티브 pull-to-refresh 사용 (커스텀 비활성화)
 * PWA standalone: 커스텀 pull-to-refresh 활성화
 *
 * 핵심 최적화: touchmove(non-passive)를 항상 걸지 않고,
 * 스크롤 최상단에서 당기기 시작할 때만 동적 등록 → 스크롤 성능 저하 방지
 */

import { useRef, useState, useEffect, type ReactNode } from 'react'

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: ReactNode
}

const THRESHOLD = 60
const MAX_PULL = 100
const RESISTANCE = 0.4

function useIsStandalone(): boolean {
  const [standalone, setStandalone] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true,
  )

  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)')
    const handler = (e: MediaQueryListEvent) => setStandalone(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return standalone
}

export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const isStandalone = useIsStandalone()
  const containerRef = useRef<HTMLDivElement>(null)

  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  // ref로 최신 값 유지 (이벤트 핸들러 안에서 stale closure 방지)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh
  const refreshingRef = useRef(false)
  refreshingRef.current = refreshing

  useEffect(() => {
    const el = containerRef.current
    if (!el || !isStandalone) return

    let startY = 0
    let pullDist = 0
    let isPulling = false

    const getScrollTop = (): number => {
      const main = el.closest('main')
      if (main) return main.scrollTop
      return window.scrollY
    }

    // non-passive: 당기는 중에만 등록
    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling || refreshingRef.current) return

      const delta = e.touches[0].clientY - startY

      // 위로 스와이프 → 풀링 취소, 일반 스크롤로 복귀
      if (delta <= 0) {
        isPulling = false
        pullDist = 0
        setPullDistance(0)
        el.removeEventListener('touchmove', handleTouchMove)
        return
      }

      // 스크롤이 최상단이 아니면 풀링 취소
      if (getScrollTop() > 0) {
        isPulling = false
        pullDist = 0
        setPullDistance(0)
        el.removeEventListener('touchmove', handleTouchMove)
        return
      }

      e.preventDefault()
      pullDist = Math.min(delta * RESISTANCE, MAX_PULL)
      setPullDistance(pullDist)
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (refreshingRef.current) return
      // 스크롤이 최상단이 아니면 무시 → non-passive 리스너 등록 안 함
      if (getScrollTop() > 0) return

      startY = e.touches[0].clientY
      isPulling = true
      pullDist = 0
      // 최상단에서 당기기 시작할 때만 non-passive touchmove 등록
      el.addEventListener('touchmove', handleTouchMove, { passive: false })
    }

    const handleTouchEnd = async () => {
      // touchmove 항상 제거 (등록 안 됐어도 안전)
      el.removeEventListener('touchmove', handleTouchMove)

      if (!isPulling) return
      isPulling = false

      if (pullDist >= THRESHOLD && !refreshingRef.current) {
        refreshingRef.current = true
        setRefreshing(true)
        setPullDistance(THRESHOLD)
        try {
          await onRefreshRef.current()
        } finally {
          refreshingRef.current = false
          setRefreshing(false)
          setPullDistance(0)
        }
      } else {
        setPullDistance(0)
      }
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchmove', handleTouchMove)
      el.removeEventListener('touchend', handleTouchEnd)
      el.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [isStandalone])

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
            <div className="animate-spin rounded-full border-b-2 border-grape-500 w-5 h-5" />
          ) : (
            <div
              className="w-5 h-5 rounded-full border-2 border-grape-400 border-t-transparent transition-transform"
              style={{
                transform: `rotate(${progress * 360}deg)`,
                opacity: progress,
              }}
            />
          )}
          <span className="text-xs text-[var(--text-tertiary)]">
            {refreshing ? '새로고침 중...' : progress >= 1 ? '놓으면 새로고침' : '당겨서 새로고침'}
          </span>
        </div>
      </div>

      {/* 콘텐츠 */}
      {children}
    </div>
  )
}
