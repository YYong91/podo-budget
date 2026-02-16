/**
 * @file ErrorState.tsx
 * @description 에러 상태를 표시하는 공통 컴포넌트
 * API 에러나 예상치 못한 오류 발생 시 사용자에게 안내하고 재시도를 유도한다.
 */

import { AlertTriangle } from 'lucide-react'

interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
}

/**
 * 에러 상태 UI 컴포넌트
 * @param title - 에러 제목 (기본값: "문제가 발생했습니다")
 * @param message - 에러 설명 (기본값: "데이터를 불러오는 중 오류가 발생했습니다.")
 * @param onRetry - 재시도 버튼 클릭 핸들러 (선택)
 */
export default function ErrorState({
  title = '문제가 발생했습니다',
  message = '데이터를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8 text-rose-400" />
      </div>
      <h3 className="text-lg font-semibold text-stone-900 mb-2 text-center">
        {title}
      </h3>
      <p className="text-sm text-stone-500 mb-6 text-center max-w-md">
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-5 py-2.5 text-sm font-medium text-white bg-grape-600 hover:bg-grape-700 rounded-xl shadow-sm shadow-grape-200 active:scale-[0.98] transition-all"
        >
          다시 시도
        </button>
      )}
    </div>
  )
}
