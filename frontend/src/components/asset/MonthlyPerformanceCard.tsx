/**
 * @file MonthlyPerformanceCard.tsx
 * @description 이번 달 성과 카드 — 변화량 + 스트릭 + 변화 분해
 */

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { formatCompactAmount } from '../../utils/format'
import type { AssetSnapshot } from '../../types'

interface BreakdownItem {
  label: string
  amount: number
}

interface MonthlyPerformanceCardProps {
  netWorthChange: number
  breakdownDiff: BreakdownItem[]
  streak: number
  savings: number
  /** 감소 시 긍정 메시지 */
  positiveMessage?: string | null
}

/** 유형 그룹 정의 */
const DISPLAY_GROUPS: { label: string; keys: string[] }[] = [
  { label: '투자', keys: ['stock_kr', 'stock_us', 'crypto'] },
  { label: '예적금', keys: ['deposit'] },
  { label: '부동산/기타', keys: ['real_estate', 'other'] },
]

/** breakdown 차이 + 부채 차이를 합산하여 표시 항목 생성 */
export function computeBreakdownDiff(
  current: { breakdown: Record<string, number> | null; totalLiabilities: number },
  previous: { breakdown: Record<string, number> | null; totalLiabilities: number },
): BreakdownItem[] {
  const curBreakdown = current.breakdown ?? {}
  const prevBreakdown = previous.breakdown ?? {}
  const items: BreakdownItem[] = []

  for (const group of DISPLAY_GROUPS) {
    const curSum = group.keys.reduce((s, k) => s + (curBreakdown[k] ?? 0), 0)
    const prevSum = group.keys.reduce((s, k) => s + (prevBreakdown[k] ?? 0), 0)
    const diff = curSum - prevSum
    if (diff !== 0) {
      items.push({ label: group.label, amount: diff })
    }
  }

  // 부채 변화 (부호 반전: 부채 감소 = 양수)
  const liabilityDiff = previous.totalLiabilities - current.totalLiabilities
  if (liabilityDiff !== 0) {
    items.push({ label: '대출 상환', amount: liabilityDiff })
  }

  return items
}

/** 스트릭 계산: 최신→과거 순 스냅샷에서 연속 증가 개월 수 */
export function computeStreak(snapshots: Pick<AssetSnapshot, 'net_worth'>[]): number {
  if (snapshots.length < 2) return 0
  let count = 0
  for (let i = 0; i < snapshots.length - 1; i++) {
    if (snapshots[i].net_worth > snapshots[i + 1].net_worth) {
      count++
    } else {
      break
    }
  }
  return count
}

/** 감소 시 긍정 요소 찾기 */
export function findPositiveMessage(breakdownDiff: BreakdownItem[], savings: number): string | null {
  const loanItem = breakdownDiff.find(d => d.label === '대출 상환' && d.amount > 0)
  if (loanItem) return `대출 잔액이 ${formatCompactAmount(loanItem.amount)}원 줄었어요`
  if (savings > 0) return `저축은 꾸준히 ${formatCompactAmount(savings)}원 유지 중`
  return null
}

/** 변화량을 만원 단위 축약 형태로 포맷 (+48만원, -12만원) */
function formatNetWorthChange(amount: number): string {
  const sign = amount >= 0 ? '+' : '-'
  const formatted = formatCompactAmount(Math.abs(amount))
  return `${sign}${formatted}원`
}

export default function MonthlyPerformanceCard({
  netWorthChange,
  breakdownDiff,
  streak,
  savings,
  positiveMessage,
}: MonthlyPerformanceCardProps) {
  const [expanded, setExpanded] = useState(false)
  const isPositive = netWorthChange >= 0

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)] shadow-sm p-5">
      {/* 변화량 */}
      <p className={`text-2xl font-bold ${isPositive ? 'text-leaf-600' : 'text-rose-600'}`}>
        {formatNetWorthChange(netWorthChange)}
      </p>

      {/* 스트릭 or 긍정 메시지 */}
      {isPositive && streak >= 2 && (
        <p className="text-sm text-leaf-600 mt-1">{streak}개월 연속 순자산 증가 중</p>
      )}
      {!isPositive && positiveMessage && (
        <p className="text-sm text-[var(--text-tertiary)] mt-1">{positiveMessage}</p>
      )}

      {/* 변화 상세 토글 */}
      {breakdownDiff.length > 0 && (
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="flex items-center gap-1 mt-3 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          변화 상세
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      )}

      {expanded && (
        <div className="mt-2 space-y-1.5">
          {breakdownDiff.map(item => (
            <div key={item.label} className="flex justify-between text-sm">
              <span className="text-[var(--text-tertiary)]">{item.label}</span>
              <span className={item.amount >= 0 ? 'text-leaf-600' : 'text-rose-600'}>
                {item.amount >= 0 ? '+' : '-'}{formatCompactAmount(Math.abs(item.amount))}원
              </span>
            </div>
          ))}
          {savings > 0 && (
            <>
              <div className="border-t border-[var(--border-subtle)] my-1.5" />
              <div className="flex justify-between text-xs text-[var(--text-muted)]">
                <span>이 중 저축성 지출</span>
                <span>{formatCompactAmount(savings)}원</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
