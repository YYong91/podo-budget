/**
 * @file ToastContext.tsx
 * @description 전역 토스트 알림 상태 관리
 * 항상 1개의 토스트만 표시하며, 새 토스트 추가 시 기존 토스트를 교체한다.
 * addToast/removeToast 인터페이스는 하위 호환을 위해 유지한다.
 */

import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import Toast from '../components/Toast'
import type { ToastType } from '../components/Toast'

interface ToastItem {
  id: string
  type: ToastType
  message: string
  duration?: number
}

interface ToastContextType {
  /**
   * 새로운 토스트 알림을 추가한다
   * 기존 토스트가 있으면 교체한다 (항상 1개만 표시).
   * @param type - 토스트 타입 (success, error, warning, info)
   * @param message - 표시할 메시지
   * @param duration - 자동 사라질 시간 (밀리초). 미지정 시 타입별 기본값 적용
   */
  addToast: (type: ToastType, message: string, duration?: number) => void
  /**
   * 특정 토스트를 제거한다
   * @param id - 제거할 토스트의 ID
   */
  removeToast: (id: string) => void
}

/** 타입별 기본 duration (ms) */
const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 3000,
  error: 5000,
  warning: 4000,
  info: 3000,
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

/**
 * ToastContext Provider 컴포넌트
 * 애플리케이션 최상위에서 감싸서 사용한다
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null)

  const addToast = useCallback((type: ToastType, message: string, duration?: number) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    const resolvedDuration = duration ?? DEFAULT_DURATIONS[type]
    setToast({ id, type, message, duration: resolvedDuration })
  }, [])

  const removeToast = useCallback((id: string) => {
    setToast((prev) => (prev?.id === id ? null : prev))
  }, [])

  const contextValue = useMemo(() => ({ addToast, removeToast }), [addToast, removeToast])

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* 토스트 컨테이너: 하단 네비(56px) + 16px 간격 = 72px */}
      {toast && (
        <div
          className="fixed bottom-[72px] left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-32px)] pointer-events-none"
          role="status"
          aria-live="polite"
        >
          <Toast
            key={toast.id}
            id={toast.id}
            type={toast.type}
            message={toast.message}
            duration={toast.duration}
            onClose={removeToast}
          />
        </div>
      )}
    </ToastContext.Provider>
  )
}

/**
 * useToast 커스텀 훅
 * 컴포넌트에서 토스트 기능을 사용하기 위한 훅
 * @throws ToastProvider 외부에서 사용 시 에러 발생
 * @returns addToast, removeToast 함수를 포함한 객체
 */
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}
