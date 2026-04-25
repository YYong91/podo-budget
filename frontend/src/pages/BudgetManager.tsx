/**
 * @file BudgetManager.tsx
 * @description 예산 관리 페이지
 * 카테고리 전체 목록을 한 화면에 표시하고, 각 카테고리 옆에 예산 금액을 바로 입력할 수 있다.
 * 예산이 설정된 카테고리는 진행바와 지출 금액을 카테고리 행에 바로 표시한다.
 * 월 총 예산을 설정하면 배분 비율과 여유예산을 확인할 수 있다.
 *
 * UX 개선사항:
 * - 카테고리 이름 앞에 이모지 표시 (categoriesApi 연동)
 * - 저장 버튼 제거 → blur 시 dirty한 경우만 자동 저장
 * - 인라인 피드백: 스피너 → 체크마크(0.8초) → 사라짐 / 에러 시 X 아이콘 + 빨간 테두리
 * - 금액 입력 중 포커스 시 아래에 ₩ 포맷 미리보기 표시
 */

import { useState, useEffect, useMemo } from 'react'
import { useGoBack } from '../hooks/useGoBack'
import { ArrowLeft, Wallet, PiggyBank, Loader2, Check, X } from 'lucide-react'
import budgetApi from '../api/budgets'
import { categoryApi } from '../api/categories'
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
    <div className="space-y-6">
      {/* 헤더 스켈레톤 */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-6 w-24" />
      </div>
      {/* 월 총 예산 카드 */}
      <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)]/60 p-5">
        <Skeleton className="h-5 w-20 mb-4" />
        <Skeleton className="h-10 w-44" />
      </div>
      {/* 카테고리 카드 */}
      <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)]/60 overflow-hidden">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="px-4 py-3.5 space-y-2 border-b border-[var(--border-subtle)] last:border-0">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-8" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function BudgetManager() {
  const goBack = useGoBack('/settings')

  const [overview, setOverview] = useState<CategoryBudgetOverview[]>([])
  const [alerts, setAlerts] = useState<BudgetAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 카테고리 이모지 맵 { category_id → emoji }
  const [emojiMap, setEmojiMap] = useState<Map<number, string>>(new Map())

  // 카테고리별 로컬 입력 상태 { [categoryId]: 금액 문자열 }
  const [localAmounts, setLocalAmounts] = useState<Record<number, string>>({})
  // 저장 중인 카테고리 ID 집합
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set())
  // 저장 완료된 카테고리 ID 집합 (체크마크 0.8초 표시)
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set())
  // 에러 상태 카테고리 ID 집합 (빨간 테두리 + X 아이콘)
  const [errorIds, setErrorIds] = useState<Set<number>>(new Set())

  // 월 총 예산
  const [totalBudget, setTotalBudget] = useState<number | null>(null)
  const [localTotalBudget, setLocalTotalBudget] = useState<string>('')
  const [savingTotal, setSavingTotal] = useState(false)
  const [totalSaved, setTotalSaved] = useState(false)
  const [totalError, setTotalError] = useState(false)

  // 입력 포커스 상태 — 포커스 시 raw 숫자, blur 시 ₩ 포맷 표시
  const [totalBudgetFocused, setTotalBudgetFocused] = useState(false)
  const [focusedCategoryId, setFocusedCategoryId] = useState<number | null>(null)

  /**
   * 데이터 로드 — 카테고리 개요, 알림, 월 총 예산, 카테고리 이모지를 동시에 가져온다
   */
  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [overviewRes, alertsRes, totalRes, categoriesRes] = await Promise.all([
        budgetApi.getCategoryOverview(),
        budgetApi.getBudgetAlerts(),
        budgetApi.getTotalBudget(),
        categoryApi.getAll(),
      ])

      setOverview(overviewRes.data)
      setAlerts(alertsRes.data)
      setTotalBudget(totalRes.data.total_monthly_budget)
      setLocalTotalBudget(
        totalRes.data.total_monthly_budget != null ? String(totalRes.data.total_monthly_budget) : ''
      )

      // 이모지 맵 구성: category_id → emoji (null/undefined이면 저장 안 함)
      const map = new Map<number, string>()
      categoriesRes.data.forEach((cat) => {
        if (cat.emoji) map.set(cat.id, cat.emoji)
      })
      setEmojiMap(map)

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
   * 월 총 예산 자동 저장 (blur 시 호출)
   * - dirty하지 않으면 스킵
   * - 성공: 체크마크 0.8초 표시
   * - 실패: X 아이콘 + 1.5초 후 원상복귀
   */
  const handleSaveTotal = async () => {
    if (!isTotalDirty()) return
    setSavingTotal(true)
    setTotalError(false)
    try {
      const num = Number(localTotalBudget)
      const amount = localTotalBudget && num > 0 ? num : null
      const res = await budgetApi.updateTotalBudget(amount)
      setTotalBudget(res.data.total_monthly_budget)
      setTotalSaved(true)
      setTimeout(() => setTotalSaved(false), 800)
    } catch (err) {
      console.error('Failed to save total budget:', err)
      setTotalError(true)
      setTimeout(() => setTotalError(false), 1500)
    } finally {
      setSavingTotal(false)
    }
  }

  /**
   * 카테고리 예산 자동 저장 (blur 시 호출)
   * - dirty하지 않으면 스킵
   * - 빈 값: 기존 예산 삭제
   * - 기존 예산 있음: 금액 수정
   * - 기존 예산 없음: 새로 생성 (월간, 오늘부터)
   * - 성공: 체크마크 0.8초 표시
   * - 실패: X 아이콘 + 빨간 테두리 1.5초 후 원상복귀
   */
  const handleSave = async (item: CategoryBudgetOverview) => {
    if (!isDirty(item)) return

    const amountStr = localAmounts[item.category_id] ?? ''
    const numAmount = Number(amountStr)

    setSavingIds((prev) => new Set([...prev, item.category_id]))
    setErrorIds((prev) => {
      const s = new Set(prev)
      s.delete(item.category_id)
      return s
    })

    try {
      if (!amountStr || numAmount <= 0) {
        // 빈 값이면 기존 예산 삭제
        if (item.current_budget_id) {
          await budgetApi.deleteBudget(item.current_budget_id)
        }
        // 해당 row만 초기화 (전체 리프레시 없이)
        setOverview((prev) =>
          prev.map((o) =>
            o.category_id === item.category_id
              ? { ...o, current_budget_id: null, current_budget_amount: null }
              : o,
          ),
        )
      } else if (item.current_budget_id) {
        // 기존 예산 수정
        await budgetApi.updateBudget(item.current_budget_id, { amount: numAmount })
        // 금액만 갱신
        setOverview((prev) =>
          prev.map((o) =>
            o.category_id === item.category_id ? { ...o, current_budget_amount: numAmount } : o,
          ),
        )
      } else {
        // 새 예산 생성 — 월간, 오늘부터
        const res = await budgetApi.createBudget({
          category_id: item.category_id,
          amount: numAmount,
          period: 'monthly',
          start_date: new Date().toISOString().split('T')[0],
        })
        // 새 budget_id + 금액 반영
        setOverview((prev) =>
          prev.map((o) =>
            o.category_id === item.category_id
              ? { ...o, current_budget_id: res.data.id, current_budget_amount: numAmount }
              : o,
          ),
        )
      }
      // 체크마크 0.8초 표시
      setSavedIds((prev) => new Set([...prev, item.category_id]))
      setTimeout(() => {
        setSavedIds((prev) => {
          const s = new Set(prev)
          s.delete(item.category_id)
          return s
        })
      }, 800)
    } catch (err) {
      console.error('Failed to save budget:', err)
      setErrorIds((prev) => new Set([...prev, item.category_id]))
      setTimeout(() => {
        setErrorIds((prev) => {
          const s = new Set(prev)
          s.delete(item.category_id)
          return s
        })
      }, 1500)
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
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={totalBudgetFocused ? localTotalBudget : displayBudgetValue(localTotalBudget)}
              onChange={(e) => setLocalTotalBudget(extractNumber(e.target.value))}
              onFocus={() => setTotalBudgetFocused(true)}
              onBlur={() => {
                setTotalBudgetFocused(false)
                handleSaveTotal()
              }}
              className={`input-base w-44 text-right tabular-nums ${
                totalError ? 'border-rose-500' : ''
              }`}
              placeholder="미설정"
              aria-label="월 총 예산"
            />
            {/* 저장 상태 피드백 아이콘 */}
            {savingTotal ? (
              <Loader2 className="w-4 h-4 animate-spin text-[var(--text-muted)] shrink-0" />
            ) : totalSaved ? (
              <Check className="w-4 h-4 text-leaf-500 shrink-0" />
            ) : totalError ? (
              <X className="w-4 h-4 text-rose-500 shrink-0" />
            ) : null}
          </div>
          {/* 포커스 중 ₩ 포맷 미리보기 */}
          {totalBudgetFocused && localTotalBudget && (
            <p className="text-xs text-[var(--text-muted)] text-right tabular-nums -mt-1 w-44">
              {displayBudgetValue(localTotalBudget)}
            </p>
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
              금액을 수정하면 자동으로 저장돼요 · 비우면 예산 삭제
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
                      {emojiMap.get(item.category_id) && (
                        <span className="mr-1.5">{emojiMap.get(item.category_id)}</span>
                      )}
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

                  {/* 3. 예산 입력 (blur 자동 저장) + 피드백 아이콘 */}
                  <div className="space-y-1">
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
                        onBlur={() => {
                          setFocusedCategoryId(null)
                          handleSave(item)
                        }}
                        className={`input-base flex-1 text-right tabular-nums ${
                          errorIds.has(item.category_id) ? 'border-rose-500' : ''
                        }`}
                        placeholder="예산 없음"
                        aria-label={`${item.category_name} 예산`}
                      />
                      {/* 저장 상태 피드백 아이콘 */}
                      {savingIds.has(item.category_id) ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[var(--text-muted)] shrink-0" />
                      ) : savedIds.has(item.category_id) ? (
                        <Check className="w-4 h-4 text-leaf-500 shrink-0" />
                      ) : errorIds.has(item.category_id) ? (
                        <X className="w-4 h-4 text-rose-500 shrink-0" />
                      ) : null}
                    </div>
                    {/* 포커스 중 ₩ 포맷 미리보기 */}
                    {focusedCategoryId === item.category_id && localAmounts[item.category_id] && (
                      <p className="text-xs text-[var(--text-muted)] text-right tabular-nums -mt-1">
                        {displayBudgetValue(localAmounts[item.category_id] ?? '')}
                      </p>
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
