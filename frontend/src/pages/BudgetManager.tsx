/**
 * @file BudgetManager.tsx
 * @description 예산 관리 페이지
 * 카테고리 전체 목록을 한 화면에 표시하고, 각 카테고리 옆에 예산 금액을 바로 입력할 수 있다.
 * 예산이 설정된 카테고리는 진행바와 지출 금액을 카테고리 행에 바로 표시한다.
 * 월 총 예산을 설정하면 배분 비율과 여유예산을 확인할 수 있다.
 */

import { useState, useEffect, useMemo } from 'react'
import { useGoBack } from '../hooks/useGoBack'
import { ArrowLeft, Wallet, PiggyBank } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { TOAST } from '../constants/toastMessages'
import budgetApi from '../api/budgets'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import { Skeleton } from '../components/skeleton/Skeleton'
import type { BudgetAlert, CategoryBudgetOverview } from '../types'
import { formatAmount } from '../utils/format'

/** 숫자 문자열을 ₩0,000 형식으로 표시. 빈 값이면 빈 문자열 반환 */
function displayBudgetValue(raw: string): string {
  const num = Number(raw)
  if (!raw || isNaN(num) || num <= 0) return ''
  return formatAmount(num)
}

/** 입력값에서 숫자만 추출 */
function extractNumber(value: string): string {
  return value.replace(/[^0-9]/g, '')
}

function BudgetManagerSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="card-surface p-4 flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-36" />
          </div>
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </div>
  )
}

export default function BudgetManager() {
  const goBack = useGoBack('/settings')
  const { addToast } = useToast()

  const [overview, setOverview] = useState<CategoryBudgetOverview[]>([])
  const [alerts, setAlerts] = useState<BudgetAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 카테고리별 로컬 입력 상태 { [categoryId]: 금액 문자열 }
  const [localAmounts, setLocalAmounts] = useState<Record<number, string>>({})
  // 저장 중인 카테고리 ID 집합
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set())

  // 월 총 예산
  const [totalBudget, setTotalBudget] = useState<number | null>(null)
  const [localTotalBudget, setLocalTotalBudget] = useState<string>('')
  const [savingTotal, setSavingTotal] = useState(false)

  // 입력 포커스 상태 — 포커스 시 raw 숫자, blur 시 ₩ 포맷 표시
  const [totalBudgetFocused, setTotalBudgetFocused] = useState(false)
  const [focusedCategoryId, setFocusedCategoryId] = useState<number | null>(null)

  /**
   * 데이터 로드 — 카테고리 개요, 알림, 월 총 예산을 동시에 가져온다
   */
  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [overviewRes, alertsRes, totalRes] = await Promise.all([
        budgetApi.getCategoryOverview(),
        budgetApi.getBudgetAlerts(),
        budgetApi.getTotalBudget(),
      ])

      setOverview(overviewRes.data)
      setAlerts(alertsRes.data)
      setTotalBudget(totalRes.data.total_monthly_budget)
      setLocalTotalBudget(
        totalRes.data.total_monthly_budget != null ? String(totalRes.data.total_monthly_budget) : ''
      )

      // 현재 예산 금액으로 로컬 상태 초기화
      const amounts: Record<number, string> = {}
      overviewRes.data.forEach((cat) => {
        amounts[cat.category_id] =
          cat.current_budget_amount != null ? String(cat.current_budget_amount) : ''
      })
      setLocalAmounts(amounts)
    } catch (err) {
      console.error('Failed to load data:', err)
      setError('데이터를 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  /**
   * 카테고리 ID → BudgetAlert 빠른 조회용 맵
   * alerts 배열이 변경될 때만 재계산
   */
  const alertsMap = useMemo(() => {
    const map = new Map<number, BudgetAlert>()
    alerts.forEach((a) => map.set(a.category_id, a))
    return map
  }, [alerts])

  /**
   * 카테고리별 예산 합계 (로컬 입력 기준)
   */
  const allocatedTotal = useMemo(() => {
    return Object.values(localAmounts).reduce((sum, val) => {
      const num = Number(val)
      return sum + (num > 0 ? num : 0)
    }, 0)
  }, [localAmounts])

  /**
   * 여유예산 (총 예산 - 배분된 예산)
   */
  const remainingBudget = useMemo(() => {
    const total = Number(localTotalBudget)
    if (!total || total <= 0) return null
    return total - allocatedTotal
  }, [localTotalBudget, allocatedTotal])

  /**
   * 입력값 변경 핸들러
   */
  const handleAmountChange = (categoryId: number, value: string) => {
    setLocalAmounts((prev) => ({ ...prev, [categoryId]: value }))
  }

  /**
   * 현재 예산과 로컬 입력값이 다른지 확인
   */
  const isDirty = (item: CategoryBudgetOverview): boolean => {
    const current =
      item.current_budget_amount != null ? String(item.current_budget_amount) : ''
    const local = localAmounts[item.category_id] ?? ''
    return current !== local
  }

  /**
   * 월 총 예산이 변경되었는지 확인
   */
  const isTotalDirty = (): boolean => {
    const current = totalBudget != null ? String(totalBudget) : ''
    return current !== localTotalBudget
  }

  /**
   * 월 총 예산 저장
   */
  const handleSaveTotal = async () => {
    setSavingTotal(true)
    try {
      const num = Number(localTotalBudget)
      const amount = localTotalBudget && num > 0 ? num : null
      const res = await budgetApi.updateTotalBudget(amount)
      setTotalBudget(res.data.total_monthly_budget)
      addToast('success', TOAST.BUDGET_SAVED)
    } catch (err) {
      console.error('Failed to save total budget:', err)
      addToast('error', TOAST.SAVE_FAILED)
    } finally {
      setSavingTotal(false)
    }
  }

  /**
   * 예산 저장 핸들러
   * - 빈 값: 기존 예산 삭제
   * - 기존 예산 있음: 금액 수정
   * - 기존 예산 없음: 새로 생성 (월간, 오늘부터, 알림 80% 기본값)
   */
  const handleSave = async (item: CategoryBudgetOverview) => {
    const amountStr = localAmounts[item.category_id] ?? ''
    const numAmount = Number(amountStr)

    setSavingIds((prev) => new Set([...prev, item.category_id]))
    try {
      if (!amountStr || numAmount <= 0) {
        // 빈 값이면 기존 예산 삭제
        if (item.current_budget_id) {
          await budgetApi.deleteBudget(item.current_budget_id)
          addToast('success', TOAST.BUDGET_DELETED)
        }
      } else if (item.current_budget_id) {
        // 기존 예산 수정
        await budgetApi.updateBudget(item.current_budget_id, { amount: numAmount })
        addToast('success', TOAST.BUDGET_SAVED)
      } else {
        // 새 예산 생성 — 월간, 오늘부터, 알림 80% 기본값
        await budgetApi.createBudget({
          category_id: item.category_id,
          amount: numAmount,
          period: 'monthly',
          start_date: new Date().toISOString().split('T')[0],
        })
        addToast('success', TOAST.BUDGET_SAVED)
      }
      await loadData()
    } catch (err) {
      console.error('Failed to save budget:', err)
      addToast('error', TOAST.SAVE_FAILED)
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev)
        next.delete(item.category_id)
        return next
      })
    }
  }

  /**
   * 프로그레스바 색상 결정
   * - 초과: rose-500
   * - 경고 (80% 이상): yellow-500
   * - 정상: leaf-500
   */
  const getProgressColor = (usagePct: number, isExceeded: boolean): string => {
    if (isExceeded || usagePct >= 100) return 'bg-rose-500'
    if (usagePct >= 80) return 'bg-yellow-500'
    return 'bg-leaf-500'
  }

  if (loading) {
    return <BudgetManagerSkeleton />
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => goBack()} className="p-2.5 -ml-2.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors">
            <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
          <PiggyBank data-testid="piggybank-icon" className="w-5 h-5 text-grape-500 flex-shrink-0" />
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">예산 관리</h1>
        </div>
        <ErrorState message={error} onRetry={loadData} />
      </div>
    )
  }

  const totalNum = Number(localTotalBudget)
  const hasTotalBudget = localTotalBudget && totalNum > 0
  const allocationPercent = hasTotalBudget ? (allocatedTotal / totalNum) * 100 : 0

  return (
    <div className="space-y-6 animate-page-in">
      <div className="flex items-center gap-3">
        <button onClick={() => goBack()} className="p-2.5 -ml-2.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors">
          <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">예산 관리</h1>
      </div>

      {/* 월 총 예산 카드 */}
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="w-5 h-5 text-grape-600" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">월 총 예산</h2>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={totalBudgetFocused ? localTotalBudget : displayBudgetValue(localTotalBudget)}
            onChange={(e) => setLocalTotalBudget(extractNumber(e.target.value))}
            onFocus={() => setTotalBudgetFocused(true)}
            onBlur={() => setTotalBudgetFocused(false)}
            className="input-base w-44 text-right tabular-nums"
            placeholder="미설정"
            aria-label="월 총 예산"
          />
          {isTotalDirty() && (
            <button
              onClick={handleSaveTotal}
              disabled={savingTotal}
              className="px-3 py-2 text-xs font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700 disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              {savingTotal ? '저장 중...' : '저장'}
            </button>
          )}
        </div>
        {/* 배분 현황 */}
        {hasTotalBudget && (
          <div className="mt-4 space-y-2">
            <div className="w-full bg-[var(--border-default)] rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  allocationPercent > 100 ? 'bg-rose-500' : 'bg-grape-500'
                }`}
                style={{ width: `${Math.min(allocationPercent, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-[var(--text-secondary)]">
              <span>
                배정: <span className="tabular-nums">{formatAmount(allocatedTotal)}</span> / <span className="tabular-nums">{formatAmount(totalNum)}</span> ({allocationPercent.toFixed(1)}%)
              </span>
              <span className={remainingBudget != null && remainingBudget < 0 ? 'text-rose-600 font-semibold' : ''}>
                남은 예산: <span className="tabular-nums">{remainingBudget != null ? formatAmount(remainingBudget) : '-'}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 카테고리별 예산 인라인 편집 */}
      {overview.length === 0 ? (
        <EmptyState
          variant="section"
          title="등록된 카테고리가 없습니다"
          description="카테고리 관리 페이지에서 카테고리를 먼저 추가해주세요"
        />
      ) : (
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60 overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">카테고리별 예산</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              금액을 입력 후 저장 버튼을 누르세요 · 비우면 예산 삭제
            </p>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {overview.map((item) => {
              const alert = alertsMap.get(item.category_id)
              return (
                <div key={item.category_id} className="px-4 py-3.5 space-y-2 border-b border-[var(--border-subtle)] last:border-0">
                  {/* 1. 카테고리 이름 + 사용률 뱃지 */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm text-[var(--text-primary)] truncate">
                      {item.category_name}
                    </span>
                    {alert && (
                      <span className={`text-xs font-semibold tabular-nums shrink-0 ${
                        alert.is_exceeded ? 'text-rose-600' : alert.is_warning ? 'text-yellow-600' : 'text-leaf-600'
                      }`}>
                        {alert.usage_percentage.toFixed(0)}%
                      </span>
                    )}
                  </div>

                  {/* 2. 진행바 + 지출 정보 (예산 설정 + 알림 데이터 있는 경우만) */}
                  {alert && (
                    <div className="space-y-1">
                      <div className="w-full bg-[var(--border-default)] rounded-full h-1.5 overflow-hidden">
                        <div
                          data-testid={`progress-${item.category_name}`}
                          className={`h-1.5 rounded-full transition-all ${getProgressColor(alert.usage_percentage, alert.is_exceeded)}`}
                          style={{ width: `${Math.min(alert.usage_percentage, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-[var(--text-muted)]">
                        <span className="tabular-nums">
                          {formatAmount(alert.spent_amount)} 사용
                        </span>
                        {alert.is_exceeded ? (
                          <span className="text-rose-600 font-medium tabular-nums">
                            {formatAmount(Math.abs(alert.remaining_amount))} 초과
                          </span>
                        ) : (
                          <span className="tabular-nums">
                            {formatAmount(alert.remaining_amount)} 남음
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 3. 예산 입력 + 저장 */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={
                        focusedCategoryId === item.category_id
                          ? (localAmounts[item.category_id] ?? '')
                          : displayBudgetValue(localAmounts[item.category_id] ?? '')
                      }
                      onChange={(e) => handleAmountChange(item.category_id, extractNumber(e.target.value))}
                      onFocus={() => setFocusedCategoryId(item.category_id)}
                      onBlur={() => setFocusedCategoryId(null)}
                      className="input-base flex-1 text-right tabular-nums"
                      placeholder="예산 없음"
                      aria-label={`${item.category_name} 예산`}
                    />
                    {isDirty(item) && (
                      <button
                        onClick={() => handleSave(item)}
                        disabled={savingIds.has(item.category_id)}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                      >
                        {savingIds.has(item.category_id) ? '저장 중...' : '저장'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
