/**
 * @file BudgetManager.tsx
 * @description 예산 관리 페이지
 * 카테고리 전체 목록을 한 화면에 표시하고, 각 카테고리 옆에 예산 금액을 바로 입력할 수 있다.
 * 참고용으로 카테고리별 최근 3개월 실제 지출액을 표시한다.
 */

import { useState, useEffect } from 'react'
import { Bell, AlertTriangle } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import budgetApi from '../api/budgets'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import type { BudgetAlert, CategoryBudgetOverview } from '../types'

export default function BudgetManager() {
  const { addToast } = useToast()

  const [overview, setOverview] = useState<CategoryBudgetOverview[]>([])
  const [alerts, setAlerts] = useState<BudgetAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 카테고리별 로컬 입력 상태 { [categoryId]: 금액 문자열 }
  const [localAmounts, setLocalAmounts] = useState<Record<number, string>>({})
  // 저장 중인 카테고리 ID 집합
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set())

  /**
   * 데이터 로드 — 카테고리 개요와 알림을 동시에 가져온다
   */
  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [overviewRes, alertsRes] = await Promise.all([
        budgetApi.getCategoryOverview(),
        budgetApi.getBudgetAlerts(),
      ])

      setOverview(overviewRes.data)
      setAlerts(alertsRes.data)

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
   * 금액 포맷팅
   */
  const formatAmount = (amount: number): string =>
    `₩${amount.toLocaleString('ko-KR')}`

  /**
   * 프로그레스바 색상 결정
   */
  const getProgressColor = (alert: BudgetAlert): string => {
    if (alert.is_exceeded) return 'bg-rose-500'
    if (alert.is_warning) return 'bg-yellow-500'
    return 'bg-leaf-500'
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

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-xl font-bold text-grape-700">예산 관리</h1>
        <p className="text-sm text-warm-500 mt-1">
          카테고리별 예산을 한 번에 설정하세요
        </p>
      </div>

      {/* 알림 카드 */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-warm-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-grape-600" />
            <h2 className="text-lg font-semibold text-warm-900">예산 알림</h2>
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
                  <span className="font-medium text-warm-900">{alert.category_name}</span>
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
                <div className="w-full bg-warm-200 rounded-full h-2 mb-2">
                  <div
                    className={`h-2 rounded-full ${getProgressColor(alert)}`}
                    style={{ width: `${Math.min(alert.usage_percentage, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-warm-600">
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
        <div className="bg-white rounded-2xl shadow-sm border border-warm-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-warm-100">
            <h2 className="text-base font-semibold text-warm-900">카테고리별 예산</h2>
            <p className="text-xs text-warm-400 mt-0.5">
              금액을 입력 후 저장 버튼을 누르세요 · 비우면 예산 삭제
            </p>
          </div>
          <div className="divide-y divide-warm-100">
            {overview.map((item) => (
              <div key={item.category_id} className="px-5 py-4">
                <div className="flex items-center gap-3">
                  {/* 카테고리 이름 */}
                  <span className="w-14 font-medium text-warm-900 shrink-0 text-sm truncate">
                    {item.category_name}
                  </span>

                  {/* 최근 3개월 지출 — 데스크톱 */}
                  <div className="flex-1 text-xs text-warm-400 min-w-0">
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

                  {/* 예산 입력 + 저장 버튼 */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={localAmounts[item.category_id] ?? ''}
                      onChange={(e) => handleAmountChange(item.category_id, e.target.value)}
                      className="w-28 px-2 py-1.5 text-sm border border-warm-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-grape-500 text-right"
                      placeholder="예산 없음"
                      aria-label={`${item.category_name} 예산`}
                    />
                    <span className="text-xs text-warm-500 shrink-0">원</span>
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
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
