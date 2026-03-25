/**
 * @file SubPageWrapper.tsx
 * @description 설정 서브 페이지 공통 래퍼 — 뒤로 가기 버튼 포함
 */

import { ArrowLeft } from 'lucide-react'
import { useGoBack } from '../../hooks/useGoBack'

export default function SubPageWrapper({ children }: { children: React.ReactNode }) {
  const goBack = useGoBack('/settings')
  return (
    <div className="space-y-6">
      <button
        onClick={() => goBack()}
        className="p-2.5 -ml-2.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
      >
        <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
      </button>
      {children}
    </div>
  )
}
