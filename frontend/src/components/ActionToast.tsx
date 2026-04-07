/**
 * @file ActionToast.tsx
 * @description 즉시 입력 후 표시되는 하단 카드형 토스트.
 * 성공(카테고리 이모지+금액+"수정 →"), 파싱 에러, 서버 에러(재시도) 세 가지 타입.
 * 3초 후 자동 닫힘.
 */
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

export type ActionToastData =
  | {
      type: 'success'
      categoryEmoji: string
      itemName: string
      categoryName: string
      totalAmount: number
      count: number
      editPath: string
    }
  | { type: 'parse_error' }
  | {
      type: 'server_error'
      originalText: string
      onRetry: () => void
    }

interface ActionToastProps {
  data: ActionToastData
  onClose: () => void
}

const AUTO_DISMISS_MS = 3000

export default function ActionToast({ data, onClose }: ActionToastProps) {
  const navigate = useNavigate()

  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  // 마운트 시 한 번만 타이머 설정 — onClose ref로 항상 최신 콜백 참조
  useEffect(() => {
    const timer = setTimeout(() => onCloseRef.current(), AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [])

  if (data.type === 'success') {
    const amountText = `₩${data.totalAmount.toLocaleString()}`
    return (
      <div role="status" aria-live="polite" className="bg-[var(--surface-card)] rounded-xl shadow-lg border-l-4 border-grape-400 p-3 flex items-center gap-3">
        <span className="text-xl flex-shrink-0">{data.categoryEmoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">
            {data.count > 1 ? `${data.count}건 저장` : data.itemName}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {data.categoryName} · {amountText}
          </p>
        </div>
        <button
          onClick={() => {
            onClose()
            navigate(data.editPath)
          }}
          className="text-sm font-medium text-grape-600 hover:text-grape-700 whitespace-nowrap flex-shrink-0"
        >
          수정 →
        </button>
      </div>
    )
  }

  if (data.type === 'parse_error') {
    return (
      <div role="status" aria-live="polite" className="bg-[var(--surface-card)] rounded-xl shadow-lg border-l-4 border-warm-500 p-3">
        <p className="text-sm font-medium text-[var(--text-primary)]">⚠️ 거래 정보를 인식하지 못했어요</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">금액을 포함해서 다시 입력해주세요</p>
      </div>
    )
  }

  // server_error
  return (
    <div role="status" aria-live="polite" className="bg-[var(--surface-card)] rounded-xl shadow-lg border-l-4 border-rose-500 p-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text-primary)]">❌ 저장에 실패했어요</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{data.originalText}</p>
      </div>
      <button
        onClick={() => { onClose(); data.onRetry() }}
        className="text-sm font-medium text-grape-600 hover:text-grape-700 whitespace-nowrap flex-shrink-0"
      >
        다시 시도 →
      </button>
    </div>
  )
}
