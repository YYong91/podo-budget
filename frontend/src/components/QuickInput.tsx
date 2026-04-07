/**
 * @file QuickInput.tsx
 * @description 플로팅 아일랜드가 입력창으로 전환되어 자연어 → LLM 파싱 → 즉시 저장하는 메신저 스타일 입력 UI.
 * visualViewport API로 키보드 높이에 맞춰 위치를 동적 조정한다.
 * forwardRef로 focus()를 노출 — iOS Safari는 사용자 제스처 컨텍스트에서 focus()를 호출해야 키보드가 뜬다.
 */
// iOS safe-area + 기본 하단 여백 — 컴포넌트 외부에서 계산하여 렌더마다 재생성 방지
// FloatingTabBar와 동일한 여백 — 6px (Apple HIG: safe area 바로 위 최소 여백)
const safeAreaBottom = 'calc(env(safe-area-inset-bottom, 0px) + 6px)'

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { X, ArrowUp, Loader2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { chatApi } from '../api/chat'
import { monthlyTransactionsKeys } from '../hooks/useMonthlyTransactions'
import type { ActionToastData } from './ActionToast'
import type { Category, Expense, Income } from '../types'

interface QuickInputProps {
  isOpen: boolean
  onClose: () => void
  onSaveSuccess: (data: ActionToastData) => void
  onSaveError: (data: ActionToastData) => void
  householdId: number
}

export interface QuickInputHandle {
  focus(): void
}

const QuickInput = forwardRef<QuickInputHandle, QuickInputProps>(function QuickInput(
  { isOpen, onClose, onSaveSuccess, onSaveError, householdId },
  ref
) {
  const [text, setText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [bottomOffset, setBottomOffset] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  // handleSubmit을 ref로 보관 — onRetry 콜백에서 self-reference 시 ESLint no-use-before-define 우회
  const handleSubmitRef = useRef<() => Promise<void>>(async () => {})
  // unmount 후 setState/콜백 호출 방지
  const isMountedRef = useRef(true)
  const queryClient = useQueryClient()

  useEffect(() => () => { isMountedRef.current = false }, [])

  // iOS Safari에서 키보드를 사용자 제스처 컨텍스트에서 트리거하기 위해 focus()를 외부에 노출
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }))

  // visualViewport 키보드 높이 대응 — iOS Safari fixed 요소 위치 보정
  useEffect(() => {
    if (!isOpen) return
    const vv = window.visualViewport
    if (!vv) return
    const handleResize = () => {
      const keyboardHeight = window.innerHeight - vv.height - vv.offsetTop
      setBottomOffset(Math.max(0, keyboardHeight))
    }
    vv.addEventListener('resize', handleResize)
    return () => vv.removeEventListener('resize', handleResize)
  }, [isOpen])

  // 닫기 — 상태 초기화 후 onClose 호출 (X 버튼, ESC 공용)
  // 항상 마운트된 상태이므로 닫힐 때 수동 리셋
  const handleClose = useCallback(() => {
    setText('')
    setIsLoading(false)
    onClose()
  }, [onClose])

  // ESC로 닫기
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleClose])

  // 카테고리 캐시에서 이모지 조회 — 캐시 없으면 fallback
  const getCategoryInfo = useCallback((categoryId: number): { emoji: string; name: string } => {
    const categories = queryClient.getQueryData<Category[]>(monthlyTransactionsKeys.categories)
    const cat = categories?.find(c => c.id === categoryId)
    return { emoji: cat?.emoji ?? '📝', name: cat?.name ?? '기타' }
  }, [queryClient])

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return

    setIsLoading(true)
    // 15초 타임아웃 — 스펙 요구사항
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    try {
      const { data: response } = await chatApi.sendMessage(trimmed, householdId, false, controller.signal)
      clearTimeout(timeoutId)

      const expenses = response.expenses_created ?? []
      const incomes = response.incomes_created ?? []
      const totalItems = [...expenses, ...incomes]

      if (totalItems.length === 0) {
        // 파싱 실패 — 입력창 유지
        if (!isMountedRef.current) return
        setIsLoading(false)
        onSaveError({ type: 'parse_error' })
        return
      }

      const firstItem = (expenses[0] ?? incomes[0]) as Expense | Income
      const isExpense = expenses.length > 0
      const { emoji, name: categoryName } = getCategoryInfo(firstItem.category_id ?? 0)
      const totalAmount = totalItems.reduce((sum, item) => sum + Number(item.amount), 0)
      // 다중 저장 시 스펙: 가계부 홈으로 이동
      const editPath = totalItems.length > 1
        ? '/home'
        : isExpense ? `/expenses/${firstItem.id}` : `/income/${firstItem.id}`

      if (!isMountedRef.current) return
      // 성공 시 로딩/입력 상태 초기화 후 닫기
      setIsLoading(false)
      setText('')
      // onClose 먼저 호출 — invalidateQueries가 실패해도 입력창은 닫힌다
      onClose()
      // 캐시 무효화는 백그라운드에서 (실패해도 UX에 영향 없음)
      queryClient.invalidateQueries({ queryKey: monthlyTransactionsKeys.all }).catch(() => {})
      onSaveSuccess({
        type: 'success',
        categoryEmoji: emoji,
        itemName: firstItem.description ?? trimmed,
        categoryName,
        totalAmount,
        count: totalItems.length,
        editPath,
      })
    } catch {
      clearTimeout(timeoutId)
      if (!isMountedRef.current) return
      setIsLoading(false)
      onSaveError({
        type: 'server_error',
        originalText: trimmed,
        onRetry: () => { handleSubmitRef.current() },
      })
    }
  }, [text, isLoading, householdId, queryClient, getCategoryInfo, onClose, onSaveSuccess, onSaveError])

  // 항상 최신 handleSubmit을 ref에 동기화 (useEffect로 render 단계 outside 보장)
  useEffect(() => {
    handleSubmitRef.current = handleSubmit
  })

  return (
    <div
      className={`md:hidden fixed left-0 right-0 z-30 flex justify-center pointer-events-none transition-all duration-200 ${
        isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
      }`}
      style={{ bottom: bottomOffset > 0 ? `${bottomOffset}px` : safeAreaBottom }}
    >
      <div className={`${isOpen ? 'pointer-events-auto' : ''} flex items-center gap-2 px-4 py-2 rounded-full shadow-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl w-[calc(100%-2rem)] max-w-md`}>
        {/* 취소 버튼 */}
        <button
          onClick={handleClose}
          aria-label="입력 취소"
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* 입력 필드 */}
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
          placeholder={isLoading ? '분석 중...' : '오늘 점심 8000원'}
          disabled={isLoading}
          // value는 항상 text 유지 — 로딩 중 값을 비우면 에러 복귀 시 flash 발생
          className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none disabled:opacity-50"
        />

        {/* 전송 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={isLoading || !text.trim()}
          aria-label="전송"
          className="flex-shrink-0 w-10 h-10 rounded-full bg-grape-600 hover:bg-grape-700 active:bg-grape-800 disabled:opacity-50 flex items-center justify-center transition-colors shadow-sm"
        >
          {isLoading
            ? <Loader2 className="w-[18px] h-[18px] text-white animate-spin" />
            : <ArrowUp className="w-[18px] h-[18px] text-white" />
          }
        </button>
      </div>
    </div>
  )
})

export default QuickInput
