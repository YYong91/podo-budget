import { useState, useMemo, useEffect } from 'react'
import { formatAmount, getLocalDateString } from '../../utils/format'
import { useToast } from '../../hooks/useToast'
import type { RecurringTransaction } from '../../types'

// sessionStorage 키: 현재 세션에서 "나중에" 처리된 정기거래 ID 목록
const SNOOZE_KEY = 'podo-snoozed-recurring'

type TodayRecurringCardProps = {
  items: RecurringTransaction[]
  onExecute: (id: number, amount?: number) => Promise<void>
  onSkip: (id: number) => Promise<void>
}

/** 오늘 기준 처리 대기 중인 정기거래를 카드 스택으로 보여주는 컴포넌트.
 *  한 번에 하나씩 표시하고, 등록/건너뛰기 후 다음 항목으로 이동한다.
 *  processedIds로 처리 상태를 추적하여 items 참조가 바뀌어도 안전하게 동작한다.
 *  snoozedIds는 sessionStorage 기반 — 탭 닫으면 초기화되어 다음 방문 시 재표시된다.
 */
export default function TodayRecurringCard({ items, onExecute, onSkip }: TodayRecurringCardProps) {
  const { addToast } = useToast()
  const [processedIds, setProcessedIds] = useState<Set<number>>(new Set())
  const [snoozedIds, setSnoozedIds] = useState<Set<number>>(() => {
    // 마운트 시 sessionStorage에서 스누즈 목록 복원
    try {
      const raw = sessionStorage.getItem(SNOOZE_KEY)
      return raw ? new Set<number>(JSON.parse(raw)) : new Set<number>()
    } catch {
      return new Set<number>()
    }
  })
  const [isLoading, setIsLoading] = useState(false)
  // 금액 수정 모드 상태: null이면 수정 안 함, 숫자면 사용자가 입력한 금액
  const [isEditing, setIsEditing] = useState(false)
  const [editingAmount, setEditingAmount] = useState<number | null>(null)

  // items 참조가 바뀌면 (refetch 후) processedIds 클리어 — 실행된 건은 이미 next_due_date가 다음 달로 이동해 pendingItems에서 제외됨
  useEffect(() => {
    setProcessedIds(new Set())
  }, [items])

  // 날짜는 마운트 시 한 번만 계산 (렌더링마다 재계산 방지)
  const today = useMemo(() => getLocalDateString(), [])

  // 오늘 또는 이전 날짜가 due_date이고, 처리/스누즈되지 않은 정기거래만 필터링
  const visibleItems = useMemo(
    () => items.filter(r => r.next_due_date <= today && !processedIds.has(r.id) && !snoozedIds.has(r.id)),
    [items, today, processedIds, snoozedIds],
  )

  // 처리할 항목이 없으면 렌더링하지 않음
  if (visibleItems.length === 0) return null

  const current = visibleItems[0]
  const total = visibleItems.length
  const isExpense = current.type === 'expense'

  // 카드 항목이 바뀔 때 편집 상태 초기화 (다음 항목으로 이동 시)
  const resetEditing = () => {
    setIsEditing(false)
    setEditingAmount(null)
  }

  const handleAction = async (action: 'execute' | 'skip') => {
    setIsLoading(true)
    try {
      if (action === 'execute') {
        // 금액 수정 모드였다면 수정된 금액 전달, 아니면 undefined (원래 금액 사용)
        await onExecute(current.id, editingAmount ?? undefined)
      } else {
        await onSkip(current.id)
      }
      // 성공 시 처리된 ID 추가 → visibleItems에서 자동으로 제외
      setProcessedIds(prev => new Set(prev).add(current.id))
      resetEditing()
    } catch {
      // 실패 시 버튼 복원 (처리 상태 변경 없음), 사용자에게 에러 알림
      addToast('error', '처리에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setIsLoading(false)
    }
  }

  /** "나중에" 클릭: 이번 세션에서만 숨김. API 호출 없이 즉시 처리 */
  const handleSnooze = (id: number) => {
    setSnoozedIds(prev => {
      const next = new Set(prev).add(id)
      // sessionStorage에 직렬화하여 저장 — 탭 닫으면 자동 초기화
      sessionStorage.setItem(SNOOZE_KEY, JSON.stringify([...next]))
      return next
    })
    resetEditing()
  }

  /** 금액 수정 토글: 수정 모드 진입 시 현재 금액으로 초기화 */
  const handleToggleEditing = () => {
    if (isEditing) {
      // 수정 취소 시 상태 초기화
      resetEditing()
    } else {
      setIsEditing(true)
      setEditingAmount(current.amount)
    }
  }

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)] shadow-sm p-4">
      {/* 헤더 */}
      <div className="text-sm font-semibold text-[var(--text-primary)] mb-3">
        오늘 정기거래 {total}건
      </div>

      {/* 카드 본문 */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 min-w-0">
          {/* 카테고리 이모지 — 없으면 타입별 기본값 */}
          <span className="text-lg">{current.category_emoji ?? (isExpense ? '💸' : '💰')}</span>
          <span className="text-sm font-medium text-[var(--text-primary)] truncate">
            {current.description}
          </span>
          <span className={`text-sm font-semibold shrink-0 ${isExpense ? 'text-[var(--text-secondary)]' : 'text-leaf-600'}`}>
            {formatAmount(current.amount)}
          </span>
        </div>

        {/* 순번 표시 (N/M) */}
        <span className="text-xs text-[var(--text-tertiary)] shrink-0 ml-2">
          1/{total}
        </span>
      </div>

      {/* 금액 수정 토글 버튼 */}
      <div className="mb-3">
        <button
          onClick={handleToggleEditing}
          disabled={isLoading}
          className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] underline underline-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isEditing ? '수정 취소' : '금액 수정'}
        </button>
      </div>

      {/* 금액 수정 입력 필드 (수정 모드일 때만 표시) */}
      {isEditing && (
        <div className="mb-3">
          <div className="flex items-center border border-[var(--border-default)] rounded-lg overflow-hidden">
            <span className="px-3 py-2 text-sm text-[var(--text-tertiary)] bg-[var(--surface-elevated)] border-r border-[var(--border-default)]">
              ₩
            </span>
            <input
              type="number"
              value={editingAmount ?? ''}
              onChange={e => {
              const val = Number(e.target.value)
              setEditingAmount(e.target.value === '' || isNaN(val) ? null : val)
            }}
              aria-label="변경할 금액"
              className="flex-1 px-3 py-2 text-sm bg-transparent text-[var(--text-primary)] outline-none"
              placeholder={String(current.amount)}
              min={0}
            />
          </div>
        </div>
      )}

      {/* 액션 버튼: 1행 [등록하기 건너뛰기], 2행 [나중에] — 위계 명확화 */}
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <button
            onClick={() => handleAction('execute')}
            disabled={isLoading || (isEditing && (editingAmount == null || editingAmount <= 0))}
            className={`flex-1 py-2 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isExpense
                ? 'bg-grape-600 hover:bg-grape-700'
                : 'bg-leaf-600 hover:bg-leaf-700'
            }`}
          >
            등록하기
          </button>
          <button
            onClick={() => handleAction('skip')}
            disabled={isLoading}
            className="flex-1 py-2 rounded-xl text-sm font-medium bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            건너뛰기
          </button>
        </div>
        {/* 나중에: 세션 스누즈. 전체 너비 텍스트 버튼으로 시각적 우선순위 명확히 낮춤 */}
        <button
          onClick={() => handleSnooze(current.id)}
          disabled={isLoading}
          className="w-full py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-tertiary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          나중에
        </button>
      </div>
    </div>
  )
}
