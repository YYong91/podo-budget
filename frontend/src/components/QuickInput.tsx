/**
 * @file QuickInput.tsx
 * @description 플로팅 아일랜드가 입력창으로 전환되어 자연어 → LLM 파싱 → 즉시 저장하는 메신저 스타일 입력 UI.
 * visualViewport API로 키보드 높이에 맞춰 위치를 동적 조정한다.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
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

export default function QuickInput({ isOpen, onClose, onSaveSuccess, onSaveError, householdId }: QuickInputProps) {
  const [text, setText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [bottomOffset, setBottomOffset] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  // handleSubmit을 ref로 보관 — onRetry 콜백에서 self-reference 시 ESLint no-use-before-define 우회
  const handleSubmitRef = useRef<() => Promise<void>>(async () => {})
  const queryClient = useQueryClient()

  // 열릴 때 포커스 처리
  useEffect(() => {
    if (!isOpen) return
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [isOpen])

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

  // ESC로 닫기
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // 카테고리 캐시에서 이모지 조회 — 캐시 없으면 '📝' fallback
  const getCategoryInfo = useCallback((categoryId: number): { emoji: string; name: string } => {
    const categories = queryClient.getQueryData<Category[]>(monthlyTransactionsKeys.categories)
    const cat = categories?.find(c => c.id === categoryId)
    return { emoji: cat?.emoji ?? '📝', name: cat?.name ?? '' }
  }, [queryClient])

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return

    setIsLoading(true)
    // 15초 타임아웃 — 스펙 요구사항
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    try {
      const { data: response } = await chatApi.sendMessage(trimmed, householdId, false)
      clearTimeout(timeoutId)

      const expenses = response.expenses_created ?? []
      const incomes = response.incomes_created ?? []
      const totalItems = [...expenses, ...incomes]

      if (totalItems.length === 0) {
        // 파싱 실패 — 입력창 유지
        setIsLoading(false)
        onSaveError({ type: 'parse_error' })
        return
      }

      // 캐시 무효화 — 홈 거래 목록 갱신
      await queryClient.invalidateQueries({ queryKey: monthlyTransactionsKeys.all })

      const firstItem = (expenses[0] ?? incomes[0]) as Expense | Income
      const isExpense = expenses.length > 0
      const { emoji, name: categoryName } = getCategoryInfo(firstItem.category_id)
      const totalAmount = totalItems.reduce((sum, item) => sum + Number(item.amount), 0)
      // 다중 저장 시 스펙: 가계부 홈으로 이동
      const editPath = totalItems.length > 1
        ? '/home'
        : isExpense ? `/expenses/${firstItem.id}` : `/income/${firstItem.id}`

      onClose()
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

  if (!isOpen) return null

  const safeAreaBottom = 'calc(env(safe-area-inset-bottom, 0px) + 12px)'

  return (
    <div
      className="md:hidden fixed left-0 right-0 z-30 flex justify-center pointer-events-none"
      style={{ bottom: bottomOffset > 0 ? `${bottomOffset}px` : safeAreaBottom }}
    >
      <div className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-full shadow-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl w-[calc(100%-2rem)] max-w-md">
        {/* 취소 버튼 */}
        <button
          onClick={onClose}
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
}
