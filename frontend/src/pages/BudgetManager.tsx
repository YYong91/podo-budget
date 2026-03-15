/**
 * @file BudgetManager.tsx
 * @description 예산 관리 페이지
 * 카테고리 전체 목록을 한 화면에 표시하고, 각 카테고리 옆에 예산 금액을 바로 입력할 수 있다.
 * 참고용으로 카테고리별 최근 3개월 실제 지출액을 표시한다.
 * 월 총 예산을 설정하면 카테고리별 배분 비율과 여유예산을 확인할 수 있다.
 */

import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BarChart3, AlertTriangle, Wallet } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import budgetApi from '../api/budgets'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import type { BudgetAlert, CategoryBudgetOverview } from '../types'
import { formatAmount } from '../utils/format'

export default function BudgetManager() {
  const navigate = useNavigate()
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
      addToast('success', '월 총 예산이 저장되었습니다')
    } catch (err) {
      console.error('Failed to save total budget:', err)
      addToast('error', '월 총 예산 저장에 실패했습니다')
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
          addToast('success', '예산이 삭제되었습니다')
        }
      } else if (item.current_budget_id) {
        // 기존 예산 수정
        await budgetApi.updateBudget(item.current_budget_id, { amount: numAmount })
        addToast('success', '예산이 저장되었습니다')
      } else {
        // 새 예산 생성 — 월간, 오늘부터, 알림 80% 기본값
        await budgetApi.createBudget({
          category_id: item.category_id,
          amount: numAmount,
          period: 'monthly',
          start_date: new Date().toISOString(),
        })
        addToast('success', '예산이 저장되었습니다')
      }
      await loadData()
    } catch (err) {
      console.error('Failed to save budget:', err)
      addToast('error', '예산 저장에 실패했습니다')
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
   */
  const getProgressColor = (alert: BudgetAlert): string => {
    if (alert.is_exceeded) return 'bg-rose-500'
    if (alert.is_warning) return 'bg-yellow-500'
    return 'bg-leaf-500'
  }

  /**
   * 카테고리별 총 예산 대비 비율 계산
   */
  const getCategoryPercent = (categoryId: number): number | null => {
    const total = Number(localTotalBudget)
    if (!total || total <= 0) return null
    const amount = Number(localAmounts[categoryId] ?? 0)
    if (amount <= 0) return null
    return (amount / total) * 100
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-grape-600" />
      </div>
    )
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />
  }

  const totalNum = Number(localTotalBudget)
  const hasTotalBudget = localTotalBudget && totalNum > 0
  const allocationPercent = hasTotalBudget ? (allocatedTotal / totalNum) * 100 : 0

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/settings')} className="p-2.5 -ml-2.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors">
        <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
      </button>

      {/* 월 총 예산 카드 */}
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="w-5 h-5 text-grape-600" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">월 총 예산</h2>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            step="10000"
            value={localTotalBudget}
            onChange={(e) => setLocalTotalBudget(e.target.value)}
            className="w-44 px-3 py-2 text-sm border border-[var(--input-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-grape-500 text-right"
            placeholder="미설정"
            aria-label="월 총 예산"
          />
          <span className="text-sm text-[var(--text-tertiary)]">원</span>
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
                배정: {formatAmount(allocatedTotal)} / {formatAmount(totalNum)} ({allocationPercent.toFixed(1)}%)
              </span>
              <span className={remainingBudget != null && remainingBudget < 0 ? 'text-rose-600 font-semibold' : ''}>
                남은 예산: {remainingBudget != null ? formatAmount(remainingBudget) : '-'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 예산 현황 카드 */}
      {alerts.length > 0 && (
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60 p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-grape-600" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">예산 현황</h2>
          </div>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.budget_id}
                className={`p-4 rounded-lg border ${
                  alert.is_exceeded
                    ? 'bg-rose-50 border-rose-200'
                    : alert.is_warning
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-leaf-50 border-leaf-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-[var(--text-primary)]">{alert.category_name}</span>
                  <span
                    className={`text-sm font-semibold ${
                      alert.is_exceeded
                        ? 'text-rose-600'
                        : alert.is_warning
                        ? 'text-yellow-700'
                        : 'text-leaf-600'
                    }`}
                  >
                    {alert.usage_percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-[var(--border-default)] rounded-full h-2 mb-2">
                  <div
                    className={`h-2 rounded-full ${getProgressColor(alert)}`}
                    style={{ width: `${Math.min(alert.usage_percentage, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-[var(--text-secondary)]">
                  <span>
                    사용: {formatAmount(alert.spent_amount)} / {formatAmount(alert.budget_amount)}
                  </span>
                  <span>남은 금액: {formatAmount(alert.remaining_amount)}</span>
                </div>
                {alert.is_exceeded && (
                  <div className="flex items-center gap-1 mt-2">
                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                    <p className="text-xs text-rose-600">예산을 초과했습니다!</p>
                  </div>
                )}
                {alert.is_warning && !alert.is_exceeded && (
                  <div className="flex items-center gap-1 mt-2">
                    <AlertTriangle className="w-3 h-3 text-yellow-700" />
                    <p className="text-xs text-yellow-700">예산의 80%를 사용했습니다</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 카테고리별 예산 인라인 편집 */}
      {overview.length === 0 ? (
        <EmptyState
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
              const pct = getCategoryPercent(item.category_id)
              return (
                <div key={item.category_id} className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    {/* 카테고리 이름 */}
                    <span className="w-14 font-medium text-[var(--text-primary)] shrink-0 text-sm truncate">
                      {item.category_name}
                    </span>

                    {/* 최근 3개월 지출 — 데스크톱 */}
                    <div className="flex-1 text-xs text-[var(--text-muted)] min-w-0">
                      {item.monthly_spending.length > 0 ? (
                        <span>
                          {item.monthly_spending
                            .slice(0, 3)
                            .map((s) => `${s.month}월 ${s.amount.toLocaleString('ko-KR')}원`)
                            .join(' / ')}
                        </span>
                      ) : (
                        <span className="text-warm-300">지출 내역 없음</span>
                      )}
                    </div>

                    {/* 비율 표시 */}
                    {pct != null && (
                      <span className="text-xs text-grape-500 font-medium shrink-0 w-12 text-right">
                        {pct.toFixed(1)}%
                      </span>
                    )}

                    {/* 예산 입력 + 저장 버튼 */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={localAmounts[item.category_id] ?? ''}
                        onChange={(e) => handleAmountChange(item.category_id, e.target.value)}
                        className="w-28 px-2 py-1.5 text-sm border border-[var(--input-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-grape-500 text-right"
                        placeholder="예산 없음"
                        aria-label={`${item.category_name} 예산`}
                      />
                      <span className="text-xs text-[var(--text-tertiary)] shrink-0">원</span>
                      {isDirty(item) && (
                        <button
                          onClick={() => handleSave(item)}
                          disabled={savingIds.has(item.category_id)}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                          {savingIds.has(item.category_id) ? '저장 중...' : '저장'}
                        </button>
                      )}
                    </div>
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
