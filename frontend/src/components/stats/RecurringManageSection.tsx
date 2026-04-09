/**
 * @file RecurringManageSection.tsx
 * @description 모아보기 > 정기거래 관리 섹션
 * 활성 정기거래 건수와 이번 달 지출 합계를 요약하고, 정기거래 관리 페이지로 연결한다.
 */

import { useNavigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { formatCompactAmount } from '../../utils/format'

type RecurringManageSectionProps = {
  activeCount: number
  monthlyExpenseTotal: number
}

export default function RecurringManageSection({ activeCount, monthlyExpenseTotal }: RecurringManageSectionProps) {
  const navigate = useNavigate()

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4 sm:p-6">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-4">
        <RefreshCw className="w-5 h-5 text-grape-600" />
        <h2 className="text-base font-semibold text-[var(--text-primary)]">정기거래 관리</h2>
      </div>

      {activeCount === 0 ? (
        /* 빈 상태 — 등록된 정기거래 없음 */
        <div className="flex flex-col items-center gap-3 py-2">
          <p className="text-sm text-[var(--text-secondary)]">등록된 정기거래가 없습니다</p>
          <button
            onClick={() => navigate('/recurring')}
            className="px-4 py-1.5 text-sm font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700 transition-colors"
          >
            등록하기
          </button>
        </div>
      ) : (
        /* 요약 + 관리하기 버튼 */
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--text-secondary)]">
            <span className="font-semibold text-[var(--text-primary)]">활성 {activeCount}건</span>
            {' · '}
            <span>이번 달 </span>
            <span className="font-semibold text-[var(--text-primary)]">₩{formatCompactAmount(monthlyExpenseTotal)}</span>
          </p>
          <button
            onClick={() => navigate('/recurring')}
            className="px-4 py-1.5 text-sm font-medium text-grape-600 border border-grape-300 rounded-lg hover:bg-grape-50 transition-colors"
          >
            관리하기 →
          </button>
        </div>
      )}
    </div>
  )
}
