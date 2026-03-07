/**
 * @file TransactionList.tsx
 * @description 통합 거래 내역 페이지 - 지출+수입 탭 필터, 정렬, 페이지네이션
 */

import { useEffect, useState, useMemo, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { expenseApi } from '../api/expenses'
import { incomeApi } from '../api/income'
import { categoryApi } from '../api/categories'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import type { Expense, Income, Category, HouseholdMember } from '../types'

type TransactionType = 'all' | 'expense' | 'income'
type SortField = 'date' | 'amount'
type SortDirection = 'asc' | 'desc'

interface Transaction {
  id: number
  type: 'expense' | 'income'
  date: string
  description: string
  amount: number
  category_id: number | null
  user_id: number | null
  exclude_from_stats?: boolean
  raw_input?: string | null
}

function formatAmount(amount: number, type: 'expense' | 'income'): string {
  const formatted = `₩${amount.toLocaleString('ko-KR')}`
  return type === 'income' ? `+${formatted}` : formatted
}

function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const DATE_PRESETS = [
  { label: '이번주', getRange: () => {
    const now = new Date()
    const day = now.getDay() || 7
    const mon = new Date(now); mon.setDate(now.getDate() - day + 1)
    return { start: toDateString(mon), end: toDateString(now) }
  }},
  { label: '지난주', getRange: () => {
    const now = new Date()
    const day = now.getDay() || 7
    const mon = new Date(now); mon.setDate(now.getDate() - day - 6)
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
    return { start: toDateString(mon), end: toDateString(sun) }
  }},
  { label: '이번달', getRange: () => {
    const now = new Date()
    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    return { start: toDateString(first), end: toDateString(now) }
  }},
  { label: '저번달', getRange: () => {
    const now = new Date()
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const last = new Date(now.getFullYear(), now.getMonth(), 0)
    return { start: toDateString(first), end: toDateString(last) }
  }},
]

export default function TransactionList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)

  // URL 파라미터에서 상태 읽기
  const tab = (searchParams.get('tab') as TransactionType) || 'all'
  const page = Number(searchParams.get('page') || '0')
  const startDate = searchParams.get('start') || ''
  const endDate = searchParams.get('end') || ''
  const categoryId = searchParams.get('cat') ? Number(searchParams.get('cat')) : undefined
  const memberUserId = searchParams.get('member') ? Number(searchParams.get('member')) : undefined
  const sortField = (searchParams.get('sort') as SortField) || 'date'
  const sortDir = (searchParams.get('dir') as SortDirection) || 'desc'

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [incomes, setIncomes] = useState<Income[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [members, setMembers] = useState<HouseholdMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // URL 파라미터 업데이트 헬퍼
  const setParams = useCallback((updates: Record<string, string | null>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(updates)) {
        if (v === null) next.delete(k)
        else next.set(k, v)
      }
      return next
    })
  }, [setSearchParams])

  const setTab = (t: TransactionType) => setParams({ tab: t === 'all' ? null : t, page: null })
  const setPage = (p: number) => setParams({ page: p > 0 ? String(p) : null })

  // 카테고리 로드
  useEffect(() => {
    categoryApi.getAll().then(res => setCategories(res.data)).catch(() => {})
  }, [])

  // 멤버 목록 로드 (가구 선택 시)
  useEffect(() => {
    if (!activeHouseholdId) { setMembers([]); return }
    import('../api/households').then(({ getHouseholdDetail }) => {
      getHouseholdDetail(activeHouseholdId).then(res => {
        setMembers(res.data.members || [])
      }).catch(() => {})
    })
  }, [activeHouseholdId])

  // 데이터 로드
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const params: Record<string, string | number | boolean> = {
        skip: page * 20,
        limit: 20,
      }
      if (startDate) params.start_date = startDate
      if (endDate) params.end_date = endDate
      if (categoryId) params.category_id = categoryId
      if (memberUserId) params.user_id = memberUserId
      if (activeHouseholdId) params.household_id = activeHouseholdId

      const fetchExpenses = tab !== 'income'
      const fetchIncomes = tab !== 'expense'

      const [expRes, incRes] = await Promise.all([
        fetchExpenses ? expenseApi.getAll(params).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        fetchIncomes ? incomeApi.getAll(params).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ])

      setExpenses(expRes.data)
      setIncomes(incRes.data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [page, startDate, endDate, categoryId, memberUserId, activeHouseholdId, tab])

  useEffect(() => { fetchData() }, [fetchData])

  // 거래 내역 통합 + 정렬
  const transactions = useMemo(() => {
    const items: Transaction[] = [
      ...expenses.map(e => ({ ...e, type: 'expense' as const })),
      ...incomes.map(i => ({ ...i, type: 'income' as const })),
    ]

    items.sort((a, b) => {
      let cmp = 0
      if (sortField === 'date') {
        cmp = a.date.localeCompare(b.date)
      } else {
        cmp = a.amount - b.amount
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return items
  }, [expenses, incomes, sortField, sortDir])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setParams({ dir: sortDir === 'asc' ? 'desc' : 'asc' })
    } else {
      setParams({ sort: field, dir: 'desc' })
    }
  }

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <span className="ml-1 text-warm-300">⇅</span>
    return <span className="ml-1 text-grape-600">{sortDir === 'asc' ? '▲' : '▼'}</span>
  }

  const getCategoryName = (id: number | null) =>
    id != null ? (categories.find(c => c.id === id)?.name ?? '미분류') : '미분류'

  const getMemberName = (userId: number | null) =>
    userId != null ? (members.find(m => m.user_id === userId)?.username ?? '') : ''

  const showMemberFilter = activeHouseholdId != null && members.length > 1

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-grape-700">거래 내역</h1>
        <div className="bg-white rounded-2xl shadow-sm border border-warm-200/60">
          <ErrorState onRetry={fetchData} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <h1 className="text-xl font-bold text-grape-700">거래 내역</h1>

      {/* 탭 */}
      <div className="flex gap-1 bg-warm-100 rounded-xl p-1">
        {([
          { key: 'all', label: '전체' },
          { key: 'expense', label: '지출' },
          { key: 'income', label: '수입' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === key
                ? 'bg-white text-grape-700 shadow-sm'
                : 'text-warm-500 hover:text-warm-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 필터 바 */}
      <div className="bg-white rounded-2xl shadow-sm border border-warm-200/60 p-4">
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
              onChange={(e) => setParams({ start: e.target.value || null, page: null })}
              className="w-full border border-warm-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
            />
          </div>
          <div>
            <label className="block text-xs text-warm-400 mb-1">종료일</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setParams({ end: e.target.value || null, page: null })}
              className="w-full border border-warm-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
            />
          </div>
          <div>
            <label className="block text-xs text-warm-400 mb-1">카테고리</label>
            <select
              value={categoryId ?? ''}
              onChange={(e) => setParams({ cat: e.target.value || null, page: null })}
              className="w-full border border-warm-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
            >
              <option value="">전체</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          {showMemberFilter && (
            <div>
              <label className="block text-xs text-warm-400 mb-1">멤버</label>
              <select
                value={memberUserId ?? ''}
                onChange={(e) => setParams({ member: e.target.value || null, page: null })}
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
        ) : transactions.length > 0 ? (
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
                {transactions.map((tx) => (
                  <tr
                    key={`${tx.type}-${tx.id}`}
                    className={`hover:bg-warm-50/50 transition-colors ${tx.exclude_from_stats ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-3 text-sm text-warm-600 whitespace-nowrap">
                      {tx.date.slice(0, 10).replace(/-/g, '.')}
                    </td>
                    <td className="px-4 py-3 max-w-[200px] sm:max-w-none">
                      <div className="flex items-center gap-2">
                        <Link
                          to={tx.type === 'expense' ? `/expenses/${tx.id}` : `/income/${tx.id}`}
                          className="text-sm font-medium text-warm-900 hover:text-grape-600 transition-colors block truncate"
                        >
                          {tx.description}
                        </Link>
                        {tx.raw_input?.startsWith('[정기]') && (
                          <span className="shrink-0 text-xs bg-warm-200 text-warm-600 px-1.5 py-0.5 rounded-full">정기</span>
                        )}
                        {tx.exclude_from_stats && (
                          <span className="shrink-0 text-xs bg-warm-100 text-warm-500 px-1.5 py-0.5 rounded-full">통계제외</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`inline-block text-xs px-2 py-1 rounded-full ${
                        tx.type === 'income'
                          ? 'bg-leaf-50 text-leaf-700'
                          : 'bg-grape-50 text-grape-700'
                      }`}>
                        {getCategoryName(tx.category_id)}
                      </span>
                    </td>
                    {showMemberFilter && (
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-warm-500">{getMemberName(tx.user_id)}</span>
                      </td>
                    )}
                    <td className={`px-4 py-3 text-sm font-semibold text-right whitespace-nowrap ${
                      tx.type === 'income' ? 'text-leaf-600' : 'text-warm-900'
                    }`}>
                      {formatAmount(tx.amount, tx.type)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="거래 내역이 없습니다"
            description="필터 조건을 변경하거나 새로운 거래를 추가해보세요."
          />
        )}
      </div>

      {/* 페이지네이션 */}
      <div className="flex items-center justify-between">
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
          disabled={transactions.length < 20}
          className="px-4 py-2 text-sm border border-warm-300 rounded-lg disabled:opacity-40 hover:bg-warm-50"
        >
          다음
        </button>
      </div>
    </div>
  )
}
