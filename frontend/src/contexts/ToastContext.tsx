/**
 * @file ToastContext.tsx
 * @description 전역 토스트 알림 상태 관리
 * React Context를 사용하여 애플리케이션 전역에서
 * 토스트 알림을 추가/제거할 수 있는 기능을 제공한다.
 */

import { createContext, useContext, useState } from 'react'
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
   * @param type - 토스트 타입 (success, error, warning, info)
   * @param message - 표시할 메시지
   * @param duration - 자동 사라질 시간 (밀리초, 기본 3000ms)
   */
  addToast: (type: ToastType, message: string, duration?: number) => void
  /**
   * 특정 토스트를 제거한다
   * @param id - 제거할 토스트의 ID
   */
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

/**
 * ToastContext Provider 컴포넌트
 * 애플리케이션 최상위에서 감싸서 사용한다
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = (type: ToastType, message: string, duration = 3000) => {
    const id = `toast-${Date.now()}-${Math.random()}`
    setToasts((prev) => [...prev, { id, type, message, duration }])
  }

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {/* 토스트 컨테이너: 화면 우상단에 고정 */}
      <div className="fixed top-4 right-4 z-50 pointer-events-none">
        <div className="pointer-events-auto">
          {toasts.map((toast) => (
            <Toast
              key={toast.id}
              id={toast.id}
              type={toast.type}
              message={toast.message}
              duration={toast.duration}
              onClose={removeToast}
            />
          ))}
        </div>
      </div>
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
