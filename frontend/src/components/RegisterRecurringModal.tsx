/**
 * @file RegisterRecurringModal.tsx
 * @description 지출/수입 항목을 정기거래로 등록하는 모달
 * 기존 거래의 금액, 설명, 카테고리를 미리 채우고 주기만 추가로 설정한다.
 */

import { useState } from 'react'
import { X } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { TOAST } from '../constants/toastMessages'
import { recurringApi } from '../api/recurring'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import type { Category, RecurringTransactionCreate } from '../types'
import { getLocalDateString } from '../utils/format'

interface Props {
  type: 'expense' | 'income'
  amount: number
  description: string
  category_id: number | null
  categories: Category[]
  initialDate: string
  onClose: () => void
  onSuccess: () => void
  sourceId?: number
}

export default function RegisterRecurringModal({
  type,
  amount,
  description,
  category_id,
  categories,
  initialDate,
  onClose,
  onSuccess,
  sourceId,
}: Props) {
  const { addToast } = useToast()
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)

  // 거래 날짜에서 일(day) 추출 — "2026-01-01T00:00:00" 또는 "2026-01-01" 모두 처리
  const dayOfMonth = String(Number(initialDate.slice(8, 10)))

  const [formData, setFormData] = useState({
    frequency: 'monthly' as 'monthly' | 'weekly' | 'yearly' | 'custom',
    day_of_month: dayOfMonth,
    day_of_week: '0',
    month_of_year: '1',
    interval: '14',
    start_date: getLocalDateString(),
    end_date: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const filteredCategories = categories.filter(
    (c) => c.type === type || c.type === 'both'
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setSubmitting(true)
    try {
      const payload: RecurringTransactionCreate = {
        type,
        amount,
        description,
        category_id,
        frequency: formData.frequency,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        household_id: activeHouseholdId,
        source_id: sourceId ?? null,
      }
      if (formData.frequency === 'monthly' || formData.frequency === 'yearly') {
        payload.day_of_month = Number(formData.day_of_month)
      }
      if (formData.frequency === 'weekly') {
        payload.day_of_week = Number(formData.day_of_week)
      }
      if (formData.frequency === 'yearly') {
        payload.month_of_year = Number(formData.month_of_year)
      }
      if (formData.frequency === 'custom') {
        payload.interval = Number(formData.interval)
      }
      await recurringApi.create(payload)
      addToast('success', TOAST.RECURRING_ADDED)
      onSuccess()
    } catch {
      addToast('error', TOAST.SAVE_FAILED)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true" aria-labelledby="register-recurring-title">
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[var(--border-subtle)]">
          <h2 id="register-recurring-title" className="text-lg font-semibold text-[var(--text-primary)]">정기거래 등록</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-[var(--surface-hover)]" aria-label="닫기">
            <X className="w-5 h-5 text-[var(--text-tertiary)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* 미리 채워진 정보 (읽기 전용) */}
          <div className="bg-[var(--surface-elevated)] rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--text-tertiary)]">유형</span>
              <span className={`font-medium ${type === 'expense' ? 'text-grape-600' : 'text-leaf-600'}`}>
                {type === 'expense' ? '지출' : '수입'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-tertiary)]">설명</span>
              <span className="font-medium text-[var(--text-primary)] truncate ml-4 max-w-48">{description}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-tertiary)]">금액</span>
              <span className="font-medium text-[var(--text-primary)]">₩{amount.toLocaleString('ko-KR')}</span>
            </div>
            {category_id && (
              <div className="flex justify-between">
                <span className="text-[var(--text-tertiary)]">카테고리</span>
                <span className="font-medium text-[var(--text-primary)]">
                  {filteredCategories.find((c) => c.id === category_id)?.name ?? ''}
                </span>
              </div>
            )}
          </div>

          {/* 반복 주기 */}
          <div>
            <label htmlFor="recurring-frequency" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">반복 주기</label>
            <select
              id="recurring-frequency"
              value={formData.frequency}
              onChange={(e) =>
                setFormData({ ...formData, frequency: e.target.value as typeof formData.frequency })
              }
              className="w-full px-3 py-2 rounded-xl border border-[var(--input-border)] text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
            >
              <option value="monthly">매월</option>
              <option value="weekly">매주</option>
              <option value="yearly">매년</option>
              <option value="custom">사용자 지정</option>
            </select>
          </div>

          {/* 주기별 추가 필드 */}
          {(formData.frequency === 'monthly' || formData.frequency === 'yearly') && (
            <div>
              <label htmlFor="recurring-day-of-month" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">반복 날짜</label>
              <div className="flex items-center gap-2">
                <input
                  id="recurring-day-of-month"
                  type="number"
                  inputMode="numeric"
                  value={formData.day_of_month}
                  onChange={(e) => setFormData({ ...formData, day_of_month: e.target.value })}
                  min="1"
                  max="31"
                  className="w-24 px-3 py-2 rounded-xl border border-[var(--input-border)] text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                />
                <span className="text-sm text-[var(--text-secondary)]">일</span>
              </div>
            </div>
          )}

          {formData.frequency === 'weekly' && (
            <div>
              <label htmlFor="recurring-day-of-week" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">요일</label>
              <select
                id="recurring-day-of-week"
                value={formData.day_of_week}
                onChange={(e) => setFormData({ ...formData, day_of_week: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-[var(--input-border)] text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
              >
                {['월', '화', '수', '목', '금', '토', '일'].map((d, i) => (
                  <option key={i} value={i}>{d}요일</option>
                ))}
              </select>
            </div>
          )}

          {formData.frequency === 'yearly' && (
            <div>
              <label htmlFor="recurring-month-of-year" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">반복 월</label>
              <select
                id="recurring-month-of-year"
                value={formData.month_of_year}
                onChange={(e) => setFormData({ ...formData, month_of_year: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-[var(--input-border)] text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}월</option>
                ))}
              </select>
            </div>
          )}

          {formData.frequency === 'custom' && (
            <div>
              <label htmlFor="recurring-interval" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">반복 주기</label>
              <div className="flex items-center gap-2">
                <input
                  id="recurring-interval"
                  type="number"
                  inputMode="numeric"
                  value={formData.interval}
                  onChange={(e) => setFormData({ ...formData, interval: e.target.value })}
                  min="1"
                  className="w-24 px-3 py-2 rounded-xl border border-[var(--input-border)] text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                />
                <span className="text-sm text-[var(--text-secondary)]">일마다</span>
              </div>
            </div>
          )}

          {/* 시작일 */}
          <div>
            <label htmlFor="recurring-start-date" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">시작일</label>
            <input
              id="recurring-start-date"
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-[var(--input-border)] text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
            />
          </div>

          {/* 종료일 */}
          <div>
            <label htmlFor="recurring-end-date" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">종료일 (선택)</label>
            <input
              id="recurring-end-date"
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-[var(--input-border)] text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-grape-600 text-white rounded-xl text-sm font-medium shadow-sm hover:bg-grape-700 transition-colors disabled:opacity-50"
          >
            {submitting ? '등록 중...' : '정기거래 등록'}
          </button>
        </form>
      </div>
    </div>
  )
}
