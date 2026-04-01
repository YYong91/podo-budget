/**
 * @file MonthlyView.tsx
 * @description 월별 캘린더 + 거래 목록 UI — 요약, 캘린더, 날짜별 그룹 리스트
 * TransactionList에서 월 뷰 관련 JSX를 분리한 컴포넌트.
 */

import { useRef, useMemo, useCallback } from 'react'
import PeriodNavigator from '../stats/PeriodNavigator'
import MiniCalendar from '../MiniCalendar'
import TransactionItem from '../TransactionItem'
import ScheduledTransactions from '../ScheduledTransactions'
import EmptyState from '../EmptyState'
import WelcomeCard from '../WelcomeCard'
import BotNudgeCard from '../BotNudgeCard'
import { Search } from 'lucide-react'
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
}: MonthlyViewProps) {
  const { addToast } = useToast()

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

      {/* 요약 + 필터 */}
      <div className="flex items-center justify-center gap-6">
        <button
          onClick={() => monthly.toggleFilter('expense')}
          className={`text-center transition-opacity ${
            monthly.filter === 'income' ? 'opacity-40' : ''
          }`}
        >
          <div className="text-xs text-[var(--text-tertiary)]">지출</div>
          <div className={`text-base font-bold ${monthly.filter !== 'income' ? 'text-grape-600' : 'text-[var(--text-muted)]'}`}>
            {formatAmount(monthly.totalExpense)}
          </div>
        </button>
        <div className="w-px h-8 bg-[var(--border-default)]" />
        <button
          onClick={() => monthly.toggleFilter('income')}
          className={`text-center transition-opacity ${
            monthly.filter === 'expense' ? 'opacity-40' : ''
          }`}
        >
          <div className="text-xs text-[var(--text-tertiary)]">수입</div>
          <div className={`text-base font-bold ${monthly.filter !== 'expense' ? 'text-leaf-600' : 'text-[var(--text-muted)]'}`}>
            {formatAmount(monthly.totalIncome)}
          </div>
        </button>
      </div>

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

      {/* 미니 캘린더 */}
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-3">
        <MiniCalendar
          year={monthly.currentYear}
          month={monthly.currentMonth}
          daySummaries={monthly.daySummaries}
          onDateClick={handleDateClick}
          today={todayString}
        />
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
            title={monthly.filter === 'all' ? '거래 내역이 없습니다' : `${monthly.filter === 'expense' ? '지출' : '수입'} 내역이 없습니다`}
            description="이번 달의 거래를 추가해보세요."
          />
        </div>
      ) : (
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] overflow-hidden">
          {Array.from(monthly.grouped.entries()).map(([dateKey, txs]) => (
            <div key={dateKey}>
              {/* 스티키 날짜 헤더 */}
              <div
                ref={(el) => { if (el) dateRefs.current.set(dateKey, el) }}
                className="sticky top-0 md:top-0 z-10 bg-[var(--surface-elevated)] px-4 py-2 border-b border-[var(--border-subtle)] scroll-mt-14 md:scroll-mt-0"
              >
                <span className="text-xs font-semibold text-[var(--text-secondary)]">
                  {formatDateHeader(dateKey)}
                </span>
              </div>
              {/* 거래 항목들 */}
              <div className="divide-y divide-[var(--border-subtle)]">
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
          ))}
        </div>
      )}
    </>
  )
}

/** 월별 거래 리스트 로딩 스켈레톤 */
function MonthlyViewSkeleton() {
  return (
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] overflow-hidden">
      {[1, 2, 3].map(i => (
        <div key={i}>
          <div className="bg-[var(--surface-elevated)] px-4 py-2 border-b border-[var(--border-subtle)]">
            <div className="h-3 w-24 bg-[var(--surface-hover)] rounded animate-pulse" />
          </div>
          {[1, 2].map(j => (
            <div key={j} className="px-4 py-3 space-y-2">
              <div className="flex justify-between">
                <div className="h-4 w-32 bg-[var(--border-subtle)] rounded animate-pulse" />
                <div className="h-4 w-20 bg-[var(--border-subtle)] rounded animate-pulse" />
              </div>
              <div className="h-3 w-12 bg-[var(--border-subtle)] rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
