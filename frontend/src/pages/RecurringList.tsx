/**
 * @file RecurringList.tsx
 * @description 정기거래 관리 페이지
 * 목록 표시 + 필터만 담당하며, 모달은 RecurringModal로 분리되어 있다.
 */

import { useState, useEffect } from 'react'
import { useGoBack } from '../hooks/useGoBack'
import { ArrowLeft, Plus, Pencil, Trash2, Pause, Play, Zap, Repeat } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { TOAST } from '../constants/toastMessages'
import { recurringApi } from '../api/recurring'
import { categoryApi } from '../api/categories'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import { Skeleton } from '../components/skeleton/Skeleton'
import RecurringModal from '../components/recurring/RecurringModal'
import type { RecurringFormData } from '../components/recurring/RecurringModal'
import type { RecurringTransaction, RecurringTransactionCreate, Category } from '../types'
import { formatAmount, getLocalDateString } from '../utils/format'
import { trackEvent } from '../utils/analytics'
import { formatFrequency } from '../utils/recurringUtils'

/* 빈 폼 데이터 */
const emptyForm: RecurringFormData = {
  type: 'expense',
  amount: '',
  description: '',
  category_id: '',
  frequency: 'monthly',
  day_of_month: '25',
  day_of_week: '0',
  month_of_year: '1',
  interval: '14',
  start_date: getLocalDateString(),
  end_date: '',
}

function RecurringListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="card-surface p-4 flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  )
}

export default function RecurringList() {
  const goBack = useGoBack('/settings')
  const { addToast } = useToast()
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)

  const [items, setItems] = useState<RecurringTransaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /* 필터 */
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all')

  /* 모달 */
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState<RecurringFormData>(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  /* 데이터 로드 */
  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      if (!activeHouseholdId) return  // 가구 로딩 전 API 호출 방지 (#149)
      const params: { type?: string; household_id: number } = { household_id: activeHouseholdId }
      if (typeFilter !== 'all') params.type = typeFilter

      const [recurringRes, categoriesRes] = await Promise.all([
        recurringApi.getAll(params),
        categoryApi.getAll(),
      ])

      setItems(recurringRes.data)
      setCategories(categoriesRes.data)
    } catch {
      setError('데이터를 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [typeFilter, activeHouseholdId])

  /* 모달 열기: 추가 */
  const openAdd = () => {
    setEditingId(null)
    setFormData(emptyForm)
    setShowModal(true)
  }

  /* 모달 열기: 수정 */
  const openEdit = (r: RecurringTransaction) => {
    setEditingId(r.id)
    setFormData({
      type: r.type,
      amount: String(r.amount),
      description: r.description,
      category_id: r.category_id ? String(r.category_id) : '',
      frequency: r.frequency,
      day_of_month: String(r.day_of_month ?? 25),
      day_of_week: String(r.day_of_week ?? 0),
      month_of_year: String(r.month_of_year ?? 1),
      interval: String(r.interval ?? 14),
      start_date: r.start_date,
      end_date: r.end_date ?? '',
    })
    setShowModal(true)
  }

  /* 저장 (추가 / 수정) */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.description.trim()) {
      addToast('error', '설명을 입력해주세요')
      return
    }
    if (!formData.amount || Number(formData.amount) <= 0) {
      addToast('error', '올바른 금액을 입력해주세요')
      return
    }

    setSubmitting(true)
    try {
      if (editingId) {
        await recurringApi.update(editingId, {
          amount: Number(formData.amount),
          description: formData.description,
          category_id: formData.category_id ? Number(formData.category_id) : null,
          end_date: formData.end_date || null,
        })
        addToast('success', TOAST.RECURRING_UPDATED)
      } else {
        const payload: RecurringTransactionCreate = {
          type: formData.type,
          amount: Number(formData.amount),
          description: formData.description,
          category_id: formData.category_id ? Number(formData.category_id) : null,
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
        addToast('success', TOAST.RECURRING_ADDED)
        trackEvent('recurring_added')
      }
      setShowModal(false)
      loadData()
    } catch {
      addToast('error', TOAST.SAVE_FAILED)
    } finally {
      setSubmitting(false)
    }
  }

  /* 삭제 */
  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    try {
      await recurringApi.delete(id)
      addToast('success', TOAST.RECURRING_DELETED)
      loadData()
    } catch {
      addToast('error', TOAST.DELETE_FAILED)
    }
  }

  /* 바로 등록 (즉시 실행) */
  const handleExecute = async (r: RecurringTransaction) => {
    try {
      await recurringApi.execute(r.id)
      addToast('success', TOAST.RECURRING_EXECUTED)
      loadData()
    } catch {
      addToast('error', TOAST.RECURRING_EXECUTE_FAILED)
    }
  }

  /* 일시정지/재개 */
  const toggleActive = async (r: RecurringTransaction) => {
    try {
      await recurringApi.update(r.id, { is_active: !r.is_active })
      addToast('success', TOAST.STATUS_CHANGED)
      loadData()
    } catch {
      addToast('error', TOAST.RECURRING_TOGGLE_FAILED)
    }
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => goBack()} className="p-2.5 -ml-2.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors">
            <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
          <Repeat className="w-5 h-5 text-grape-500 flex-shrink-0" />
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">반복 거래</h1>
        </div>
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60">
          <ErrorState onRetry={loadData} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-page-in">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => goBack()} className="p-2.5 -ml-2.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors">
            <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
          <Repeat className="w-5 h-5 text-grape-500 flex-shrink-0" />
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">반복 거래</h1>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2 bg-grape-600 text-white rounded-xl text-sm font-medium shadow-sm hover:bg-grape-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          추가
        </button>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-2">
        {(['all', 'expense', 'income'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              typeFilter === t
                ? 'bg-grape-100 text-grape-600'
                : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            {t === 'all' ? '전체' : t === 'expense' ? '지출' : '수입'}
          </button>
        ))}
      </div>

      {/* 목록 */}
      {loading ? (
        <RecurringListSkeleton />
      ) : items.length === 0 ? (
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60">
          <EmptyState
            variant="primary"
            title="등록된 정기거래가 없습니다"
            description="매월 반복되는 지출이나 수입을 등록하면 자동으로 알려드립니다."
            action={{ label: '정기거래 추가', onClick: openAdd }}
          />
        </div>
      ) : (
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60 overflow-hidden">
          {/* 데스크톱: 테이블 */}
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-elevated)]/50">
                  <th className="text-left px-5 py-3 text-[var(--text-tertiary)] font-medium">설명</th>
                  <th className="text-right px-5 py-3 text-[var(--text-tertiary)] font-medium">금액</th>
                  <th className="text-left px-5 py-3 text-[var(--text-tertiary)] font-medium">주기</th>
                  <th className="text-left px-5 py-3 text-[var(--text-tertiary)] font-medium">다음 예정일</th>
                  <th className="text-center px-5 py-3 text-[var(--text-tertiary)] font-medium">상태</th>
                  <th className="text-right px-5 py-3 text-[var(--text-tertiary)] font-medium">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {items.map((r) => (
                  <tr key={r.id} className={`hover:bg-[var(--surface-hover)]/50 ${!r.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${r.type === 'expense' ? 'bg-grape-500' : 'bg-leaf-500'}`} />
                        <span className="font-medium text-[var(--text-primary)]">{r.description}</span>
                      </div>
                    </td>
                    <td className={`px-5 py-3 text-right font-semibold tabular-nums ${r.type === 'expense' ? 'text-[var(--text-primary)]' : 'text-leaf-600'}`}>
                      {r.type === 'income' ? '+' : ''}{formatAmount(r.amount)}
                    </td>
                    <td className="px-5 py-3 text-[var(--text-secondary)]">{formatFrequency(r)}</td>
                    <td className="px-5 py-3 text-[var(--text-secondary)]">{r.next_due_date}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.is_active ? 'bg-leaf-100 text-leaf-600' : 'bg-[var(--surface-hover)] text-[var(--text-tertiary)]'
                      }`}>
                        {r.is_active ? '사용 중' : '중지'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {r.is_active && (
                          <button onClick={() => handleExecute(r)} className="p-2 rounded-md hover:bg-leaf-50 text-[var(--text-tertiary)] hover:text-leaf-600" title="바로 등록">
                            <Zap className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => toggleActive(r)} className="p-2 rounded-md hover:bg-[var(--surface-hover)] text-[var(--text-tertiary)]" title={r.is_active ? '중지' : '다시 시작'}>
                          {r.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <button onClick={() => openEdit(r)} className="p-2 rounded-md hover:bg-[var(--surface-hover)] text-[var(--text-tertiary)]" title="수정">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(r.id)} className="p-2 rounded-md hover:bg-red-50 text-[var(--text-tertiary)] hover:text-red-600" title="삭제">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 모바일 카드 뷰 */}
          <div className="md:hidden divide-y divide-[var(--border-subtle)]">
            {items.map((r) => (
              <div key={r.id} className={`p-4 ${!r.is_active ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${r.type === 'expense' ? 'bg-grape-500' : 'bg-leaf-500'}`} />
                    <span className="font-medium text-[var(--text-primary)] truncate">{r.description}</span>
                  </div>
                  <span className={`font-semibold whitespace-nowrap ml-2 tabular-nums ${r.type === 'expense' ? 'text-[var(--text-primary)]' : 'text-leaf-600'}`}>
                    {r.type === 'income' ? '+' : ''}{formatAmount(r.amount)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="text-sm text-[var(--text-tertiary)] space-x-3">
                    <span>{formatFrequency(r)}</span>
                    <span>다음: {r.next_due_date}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {r.is_active && (
                      <button onClick={() => handleExecute(r)} className="p-1 text-[var(--text-muted)] hover:text-leaf-600" title="바로 등록">
                        <Zap className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => toggleActive(r)} className="p-1 text-[var(--text-muted)]">
                      {r.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button onClick={() => openEdit(r)} className="p-1 text-[var(--text-muted)]">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(r.id)} className="p-1 text-[var(--text-muted)]">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 추가/수정 모달 */}
      {showModal && (
        <RecurringModal
          editingId={editingId}
          formData={formData}
          onFormChange={setFormData}
          categories={categories}
          submitting={submitting}
          onSubmit={handleSubmit}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
