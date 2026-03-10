/**
 * @file ExpenseList.tsx
 * @description 지출 목록 페이지 - 필터링, 정렬, 페이지네이션
 * 날짜/카테고리/멤버 필터, 날짜/금액 정렬, 페이지네이션을 제공한다.
 */

import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, PlusCircle } from 'lucide-react'
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

/** 날짜를 YYYY-MM-DD 문자열로 변환 (로컬 타임존 기준) */
function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 빠른 날짜 선택 프리셋 */
const DATE_PRESETS = [
  {
    label: '이번주',
    getRange: () => {
      const today = new Date()
      const day = today.getDay()
      const diff = day === 0 ? -6 : 1 - day
      const monday = new Date(today)
      monday.setDate(today.getDate() + diff)
      return { start: toDateString(monday), end: toDateString(today) }
    },
  },
  {
    label: '지난주',
    getRange: () => {
      const today = new Date()
      const day = today.getDay()
      const diff = day === 0 ? -6 : 1 - day
      const monday = new Date(today)
      monday.setDate(today.getDate() + diff - 7)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      return { start: toDateString(monday), end: toDateString(sunday) }
    },
  },
  {
    label: '이번달',
    getRange: () => {
      const today = new Date()
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      return { start: toDateString(start), end: toDateString(today) }
    },
  },
  {
    label: '저번달',
    getRange: () => {
      const today = new Date()
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const end = new Date(today.getFullYear(), today.getMonth(), 0)
      return { start: toDateString(start), end: toDateString(end) }
    },
  },
]

export default function ExpenseList() {
  const navigate = useNavigate()
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)
  const currentHousehold = useHouseholdStore((s) => s.currentHousehold)
  const fetchHouseholdDetail = useHouseholdStore((s) => s.fetchHouseholdDetail)

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [members, setMembers] = useState<HouseholdMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const limit = 20

  /* URL 쿼리 파라미터로 필터/페이지 상태 관리 (뒤로가기 시 복원) */
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parseInt(searchParams.get('page') ?? '0', 10)
  const startDate = searchParams.get('start') ?? ''
  const endDate = searchParams.get('end') ?? ''
  const categoryId = searchParams.get('cat') ? Number(searchParams.get('cat')) : undefined
  const memberUserId = searchParams.get('member') ? Number(searchParams.get('member')) : undefined

  /* 정렬 상태 (클라이언트 사이드 — URL에 반영) */
  const sortField = (searchParams.get('sort') ?? 'date') as SortField
  const sortDirection = (searchParams.get('dir') ?? 'desc') as SortDirection

  /** URL 파라미터 업데이트 헬퍼 (기존 파라미터 유지, replace로 히스토리 오염 방지) */
  function setParams(updates: Record<string, string | null>) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(updates)) {
          if (value === null || value === '') next.delete(key)
          else next.set(key, value)
        }
        return next
      },
      { replace: true }
    )
  }

  function setPage(newPage: number) { setParams({ page: newPage === 0 ? null : String(newPage) }) }
  function setStartDate(val: string) { setParams({ start: val || null, page: null }) }
  function setEndDate(val: string) { setParams({ end: val || null, page: null }) }
  function setCategoryId(val: number | undefined) { setParams({ cat: val != null ? String(val) : null, page: null }) }
  function setMemberUserId(val: number | undefined) { setParams({ member: val != null ? String(val) : null, page: null }) }

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
      setParams({ dir: sortDirection === 'asc' ? 'desc' : 'asc' })
    } else {
      setParams({ sort: field, dir: 'desc' })
    }
  }

  /**
   * 정렬 아이콘 렌더링
   */
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <span className="text-warm-300 ml-1">⇅</span>
    }
    return (
      <span className="text-grape-600 ml-1">
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
      setParams({ member: null })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <h1 className="text-xl font-bold text-grape-700">지출 목록</h1>
        <div className="bg-white rounded-2xl shadow-sm border border-warm-200/60">
          <ErrorState onRetry={fetchExpenses} />
        </div>
      </div>
    )
  }

  // 가구 활성 상태이고 멤버 2명 이상일 때만 멤버 필터 표시
  const showMemberFilter = activeHouseholdId != null && members.length > 1

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-grape-700">지출 목록</h1>
        <button
          onClick={() => navigate('/expenses/new')}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-grape-600 rounded-xl hover:bg-grape-700 shadow-sm shadow-grape-200 active:scale-[0.98] transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          지출 등록
        </button>
      </div>

      {/* 필터 바 */}
      <div className="bg-white rounded-2xl shadow-sm border border-warm-200/60 p-4">
        {/* 빠른 날짜 선택 */}
        <div className="flex flex-wrap gap-2 mb-4">
          {DATE_PRESETS.map((preset) => {
            const range = preset.getRange()
            const isActive = startDate === range.start && endDate === range.end
            return (
              <button
                key={preset.label}
                onClick={() => setParams({ start: range.start, end: range.end, page: null })}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  isActive
                    ? 'bg-grape-100 text-grape-700 border-grape-300 font-medium'
                    : 'bg-white text-warm-600 border-warm-200 hover:bg-warm-50'
                }`}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
        <div className={`grid grid-cols-1 sm:grid-cols-2 ${showMemberFilter ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}>
          <div>
            <label className="block text-xs text-warm-400 mb-1">시작일</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-warm-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
            />
          </div>
          <div>
            <label className="block text-xs text-warm-400 mb-1">종료일</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-warm-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
            />
          </div>
          <div>
            <label className="block text-xs text-warm-400 mb-1">카테고리</label>
            <select
              value={categoryId ?? ''}
              onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full border border-warm-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
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
              <label className="block text-xs text-warm-400 mb-1">멤버</label>
              <select
                value={memberUserId ?? ''}
                onChange={(e) => setMemberUserId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full border border-warm-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
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
              onClick={() => setParams({ start: null, end: null, cat: null, member: null, page: null })}
              className="w-full sm:w-auto px-4 py-2 text-sm text-warm-500 hover:text-warm-600 underline"
            >
              필터 초기화
            </button>
          </div>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-2xl shadow-sm border border-warm-200/60 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-grape-600" />
          </div>
        ) : expenses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-warm-50 border-b border-warm-200">
                <tr>
                  <th
                    className="text-left text-xs font-medium text-warm-400 uppercase px-4 py-3 cursor-pointer hover:bg-warm-100 select-none transition-colors"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center">
                      날짜
                      {renderSortIcon('date')}
                    </div>
                  </th>
                  <th className="text-left text-xs font-medium text-warm-400 uppercase px-4 py-3">내용</th>
                  <th className="text-left text-xs font-medium text-warm-400 uppercase px-4 py-3 hidden sm:table-cell">카테고리</th>
                  {/* 가구 활성 시 작성자 열 표시 */}
                  {showMemberFilter && (
                    <th className="text-left text-xs font-medium text-warm-400 uppercase px-4 py-3 hidden md:table-cell">작성자</th>
                  )}
                  <th
                    className="text-right text-xs font-medium text-warm-400 uppercase px-4 py-3 cursor-pointer hover:bg-warm-100 select-none transition-colors"
                    onClick={() => handleSort('amount')}
                  >
                    <div className="flex items-center justify-end">
                      금액
                      {renderSortIcon('amount')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-100">
                {sortedExpenses.map((expense) => (
                  <tr key={expense.id} className={`hover:bg-grape-50/50 transition-colors ${expense.exclude_from_stats ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 text-sm text-warm-600 whitespace-nowrap">
                      {expense.date.slice(0, 10).replace(/-/g, '.')}
                    </td>
                    <td className="px-4 py-3 max-w-[200px] sm:max-w-none">
                      <div className="flex items-center gap-2">
                        <Link to={`/expenses/${expense.id}`} className="text-sm font-medium text-warm-900 hover:text-grape-600 transition-colors block truncate">
                          {expense.description}
                        </Link>
                        {expense.raw_input?.startsWith('[정기]') && (
                          <span className="shrink-0 text-xs bg-warm-200 text-warm-600 px-1.5 py-0.5 rounded-full">정기</span>
                        )}
                        {expense.exclude_from_stats && (
                          <span className="shrink-0 text-xs bg-warm-100 text-warm-500 px-1.5 py-0.5 rounded-full">통계제외</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="inline-block bg-grape-50 text-grape-700 text-xs px-2 py-1 rounded-full">
                        {getCategoryName(expense.category_id)}
                      </span>
                    </td>
                    {showMemberFilter && (
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-warm-500">
                          {getMemberName(expense.user_id)}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm font-semibold text-warm-900 text-right whitespace-nowrap">
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
      <div className="flex items-center justify-between pb-20">
        <button
          onClick={() => setPage(Math.max(0, page - 1))}
          disabled={page === 0}
          className="px-4 py-2 text-sm border border-warm-300 rounded-lg disabled:opacity-40 hover:bg-warm-50"
        >
          이전
        </button>
        <span className="text-sm text-warm-500">페이지 {page + 1}</span>
        <button
          onClick={() => setPage(page + 1)}
          disabled={expenses.length < limit}
          className="px-4 py-2 text-sm border border-warm-300 rounded-lg disabled:opacity-40 hover:bg-warm-50"
        >
          다음
        </button>
      </div>
    </div>
  )
}
