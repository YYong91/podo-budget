/**
 * @file RecurringModal.tsx
 * @description 반복 거래 추가/수정 모달 컴포넌트
 * 추가 시: 유형, 설명, 금액, 카테고리, 빈도, 시작일, 종료일
 * 수정 시: 설명, 금액, 카테고리, 종료일만 수정 가능
 */

import { X } from 'lucide-react'
import type { Category } from '../../types'
import FrequencyFields from './FrequencyFields'

/** 모달 폼 데이터 타입 */
export interface RecurringFormData {
  type: 'expense' | 'income'
  amount: string
  description: string
  category_id: string
  frequency: 'monthly' | 'weekly' | 'yearly' | 'custom'
  day_of_month: string
  day_of_week: string
  month_of_year: string
  interval: string
  start_date: string
  end_date: string
}

interface RecurringModalProps {
  /** 수정 모드 여부 (null이면 추가) */
  editingId: number | null
  /** 폼 데이터 */
  formData: RecurringFormData
  /** 폼 데이터 변경 핸들러 */
  onFormChange: (data: RecurringFormData) => void
  /** 카테고리 목록 (타입 필터링 전) */
  categories: Category[]
  /** 제출 중 여부 */
  submitting: boolean
  /** 폼 제출 핸들러 */
  onSubmit: (e: React.FormEvent) => void
  /** 모달 닫기 핸들러 */
  onClose: () => void
}

const INPUT_CLASSES = 'w-full px-3 py-2 rounded-xl border border-[var(--input-border)] text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500'

export default function RecurringModal({
  editingId,
  formData,
  onFormChange,
  categories,
  submitting,
  onSubmit,
  onClose,
}: RecurringModalProps) {
  /** 타입에 맞는 카테고리만 필터 */
  const filteredCategories = categories.filter(
    (c) => c.type === formData.type || c.type === 'both'
  )

  /** 필드 변경 헬퍼 */
  const updateField = (field: string, value: string) => {
    onFormChange({ ...formData, [field]: value })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true" aria-labelledby="recurring-modal-title">
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-subtle)]">
          <h2 id="recurring-modal-title" className="text-lg font-semibold text-[var(--text-primary)]">
            {editingId ? '반복 거래 수정' : '반복 거래 추가'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-[var(--surface-hover)]" aria-label="닫기">
            <X className="w-5 h-5 text-[var(--text-tertiary)]" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="p-5 space-y-4">
          {/* 타입 선택 (추가 시에만) */}
          {!editingId && (
            <div>
              <span className="block text-sm font-medium text-[var(--text-secondary)] mb-2">유형</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onFormChange({ ...formData, type: 'expense', category_id: '' })}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                    formData.type === 'expense' ? 'bg-grape-100 text-grape-600' : 'bg-[var(--surface-hover)] text-[var(--text-secondary)]'
                  }`}
                >
                  지출
                </button>
                <button
                  type="button"
                  onClick={() => onFormChange({ ...formData, type: 'income', category_id: '' })}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                    formData.type === 'income' ? 'bg-leaf-100 text-leaf-600' : 'bg-[var(--surface-hover)] text-[var(--text-secondary)]'
                  }`}
                >
                  수입
                </button>
              </div>
            </div>
          )}

          {/* 설명 */}
          <div>
            <label htmlFor="reclist-description" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">설명</label>
            <input
              id="reclist-description"
              type="text"
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="예: 넷플릭스, 월급"
              className={INPUT_CLASSES}
            />
          </div>

          {/* 금액 */}
          <div>
            <label htmlFor="reclist-amount" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">금액</label>
            <input
              id="reclist-amount"
              type="number"
              value={formData.amount}
              onChange={(e) => updateField('amount', e.target.value)}
              placeholder="0"
              min="1"
              className={INPUT_CLASSES}
            />
          </div>

          {/* 카테고리 */}
          <div>
            <label htmlFor="reclist-category" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">카테고리</label>
            <select
              id="reclist-category"
              value={formData.category_id}
              onChange={(e) => updateField('category_id', e.target.value)}
              className={INPUT_CLASSES}
            >
              <option value="">선택 안 함</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* 빈도 필드 (추가 시에만) */}
          {!editingId && (
            <FrequencyFields
              frequency={formData.frequency}
              dayOfMonth={formData.day_of_month}
              dayOfWeek={formData.day_of_week}
              monthOfYear={formData.month_of_year}
              interval={formData.interval}
              startDate={formData.start_date}
              onChange={updateField}
            />
          )}

          {/* 종료일 (항상 표시) */}
          <div>
            <label htmlFor="reclist-end-date" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">종료일 (선택)</label>
            <input
              id="reclist-end-date"
              type="date"
              value={formData.end_date}
              onChange={(e) => updateField('end_date', e.target.value)}
              className={INPUT_CLASSES}
            />
          </div>

          {/* 저장 버튼 */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-grape-600 text-white rounded-xl text-sm font-medium shadow-sm hover:bg-grape-700 transition-colors disabled:opacity-50"
          >
            {submitting ? '저장 중...' : editingId ? '수정하기' : '추가하기'}
          </button>
        </form>
      </div>
    </div>
  )
}
