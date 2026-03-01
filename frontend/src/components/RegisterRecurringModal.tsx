/**
 * @file RegisterRecurringModal.tsx
 * @description 지출/수입 항목에서 정기거래로 등록하는 모달
 * 기존 거래의 금액, 설명, 카테고리를 미리 채우고 빈도만 추가로 설정한다.
 */

import { useState } from 'react'
import { X } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { recurringApi } from '../api/recurring'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import type { Category, RecurringTransactionCreate } from '../types'

interface Props {
  type: 'expense' | 'income'
  amount: number
  description: string
  category_id: number | null
  categories: Category[]
  initialDate: string
  onClose: () => void
  onSuccess: () => void
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
    start_date: new Date().toISOString().slice(0, 10),
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
      addToast('success', '정기거래로 등록되었습니다')
      onSuccess()
    } catch {
      addToast('error', '등록에 실패했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-warm-100">
          <h2 className="text-lg font-semibold text-warm-800">정기거래 등록</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-warm-100">
            <X className="w-5 h-5 text-warm-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* 미리 채워진 정보 (읽기 전용) */}
          <div className="bg-warm-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-warm-500">유형</span>
              <span className={`font-medium ${type === 'expense' ? 'text-grape-700' : 'text-leaf-700'}`}>
                {type === 'expense' ? '지출' : '수입'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-warm-500">설명</span>
              <span className="font-medium text-warm-900 truncate ml-4 max-w-48">{description}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-warm-500">금액</span>
              <span className="font-medium text-warm-900">₩{amount.toLocaleString('ko-KR')}</span>
            </div>
            {category_id && (
              <div className="flex justify-between">
                <span className="text-warm-500">카테고리</span>
                <span className="font-medium text-warm-900">
                  {filteredCategories.find((c) => c.id === category_id)?.name ?? ''}
                </span>
              </div>
            )}
          </div>

          {/* 반복 빈도 */}
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1">반복 빈도</label>
            <select
              value={formData.frequency}
              onChange={(e) =>
                setFormData({ ...formData, frequency: e.target.value as typeof formData.frequency })
              }
              className="w-full px-3 py-2 rounded-lg border border-warm-300 text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
            >
              <option value="monthly">매월</option>
              <option value="weekly">매주</option>
              <option value="yearly">매년</option>
              <option value="custom">사용자 지정</option>
            </select>
          </div>

          {/* 빈도별 추가 필드 */}
          {(formData.frequency === 'monthly' || formData.frequency === 'yearly') && (
            <div>
              <label className="block text-sm font-medium text-warm-700 mb-1">반복 날짜</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={formData.day_of_month}
                  onChange={(e) => setFormData({ ...formData, day_of_month: e.target.value })}
                  min="1"
                  max="31"
                  className="w-24 px-3 py-2 rounded-lg border border-warm-300 text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                />
                <span className="text-sm text-warm-600">일</span>
              </div>
            </div>
          )}

          {formData.frequency === 'weekly' && (
            <div>
              <label className="block text-sm font-medium text-warm-700 mb-1">요일</label>
              <select
                value={formData.day_of_week}
                onChange={(e) => setFormData({ ...formData, day_of_week: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-warm-300 text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
              >
                {['월', '화', '수', '목', '금', '토', '일'].map((d, i) => (
                  <option key={i} value={i}>{d}요일</option>
                ))}
              </select>
            </div>
          )}

          {formData.frequency === 'yearly' && (
            <div>
              <label className="block text-sm font-medium text-warm-700 mb-1">실행 월</label>
              <select
                value={formData.month_of_year}
                onChange={(e) => setFormData({ ...formData, month_of_year: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-warm-300 text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}월</option>
                ))}
              </select>
            </div>
          )}

          {formData.frequency === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-warm-700 mb-1">반복 간격</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={formData.interval}
                  onChange={(e) => setFormData({ ...formData, interval: e.target.value })}
                  min="1"
                  className="w-24 px-3 py-2 rounded-lg border border-warm-300 text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                />
                <span className="text-sm text-warm-600">일마다</span>
              </div>
            </div>
          )}

          {/* 시작일 */}
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1">시작일</label>
            <input
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-warm-300 text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
            />
          </div>

          {/* 종료일 */}
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1">종료일 (선택)</label>
            <input
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-warm-300 text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-grape-600 text-white rounded-xl text-sm font-medium shadow-sm hover:bg-grape-700 transition-colors disabled:opacity-50"
          >
            {submitting ? '등록 중...' : '정기거래 등록'}
          </button>
        </form>
      </div>
    </div>
  )
}
