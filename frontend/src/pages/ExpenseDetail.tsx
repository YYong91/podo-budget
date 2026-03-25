/**
 * @file ExpenseDetail.tsx
 * @description 지출 상세 정보 페이지
 * 지출 내역 조회, 수정(인라인 편집), 삭제 기능을 제공한다.
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { expenseApi } from '../api/expenses'
import { categoryApi } from '../api/categories'
import RegisterRecurringModal from '../components/RegisterRecurringModal'
import ErrorState from '../components/ErrorState'
import LoadingSpinner from '../components/LoadingSpinner'
import type { Expense, Category } from '../types'
import { formatAmount } from '../utils/format'

/**
 * ISO 날짜 문자열을 YYYY.MM.DD 형식으로 변환
 */
function formatDate(dateStr: string): string {
  return dateStr.slice(0, 10).replace(/-/g, '.')
}

export default function ExpenseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [expense, setExpense] = useState<Expense | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showRecurringModal, setShowRecurringModal] = useState(false)

  // 편집 모드 상태
  const [editForm, setEditForm] = useState({
    amount: 0,
    description: '',
    category_id: null as number | null,
    date: '',
    memo: '',
    exclude_from_stats: false,
  })

  const fetchData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(false)

    try {
      const [expenseRes, categoriesRes] = await Promise.all([
        expenseApi.getById(Number(id)),
        categoryApi.getAll(),
      ])
      setExpense(expenseRes.data)
      setCategories(categoriesRes.data)

      // 편집 폼 초기화
      setEditForm({
        amount: expenseRes.data.amount,
        description: expenseRes.data.description,
        category_id: expenseRes.data.category_id,
        date: expenseRes.data.date.slice(0, 10), // YYYY-MM-DD
        memo: expenseRes.data.memo ?? '',
        exclude_from_stats: expenseRes.data.exclude_from_stats ?? false,
      })
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  /**
   * 저장 버튼 클릭 - PUT /api/expenses/{id}
   */
  const handleSave = async () => {
    if (!expense) return

    if (!editForm.description.trim()) {
      addToast('error', '설명을 입력해주세요')
      return
    }

    if (editForm.amount <= 0) {
      addToast('error', '금액은 0보다 커야 합니다')
      return
    }

    try {
      const updated = await expenseApi.update(expense.id, {
        amount: editForm.amount,
        description: editForm.description.trim(),
        category_id: editForm.category_id,
        // date input은 YYYY-MM-DD 형식이므로 datetime으로 변환
        date: editForm.date.includes('T') ? editForm.date : `${editForm.date}T00:00:00`,
        memo: editForm.memo.trim() || undefined,
        exclude_from_stats: editForm.exclude_from_stats,
      })
      setExpense(updated.data)
      setIsEditing(false)
      addToast('success', '저장되었습니다')
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 403) {
        addToast('error', '이 항목을 수정할 권한이 없습니다')
      } else {
        addToast('error', '저장에 실패했습니다')
      }
    }
  }

  /**
   * 삭제 확인 후 DELETE /api/expenses/{id}
   */
  const handleDelete = async () => {
    if (!expense) return

    try {
      await expenseApi.delete(expense.id)
      addToast('success', '삭제되었습니다')
      navigate('/expenses')
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 403) {
        addToast('error', '이 항목을 삭제할 권한이 없습니다')
      } else {
        addToast('error', '삭제에 실패했습니다')
      }
    }
  }

  if (loading) {
    return <LoadingSpinner />
  }

  if (error) {
    return <ErrorState onRetry={fetchData} />
  }

  if (!expense) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--text-tertiary)] mb-4">지출 내역을 찾을 수 없습니다</p>
        <Link to="/expenses" className="text-grape-600 hover:text-grape-700">
          목록으로 돌아가기
        </Link>
      </div>
    )
  }

  // 카테고리명 조회
  const categoryName =
    categories.find((c) => c.id === expense.category_id)?.name || '미분류'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/expenses"
          aria-label="목록으로"
          className="p-2 -ml-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </Link>

        <div className="flex flex-wrap gap-2">
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--surface-card)] border border-[var(--input-border)] rounded-xl hover:bg-[var(--surface-elevated)] transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-white bg-grape-600 rounded-xl hover:bg-grape-700 shadow-sm shadow-grape-200 transition-colors"
              >
                저장
              </button>
            </>
          ) : (
            <>
              {!expense.recurring_transaction_id && (
                <button
                  onClick={() => setShowRecurringModal(true)}
                  className="shrink-0 whitespace-nowrap px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--surface-hover)] rounded-xl hover:bg-[var(--border-default)] transition-colors"
                >
                  반복 거래 등록
                </button>
              )}
              <button
                onClick={() => setIsEditing(true)}
                className="shrink-0 px-4 py-2 text-sm font-medium text-grape-600 bg-grape-50 rounded-xl hover:bg-grape-100 transition-colors"
              >
                수정
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="shrink-0 px-4 py-2 text-sm font-medium text-rose-600 bg-rose-50 rounded-xl hover:bg-rose-100 transition-colors"
              >
                삭제
              </button>
            </>
          )}
        </div>
      </div>

      {/* 지출 정보 카드 */}
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60 p-4 sm:p-6 space-y-5">
        {/* 금액 */}
        <div>
          <label htmlFor="expense-edit-amount" className="block text-sm font-medium text-[var(--text-tertiary)] mb-2">
            금액
          </label>
          {isEditing ? (
            <input
              id="expense-edit-amount"
              type="number"
              value={editForm.amount}
              onChange={(e) =>
                setEditForm({ ...editForm, amount: Number(e.target.value) })
              }
              className="w-full px-4 py-2 text-xl sm:text-2xl font-bold text-[var(--text-primary)] border border-[var(--input-border)] rounded-xl focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
              placeholder="10000"
            />
          ) : (
            <p className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">
              {formatAmount(expense.amount)}
            </p>
          )}
        </div>

        {/* 설명 */}
        <div>
          <label htmlFor="expense-edit-description" className="block text-sm font-medium text-[var(--text-tertiary)] mb-2">
            설명
          </label>
          {isEditing ? (
            <input
              id="expense-edit-description"
              type="text"
              value={editForm.description}
              onChange={(e) =>
                setEditForm({ ...editForm, description: e.target.value })
              }
              className="w-full px-4 py-2 text-lg border border-[var(--input-border)] rounded-xl focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
              placeholder="김치찌개"
            />
          ) : (
            <p className="text-lg text-[var(--text-primary)]">{expense.description}</p>
          )}
        </div>

        {/* 카테고리 */}
        <div>
          <label htmlFor="expense-edit-category" className="block text-sm font-medium text-[var(--text-tertiary)] mb-2">
            카테고리
          </label>
          {isEditing ? (
            <select
              id="expense-edit-category"
              value={editForm.category_id ?? ''}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  category_id: e.target.value ? Number(e.target.value) : null,
                })
              }
              className="w-full px-4 py-2 text-lg border border-[var(--input-border)] rounded-xl focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
            >
              <option value="">미분류</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-lg text-[var(--text-primary)]">{categoryName}</p>
          )}
        </div>

        {/* 날짜 */}
        <div>
          <label htmlFor="expense-edit-date" className="block text-sm font-medium text-[var(--text-tertiary)] mb-2">
            날짜
          </label>
          {isEditing ? (
            <input
              id="expense-edit-date"
              type="date"
              value={editForm.date}
              onChange={(e) =>
                setEditForm({ ...editForm, date: e.target.value })
              }
              className="w-full px-4 py-2 text-lg border border-[var(--input-border)] rounded-xl focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
            />
          ) : (
            <p className="text-lg text-[var(--text-primary)]">{formatDate(expense.date)}</p>
          )}
        </div>

        {/* 메모 */}
        <div>
          <label htmlFor="expense-edit-memo" className="block text-sm font-medium text-[var(--text-tertiary)] mb-2">
            메모
          </label>
          {isEditing ? (
            <input
              id="expense-edit-memo"
              type="text"
              value={editForm.memo}
              onChange={(e) =>
                setEditForm({ ...editForm, memo: e.target.value })
              }
              placeholder="추가 메모 (선택)"
              className="w-full px-4 py-2 text-lg border border-[var(--input-border)] rounded-xl focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
            />
          ) : expense.memo ? (
            <p className="text-lg text-[var(--text-primary)]">{expense.memo}</p>
          ) : (
            <p className="text-lg text-[var(--text-muted)]">-</p>
          )}
        </div>

        {/* 통계 제외 */}
        <div>
          <span className="block text-sm font-medium text-[var(--text-tertiary)] mb-2">
            통계 제외
          </span>
          {isEditing ? (
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={editForm.exclude_from_stats}
                  onChange={(e) => setEditForm({ ...editForm, exclude_from_stats: e.target.checked })}
                  className="sr-only"
                />
                <div className={`w-10 h-6 rounded-full transition-colors ${editForm.exclude_from_stats ? 'bg-[var(--text-muted)]' : 'bg-[var(--border-default)]'}`} />
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${editForm.exclude_from_stats ? 'translate-x-4' : ''}`} />
              </div>
              <span className="text-sm text-[var(--text-secondary)]">차트/통계에서 제외</span>
            </label>
          ) : (
            <p className="text-lg text-[var(--text-primary)]">{expense.exclude_from_stats ? '제외됨' : '-'}</p>
          )}
        </div>

        {/* 원본 입력 (읽기 전용) */}
        {expense.raw_input && (
          <div>
            <span className="block text-sm font-medium text-[var(--text-tertiary)] mb-2">
              원본 입력
            </span>
            <p className="text-sm text-[var(--text-secondary)] bg-[var(--surface-elevated)] rounded-lg p-3 font-mono">
              {expense.raw_input}
            </p>
          </div>
        )}

        {/* 메타 정보 */}
        <div className="pt-4 border-t border-[var(--border-subtle)] flex gap-4 text-xs text-[var(--text-muted)]">
          <span>생성: {formatDate(expense.created_at)}</span>
          <span>수정: {formatDate(expense.updated_at)}</span>
        </div>
      </div>

      {/* 정기거래 등록 모달 */}
      {showRecurringModal && expense && (
        <RegisterRecurringModal
          type="expense"
          amount={expense.amount}
          description={expense.description}
          category_id={expense.category_id}
          categories={categories}
          initialDate={expense.date}
          sourceId={expense.id}
          onClose={() => setShowRecurringModal(false)}
          onSuccess={() => {
            setShowRecurringModal(false)
            fetchData()
          }}
        />
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="expense-delete-title">
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 id="expense-delete-title" className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              지출 내역 삭제
            </h3>
            <p className="text-[var(--text-secondary)] mb-6">
              정말로 이 지출 내역을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--surface-hover)] rounded-xl hover:bg-[var(--border-default)] transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
