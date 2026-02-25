/**
 * @file ExpenseDetail.tsx
 * @description 지출 상세 정보 페이지
 * 지출 내역 조회, 수정(인라인 편집), 삭제 기능을 제공한다.
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { expenseApi } from '../api/expenses'
import { categoryApi } from '../api/categories'
import type { Expense, Category } from '../types'

/**
 * 금액을 한국 원화 형식으로 포맷
 */
function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

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
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // 편집 모드 상태
  const [editForm, setEditForm] = useState({
    amount: 0,
    description: '',
    category_id: null as number | null,
    date: '',
    memo: '',
    exclude_from_stats: false,
  })

  useEffect(() => {
    async function fetchData() {
      if (!id) return

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
        addToast('error', '지출 내역을 불러오는데 실패했습니다')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id])

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
    } catch {
      addToast('error', '저장에 실패했습니다')
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
    } catch {
      addToast('error', '삭제에 실패했습니다')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-grape-600" />
      </div>
    )
  }

  if (!expense) {
    return (
      <div className="text-center py-12">
        <p className="text-warm-500 mb-4">지출 내역을 찾을 수 없습니다</p>
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
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/expenses"
            aria-label="목록으로"
            className="p-2 rounded-lg hover:bg-warm-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-warm-600" />
          </Link>
          <h1 className="text-xl font-bold text-grape-700">지출 상세</h1>
        </div>

        <div className="flex gap-2 justify-end">
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-warm-700 bg-white border border-warm-300 rounded-xl hover:bg-warm-50 transition-colors"
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
              <button
                onClick={() => setIsEditing(true)}
                className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-grape-700 bg-grape-50 rounded-xl hover:bg-grape-100 transition-colors"
              >
                수정
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-rose-700 bg-rose-50 rounded-xl hover:bg-rose-100 transition-colors"
              >
                삭제
              </button>
            </>
          )}
        </div>
      </div>

      {/* 지출 정보 카드 */}
      <div className="bg-white rounded-2xl shadow-sm border border-warm-200/60 p-4 sm:p-6 space-y-5">
        {/* 금액 */}
        <div>
          <label className="block text-sm font-medium text-warm-500 mb-2">
            금액
          </label>
          {isEditing ? (
            <input
              type="number"
              value={editForm.amount}
              onChange={(e) =>
                setEditForm({ ...editForm, amount: Number(e.target.value) })
              }
              className="w-full px-4 py-2 text-xl sm:text-2xl font-bold text-warm-900 border border-warm-300 rounded-xl focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
              placeholder="10000"
            />
          ) : (
            <p className="text-2xl sm:text-3xl font-bold text-warm-900">
              {formatAmount(expense.amount)}
            </p>
          )}
        </div>

        {/* 설명 */}
        <div>
          <label className="block text-sm font-medium text-warm-500 mb-2">
            설명
          </label>
          {isEditing ? (
            <input
              type="text"
              value={editForm.description}
              onChange={(e) =>
                setEditForm({ ...editForm, description: e.target.value })
              }
              className="w-full px-4 py-2 text-lg border border-warm-300 rounded-xl focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
              placeholder="김치찌개"
            />
          ) : (
            <p className="text-lg text-warm-900">{expense.description}</p>
          )}
        </div>

        {/* 카테고리 */}
        <div>
          <label className="block text-sm font-medium text-warm-500 mb-2">
            카테고리
          </label>
          {isEditing ? (
            <select
              value={editForm.category_id ?? ''}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  category_id: e.target.value ? Number(e.target.value) : null,
                })
              }
              className="w-full px-4 py-2 text-lg border border-warm-300 rounded-xl focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
            >
              <option value="">미분류</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-lg text-warm-900">{categoryName}</p>
          )}
        </div>

        {/* 날짜 */}
        <div>
          <label className="block text-sm font-medium text-warm-500 mb-2">
            날짜
          </label>
          {isEditing ? (
            <input
              type="date"
              value={editForm.date}
              onChange={(e) =>
                setEditForm({ ...editForm, date: e.target.value })
              }
              className="w-full px-4 py-2 text-lg border border-warm-300 rounded-xl focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
            />
          ) : (
            <p className="text-lg text-warm-900">{formatDate(expense.date)}</p>
          )}
        </div>

        {/* 메모 */}
        <div>
          <label className="block text-sm font-medium text-warm-500 mb-2">
            메모
          </label>
          {isEditing ? (
            <input
              type="text"
              value={editForm.memo}
              onChange={(e) =>
                setEditForm({ ...editForm, memo: e.target.value })
              }
              placeholder="추가 메모 (선택)"
              className="w-full px-4 py-2 text-lg border border-warm-300 rounded-xl focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
            />
          ) : expense.memo ? (
            <p className="text-lg text-warm-900">{expense.memo}</p>
          ) : (
            <p className="text-lg text-warm-400">-</p>
          )}
        </div>

        {/* 통계 제외 */}
        <div>
          <label className="block text-sm font-medium text-warm-500 mb-2">
            통계 제외
          </label>
          {isEditing ? (
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={editForm.exclude_from_stats}
                  onChange={(e) => setEditForm({ ...editForm, exclude_from_stats: e.target.checked })}
                  className="sr-only"
                />
                <div className={`w-10 h-6 rounded-full transition-colors ${editForm.exclude_from_stats ? 'bg-warm-400' : 'bg-warm-200'}`} />
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${editForm.exclude_from_stats ? 'translate-x-4' : ''}`} />
              </div>
              <span className="text-sm text-warm-700">차트/통계에서 제외</span>
            </label>
          ) : (
            <p className="text-lg text-warm-900">{expense.exclude_from_stats ? '제외됨' : '-'}</p>
          )}
        </div>

        {/* 원본 입력 (읽기 전용) */}
        {expense.raw_input && (
          <div>
            <label className="block text-sm font-medium text-warm-500 mb-2">
              원본 입력
            </label>
            <p className="text-sm text-warm-600 bg-warm-50 rounded-lg p-3 font-mono">
              {expense.raw_input}
            </p>
          </div>
        )}

        {/* 메타 정보 */}
        <div className="pt-4 border-t border-warm-100 flex gap-4 text-xs text-warm-400">
          <span>생성: {formatDate(expense.created_at)}</span>
          <span>수정: {formatDate(expense.updated_at)}</span>
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-warm-900 mb-2">
              지출 내역 삭제
            </h3>
            <p className="text-warm-600 mb-6">
              정말로 이 지출 내역을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-sm font-medium text-warm-700 bg-warm-100 rounded-xl hover:bg-warm-200 transition-colors"
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
