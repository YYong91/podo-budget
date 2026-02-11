/* 지출 목록 페이지 - 필터링, 정렬, 페이지네이션 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { expenseApi } from '../api/expenses'
import { categoryApi } from '../api/categories'
import type { Expense, Category } from '../types'

function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

export default function ExpenseList() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const limit = 20

  /* 필터 상태 */
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [categoryId, setCategoryId] = useState<number | undefined>()

  async function fetchExpenses() {
    setLoading(true)
    try {
      const res = await expenseApi.getAll({
        skip: page * limit,
        limit,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        category_id: categoryId,
      })
      setExpenses(res.data)
    } catch {
      // API 미연결
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    categoryApi.getAll().then((res) => setCategories(res.data)).catch(() => {})
  }, [])

  useEffect(() => {
    fetchExpenses()
  }, [page, startDate, endDate, categoryId])

  /* 카테고리 이름 찾기 */
  function getCategoryName(catId: number | null): string {
    if (!catId) return '미분류'
    return categories.find((c) => c.id === catId)?.name ?? '미분류'
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">지출 목록</h1>

      {/* 필터 바 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">시작일</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(0) }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">종료일</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(0) }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">카테고리</label>
            <select
              value={categoryId ?? ''}
              onChange={(e) => { setCategoryId(e.target.value ? Number(e.target.value) : undefined); setPage(0) }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">전체</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => { setStartDate(''); setEndDate(''); setCategoryId(undefined); setPage(0) }}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            필터 초기화
          </button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
          </div>
        ) : expenses.length > 0 ? (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">날짜</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">내용</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3 hidden sm:table-cell">카테고리</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3">금액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {expenses.map((expense) => (
                <tr key={expense.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {expense.date.slice(0, 10)}
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/expenses/${expense.id}`} className="text-sm font-medium text-gray-900 hover:text-primary-600">
                      {expense.description}
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="inline-block bg-primary-50 text-primary-700 text-xs px-2 py-1 rounded-full">
                      {getCategoryName(expense.category_id)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right whitespace-nowrap">
                    {formatAmount(expense.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-400 text-center py-12">지출 내역이 없습니다</p>
        )}
      </div>

      {/* 페이지네이션 */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
        >
          이전
        </button>
        <span className="text-sm text-gray-500">페이지 {page + 1}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={expenses.length < limit}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
        >
          다음
        </button>
      </div>
    </div>
  )
}
