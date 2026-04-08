/**
 * @file TransactionList.tsx
 * @description 통합 거래 목록 페이지 — 검색 모드와 월별 뷰를 전환하는 라우터.
 * UI는 SearchMode / MonthlyView 컴포넌트에 위임하고,
 * 공유 상태(카테고리 바텀시트, 웰컴 카드)만 관리한다.
 */

import { useEffect, useState, useMemo, useCallback } from 'react'
import { expenseApi } from '../api/expenses'
import { incomeApi } from '../api/income'
import budgetApi from '../api/budgets'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import { useToast } from '../hooks/useToast'
import { TOAST } from '../constants/toastMessages'
import CategoryBottomSheet from '../components/CategoryBottomSheet'
import HouseholdBottomSheet from '../components/HouseholdBottomSheet'
import PullToRefresh from '../components/PullToRefresh'
import ErrorState from '../components/ErrorState'
import { useAuth } from '../contexts/AuthContext'
import { useTransactionSearch } from '../hooks/useTransactionSearch'
import type { UnifiedTransaction } from '../hooks/useTransactionSearch'
import { useMonthlyTransactions } from '../hooks/useMonthlyTransactions'
import SearchMode from '../components/transaction/SearchMode'
import MonthlyView from '../components/transaction/MonthlyView'

export default function TransactionList() {
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)
  const households = useHouseholdStore((s) => s.households)
  const setActiveHouseholdId = useHouseholdStore((s) => s.setActiveHouseholdId)
  const currentHousehold = useHouseholdStore((s) => s.currentHousehold)
  const fetchHouseholdDetail = useHouseholdStore((s) => s.fetchHouseholdDetail)
  const { addToast } = useToast()
  const { user } = useAuth()

  // 월별 거래 데이터 훅
  const monthly = useMonthlyTransactions({ activeHouseholdId })

  // 검색 훅
  const search = useTransactionSearch({ activeHouseholdId })

  // currentHousehold 로딩 — memberMap 구성에 필요
  useEffect(() => {
    if (activeHouseholdId && currentHousehold?.id !== activeHouseholdId) {
      fetchHouseholdDetail(activeHouseholdId)
    }
  }, [activeHouseholdId, currentHousehold?.id, fetchHouseholdDetail])

  // memberMap — 멀티멤버 가구에서만 유효 (단독 가구는 null)
  const memberMap = useMemo(() => {
    const members = currentHousehold?.members
    if (!members || members.length <= 1) return null
    const map = new Map<number, string>()
    for (const m of members) {
      map.set(m.user_id, m.username)
    }
    return map
  }, [currentHousehold?.members])

  // 웰컴 카드 상태
  const [welcomeDismissed, setWelcomeDismissed] = useState(() =>
    localStorage.getItem('podo-welcome-dismissed') === 'true'
  )
  const [totalTransactionCount, setTotalTransactionCount] = useState(0)

  // 월 총 예산 (undefined = 로딩 중, null = 예산 미설정, number = 설정됨)
  const [totalBudget, setTotalBudget] = useState<number | null | undefined>(undefined)
  useEffect(() => {
    if (!activeHouseholdId) return
    budgetApi.getTotalBudget()
      .then(res => setTotalBudget(res.data.total_monthly_budget))
      .catch(() => setTotalBudget(null))
  }, [activeHouseholdId])

  // 봇 넛지 카드 상태
  const isBotLinked = !!user?.is_telegram_linked || !!user?.is_kakao_linked
  const [botNudgeDismissed, setBotNudgeDismissed] = useState(() =>
    localStorage.getItem('podo-bot-nudge-dismissed') === 'true'
  )

  // 전체 기간 거래 건수 조회 (웰컴 카드 단계 판정용)
  useEffect(() => {
    if (welcomeDismissed || !activeHouseholdId) return
    Promise.all([
      expenseApi.getAll({ household_id: activeHouseholdId, limit: 3 }).catch(() => ({ data: [] })),
      incomeApi.getAll({ household_id: activeHouseholdId, limit: 3 }).catch(() => ({ data: [] })),
    ]).then(([expRes, incRes]) => {
      setTotalTransactionCount(expRes.data.length + incRes.data.length)
    })
  }, [welcomeDismissed, activeHouseholdId])

  const handleWelcomeDismiss = useCallback(() => {
    setWelcomeDismissed(true)
    localStorage.setItem('podo-welcome-dismissed', 'true')
  }, [])

  const handleBotNudgeDismiss = useCallback(() => {
    setBotNudgeDismissed(true)
    localStorage.setItem('podo-bot-nudge-dismissed', 'true')
  }, [])

  // 웰컴 카드 단계 갱신 — 거래 추가 후 돌아왔을 때 반영
  useEffect(() => {
    if (!welcomeDismissed && !monthly.loading) {
      setTotalTransactionCount(prev =>
        Math.max(prev, monthly.expenses.length + monthly.incomes.length)
      )
    }
  }, [welcomeDismissed, monthly.loading, monthly.expenses.length, monthly.incomes.length])

  // 가구 전환 바텀시트 상태
  const [householdSheetOpen, setHouseholdSheetOpen] = useState(false)

  // 카테고리 바텀시트 상태
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetTarget, setSheetTarget] = useState<UnifiedTransaction | null>(null)
  const [sheetSaving, setSheetSaving] = useState(false)
  // 카테고리 바텀시트: 검색 필터용 vs 거래 카테고리 변경용 구분
  const [isFilterCategorySheet, setIsFilterCategorySheet] = useState(false)

  // TransactionItem.onCategoryClick 안정화
  const categoryClickHandlers = useMemo(() => {
    const handlers = new Map<string, () => void>()

    if (search.isSearchMode) {
      for (const txs of search.searchGrouped.values()) {
        for (const tx of txs) {
          handlers.set(`${tx.type}-${tx.id}`, () => {
            if (tx.category_id) {
              setIsFilterCategorySheet(false)
              search.setSearchFilter('category',
                search.searchCategoryId === tx.category_id ? null : String(tx.category_id))
            }
          })
        }
      }
    } else {
      for (const txs of monthly.grouped.values()) {
        for (const tx of txs) {
          handlers.set(`${tx.type}-${tx.id}`, () => {
            setIsFilterCategorySheet(false)
            setSheetTarget(tx)
            setSheetOpen(true)
          })
        }
      }
    }
    return handlers
  // eslint-disable-next-line react-hooks/exhaustive-deps -- setSearchFilter는 useCallback 안정 참조
  }, [monthly.grouped, search.searchGrouped, search.isSearchMode, search.searchCategoryId])

  // 카테고리 변경 (거래 카테고리 수정 또는 검색 필터 설정)
  const handleCategorySelect = useCallback(async (categoryId: number | null) => {
    if (isFilterCategorySheet) {
      search.setSearchFilter('category', categoryId ? String(categoryId) : null)
      setSheetOpen(false)
      setIsFilterCategorySheet(false)
      return
    }
    if (!sheetTarget) return
    setSheetSaving(true)
    try {
      if (sheetTarget.type === 'expense') {
        await expenseApi.update(sheetTarget.id, { category_id: categoryId ?? undefined })
        monthly.setExpenses(prev => prev.map(e =>
          e.id === sheetTarget.id ? { ...e, category_id: categoryId } : e
        ))
      } else {
        await incomeApi.update(sheetTarget.id, { category_id: categoryId ?? undefined })
        monthly.setIncomes(prev => prev.map(i =>
          i.id === sheetTarget.id ? { ...i, category_id: categoryId } : i
        ))
      }
      setSheetOpen(false)
    } catch {
      addToast('error', TOAST.CATEGORY_CHANGE_FAILED)
    } finally {
      setSheetSaving(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- addToast, setSearchFilter는 안정적 참조
  }, [sheetTarget, isFilterCategorySheet, search.setSearchFilter])

  const { fetchData } = monthly
  const handleRefresh = useCallback(async () => {
    await fetchData()
  }, [fetchData])

  if (monthly.error) {
    return (
      <div className="space-y-4">
        <ErrorState onRetry={monthly.fetchData} />
      </div>
    )
  }

  return (
    <>
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="space-y-4 animate-page-in">
      {search.isSearchMode ? (
        <SearchMode
          search={search}
          monthly={monthly}
          categoryClickHandlers={categoryClickHandlers}
          onOpenFilterCategorySheet={() => {
            setIsFilterCategorySheet(true)
            setSheetTarget(null)
            setSheetOpen(true)
          }}
          onClearFilterCategory={() => {
            search.setSearchFilter('category', null)
          }}
          searchCategoryActive={!!search.searchCategoryId}
          memberMap={memberMap}
        />
      ) : (
        <MonthlyView
          monthly={monthly}
          categoryClickHandlers={categoryClickHandlers}
          onEnterSearchMode={search.enterSearchMode}
          welcomeDismissed={welcomeDismissed}
          totalTransactionCount={totalTransactionCount}
          isBotLinked={isBotLinked}
          onWelcomeDismiss={handleWelcomeDismiss}
          botNudgeDismissed={botNudgeDismissed}
          onBotNudgeDismiss={handleBotNudgeDismiss}
          memberMap={memberMap}
          totalBudget={totalBudget}
          showHouseholdSwitcher={households.length > 1}
          onOpenHouseholdSheet={() => setHouseholdSheetOpen(true)}
        />
      )}

    </div>
    </PullToRefresh>

      {/* 가구 전환 바텀시트 — PullToRefresh 바깥에 배치 (터치 이벤트 충돌 방지) */}
      <HouseholdBottomSheet
        isOpen={householdSheetOpen}
        onClose={() => setHouseholdSheetOpen(false)}
        households={households}
        activeHouseholdId={activeHouseholdId}
        onSelect={setActiveHouseholdId}
      />

      {/* 카테고리 바텀시트 — PullToRefresh 바깥에 배치 (터치 이벤트 충돌 방지) */}
      <CategoryBottomSheet
        isOpen={sheetOpen}
        onClose={() => { setSheetOpen(false); setIsFilterCategorySheet(false) }}
        onSelect={handleCategorySelect}
        categories={monthly.categories}
        currentCategoryId={isFilterCategorySheet ? search.searchCategoryId : (sheetTarget?.category_id ?? null)}
        transactionType={isFilterCategorySheet
          ? (search.searchType === 'income' ? 'income' : 'expense')
          : (sheetTarget?.type ?? 'expense')}
        saving={sheetSaving}
        title={isFilterCategorySheet ? '카테고리 선택' : undefined}
      />
    </>
  )
}
