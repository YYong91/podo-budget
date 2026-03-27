/**
 * @file Toast.tsx
 * @description 토스트 알림 컴포넌트
 * Pill shape 다크 포도색 반투명 스타일.
 * 아이콘 색상만으로 타입을 구분하며, 자동 사라짐만 지원한다 (닫기 버튼 없음).
 */

import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { Check, X, AlertTriangle, Info } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastProps {
  id: string
  type: ToastType
  message: string
  duration?: number
  onClose: (id: string) => void
}

/** 타입별 아이콘 컴포넌트와 색상 */
const TOAST_ICONS: Record<ToastType, { icon: ReactNode; color: string }> = {
  success: {
    icon: <Check className="w-4 h-4" />,
    color: 'text-leaf-400',
  },
  error: {
    icon: <X className="w-4 h-4" />,
    color: 'text-red-400',
  },
  warning: {
    icon: <AlertTriangle className="w-4 h-4" />,
    color: 'text-amber-400',
  },
  info: {
    icon: <Info className="w-4 h-4" />,
    color: 'text-grape-300',
  },
}

/**
 * 개별 토스트 컴포넌트
 * 지정된 시간 후 자동으로 사라진다.
 */
export default function Toast({ id, type, message, duration = 3000, onClose }: ToastProps) {
  const { icon, color } = TOAST_ICONS[type]

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id)
    }, duration)

    return () => clearTimeout(timer)
  }, [id, duration, onClose])

  return (
    <div
      className={`
        bg-[#1a1625]/90 backdrop-blur-sm
        rounded-full px-5 py-3
        flex items-center gap-2
        animate-toastIn
      `}
      role="alert"
    >
      {/* 아이콘 — 타입별 색상 */}
      <span className={`flex-shrink-0 ${color}`}>{icon}</span>

      {/* 메시지 — 1줄 강제 */}
      <p className="text-sm text-white font-medium truncate">{message}</p>
    </div>
  )
}
