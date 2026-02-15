/**
 * @file Toast.tsx
 * @description 토스트 알림 컴포넌트
 * 성공, 에러, 경고, 정보 4가지 타입의 알림을 표시하며
 * 자동 사라짐, 수동 닫기, 애니메이션 기능을 제공한다.
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

/**
 * 토스트 타입별 스타일 및 아이콘 정의
 * @param type - 토스트 타입
 * @returns 배경색, 테두리색, 아이콘 컴포넌트를 포함한 스타일 객체
 */
const getToastStyle = (type: ToastType): {
  bg: string
  border: string
  text: string
  icon: ReactNode
  iconBg: string
} => {
  const iconClassName = 'w-4 h-4'

  const styles = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-800',
      icon: <Check className={iconClassName} />,
      iconBg: 'bg-green-100',
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      icon: <X className={iconClassName} />,
      iconBg: 'bg-red-100',
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-800',
      icon: <AlertTriangle className={iconClassName} />,
      iconBg: 'bg-yellow-100',
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      icon: <Info className={iconClassName} />,
      iconBg: 'bg-blue-100',
    },
  }
  return styles[type]
}

/**
 * 개별 토스트 컴포넌트
 * 지정된 시간 후 자동으로 사라지며, X 버튼으로 수동 닫기 가능
 */
export default function Toast({ id, type, message, duration = 3000, onClose }: ToastProps) {
  const style = getToastStyle(type)

  useEffect(() => {
    // 자동 사라짐 타이머
    const timer = setTimeout(() => {
      onClose(id)
    }, duration)

    return () => clearTimeout(timer)
  }, [id, duration, onClose])

  return (
    <div
      className={`
        ${style.bg} ${style.border} ${style.text}
        border rounded-xl shadow-lg p-4 mb-3
        flex items-start gap-3
        animate-slideIn
        max-w-md w-full
      `}
      role="alert"
    >
      {/* 아이콘 */}
      <div className={`${style.iconBg} rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0`}>
        {style.icon}
      </div>

      {/* 메시지 */}
      <p className="flex-1 text-sm font-medium leading-relaxed">{message}</p>

      {/* 닫기 버튼 */}
      <button
        onClick={() => onClose(id)}
        className="flex-shrink-0 hover:opacity-70 transition-opacity"
        aria-label="닫기"
      >
        <span className="text-lg leading-none">×</span>
      </button>
    </div>
  )
}
