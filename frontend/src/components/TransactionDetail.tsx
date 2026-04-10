/**
 * @file TransactionDetail.tsx
 * @description 지출/수입 상세 정보 통합 컴포넌트
 * type prop으로 지출/수입을 구분하며, 뷰 모드 렌더링을 제공한다.
 * ExpenseDetail과 IncomeDetail을 통합한 컴포넌트로, 추후 편집/삭제/정기거래 기능이 추가된다.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { expenseApi } from '../api/expenses'
import { incomeApi } from '../api/income'
import { categoryApi } from '../api/categories'
import { paymentMethodApi } from '../api/paymentMethods'
import { useHouseholdStore } from '../stores/useHouseholdStore'
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

/** ISO 날짜 문자열을 YYYY.MM.DD 형식으로 변환 */
function formatDate(dateStr: string): string {
  return dateStr.slice(0, 10).replace(/-/g, '.')
}

// ── 컴포넌트 ──

export default function TransactionDetail({ type }: TransactionDetailProps) {
  const cfg = TYPE_CONFIG[type]
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)

  // isMountedRef — 비동기 작업 완료 후 언마운트된 컴포넌트에 setState 호출 방지
  const isMountedRef = useRef(true)
  useEffect(() => () => { isMountedRef.current = false }, [])

  // 상태
  const [transaction, setTransaction] = useState<Expense | Income | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [errorState, setErrorState] = useState<PageErrorState>('none')
  // mode/showDeleteModal/showRecurringModal — 현재는 뷰 모드만 구현, Task 3/5에서 활성화
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [mode, setMode] = useState<DetailMode>(() =>
    searchParams.get('edit') === 'true' ? 'edit' : 'view',
  )
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showRecurringModal, setShowRecurringModal] = useState(false)

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
      if (status === 404) {
        setErrorState('notFound')
      } else {
        setErrorState('error')
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [id, type, cfg.categoryApiType, cfg.hasPaymentMethod, activeHouseholdId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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
        <Link to={cfg.listRoute} className={`text-${cfg.color}-600 hover:text-${cfg.color}-700`}>
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
        <Link
          to={cfg.listRoute}
          aria-label="목록으로"
          className="p-2 -ml-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </Link>
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">{cfg.pageTitle}</h1>
      </div>

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
          {/* 카테고리 칩 */}
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm bg-[var(--surface-elevated)] text-[var(--text-primary)]">
            {categoryEmoji && <span>{categoryEmoji}</span>}
            {categoryName}
            <span className="text-[var(--text-muted)] text-xs ml-0.5">▾</span>
          </span>

          {/* 결제수단 칩 (지출 타입이고 결제수단이 있을 때만) */}
          {cfg.hasPaymentMethod && paymentMethod && (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm bg-[var(--surface-elevated)] text-[var(--text-primary)]">
              <span>{PM_ICON[paymentMethod.type] ?? '💳'}</span>
              {paymentMethod.name}
              <span className="text-[var(--text-muted)] text-xs ml-0.5">▾</span>
            </span>
          )}
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
            🔁 정기거래
          </span>
        ) : (
          <button
            onClick={() => setShowRecurringModal(true)}
            className={`text-sm font-medium text-${cfg.color}-600 hover:text-${cfg.color}-700 transition-colors`}
          >
            정기거래 등록
          </button>
        )}

        {/* 메타 정보 */}
        <div className="pt-4 border-t border-[var(--border-subtle)] flex gap-4 text-xs text-[var(--text-muted)]">
          <span>생성: {formatDate(transaction.created_at)}</span>
          <span>수정: {formatDate(transaction.updated_at)}</span>
        </div>
      </div>

      {/* 하단 액션 */}
      <div className="space-y-2">
        <button
          onClick={() => setMode('edit')}
          className={`w-full py-3 text-sm font-semibold text-white rounded-2xl transition-colors ${
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
          삭제
        </button>
      </div>
    </div>
  )
}
