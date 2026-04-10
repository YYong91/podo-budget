/**
 * @file TransactionDetail.tsx
 * @description 지출/수입 상세 정보 통합 컴포넌트
 * type prop으로 지출/수입을 구분하며, 뷰 모드와 편집 모드를 제공한다.
 * ExpenseDetail과 IncomeDetail을 통합한 컴포넌트로, 추후 삭제/정기거래 기능이 추가된다.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { expenseApi } from '../api/expenses'
import { incomeApi } from '../api/income'
import { categoryApi } from '../api/categories'
import { paymentMethodApi } from '../api/paymentMethods'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import { useToast } from '../hooks/useToast'
import { TOAST } from '../constants/toastMessages'
import ErrorState from './ErrorState'
import { Skeleton } from './skeleton/Skeleton'
import type { Expense, Income, Category, PaymentMethod } from '../types'
import { formatAmount } from '../utils/format'

// ── 타입 ──

interface TransactionDetailProps {
  type: 'expense' | 'income'
}

type DetailMode = 'view' | 'edit'
type PageErrorState = 'none' | 'error' | 'notFound'
type QuickEditField = 'category' | 'payment_method' | null

// ── 설정 ──

const TYPE_CONFIG = {
  expense: {
    color: 'grape',
    amountPrefix: '',
    amountColor: 'text-[var(--text-primary)]',
    listRoute: '/expenses',
    pageTitle: '지출 내역',
    categoryApiType: 'expense' as const,
    hasPaymentMethod: true,
  },
  income: {
    color: 'leaf',
    amountPrefix: '+',
    amountColor: 'text-leaf-600',
    listRoute: '/income',
    pageTitle: '수입 내역',
    categoryApiType: 'income' as const,
    hasPaymentMethod: false,
  },
} as const

/** 결제수단 타입별 아이콘 */
const PM_ICON: Record<string, string> = {
  credit_card: '💳',
  debit_card: '💳',
  cash: '💵',
  transfer: '🏦',
}

/** 편집 폼 상태 타입 */
interface EditFormState {
  amount: number
  description: string
  category_id: number | null
  payment_method_id: number | null
  date: string
  memo: string
  exclude_from_stats: boolean
}

/** transaction → editForm 변환 헬퍼 */
function toEditForm(t: Expense | Income): EditFormState {
  return {
    amount: t.amount,
    description: t.description,
    category_id: t.category_id,
    payment_method_id: 'payment_method_id' in t ? (t as Expense).payment_method_id : null,
    date: t.date.slice(0, 10),
    memo: t.memo ?? '',
    exclude_from_stats: t.exclude_from_stats ?? false,
  }
}

/** ISO 날짜 문자열을 YYYY.MM.DD 형식으로 변환 */
function formatDate(dateStr: string): string {
  return dateStr.slice(0, 10).replace(/-/g, '.')
}

// ── 컴포넌트 ──

export default function TransactionDetail({ type }: TransactionDetailProps) {
  const cfg = TYPE_CONFIG[type]
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)
  const { addToast } = useToast()

  // isMountedRef — 비동기 작업 완료 후 언마운트된 컴포넌트에 setState 호출 방지
  const isMountedRef = useRef(true)
  useEffect(() => () => { isMountedRef.current = false }, [])

  // 상태
  const [transaction, setTransaction] = useState<Expense | Income | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [errorState, setErrorState] = useState<PageErrorState>('none')
  const [mode, setMode] = useState<DetailMode>(() =>
    searchParams.get('edit') === 'true' ? 'edit' : 'view',
  )
  const [, setShowDeleteModal] = useState(false)
  const [, setShowRecurringModal] = useState(false)

  // ── 빠른 수정 상태 ──
  const [quickEditField, setQuickEditField] = useState<QuickEditField>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [flashField, setFlashField] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')

  // ── dirty form guard 상태 ──
  const [showDirtyDialog, setShowDirtyDialog] = useState(false)

  // ── 편집 모드 상태 ──
  const [editForm, setEditForm] = useState<EditFormState>(() =>
    transaction ? toEditForm(transaction) : {
      amount: 0, description: '', category_id: null,
      payment_method_id: null, date: '', memo: '', exclude_from_stats: false,
    },
  )

  // ── 데이터 로딩 ──

  const fetchData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setErrorState('none')

    try {
      // 거래 + 카테고리를 병렬 로드
      const [txRes, catRes] = await Promise.all([
        type === 'expense'
          ? expenseApi.getById(Number(id))
          : incomeApi.getById(Number(id)),
        categoryApi.getAll({ type: cfg.categoryApiType }),
      ])

      if (!isMountedRef.current) return

      setTransaction(txRes.data)
      setEditForm(toEditForm(txRes.data))
      setCategories(catRes.data)

      // 결제수단 로드 (지출 타입이고 household_id가 있을 때만)
      if (cfg.hasPaymentMethod) {
        const hhId = txRes.data.household_id ?? activeHouseholdId
        if (hhId) {
          try {
            const pmRes = await paymentMethodApi.getAll(hhId)
            if (isMountedRef.current) {
              setPaymentMethods(pmRes.data.filter((m) => m.is_active))
            }
          } catch {
            // 결제수단 로드 실패는 무시 — 선택 필드이므로 동작에 지장 없음
          }
        }
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 403) {
        addToast('error', TOAST.NO_PERMISSION)
        navigate(cfg.listRoute)
      } else if (status === 404) {
        setErrorState('notFound')
      } else {
        setErrorState('error')
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [id, type, cfg.categoryApiType, cfg.hasPaymentMethod, cfg.listRoute, activeHouseholdId, navigate, addToast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── 빠른 수정 핸들러 ──

  /** 칩 탭 → 드롭다운 열기 */
  const handleChipTap = useCallback((field: QuickEditField) => {
    if (quickEditField !== null || isSaving) return // 동시 탭 방지
    setQuickEditField(field)
  }, [quickEditField, isSaving])

  /** 드롭다운 선택 → API PUT → 칩 복귀 */
  const handleQuickSave = useCallback(async (field: 'category_id' | 'payment_method_id', value: number | null) => {
    if (!transaction) return
    setIsSaving(true)
    try {
      const api = type === 'expense' ? expenseApi : incomeApi
      const res = await api.update(transaction.id, { [field]: value })
      if (!isMountedRef.current) return
      setTransaction(res.data)
      setQuickEditField(null)

      // 성공 피드백: 칩 color flash
      const chipName = field === 'category_id' ? 'category' : 'payment_method'
      setFlashField(chipName)
      setTimeout(() => { if (isMountedRef.current) setFlashField(null) }, 400)

      // aria-live 안내 메시지
      const newLabel = field === 'category_id'
        ? (categories.find((c) => c.id === value)?.name ?? '분류 안 됨')
        : (paymentMethods.find((pm) => pm.id === value)?.name ?? '미지정')
      const fieldLabel = field === 'category_id' ? '카테고리' : '결제수단'
      setAnnouncement(`${fieldLabel}를 ${newLabel}(으)로 변경했습니다`)
    } catch (err: unknown) {
      if (!isMountedRef.current) return
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 403) {
        addToast('error', TOAST.NO_PERMISSION)
      } else {
        addToast('error', TOAST.SAVE_FAILED)
      }
    } finally {
      if (isMountedRef.current) {
        setIsSaving(false)
        setQuickEditField(null)
      }
    }
  }, [transaction, type, categories, paymentMethods, addToast])

  /** 수정 버튼 클릭 시 빠른 수정 닫고 편집 모드로 전환 */
  const handleEditClick = useCallback(() => {
    if (!transaction) return
    setQuickEditField(null)
    setEditForm(toEditForm(transaction))
    setMode('edit')
  }, [transaction])

  /** 편집 모드 저장 */
  const handleSave = useCallback(async () => {
    if (!transaction || isSaving) return

    if (!editForm.description.trim()) {
      addToast('error', '설명을 입력해주세요')
      return
    }
    if (editForm.amount <= 0) {
      addToast('error', '금액은 0보다 커야 합니다')
      return
    }

    setIsSaving(true)
    try {
      const api = type === 'expense' ? expenseApi : incomeApi
      const base = {
        amount: editForm.amount,
        description: editForm.description.trim(),
        category_id: editForm.category_id,
        date: editForm.date.includes('T') ? editForm.date : `${editForm.date}T00:00:00`,
        memo: editForm.memo.trim() || null,
        exclude_from_stats: editForm.exclude_from_stats,
      }
      const payload = cfg.hasPaymentMethod
        ? { ...base, payment_method_id: editForm.payment_method_id }
        : base
      const res = await api.update(transaction.id, payload)
      if (!isMountedRef.current) return
      setTransaction(res.data)
      setEditForm(toEditForm(res.data))
      setMode('view')
      addToast('success', TOAST.SAVED)
    } catch (err: unknown) {
      if (!isMountedRef.current) return
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 403) {
        addToast('error', TOAST.NO_PERMISSION)
      } else {
        addToast('error', TOAST.SAVE_FAILED)
      }
    } finally {
      if (isMountedRef.current) setIsSaving(false)
    }
  }, [transaction, editForm, type, cfg.hasPaymentMethod, addToast, isSaving])

  /** 편집 폼이 원본 대비 변경되었는지 확인 */
  const isDirty = useCallback(() => {
    if (!transaction) return false
    return JSON.stringify(editForm) !== JSON.stringify(toEditForm(transaction))
  }, [editForm, transaction])

  /** 목록으로 이동 — 변경사항이 있으면 다이얼로그 표시 */
  const handleNavigateAway = useCallback(() => {
    if (isDirty()) {
      setShowDirtyDialog(true)
    } else {
      navigate(cfg.listRoute)
    }
  }, [isDirty, navigate, cfg.listRoute])

  // ── 로딩 스켈레톤 ──

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-lg" />
          <Skeleton className="w-24 h-6 rounded-lg" />
        </div>
        <div className="space-y-3">
          <Skeleton className="w-48 h-10 rounded-lg" />
          <Skeleton className="w-32 h-6 rounded-lg" />
          <div className="flex gap-2">
            <Skeleton className="w-20 h-8 rounded-full" />
            <Skeleton className="w-24 h-8 rounded-full" />
          </div>
          <Skeleton className="w-28 h-4 rounded-lg" />
        </div>
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    )
  }

  // ── 에러 상태 ──

  if (errorState === 'error') {
    return <ErrorState onRetry={fetchData} />
  }

  // ── 미발견 상태 ──

  if (errorState === 'notFound' || !transaction) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--text-tertiary)] mb-4">내역을 찾을 수 없습니다</p>
        <Link to={cfg.listRoute} className={type === 'expense' ? 'text-grape-600 hover:text-grape-700' : 'text-leaf-600 hover:text-leaf-700'}>
          목록으로 돌아가기
        </Link>
      </div>
    )
  }

  // ── 데이터 조회 ──

  const category = categories.find((c) => c.id === transaction.category_id)
  const categoryName = category?.name ?? '분류 안 됨'
  const categoryEmoji = category?.emoji ?? null

  const paymentMethodId = cfg.hasPaymentMethod
    ? (transaction as Expense).payment_method_id
    : null
  const paymentMethod = paymentMethodId
    ? paymentMethods.find((pm) => pm.id === paymentMethodId) ?? null
    : null

  // ── 렌더링 ──

  return (
    <div className="space-y-6 animate-page-in">
      {/* 헤더: 뒤로가기 + 페이지 제목 */}
      <div className="flex items-center gap-3">
        {mode === 'edit' ? (
          <button
            type="button"
            aria-label="뒤로가기"
            onClick={handleNavigateAway}
            className="p-2 -ml-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
        ) : (
          <Link
            to={cfg.listRoute}
            aria-label="뒤로가기"
            className="p-2 -ml-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
          </Link>
        )}
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">{cfg.pageTitle}</h1>
      </div>

      {mode === 'view' ? (
        <>
          {/* 히어로 섹션 */}
          <div className="space-y-3">
            {/* 금액 */}
            <p className={`text-4xl font-bold ${cfg.amountColor}`}>
              {cfg.amountPrefix}{formatAmount(transaction.amount)}
            </p>

            {/* 설명 */}
            <p className="text-lg font-medium text-[var(--text-primary)]">
              {transaction.description}
            </p>

            {/* 칩 영역 */}
            <div className="flex flex-wrap gap-2">
              {/* 카테고리 칩 / 드롭다운 */}
              {quickEditField === 'category' ? (
                <select
                  data-testid="quick-select-category"
                  aria-label="카테고리 변경"
                  className="rounded-full px-3 py-1.5 text-sm min-h-[44px] bg-[var(--surface-elevated)] text-[var(--text-secondary)] border border-[var(--border-default)] focus:outline-none focus:ring-2 focus:ring-grape-400"
                  value={transaction.category_id ?? ''}
                  disabled={isSaving}
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  onChange={(e) => {
                    const val = e.target.value === '' ? null : Number(e.target.value)
                    handleQuickSave('category_id', val)
                  }}
                >
                  <option value="">분류 안 됨</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              ) : (
                <button
                  type="button"
                  data-testid="chip-category"
                  onClick={() => handleChipTap('category')}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm min-h-[44px] bg-[var(--surface-elevated)] text-[var(--text-secondary)] transition-colors duration-400 ${
                    quickEditField !== null && quickEditField !== 'category' ? 'opacity-50 pointer-events-none' : ''
                  } ${flashField === 'category' ? (cfg.color === 'grape' ? 'bg-grape-200' : 'bg-leaf-200') : ''}`}
                >
                  {categoryEmoji && <span>{categoryEmoji}</span>}
                  {categoryName}
                  <span className="text-[var(--text-muted)] text-xs ml-0.5">▾</span>
                </button>
              )}

              {/* 결제수단 칩 / 드롭다운 (지출 타입이고 결제수단이 있을 때만) */}
              {cfg.hasPaymentMethod && paymentMethod && (
                quickEditField === 'payment_method' ? (
                  <select
                    data-testid="quick-select-payment_method"
                    aria-label="결제수단 변경"
                    className="rounded-full px-3 py-1.5 text-sm min-h-[44px] bg-[var(--surface-elevated)] text-[var(--text-secondary)] border border-[var(--border-default)] focus:outline-none focus:ring-2 focus:ring-grape-400"
                    value={paymentMethodId ?? ''}
                    disabled={isSaving}
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                    onChange={(e) => {
                      const val = e.target.value === '' ? null : Number(e.target.value)
                      handleQuickSave('payment_method_id', val)
                    }}
                  >
                    <option value="">미지정</option>
                    {paymentMethods.map((pm) => (
                      <option key={pm.id} value={pm.id}>{pm.name}</option>
                    ))}
                  </select>
                ) : (
                  <button
                    type="button"
                    data-testid="chip-payment_method"
                    onClick={() => handleChipTap('payment_method')}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm min-h-[44px] bg-[var(--surface-elevated)] text-[var(--text-secondary)] transition-colors duration-400 ${
                      quickEditField !== null && quickEditField !== 'payment_method' ? 'opacity-50 pointer-events-none' : ''
                    } ${flashField === 'payment_method' ? 'bg-grape-200' : ''}`}
                  >
                    <span>{PM_ICON[paymentMethod.type] ?? '💳'}</span>
                    {paymentMethod.name}
                    <span className="text-[var(--text-muted)] text-xs ml-0.5">▾</span>
                  </button>
                )
              )}
            </div>

            {/* 접근성: 빠른 수정 결과 안내 */}
            <div aria-live="polite" className="sr-only" data-testid="live-region">
              {announcement}
            </div>

            {/* 날짜 */}
            <p className="text-xs text-[var(--text-muted)] mt-2">
              {formatDate(transaction.date)}
            </p>
          </div>

          {/* 부가 정보 카드 */}
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60 p-4 sm:p-6 space-y-4">
            {/* 메모 (있을 때만) */}
            {transaction.memo && (
              <div>
                <span className="block text-sm font-medium text-[var(--text-tertiary)] mb-1">메모</span>
                <p className="text-sm text-[var(--text-primary)]">{transaction.memo}</p>
              </div>
            )}

            {/* 원본 입력 (있을 때만) */}
            {transaction.raw_input && (
              <div>
                <span className="block text-sm font-medium text-[var(--text-tertiary)] mb-1">원본 입력</span>
                <p className="text-sm text-[var(--text-secondary)] bg-[var(--surface-elevated)] rounded-lg p-3 font-mono">
                  {transaction.raw_input}
                </p>
              </div>
            )}

            {/* 통계 제외 뱃지 */}
            {transaction.exclude_from_stats && (
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-warm-100 text-warm-700">
                통계 제외
              </span>
            )}

            {/* 정기거래 뱃지 / 등록 버튼 */}
            {transaction.recurring_transaction_id ? (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-grape-50 text-grape-700">
                🔁 정기거래 연결됨
              </span>
            ) : (
              <button
                onClick={() => setShowRecurringModal(true)}
                className={`text-sm font-medium transition-colors ${type === 'expense' ? 'text-grape-600 hover:text-grape-700' : 'text-leaf-600 hover:text-leaf-700'}`}
              >
                + 정기거래 등록
              </button>
            )}

            {/* 메타 정보 */}
            <div className="pt-4 border-t border-[var(--border-subtle)] flex gap-4 text-xs text-[var(--text-muted)]">
              <span>생성: {formatDate(transaction.created_at)}</span>
              <span>수정: {formatDate(transaction.updated_at)}</span>
            </div>
          </div>

          {/* 하단 액션 */}
          <div className="space-y-4">
            <button
              onClick={handleEditClick}
              className={`w-full py-3 text-sm font-semibold text-white rounded-xl transition-colors ${
                cfg.color === 'grape'
                  ? 'bg-grape-600 hover:bg-grape-700'
                  : 'bg-leaf-600 hover:bg-leaf-700'
              }`}
            >
              수정
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="text-sm text-rose-500 py-4 w-full text-center"
            >
              삭제하기
            </button>
          </div>
        </>
      ) : (
        <>
          {/* 편집 모드 카드 */}
          <div className={`rounded-2xl border p-4 sm:p-6 space-y-5 transition-colors duration-200 ${
            cfg.color === 'grape'
              ? 'bg-grape-50 border-grape-300'
              : 'bg-leaf-50 border-leaf-300'
          }`}>
            {/* 금액 */}
            <div>
              <label htmlFor="edit-amount" className="block text-sm font-medium text-[var(--text-tertiary)] mb-2">금액</label>
              <input
                id="edit-amount"
                type="number"
                className="input-base"
                value={editForm.amount || ''}
                onChange={(e) => setEditForm((f) => ({ ...f, amount: Number(e.target.value) || 0 }))}
                min={0}
              />
            </div>

            {/* 설명 */}
            <div>
              <label htmlFor="edit-description" className="block text-sm font-medium text-[var(--text-tertiary)] mb-2">설명</label>
              <input
                id="edit-description"
                type="text"
                className="input-base"
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            {/* 카테고리 */}
            <div>
              <label htmlFor="edit-category" className="block text-sm font-medium text-[var(--text-tertiary)] mb-2">카테고리</label>
              <select
                id="edit-category"
                className="input-base"
                value={editForm.category_id ?? ''}
                onChange={(e) => setEditForm((f) => ({ ...f, category_id: e.target.value === '' ? null : Number(e.target.value) }))}
              >
                <option value="">분류 안 됨</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* 결제수단 (지출만) */}
            {cfg.hasPaymentMethod && (
              <div>
                <label htmlFor="edit-payment-method" className="block text-sm font-medium text-[var(--text-tertiary)] mb-2">결제수단</label>
                <select
                  id="edit-payment-method"
                  className="input-base"
                  value={editForm.payment_method_id ?? ''}
                  onChange={(e) => setEditForm((f) => ({ ...f, payment_method_id: e.target.value === '' ? null : Number(e.target.value) }))}
                >
                  <option value="">미지정</option>
                  {paymentMethods.map((pm) => (
                    <option key={pm.id} value={pm.id}>{pm.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 날짜 */}
            <div>
              <label htmlFor="edit-date" className="block text-sm font-medium text-[var(--text-tertiary)] mb-2">날짜</label>
              <input
                id="edit-date"
                type="date"
                className="input-base"
                value={editForm.date}
                onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>

            {/* 메모 */}
            <div>
              <label htmlFor="edit-memo" className="block text-sm font-medium text-[var(--text-tertiary)] mb-2">메모</label>
              <input
                id="edit-memo"
                type="text"
                className="input-base"
                value={editForm.memo}
                onChange={(e) => setEditForm((f) => ({ ...f, memo: e.target.value }))}
                placeholder="메모 (선택)"
              />
            </div>

            {/* 통계 제외 토글 */}
            <div className="flex items-center justify-between">
              <label htmlFor="edit-exclude-stats" className="text-sm font-medium text-[var(--text-tertiary)]">통계 제외</label>
              <button
                id="edit-exclude-stats"
                type="button"
                role="switch"
                aria-checked={editForm.exclude_from_stats}
                onClick={() => setEditForm((f) => ({ ...f, exclude_from_stats: !f.exclude_from_stats }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  editForm.exclude_from_stats ? (cfg.color === 'grape' ? 'bg-grape-500' : 'bg-leaf-500') : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    editForm.exclude_from_stats ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* 하단 sticky CTA */}
          <div className="flex gap-3 sticky bottom-4">
            <button
              type="button"
              onClick={handleNavigateAway}
              className="flex-1 py-3 text-sm font-semibold text-center text-[var(--text-secondary)] bg-[var(--surface-card)] border border-[var(--border-default)] rounded-xl transition-colors hover:bg-[var(--surface-hover)]"
            >
              목록으로
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`flex-1 py-3 text-sm font-semibold text-white rounded-xl transition-colors ${
                cfg.color === 'grape'
                  ? 'bg-grape-600 hover:bg-grape-700'
                  : 'bg-leaf-600 hover:bg-leaf-700'
              } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isSaving ? '저장 중…' : '저장'}
            </button>
          </div>

          {/* Dirty form guard 다이얼로그 */}
          {showDirtyDialog && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                 role="dialog" aria-modal="true" aria-labelledby="dirty-dialog-title">
              <div className="bg-[var(--surface-card)] rounded-2xl shadow-xl max-w-sm w-full p-6">
                <h3 id="dirty-dialog-title" className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                  저장하지 않고 이동
                </h3>
                <p className="text-[var(--text-secondary)] mb-6">
                  변경사항이 저장되지 않았습니다. 이동하시겠습니까?
                </p>
                <div className="flex gap-3 justify-end">
                  {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
                  <button
                    autoFocus
                    onClick={() => setShowDirtyDialog(false)}
                    className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--surface-hover)] rounded-xl hover:bg-[var(--border-default)] transition-colors"
                  >
                    머무르기
                  </button>
                  <button
                    onClick={() => navigate(cfg.listRoute)}
                    className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition-colors"
                  >
                    이동하기
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
