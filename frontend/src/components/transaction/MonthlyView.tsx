/**
 * @file MonthlyView.tsx
 * @description 월별 캘린더 + 거래 목록 UI — 요약, 캘린더, 날짜별 그룹 리스트
 * TransactionList에서 월 뷰 관련 JSX를 분리한 컴포넌트.
 */

import { useRef, useMemo, useCallback, useState } from 'react'
import { Skeleton } from '../skeleton/Skeleton'
import PeriodNavigator from '../stats/PeriodNavigator'
import HeroSummary from '../stats/HeroSummary'
import MiniCalendar from '../MiniCalendar'
import TransactionItem from '../TransactionItem'
import ScheduledTransactions from '../ScheduledTransactions'
import EmptyState from '../EmptyState'
import WelcomeCard from '../WelcomeCard'
import BotNudgeCard from '../BotNudgeCard'
import { Search, ChevronDown, ChevronUp } from 'lucide-react'
import { formatAmount } from '../../utils/format'
import { formatDateHeader } from '../../utils/calendar'
import { recurringApi } from '../../api/recurring'
import { useToast } from '../../hooks/useToast'
import { TOAST } from '../../constants/toastMessages'
import type { useMonthlyTransactions } from '../../hooks/useMonthlyTransactions'

interface MonthlyViewProps {
  monthly: ReturnType<typeof useMonthlyTransactions>
  categoryClickHandlers: Map<string, () => void>
  onEnterSearchMode: () => void
  /** 웰컴 카드 */
  welcomeDismissed: boolean
  totalTransactionCount: number
  isBotLinked: boolean
  onWelcomeDismiss: () => void
  /** 봇 넛지 카드 */
  botNudgeDismissed: boolean
  onBotNudgeDismiss: () => void
  /** 멀티멤버 가구의 user_id → username 매핑 (단독 가구는 null) */
  memberMap: Map<number, string> | null
  /** 월 총 예산 (null이면 미설정) */
  totalBudget: number | null
}

export default function MonthlyView({
  monthly,
  categoryClickHandlers,
  onEnterSearchMode,
  welcomeDismissed,
  totalTransactionCount,
  isBotLinked,
  onWelcomeDismiss,
  botNudgeDismissed,
  onBotNudgeDismiss,
  memberMap,
  totalBudget,
}: MonthlyViewProps) {
  const { addToast } = useToast()

  // 달력 접기/펼치기 (최초 방문: 펼침, 이후: 사용자 선호 유지)
  const CALENDAR_COLLAPSE_KEY = 'podo-calendar-collapsed'
  const [calendarCollapsed, setCalendarCollapsed] = useState(() => {
    const stored = localStorage.getItem(CALENDAR_COLLAPSE_KEY)
    if (stored === null) return false // 최초 방문 → 펼침
    return stored === 'true'
  })
  const toggleCalendar = useCallback(() => {
    setCalendarCollapsed(prev => {
      const next = !prev
      localStorage.setItem(CALENDAR_COLLAPSE_KEY, String(next))
      return next
    })
  }, [])

  // 날짜 섹션 ref 맵
  const dateRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const todayString = useMemo(() => {
    const d = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }, [])

  // 캘린더 날짜 클릭 -> 스크롤
  const handleDateClick = useCallback((dateString: string) => {
    const ref = dateRefs.current.get(dateString)
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  return (
    <>
      {/* 월 네비게이션 + 검색 버튼 */}
      <div className="relative">
        <PeriodNavigator label={monthly.monthLabel} onPrev={() => monthly.navigateMonth(-1)} onNext={() => monthly.navigateMonth(1)} />
        <button
          onClick={onEnterSearchMode}
          className="absolute right-0 top-1/2 -translate-y-1/2 p-2 rounded-xl hover:bg-[var(--surface-hover)] transition-colors"
          aria-label="검색"
        >
          <Search className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
      </div>

      {/* 월간 지출 히어로 요약 — currentMonth는 0-indexed이므로 +1 */}
      <HeroSummary
        label={`${monthly.currentMonth + 1}월 지출`}
        amount={monthly.totalExpense}
        sublabel={
          totalBudget != null && totalBudget > 0
            ? `예산 대비 ${Math.round((monthly.totalExpense / totalBudget) * 100)}%`
            : monthly.totalIncome > 0
              ? `수입 대비 ${Math.round((monthly.totalExpense / monthly.totalIncome) * 100)}%`
              : undefined
        }
      />

      {/* 온보딩 웰컴 카드 */}
      {!welcomeDismissed && !monthly.loading && (
        <WelcomeCard
          transactionCount={Math.max(totalTransactionCount, monthly.expenses.length + monthly.incomes.length)}
          isBotLinked={isBotLinked}
          onDismiss={onWelcomeDismiss}
        />
      )}

      {/* 봇 연동 넛지 카드 — 웰컴 카드 완료 후, 봇 미연동 + 지출 1건 이상 */}
      {welcomeDismissed && !botNudgeDismissed && !isBotLinked && !monthly.loading
        && monthly.expenses.length > 0 && (
        <BotNudgeCard onDismiss={onBotNudgeDismiss} />
      )}

      {/* 미니 캘린더 (접기/펼치기) */}
      {calendarCollapsed ? (
        <button
          onClick={toggleCalendar}
          className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] hover:bg-[var(--surface-hover)] transition-colors"
        >
          <span className="text-xs text-[var(--text-tertiary)]">달력 펼치기</span>
          <ChevronDown className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
        </button>
      ) : (
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-3">
          <MiniCalendar
            year={monthly.currentYear}
            month={monthly.currentMonth}
            daySummaries={monthly.daySummaries}
            onDateClick={handleDateClick}
            today={todayString}
          />
          <button
            onClick={toggleCalendar}
            className="w-full flex items-center justify-center gap-1.5 pt-2 mt-1 border-t border-[var(--border-subtle)]"
          >
            <span className="text-xs text-[var(--text-tertiary)]">접기</span>
            <ChevronUp className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
          </button>
        </div>
      )}

      {/* 세그먼트 필터 — 캘린더 아래, 리스트 바로 위 */}
      <div className="flex items-center bg-[var(--surface-elevated)] rounded-lg p-1">
        {(['all', 'expense', 'income'] as const).map((type) => {
          const label = type === 'all' ? '전체' : type === 'expense' ? '지출' : '수입'
          const isActive = type === 'all' ? monthly.filter === 'all' : monthly.filter === type
          return (
            <button
              key={type}
              onClick={() => {
                if (type === 'all') {
                  // "전체" 선택 — 현재 필터가 있으면 토글로 해제
                  if (monthly.filter !== 'all') monthly.toggleFilter(monthly.filter as 'expense' | 'income')
                } else {
                  monthly.toggleFilter(type)
                }
              }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                isActive
                  ? 'bg-[var(--surface-card)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* 예정 거래 섹션 — 캘린더 아래, 거래 리스트 위 */}
      <ScheduledTransactions
        items={monthly.allRecurring}
        currentYear={monthly.currentYear}
        currentMonth={monthly.currentMonth}
        onExecute={async (id) => {
          try {
            await recurringApi.execute(id)
            addToast('success', TOAST.RECURRING_EXECUTED)
            monthly.fetchData()
          } catch {
            addToast('error', TOAST.RECURRING_EXECUTE_FAILED)
          }
        }}
        onSkip={async (id) => {
          try {
            await recurringApi.skip(id)
            addToast('success', TOAST.RECURRING_SKIPPED)
            monthly.fetchData()
          } catch {
            addToast('error', TOAST.RECURRING_SKIP_FAILED)
          }
        }}
      />

      {/* 거래 리스트 */}
      {monthly.loading ? (
        <MonthlyViewSkeleton />
      ) : monthly.grouped.size === 0 ? (
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]">
          <EmptyState
            variant="primary"
            title={monthly.filter === 'all' ? '거래 내역이 없습니다' : `${monthly.filter === 'expense' ? '지출' : '수입'} 내역이 없습니다`}
            description="이번 달의 거래를 추가해보세요."
          />
        </div>
      ) : (
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] overflow-hidden animate-stagger">
          {Array.from(monthly.grouped.entries()).map(([dateKey, txs], index) => {
            // 날짜별 합계: 지출은 음수, 수입은 양수
            const dailyTotal = txs.reduce(
              (sum, tx) => sum + (tx.type === 'expense' ? -tx.amount : tx.amount),
              0
            )
            return (
              <div key={dateKey} className={index > 0 ? 'mt-6' : ''}>
                {/* 스티키 날짜 헤더 — 날짜 텍스트 + 일별 합계 */}
                <div
                  ref={(el) => { if (el) dateRefs.current.set(dateKey, el) }}
                  className="sticky top-0 md:top-0 z-10 bg-[var(--surface-elevated)] px-4 py-2 scroll-mt-14 md:scroll-mt-0"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--text-secondary)]">
                      {formatDateHeader(dateKey)}
                    </span>
                    <span className="text-amount text-[var(--text-muted)]">
                      {formatAmount(dailyTotal)}
                    </span>
                  </div>
                </div>
                {/* 거래 항목들 — border 대신 gap으로 간격 */}
                <div className="flex flex-col gap-1">
                  {txs.map(tx => (
                    <TransactionItem
                      key={`${tx.type}-${tx.id}`}
                      id={tx.id}
                      type={tx.type}
                      description={tx.description}
                      amount={tx.amount}
                      categoryId={tx.category_id}
                      categoryMap={monthly.categoryMap}
                      excludeFromStats={tx.exclude_from_stats}
                      recurringTransactionId={tx.recurring_transaction_id}
                      onCategoryClick={categoryClickHandlers.get(`${tx.type}-${tx.id}`)!}
                      recordedBy={memberMap && tx.user_id != null ? memberMap.get(tx.user_id) : undefined}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

/** 월별 거래 리스트 로딩 스켈레톤 */
function MonthlyViewSkeleton() {
  return (
    <div className="space-y-4">
      {/* 히어로 골격 */}
      <div className="card-surface p-6 space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-3 w-36" />
      </div>
      {/* 날짜 헤더 + 거래 3줄 */}
      <div className="card-surface overflow-hidden">
        <div className="px-4 py-2">
          <Skeleton className="h-3 w-24" />
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="px-4 py-4 flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}
