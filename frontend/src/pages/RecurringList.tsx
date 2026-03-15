/**
 * @file RecurringList.tsx
 * @description 반복 거래 관리 페이지
 * 정기 지출/수입 목록 조회, 추가, 수정, 삭제, 일시정지/재개 기능을 제공한다.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Plus, Pencil, Trash2, Pause, Play, X, Zap } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { recurringApi } from '../api/recurring'
import { categoryApi } from '../api/categories'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import type { RecurringTransaction, RecurringTransactionCreate, Category } from '../types'
import { formatAmount } from '../utils/format'

/* 빈도 한국어 표시 */
function formatFrequency(r: RecurringTransaction): string {
  const days = ['월', '화', '수', '목', '금', '토', '일']
  switch (r.frequency) {
    case 'monthly':
      return `매월 ${r.day_of_month}일`
    case 'weekly':
      return `매주 ${days[r.day_of_week ?? 0]}요일`
    case 'yearly':
      return `매년 ${r.month_of_year}월 ${r.day_of_month}일`
    case 'custom':
      return `${r.interval}일마다`
    default:
      return r.frequency
  }
}

/* 빈 폼 데이터 */
const emptyForm = {
  type: 'expense' as 'expense' | 'income',
  amount: '',
  description: '',
  category_id: '',
  frequency: 'monthly' as 'monthly' | 'weekly' | 'yearly' | 'custom',
  day_of_month: '25',
  day_of_week: '0',
  month_of_year: '1',
  interval: '14',
  start_date: new Date().toISOString().slice(0, 10),
  end_date: '',
}

export default function RecurringList() {
  const navigate = useNavigate()
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
  const [formData, setFormData] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  /* 데이터 로드 */
  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const params: { type?: string; household_id: number } = { household_id: activeHouseholdId! }
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
        addToast('success', '반복 거래가 수정되었습니다')
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
        addToast('success', '반복 거래가 추가되었습니다')
      }
      setShowModal(false)
      loadData()
    } catch {
      addToast('error', '저장에 실패했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  /* 삭제 */
  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    try {
      await recurringApi.delete(id)
      addToast('success', '반복 거래가 삭제되었습니다')
      loadData()
    } catch {
      addToast('error', '삭제에 실패했습니다')
    }
  }

  /* 바로 등록 (즉시 실행) */
  const handleExecute = async (r: RecurringTransaction) => {
    try {
      await recurringApi.execute(r.id)
      addToast('success', `${r.description} 등록되었습니다`)
      loadData()
    } catch {
      addToast('error', '등록에 실패했습니다')
    }
  }

  /* 일시정지/재개 */
  const toggleActive = async (r: RecurringTransaction) => {
    try {
      await recurringApi.update(r.id, { is_active: !r.is_active })
      addToast('success', r.is_active ? '중지되었습니다' : '다시 시작되었습니다')
      loadData()
    } catch {
      addToast('error', '변경에 실패했습니다')
    }
  }

  /* 카테고리 필터링 (타입에 맞는 카테고리만) */
  const filteredCategories = categories.filter(
    (c) => c.type === formData.type || c.type === 'both'
  )

  if (error) {
    return (
      <div className="space-y-6">
        <button onClick={() => navigate('/settings')} className="p-2.5 -ml-2.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors">
          <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60">
          <ErrorState onRetry={loadData} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/settings')} className="p-2.5 -ml-2.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors">
          <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
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
                ? 'bg-grape-100 text-grape-800'
                : 'bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            {t === 'all' ? '전체' : t === 'expense' ? '지출' : '수입'}
          </button>
        ))}
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-grape-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60">
          <EmptyState
            title="등록된 반복 거래가 없습니다"
            description="매월 반복되는 지출이나 수입을 등록하면 자동으로 알려드립니다."
            action={{ label: '반복 거래 추가', onClick: openAdd }}
          />
        </div>
      ) : (
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60 overflow-hidden">
          {/* 모바일: 카드 리스트, 데스크톱: 테이블 */}
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-elevated)]/50">
                  <th className="text-left px-5 py-3 text-[var(--text-tertiary)] font-medium">설명</th>
                  <th className="text-right px-5 py-3 text-[var(--text-tertiary)] font-medium">금액</th>
                  <th className="text-left px-5 py-3 text-[var(--text-tertiary)] font-medium">빈도</th>
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
                    <td className={`px-5 py-3 text-right font-semibold ${r.type === 'expense' ? 'text-[var(--text-primary)]' : 'text-leaf-700 dark:text-leaf-400'}`}>
                      {r.type === 'income' ? '+' : ''}{formatAmount(r.amount)}
                    </td>
                    <td className="px-5 py-3 text-[var(--text-secondary)]">{formatFrequency(r)}</td>
                    <td className="px-5 py-3 text-[var(--text-secondary)]">{r.next_due_date}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.is_active ? 'bg-leaf-100 text-leaf-700 dark:text-leaf-400' : 'bg-[var(--surface-hover)] text-[var(--text-tertiary)]'
                      }`}>
                        {r.is_active ? '사용 중' : '중지'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {r.is_active && (
                          <button onClick={() => handleExecute(r)} className="p-2 rounded-md hover:bg-leaf-50 dark:hover:bg-leaf-900/20 text-[var(--text-tertiary)] hover:text-leaf-600 dark:hover:text-leaf-400" title="바로 등록">
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
                  <span className={`font-semibold whitespace-nowrap ml-2 ${r.type === 'expense' ? 'text-[var(--text-primary)]' : 'text-leaf-700 dark:text-leaf-400'}`}>
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
                      <button onClick={() => handleExecute(r)} className="p-1 text-[var(--text-muted)] hover:text-leaf-600 dark:hover:text-leaf-400" title="바로 등록">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[var(--border-subtle)]">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                {editingId ? '반복 거래 수정' : '반복 거래 추가'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-md hover:bg-[var(--surface-hover)]">
                <X className="w-5 h-5 text-[var(--text-tertiary)]" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* 타입 선택 (추가 시에만) */}
              {!editingId && (
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">유형</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'expense', category_id: '' })}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                        formData.type === 'expense' ? 'bg-grape-100 text-grape-800' : 'bg-[var(--surface-hover)] text-[var(--text-secondary)]'
                      }`}
                    >
                      지출
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'income', category_id: '' })}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                        formData.type === 'income' ? 'bg-leaf-100 text-leaf-800' : 'bg-[var(--surface-hover)] text-[var(--text-secondary)]'
                      }`}
                    >
                      수입
                    </button>
                  </div>
                </div>
              )}

              {/* 설명 */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">설명</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="예: 넷플릭스, 월급"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--input-border)] text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                />
              </div>

              {/* 금액 */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">금액</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0"
                  min="1"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--input-border)] text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                />
              </div>

              {/* 카테고리 */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">카테고리</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--input-border)] text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                >
                  <option value="">선택 안 함</option>
                  {filteredCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* 빈도 (추가 시에만) */}
              {!editingId && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">반복 빈도</label>
                    <select
                      value={formData.frequency}
                      onChange={(e) => setFormData({ ...formData, frequency: e.target.value as typeof formData.frequency })}
                      className="w-full px-3 py-2 rounded-xl border border-[var(--input-border)] text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
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
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">반복일</label>
                      <input
                        type="number"
                        value={formData.day_of_month}
                        onChange={(e) => setFormData({ ...formData, day_of_month: e.target.value })}
                        min="1"
                        max="31"
                        className="w-full px-3 py-2 rounded-xl border border-[var(--input-border)] text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                      />
                    </div>
                  )}

                  {formData.frequency === 'weekly' && (
                    <div>
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">요일</label>
                      <select
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
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">반복 월</label>
                      <select
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
                      <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">반복 주기 (일)</label>
                      <input
                        type="number"
                        value={formData.interval}
                        onChange={(e) => setFormData({ ...formData, interval: e.target.value })}
                        min="1"
                        className="w-full px-3 py-2 rounded-xl border border-[var(--input-border)] text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                      />
                    </div>
                  )}

                  {/* 시작일 */}
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">시작일</label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-[var(--input-border)] text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                    />
                  </div>
                </>
              )}

              {/* 종료일 (항상 표시) */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">종료일 (선택)</label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--input-border)] text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
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
      )}
    </div>
  )
}
