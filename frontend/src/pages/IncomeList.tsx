/**
 * @file IncomeList.tsx
 * @description 수입 목록 페이지 - 필터링, 정렬, 페이지네이션
 */

import { useEffect, useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, PlusCircle } from 'lucide-react'
import { incomeApi } from '../api/income'
import { categoryApi } from '../api/categories'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import type { Income, Category, HouseholdMember } from '../types'

type SortField = 'date' | 'amount'
type SortDirection = 'asc' | 'desc'

function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

export default function IncomeList() {
  const navigate = useNavigate()
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)
  const currentHousehold = useHouseholdStore((s) => s.currentHousehold)
  const fetchHouseholdDetail = useHouseholdStore((s) => s.fetchHouseholdDetail)

  const [incomes, setIncomes] = useState<Income[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [members, setMembers] = useState<HouseholdMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [page, setPage] = useState(0)
  const limit = 20

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [categoryId, setCategoryId] = useState<number | undefined>()
  const [memberUserId, setMemberUserId] = useState<number | undefined>()

  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  async function fetchIncomes() {
    setLoading(true)
    setError(false)
    try {
      const res = await incomeApi.getAll({
        skip: page * limit,
        limit,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        category_id: categoryId,
        household_id: activeHouseholdId ?? undefined,
        member_user_id: memberUserId,
      })
      setIncomes(res.data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <span className="text-stone-300 ml-1">⇅</span>
    return <span className="text-leaf-600 ml-1">{sortDirection === 'asc' ? '▲' : '▼'}</span>
  }

  const sortedIncomes = useMemo(() => {
    const sorted = [...incomes]
    sorted.sort((a, b) => {
      let comparison = 0
      if (sortField === 'date') comparison = a.date.localeCompare(b.date)
      else if (sortField === 'amount') comparison = a.amount - b.amount
      return sortDirection === 'asc' ? comparison : -comparison
    })
    return sorted
  }, [incomes, sortField, sortDirection])

  useEffect(() => {
    categoryApi
      .getAll()
      .then((res) => setCategories(res.data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (activeHouseholdId) fetchHouseholdDetail(activeHouseholdId).catch(() => {})
    else {
      setMembers([])
      setMemberUserId(undefined)
    }
  }, [activeHouseholdId, fetchHouseholdDetail])

  useEffect(() => {
    if (currentHousehold && currentHousehold.id === activeHouseholdId) setMembers(currentHousehold.members)
    else setMembers([])
  }, [currentHousehold, activeHouseholdId])

  useEffect(() => {
    fetchIncomes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, startDate, endDate, categoryId, activeHouseholdId, memberUserId])

  function getCategoryName(catId: number | null): string {
    if (!catId) return '미분류'
    return categories.find((c) => c.id === catId)?.name ?? '미분류'
  }

  function getMemberName(userId: number | null): string {
    if (!userId) return ''
    return members.find((m) => m.user_id === userId)?.username ?? ''
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold text-stone-800">수입 목록</h1>
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200/60">
          <ErrorState onRetry={fetchIncomes} />
        </div>
      </div>
    )
  }

  const showMemberFilter = activeHouseholdId != null && members.length > 1

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-stone-800">수입 목록</h1>
        <button
          onClick={() => navigate('/income/new')}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-leaf-600 rounded-xl hover:bg-leaf-700 shadow-sm shadow-leaf-200 active:scale-[0.98] transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          수입 등록
        </button>
      </div>

      {/* 필터 바 */}
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200/60 p-4">
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 ${showMemberFilter ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}
        >
          <div>
            <label className="block text-xs text-stone-400 mb-1">시작일</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setPage(0)
              }}
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-leaf-500/30 focus:border-leaf-500"
            />
          </div>
          <div>
            <label className="block text-xs text-stone-400 mb-1">종료일</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setPage(0)
              }}
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-leaf-500/30 focus:border-leaf-500"
            />
          </div>
          <div>
            <label className="block text-xs text-stone-400 mb-1">카테고리</label>
            <select
              value={categoryId ?? ''}
              onChange={(e) => {
                setCategoryId(e.target.value ? Number(e.target.value) : undefined)
                setPage(0)
              }}
              className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-leaf-500/30 focus:border-leaf-500"
            >
              <option value="">전체</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          {showMemberFilter && (
            <div>
              <label className="block text-xs text-stone-400 mb-1">멤버</label>
              <select
                value={memberUserId ?? ''}
                onChange={(e) => {
                  setMemberUserId(e.target.value ? Number(e.target.value) : undefined)
                  setPage(0)
                }}
                className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-leaf-500/30 focus:border-leaf-500"
              >
                <option value="">전체 멤버</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.username}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-end">
            <button
              onClick={() => {
                setStartDate('')
                setEndDate('')
                setCategoryId(undefined)
                setMemberUserId(undefined)
                setPage(0)
              }}
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
            <Loader2 className="w-6 h-6 animate-spin text-leaf-600" />
          </div>
        ) : incomes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th
                    className="text-left text-xs font-medium text-stone-400 uppercase px-4 py-3 cursor-pointer hover:bg-stone-100 select-none"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center">날짜{renderSortIcon('date')}</div>
                  </th>
                  <th className="text-left text-xs font-medium text-stone-400 uppercase px-4 py-3">내용</th>
                  <th className="text-left text-xs font-medium text-stone-400 uppercase px-4 py-3 hidden sm:table-cell">
                    카테고리
                  </th>
                  {showMemberFilter && (
                    <th className="text-left text-xs font-medium text-stone-400 uppercase px-4 py-3 hidden md:table-cell">
                      작성자
                    </th>
                  )}
                  <th
                    className="text-right text-xs font-medium text-stone-400 uppercase px-4 py-3 cursor-pointer hover:bg-stone-100 select-none"
                    onClick={() => handleSort('amount')}
                  >
                    <div className="flex items-center justify-end">금액{renderSortIcon('amount')}</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {sortedIncomes.map((income) => (
                  <tr key={income.id} className="hover:bg-leaf-50/50 transition-colors">
                    <td className="px-4 py-3 text-sm text-stone-600 whitespace-nowrap">
                      {income.date.slice(0, 10).replace(/-/g, '.')}
                    </td>
                    <td className="px-4 py-3 max-w-[200px] sm:max-w-none">
                      <Link
                        to={`/income/${income.id}`}
                        className="text-sm font-medium text-stone-900 hover:text-leaf-600 transition-colors block truncate"
                      >
                        {income.description}
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="inline-block bg-leaf-50 text-leaf-700 text-xs px-2 py-1 rounded-full">
                        {getCategoryName(income.category_id)}
                      </span>
                    </td>
                    {showMemberFilter && (
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-stone-500">{getMemberName(income.user_id)}</span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm font-semibold text-leaf-700 text-right whitespace-nowrap">
                      +{formatAmount(income.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="수입 내역이 없습니다" description="필터 조건을 변경하거나 채팅으로 수입을 입력해보세요." />
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
          disabled={incomes.length < limit}
          className="px-4 py-2 text-sm border border-stone-300 rounded-lg disabled:opacity-40 hover:bg-stone-50"
        >
          다음
        </button>
      </div>
    </div>
  )
}
