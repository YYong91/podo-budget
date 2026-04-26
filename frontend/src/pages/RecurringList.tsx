/**
 * @file RecurringList.tsx
 * @description 정기거래 관리 페이지 — 카드 레이아웃 + 낙관적 토글 + ⋮ 드롭다운 메뉴 + D-day 표현
 * 목록 표시 + 필터만 담당하며, 모달은 RecurringModal로 분리되어 있다.
 */

import { useState, useEffect } from 'react'
import { useGoBack } from '../hooks/useGoBack'
import {
  ArrowLeft, Plus, Pencil, Trash2,
  ToggleLeft, ToggleRight, PlusCircle,
  MoreVertical, Loader2, Check, ChevronDown, Repeat,
} from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { TOAST } from '../constants/toastMessages'
import { recurringApi } from '../api/recurring'
import { categoryApi } from '../api/categories'
import { paymentMethodApi } from '../api/paymentMethods'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import RecurringModal from '../components/recurring/RecurringModal'
import type { RecurringFormData } from '../components/recurring/RecurringModal'
import type { RecurringTransaction, RecurringTransactionCreate, Category, PaymentMethod } from '../types'
import { formatAmount, getLocalDateString } from '../utils/format'
import { trackEvent } from '../utils/analytics'

/* 빈 폼 데이터 */
const emptyForm: RecurringFormData = {
  type: 'expense',
  amount: '',
  description: '',
  category_id: '',
  payment_method_id: '',
  frequency: 'monthly',
  day_of_month: '25',
  day_of_week: '0',
  month_of_year: '1',
  interval: '14',
  start_date: getLocalDateString(),
  end_date: '',
}

/** next_due_date를 사람이 읽기 쉬운 형식으로 변환 */
function formatDueDate(nextDueDateStr: string): { text: string; isUrgent: boolean } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // 타임존 이슈 방지: 날짜 문자열 직접 파싱
  const [y, m, d] = nextDueDateStr.split('-').map(Number)
  const due = new Date(y, m - 1, d)
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return { text: '오늘', isUrgent: true }
  if (diffDays === 1) return { text: '내일', isUrgent: true }
  if (diffDays > 1 && diffDays <= 7) return { text: `${diffDays}일 후`, isUrgent: true }
  if (diffDays > 7) return { text: `매월 ${d}일`, isUrgent: false }
  if (diffDays === -1) return { text: '어제', isUrgent: false }
  return { text: `${Math.abs(diffDays)}일 전`, isUrgent: false }
}

function RecurringListSkeleton() {
  return (
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60 overflow-hidden">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-4 flex items-center gap-3 border-b border-[var(--border-subtle)] last:border-0">
          <div className="w-10 h-10 rounded-xl bg-[var(--surface-elevated)] animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 rounded bg-[var(--surface-elevated)] animate-pulse" />
            <div className="h-3 w-20 rounded bg-[var(--surface-elevated)] animate-pulse" />
          </div>
          <div className="text-right space-y-2">
            <div className="h-4 w-16 rounded bg-[var(--surface-elevated)] animate-pulse" />
            <div className="h-3 w-12 rounded bg-[var(--surface-elevated)] animate-pulse" />
          </div>
          <div className="flex gap-1">
            <div className="w-8 h-8 rounded-lg bg-[var(--surface-elevated)] animate-pulse" />
            <div className="w-8 h-8 rounded-lg bg-[var(--surface-elevated)] animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

interface RecurringCardProps {
  r: RecurringTransaction
  openMenuId: number | null
  deletingId: number | null
  togglingIds: Set<number>
  executingIds: Set<number>
  executedIds: Set<number>
  showExecute: boolean
  onToggle: (r: RecurringTransaction) => void
  onMenuOpen: (id: number | null) => void
  onEdit: (r: RecurringTransaction) => void
  onDeleteRequest: (id: number) => void
  onDeleteConfirm: (id: number) => void
  onDeleteCancel: () => void
  onExecute: (r: RecurringTransaction) => void
}

function RecurringCard({
  r, openMenuId, deletingId, togglingIds, executingIds, executedIds, showExecute,
  onToggle, onMenuOpen, onEdit, onDeleteRequest, onDeleteConfirm, onDeleteCancel, onExecute,
}: RecurringCardProps) {
  const { text: dueText, isUrgent } = formatDueDate(r.next_due_date)
  const secondaryInfo = [r.category_name, r.payment_method_name].filter(Boolean).join(' · ')

  return (
    <div>
      <div className="p-4 flex items-center gap-3">
        {/* 이모지 */}
        <div className="w-10 h-10 rounded-xl bg-[var(--surface-elevated)] flex items-center justify-center shrink-0 text-xl">
          {r.category_emoji ?? (r.type === 'expense' ? '💸' : '💰')}
        </div>
        {/* 설명 + 2차 정보 */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-[var(--text-primary)] truncate">{r.description}</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5 truncate">
            {secondaryInfo || '카테고리 없음'}
          </p>
        </div>
        {/* 금액 + D-day */}
        <div className="text-right shrink-0">
          <p className={`font-semibold text-sm ${r.type === 'income' ? 'text-leaf-600' : 'text-[var(--text-primary)]'}`}>
            {r.type === 'income' ? '+' : ''}{formatAmount(r.amount)}
          </p>
          <p className={`text-xs mt-0.5 ${isUrgent ? 'text-amber-500 font-medium' : 'text-[var(--text-tertiary)]'}`}>
            {dueText}
          </p>
        </div>
        {/* 토글 + ⋮ */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => onToggle(r)}
            disabled={togglingIds.has(r.id)}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50"
            title={r.is_active ? '일시정지' : '다시 시작'}
            data-testid={`toggle-${r.id}`}
          >
            {r.is_active
              ? <ToggleRight className="w-5 h-5 text-leaf-500" />
              : <ToggleLeft className="w-5 h-5 text-[var(--text-tertiary)]" />}
          </button>
          <div className="relative">
            <button
              onClick={() => onMenuOpen(openMenuId === r.id ? null : r.id)}
              disabled={executingIds.has(r.id)}
              className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid={`menu-${r.id}`}
              aria-label="더보기"
            >
              {executingIds.has(r.id) ? (
                <Loader2 className="w-4 h-4 animate-spin text-[var(--text-muted)]" />
              ) : executedIds.has(r.id) ? (
                <Check className="w-4 h-4 text-leaf-500" />
              ) : (
                <MoreVertical className="w-4 h-4 text-[var(--text-tertiary)]" />
              )}
            </button>
            {openMenuId === r.id && (
              <div className="absolute right-0 top-8 z-10 bg-[var(--surface-card)] rounded-xl shadow-lg border border-[var(--border-default)] py-1 min-w-36">
                {showExecute && (
                  <button
                    onClick={() => onExecute(r)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                  >
                    <PlusCircle className="w-4 h-4" />
                    지금 등록
                  </button>
                )}
                <button
                  onClick={() => { onMenuOpen(null); onEdit(r) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                >
                  <Pencil className="w-4 h-4" />
                  수정
                </button>
                <button
                  onClick={() => { onMenuOpen(null); onDeleteRequest(r.id) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-500 hover:bg-rose-50"
                >
                  <Trash2 className="w-4 h-4" />
                  삭제
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* 삭제 확인 인라인 */}
      {deletingId === r.id && (
        <div className="px-4 py-3 bg-rose-50/50 flex items-center justify-between border-t border-rose-100">
          <p className="text-sm text-[var(--text-secondary)]">'{r.description}'을 삭제할까요?</p>
          <div className="flex gap-2">
            <button
              onClick={onDeleteCancel}
              className="px-3 py-1.5 text-xs rounded-lg bg-[var(--surface-hover)] text-[var(--text-secondary)]"
            >
              취소
            </button>
            <button
              onClick={() => onDeleteConfirm(r.id)}
              className="px-3 py-1.5 text-xs rounded-lg bg-rose-500 text-white font-medium"
            >
              삭제
            </button>
          </div>
        </div>
      )}
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

  /* 카드 인터랙션 상태 */
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set())
  const [executingIds, setExecutingIds] = useState<Set<number>>(new Set())
  const [executedIds, setExecutedIds] = useState<Set<number>>(new Set())
  const [showInactive, setShowInactive] = useState(false)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])

  /* 데이터 로드 */
  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      if (!activeHouseholdId) return  // 가구 로딩 전 API 호출 방지 (#149)
      const params: { type?: string; household_id: number } = { household_id: activeHouseholdId }
      if (typeFilter !== 'all') params.type = typeFilter

      const [recurringRes, categoriesRes, pmRes] = await Promise.all([
        recurringApi.getAll(params),
        categoryApi.getAll(),
        paymentMethodApi.getAll(activeHouseholdId),
      ])

      setItems(recurringRes.data)
      setCategories(categoriesRes.data)
      setPaymentMethods(pmRes.data.filter((pm: PaymentMethod) => pm.is_active))
    } catch {
      setError('데이터를 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [typeFilter, activeHouseholdId])

  /* ⋮ 메뉴 외부 클릭 닫기 (setTimeout 0 필수: 버튼 클릭 이벤트 bubbling 완료 후 리스너 등록) */
  useEffect(() => {
    if (openMenuId === null) return
    const handleClickOutside = () => setOpenMenuId(null)
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', handleClickOutside)
    }
  }, [openMenuId])

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
      payment_method_id: r.payment_method_id ? String(r.payment_method_id) : '',
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

  /* 저장 (추가 / 수정) — API 응답으로 로컬 상태 업데이트 (재로드 없음) */
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
        // 수정: API 응답 데이터로 해당 항목만 교체
        const res = await recurringApi.update(editingId, {
          amount: Number(formData.amount),
          description: formData.description,
          category_id: formData.category_id ? Number(formData.category_id) : null,
          payment_method_id: formData.payment_method_id ? Number(formData.payment_method_id) : null,
          end_date: formData.end_date || null,
        })
        setItems((prev) => prev.map((item) => item.id === editingId ? res.data : item))
      } else {
        // 생성: API 응답 데이터를 목록에 추가
        const payload: RecurringTransactionCreate = {
          type: formData.type,
          amount: Number(formData.amount),
          description: formData.description,
          category_id: formData.category_id ? Number(formData.category_id) : null,
          payment_method_id: formData.payment_method_id ? Number(formData.payment_method_id) : null,
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
        const res = await recurringApi.create(payload)
        setItems((prev) => [...prev, res.data])
        trackEvent('recurring_added')
      }
      setShowModal(false)
      addToast('success', editingId ? TOAST.RECURRING_UPDATED : TOAST.RECURRING_ADDED)
    } catch {
      addToast('error', TOAST.SAVE_FAILED)
    } finally {
      setSubmitting(false)
    }
  }

  /* 토글 (낙관적 업데이트) */
  const handleToggle = async (r: RecurringTransaction) => {
    // 낙관적 업데이트: API 응답 전에 UI 즉시 반영
    setItems((prev) => prev.map((item) => item.id === r.id ? { ...item, is_active: !item.is_active } : item))
    setTogglingIds((prev) => new Set([...prev, r.id]))
    try {
      await recurringApi.update(r.id, { is_active: !r.is_active })
    } catch {
      // 실패 시 롤백
      setItems((prev) => prev.map((item) => item.id === r.id ? { ...item, is_active: r.is_active } : item))
      addToast('error', TOAST.RECURRING_TOGGLE_FAILED)
    } finally {
      setTogglingIds((prev) => { const s = new Set(prev); s.delete(r.id); return s })
    }
  }

  /* 즉시 실행 (인라인 피드백) */
  const handleExecute = async (r: RecurringTransaction) => {
    setOpenMenuId(null)
    setExecutingIds((prev) => new Set([...prev, r.id]))
    try {
      await recurringApi.execute(r.id)
      // 잠깐 체크마크 표시 후 제거
      setExecutedIds((prev) => new Set([...prev, r.id]))
      setTimeout(() => {
        setExecutedIds((prev) => { const s = new Set(prev); s.delete(r.id); return s })
      }, 800)
      addToast('success', TOAST.RECURRING_EXECUTED)
    } catch {
      addToast('error', TOAST.RECURRING_EXECUTE_FAILED)
    } finally {
      setExecutingIds((prev) => { const s = new Set(prev); s.delete(r.id); return s })
    }
  }

  /* 삭제: 로컬 상태 업데이트 (재로드 없이) */
  const handleDelete = async (id: number) => {
    try {
      await recurringApi.delete(id)
      setItems((prev) => prev.filter((item) => item.id !== id))
      setDeletingId(null)
      addToast('success', TOAST.RECURRING_DELETED)
    } catch {
      addToast('error', TOAST.DELETE_FAILED)
    }
  }

  /* 렌더링 직전 활성/비활성 분리 + 날짜 기준 정렬
   * next_due_date(YYYY-MM-DD) 기준 정렬: day_of_month는 monthly 외 weekly/custom에서 null이므로 부정확 */
  const activeItems = items
    .filter((r) => r.is_active)
    .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date))
  const inactiveItems = items
    .filter((r) => !r.is_active)
    .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date))

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => goBack()} className="p-2.5 -ml-2.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors">
            <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
          <Repeat className="w-5 h-5 text-grape-500 flex-shrink-0" />
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">정기거래</h1>
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
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">정기거래</h1>
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
            icon={<Repeat className="w-8 h-8 text-grape-400" />}
            title="등록된 정기거래가 없습니다"
            description="월세, 구독료, 월급처럼 반복되는 거래를 등록하면 달력에 예정일이 표시되고 예산 예측에도 자동으로 반영됩니다."
            action={{ label: '정기거래 추가', onClick: openAdd }}
          >
            <div className="w-full px-2 pb-2 grid grid-cols-3 gap-2 text-center">
              {[
                { emoji: '🏠', text: '월세·관리비' },
                { emoji: '📺', text: '넷플릭스·구독' },
                { emoji: '💰', text: '월급·부수입' },
              ].map(({ emoji, text }) => (
                <div key={text} className="bg-[var(--surface-elevated)] rounded-xl py-2.5 px-2">
                  <span className="text-lg block mb-0.5">{emoji}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">{text}</span>
                </div>
              ))}
            </div>
          </EmptyState>
        </div>
      ) : (
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60 overflow-hidden">
          {/* 활성 정기거래 */}
          {activeItems.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--text-tertiary)]">
              활성 정기거래가 없습니다
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)]">
              {activeItems.map((r) => (
                <RecurringCard
                  key={r.id} r={r} openMenuId={openMenuId} deletingId={deletingId}
                  togglingIds={togglingIds} executingIds={executingIds} executedIds={executedIds}
                  showExecute={true}
                  onToggle={handleToggle} onMenuOpen={setOpenMenuId} onEdit={openEdit}
                  onDeleteRequest={setDeletingId} onDeleteConfirm={handleDelete}
                  onDeleteCancel={() => setDeletingId(null)} onExecute={handleExecute}
                />
              ))}
            </div>
          )}

          {/* 비활성(일시정지) 정기거래 — 접기/펼치기 */}
          {inactiveItems.length > 0 && (
            <div className="border-t border-[var(--border-subtle)]">
              <button
                onClick={() => setShowInactive(!showInactive)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] transition-colors"
                data-testid="inactive-toggle"
              >
                <span>일시정지 {inactiveItems.length}건</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showInactive ? 'rotate-180' : ''}`} />
              </button>
              {showInactive && (
                <div className="divide-y divide-[var(--border-subtle)] opacity-60">
                  {inactiveItems.map((r) => (
                    <RecurringCard
                      key={r.id} r={r} openMenuId={openMenuId} deletingId={deletingId}
                      togglingIds={togglingIds} executingIds={executingIds} executedIds={executedIds}
                      showExecute={false}
                      onToggle={handleToggle} onMenuOpen={setOpenMenuId} onEdit={openEdit}
                      onDeleteRequest={setDeletingId} onDeleteConfirm={handleDelete}
                      onDeleteCancel={() => setDeletingId(null)} onExecute={handleExecute}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 추가/수정 모달 */}
      {showModal && (
        <RecurringModal
          editingId={editingId}
          formData={formData}
          onFormChange={setFormData}
          categories={categories}
          paymentMethods={paymentMethods}
          submitting={submitting}
          onSubmit={handleSubmit}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
