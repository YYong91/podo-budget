/**
 * @file IncomeDetail.tsx
 * @description 수입 상세 정보 페이지 - 조회, 수정(인라인 편집), 삭제
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { incomeApi } from '../api/income'
import { categoryApi } from '../api/categories'
import type { Income, Category } from '../types'

function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

function formatDate(dateStr: string): string {
  return dateStr.slice(0, 10).replace(/-/g, '.')
}

export default function IncomeDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [income, setIncome] = useState<Income | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const [editForm, setEditForm] = useState({
    amount: 0,
    description: '',
    category_id: null as number | null,
    date: '',
  })

  useEffect(() => {
    async function fetchData() {
      if (!id) return

      try {
        const [incomeRes, categoriesRes] = await Promise.all([
          incomeApi.getById(Number(id)),
          categoryApi.getAll(),
        ])
        setIncome(incomeRes.data)
        setCategories(categoriesRes.data)

        setEditForm({
          amount: incomeRes.data.amount,
          description: incomeRes.data.description,
          category_id: incomeRes.data.category_id,
          date: incomeRes.data.date.slice(0, 10),
        })
      } catch {
        addToast('error', '수입 내역을 불러오는데 실패했습니다')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id])

  const handleSave = async () => {
    if (!income) return

    if (!editForm.description.trim()) {
      addToast('error', '설명을 입력해주세요')
      return
    }

    if (editForm.amount <= 0) {
      addToast('error', '금액은 0보다 커야 합니다')
      return
    }

    try {
      const updated = await incomeApi.update(income.id, {
        amount: editForm.amount,
        description: editForm.description.trim(),
        category_id: editForm.category_id,
        date: editForm.date.includes('T') ? editForm.date : `${editForm.date}T00:00:00`,
      })
      setIncome(updated.data)
      setIsEditing(false)
      addToast('success', '저장되었습니다')
    } catch {
      addToast('error', '저장에 실패했습니다')
    }
  }

  const handleDelete = async () => {
    if (!income) return

    try {
      await incomeApi.delete(income.id)
      addToast('success', '삭제되었습니다')
      navigate('/income')
    } catch {
      addToast('error', '삭제에 실패했습니다')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (!income) {
    return (
      <div className="text-center py-12">
        <p className="text-stone-500 mb-4">수입 내역을 찾을 수 없습니다</p>
        <Link to="/income" className="text-emerald-600 hover:text-emerald-700">
          목록으로 돌아가기
        </Link>
      </div>
    )
  }

  const categoryName =
    categories.find((c) => c.id === income.category_id)?.name || '미분류'

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/income"
            aria-label="목록으로"
            className="p-2 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-stone-600" />
          </Link>
          <h1 className="text-xl font-semibold text-stone-800">수입 상세</h1>
        </div>

        <div className="flex gap-2 justify-end">
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-stone-700 bg-white border border-stone-300 rounded-xl hover:bg-stone-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 shadow-sm shadow-emerald-200 transition-colors"
              >
                저장
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors"
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

      {/* 수입 정보 카드 */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200/60 p-4 sm:p-6 space-y-5">
        {/* 금액 */}
        <div>
          <label className="block text-sm font-medium text-stone-500 mb-2">금액</label>
          {isEditing ? (
            <input
              type="number"
              value={editForm.amount}
              onChange={(e) => setEditForm({ ...editForm, amount: Number(e.target.value) })}
              className="w-full px-4 py-2 text-xl sm:text-2xl font-bold text-stone-900 border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              placeholder="10000"
            />
          ) : (
            <p className="text-2xl sm:text-3xl font-bold text-emerald-700">
              +{formatAmount(income.amount)}
            </p>
          )}
        </div>

        {/* 설명 */}
        <div>
          <label className="block text-sm font-medium text-stone-500 mb-2">설명</label>
          {isEditing ? (
            <input
              type="text"
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              className="w-full px-4 py-2 text-lg border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              placeholder="월급"
            />
          ) : (
            <p className="text-lg text-stone-900">{income.description}</p>
          )}
        </div>

        {/* 카테고리 */}
        <div>
          <label className="block text-sm font-medium text-stone-500 mb-2">카테고리</label>
          {isEditing ? (
            <select
              value={editForm.category_id ?? ''}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  category_id: e.target.value ? Number(e.target.value) : null,
                })
              }
              className="w-full px-4 py-2 text-lg border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            >
              <option value="">미분류</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-lg text-stone-900">{categoryName}</p>
          )}
        </div>

        {/* 날짜 */}
        <div>
          <label className="block text-sm font-medium text-stone-500 mb-2">날짜</label>
          {isEditing ? (
            <input
              type="date"
              value={editForm.date}
              onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
              className="w-full px-4 py-2 text-lg border border-stone-300 rounded-xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            />
          ) : (
            <p className="text-lg text-stone-900">{formatDate(income.date)}</p>
          )}
        </div>

        {/* 원본 입력 */}
        {income.raw_input && (
          <div>
            <label className="block text-sm font-medium text-stone-500 mb-2">원본 입력</label>
            <p className="text-sm text-stone-600 bg-stone-50 rounded-lg p-3 font-mono">
              {income.raw_input}
            </p>
          </div>
        )}

        {/* 메타 정보 */}
        <div className="pt-4 border-t border-stone-100 flex gap-4 text-xs text-stone-400">
          <span>생성: {formatDate(income.created_at)}</span>
          <span>수정: {formatDate(income.updated_at)}</span>
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-stone-900 mb-2">수입 내역 삭제</h3>
            <p className="text-stone-600 mb-6">
              정말로 이 수입 내역을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-sm font-medium text-stone-700 bg-stone-100 rounded-xl hover:bg-stone-200 transition-colors"
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
