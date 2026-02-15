/**
 * @file ExpenseList.tsx
 * @description 지출 목록 페이지 - 필터링, 정렬, 페이지네이션
 * 날짜/카테고리/멤버 필터, 날짜/금액 정렬, 페이지네이션을 제공한다.
 */

import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { expenseApi } from '../api/expenses'
import { categoryApi } from '../api/categories'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import type { Expense, Category, HouseholdMember } from '../types'

/* 정렬 타입 정의 */
type SortField = 'date' | 'amount'
type SortDirection = 'asc' | 'desc'

function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

export default function ExpenseList() {
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)
  const currentHousehold = useHouseholdStore((s) => s.currentHousehold)
  const fetchHouseholdDetail = useHouseholdStore((s) => s.fetchHouseholdDetail)

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [members, setMembers] = useState<HouseholdMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [page, setPage] = useState(0)
  const limit = 20

  /* 필터 상태 */
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [categoryId, setCategoryId] = useState<number | undefined>()
  const [memberUserId, setMemberUserId] = useState<number | undefined>()

  /* 정렬 상태 */
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  /**
   * 지출 목록 조회
   */
  async function fetchExpenses() {
    setLoading(true)
    setError(false)
    try {
      const res = await expenseApi.getAll({
        skip: page * limit,
        limit,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        category_id: categoryId,
        household_id: activeHouseholdId ?? undefined,
        member_user_id: memberUserId,
      })
      setExpenses(res.data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  /**
   * 정렬 토글 핸들러
   */
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  /**
   * 정렬 아이콘 렌더링
   */
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <span className="text-stone-300 ml-1">⇅</span>
    }
    return (
      <span className="text-amber-600 ml-1">
        {sortDirection === 'asc' ? '▲' : '▼'}
      </span>
    )
  }

  /**
   * 클라이언트 사이드 정렬 적용
   */
  const sortedExpenses = useMemo(() => {
    const sorted = [...expenses]
    sorted.sort((a, b) => {
      let comparison = 0
      if (sortField === 'date') {
        comparison = a.date.localeCompare(b.date)
      } else if (sortField === 'amount') {
        comparison = a.amount - b.amount
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })
    return sorted
  }, [expenses, sortField, sortDirection])

  // 카테고리 목록 로드
  useEffect(() => {
    categoryApi.getAll().then((res) => setCategories(res.data)).catch(() => {})
  }, [])

  // 활성 가구 변경 시 멤버 목록 로드
  useEffect(() => {
    if (activeHouseholdId) {
      fetchHouseholdDetail(activeHouseholdId).catch(() => {})
    } else {
      setMembers([])
      setMemberUserId(undefined)
    }
  }, [activeHouseholdId, fetchHouseholdDetail])

  // currentHousehold 변경 시 멤버 목록 동기화
  useEffect(() => {
    if (currentHousehold && currentHousehold.id === activeHouseholdId) {
      setMembers(currentHousehold.members)
    } else {
      setMembers([])
    }
  }, [currentHousehold, activeHouseholdId])

  useEffect(() => {
    fetchExpenses()
  }, [page, startDate, endDate, categoryId, activeHouseholdId, memberUserId])

  /**
   * 카테고리 이름 찾기
   */
  function getCategoryName(catId: number | null): string {
    if (!catId) return '미분류'
    return categories.find((c) => c.id === catId)?.name ?? '미분류'
  }

  /**
   * 멤버 이름 찾기
   */
  function getMemberName(userId: number | null): string {
    if (!userId) return ''
    return members.find((m) => m.user_id === userId)?.username ?? ''
  }

  /* 에러 발생 시 */
  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-stone-800">지출 목록</h1>
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200/60">
          <ErrorState onRetry={fetchExpenses} />
        </div>
      </div>
    )
  }

  // 가구 활성 상태이고 멤버 2명 이상일 때만 멤버 필터 표시
  const showMemberFilter = activeHouseholdId != null && members.length > 1

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-stone-800">지출 목록</h1>

      {/* 필터 바 */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200/60 p-4">
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${showMemberFilter ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
          <div>
            <label className="block text-xs text-stone-400 mb-1">시작일</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(0) }}
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs text-stone-400 mb-1">종료일</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(0) }}
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs text-stone-400 mb-1">카테고리</label>
            <select
              value={categoryId ?? ''}
              onChange={(e) => { setCategoryId(e.target.value ? Number(e.target.value) : undefined); setPage(0) }}
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
            >
              <option value="">전체</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          {/* 멤버 필터 (가구 활성 + 멤버 2명 이상) */}
          {showMemberFilter && (
            <div>
              <label className="block text-xs text-stone-400 mb-1">멤버</label>
              <select
                value={memberUserId ?? ''}
                onChange={(e) => { setMemberUserId(e.target.value ? Number(e.target.value) : undefined); setPage(0) }}
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
              >
                <option value="">전체 멤버</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>{m.username}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-end">
            <button
              onClick={() => { setStartDate(''); setEndDate(''); setCategoryId(undefined); setMemberUserId(undefined); setPage(0) }}
              className="w-full sm:w-auto px-4 py-2 text-sm text-stone-500 hover:text-stone-600 underline"
            >
              필터 초기화
            </button>
          </div>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200/60 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
          </div>
        ) : expenses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th
                    className="text-left text-xs font-medium text-stone-400 uppercase px-4 py-3 cursor-pointer hover:bg-stone-100 select-none transition-colors"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center">
                      날짜
                      {renderSortIcon('date')}
                    </div>
                  </th>
                  <th className="text-left text-xs font-medium text-stone-400 uppercase px-4 py-3">내용</th>
                  <th className="text-left text-xs font-medium text-stone-400 uppercase px-4 py-3 hidden sm:table-cell">카테고리</th>
                  {/* 가구 활성 시 작성자 열 표시 */}
                  {showMemberFilter && (
                    <th className="text-left text-xs font-medium text-stone-400 uppercase px-4 py-3 hidden md:table-cell">작성자</th>
                  )}
                  <th
                    className="text-right text-xs font-medium text-stone-400 uppercase px-4 py-3 cursor-pointer hover:bg-stone-100 select-none transition-colors"
                    onClick={() => handleSort('amount')}
                  >
                    <div className="flex items-center justify-end">
                      금액
                      {renderSortIcon('amount')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {sortedExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-amber-50/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-stone-600 whitespace-nowrap">
                      {expense.date.slice(0, 10).replace(/-/g, '.')}
                    </td>
                    <td className="px-4 py-3 max-w-[200px] sm:max-w-none">
                      <Link to={`/expenses/${expense.id}`} className="text-sm font-medium text-stone-900 hover:text-amber-600 transition-colors block truncate">
                        {expense.description}
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="inline-block bg-amber-50 text-amber-700 text-xs px-2 py-1 rounded-full">
                        {getCategoryName(expense.category_id)}
                      </span>
                    </td>
                    {showMemberFilter && (
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-stone-500">
                          {getMemberName(expense.user_id)}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm font-semibold text-stone-900 text-right whitespace-nowrap">
                      {formatAmount(expense.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="지출 내역이 없습니다"
            description="필터 조건을 변경하거나 새로운 지출을 추가해보세요."
          />
        )}
      </div>

      {/* 페이지네이션 */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="px-4 py-2 text-sm border border-stone-300 rounded-lg disabled:opacity-40 hover:bg-stone-50"
        >
          이전
        </button>
        <span className="text-sm text-stone-500">페이지 {page + 1}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={expenses.length < limit}
          className="px-4 py-2 text-sm border border-stone-300 rounded-lg disabled:opacity-40 hover:bg-stone-50"
        >
          다음
        </button>
      </div>
    </div>
  )
}
