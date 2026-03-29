/**
 * @file ParsedItemPreviewCard.tsx
 * @description LLM 파싱 결과 프리뷰 카드 (지출/수입 공용) (#181)
 *
 * ExpenseForm과 IncomeForm에서 동일한 레이아웃으로 사용되며
 * colorScheme prop으로 색상 테마를 분리한다.
 */

import type { Category, PaymentMethod } from '../types'

/** 프리뷰 카드에서 편집 가능한 공통 항목 구조 */
export interface PreviewItem {
  amount: number
  date: string
  description: string
  /** LLM이 제안한 카테고리 이름 (select 플레이스홀더 표시용) */
  category: string
  category_id: number | null
  memo: string | null
  /** 결제수단 ID */
  payment_method_id?: number | null
  /** LLM이 추출한 결제수단 이름 */
  payment_method?: string | null
}

type ColorScheme = 'grape' | 'leaf'

interface ParsedItemPreviewCardProps {
  item: PreviewItem
  index: number
  totalCount: number
  categories: Category[]
  /** 결제수단 목록 (지출 전용, 없으면 드롭다운 미표시) */
  paymentMethods?: PaymentMethod[]
  /** 색상 테마: 지출=grape, 수입=leaf */
  colorScheme: ColorScheme
  /** 항목 레이블 (예: "지출", "수입") */
  label: string
  onUpdate: (index: number, field: string, value: number | string | null) => void
  onRemove: (index: number) => void
  showNewCategoryFor: number | null
  newCategoryName: string
  creatingCategory: boolean
  onSetShowNewCategory: (index: number | null) => void
  onSetNewCategoryName: (name: string) => void
  onCreateCategory: (index: number) => void
}

const COLOR_MAP = {
  grape: {
    border: 'border-l-grape-400',
    input: 'focus:ring-grape-500/30 focus:border-grape-500',
    newCategoryInput: 'border-grape-300 focus:ring-grape-500/30 focus:border-grape-500',
    newCategoryBtn: 'text-white bg-grape-600 hover:bg-grape-700',
    addLink: 'text-grape-600 hover:text-grape-700',
  },
  leaf: {
    border: 'border-l-leaf-400',
    input: 'focus:ring-leaf-500/30 focus:border-leaf-500',
    newCategoryInput: 'border-leaf-300 focus:ring-leaf-500/30 focus:border-leaf-500',
    newCategoryBtn: 'text-white bg-leaf-600 hover:bg-leaf-700',
    addLink: 'text-leaf-600 hover:text-leaf-700',
  },
} as const

export default function ParsedItemPreviewCard({
  item,
  index,
  totalCount,
  categories,
  paymentMethods,
  colorScheme,
  label,
  onUpdate,
  onRemove,
  showNewCategoryFor,
  newCategoryName,
  creatingCategory,
  onSetShowNewCategory,
  onSetNewCategoryName,
  onCreateCategory,
}: ParsedItemPreviewCardProps) {
  const c = COLOR_MAP[colorScheme]

  return (
    <div
      className={`bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60 border-l-4 ${c.border} p-5 space-y-4`}
    >
      {/* 헤더: 항목 번호 + 삭제 버튼 */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--text-tertiary)]">
          {label} #{index + 1}
        </span>
        {totalCount > 1 && (
          <button
            onClick={() => onRemove(index)}
            className="text-sm text-rose-500 hover:text-rose-700 transition-colors"
          >
            삭제
          </button>
        )}
      </div>

      {/* 필드 그리드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 금액 */}
        <div>
          <label htmlFor={`preview-amount-${index}`} className="block text-xs text-[var(--text-tertiary)] mb-1">금액</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] text-sm">₩</span>
            <input
              id={`preview-amount-${index}`}
              type="number"
              inputMode="numeric"
              value={item.amount}
              onChange={(e) => onUpdate(index, 'amount', Number(e.target.value))}
              className={`w-full pl-7 pr-3 py-2 border border-[var(--input-border)] rounded-xl text-sm focus:ring-2 ${c.input}`}
              min="1"
            />
          </div>
        </div>

        {/* 날짜 */}
        <div>
          <label htmlFor={`preview-date-${index}`} className="block text-xs text-[var(--text-tertiary)] mb-1">날짜</label>
          <input
            id={`preview-date-${index}`}
            type="date"
            value={item.date.slice(0, 10)}
            onChange={(e) => onUpdate(index, 'date', e.target.value)}
            className={`w-full px-3 py-2 border border-[var(--input-border)] rounded-xl text-sm focus:ring-2 ${c.input}`}
          />
        </div>

        {/* 설명 */}
        <div>
          <label htmlFor={`preview-desc-${index}`} className="block text-xs text-[var(--text-tertiary)] mb-1">설명</label>
          <input
            id={`preview-desc-${index}`}
            type="text"
            value={item.description}
            onChange={(e) => onUpdate(index, 'description', e.target.value)}
            className={`w-full px-3 py-2 border border-[var(--input-border)] rounded-xl text-sm focus:ring-2 ${c.input}`}
          />
        </div>

        {/* 카테고리 */}
        <div>
          <label htmlFor={`preview-category-${index}`} className="block text-xs text-[var(--text-tertiary)] mb-1">카테고리</label>
          <select
            id={`preview-category-${index}`}
            value={item.category_id ?? ''}
            onChange={(e) =>
              onUpdate(index, 'category_id', e.target.value ? Number(e.target.value) : null)
            }
            className={`w-full px-3 py-2 border border-[var(--input-border)] rounded-xl text-sm focus:ring-2 ${c.input}`}
          >
            <option value="">분류 안 됨 ({item.category})</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          {showNewCategoryFor === index ? (
            <div className="flex gap-1.5 mt-1.5">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => onSetNewCategoryName(e.target.value)}
                placeholder="새 카테고리 이름"
                className={`flex-1 px-2 py-1.5 border rounded-lg text-sm focus:ring-2 ${c.newCategoryInput}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    onCreateCategory(index)
                  }
                }}
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              />
              <button
                type="button"
                onClick={() => onCreateCategory(index)}
                disabled={creatingCategory || !newCategoryName.trim()}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg disabled:opacity-50 ${c.newCategoryBtn}`}
              >
                {creatingCategory ? '...' : '추가'}
              </button>
              <button
                type="button"
                onClick={() => {
                  onSetShowNewCategory(null)
                  onSetNewCategoryName('')
                }}
                className="px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] bg-[var(--surface-hover)] rounded-lg hover:bg-[var(--surface-hover)]"
              >
                취소
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                onSetShowNewCategory(index)
                onSetNewCategoryName('')
              }}
              className={`mt-1.5 text-xs font-medium ${c.addLink}`}
            >
              + 새 카테고리
            </button>
          )}
        </div>

        {/* 결제수단 (paymentMethods가 있을 때만 표시) */}
        {paymentMethods && paymentMethods.length > 0 && (
          <div>
            <label htmlFor={`preview-payment-method-${index}`} className="block text-xs text-[var(--text-tertiary)] mb-1">결제수단</label>
            <select
              id={`preview-payment-method-${index}`}
              value={item.payment_method_id ?? ''}
              onChange={(e) =>
                onUpdate(index, 'payment_method_id', e.target.value ? Number(e.target.value) : null)
              }
              className={`w-full px-3 py-2 border border-[var(--input-border)] rounded-xl text-sm focus:ring-2 ${c.input}`}
            >
              <option value="">선택 안 함{item.payment_method ? ` (${item.payment_method})` : ''}</option>
              {paymentMethods.map((pm) => (
                <option key={pm.id} value={pm.id}>
                  {pm.name}{pm.is_default ? ' (기본)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 메모 (선택) */}
        <div className="sm:col-span-2">
          <label htmlFor={`preview-memo-${index}`} className="block text-xs text-[var(--text-tertiary)] mb-1">메모 (선택)</label>
          <input
            id={`preview-memo-${index}`}
            type="text"
            value={item.memo ?? ''}
            onChange={(e) => onUpdate(index, 'memo', e.target.value)}
            placeholder="추가 메모 입력"
            className={`w-full px-3 py-2 border border-[var(--input-border)] rounded-xl text-sm focus:ring-2 ${c.input}`}
          />
        </div>
      </div>
    </div>
  )
}
