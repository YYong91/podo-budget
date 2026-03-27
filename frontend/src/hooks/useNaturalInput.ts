/**
 * @file useNaturalInput.ts
 * @description 자연어 입력 → LLM 프리뷰 → 수정 → 저장 공통 로직 훅
 * ExpenseForm과 IncomeForm에서 95% 동일했던 자연어 입력 로직을 추출.
 * type에 따라 API 엔드포인트, 카테고리 필터, 저장 로직이 달라진다.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from './useToast'
import { TOAST } from '../constants/toastMessages'
import { expenseApi } from '../api/expenses'
import { incomeApi } from '../api/income'
import { categoryApi } from '../api/categories'
import { chatApi } from '../api/chat'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import type { Category, ParsedExpenseItem } from '../types'
import { trackEvent } from '../utils/analytics'
import { FILTER_STORAGE_KEY } from './useMonthlyTransactions'

type TransactionType = 'expense' | 'income'

/** 프리뷰 카드에서 편집 가능한 항목 */
export interface EditableItem extends ParsedExpenseItem {
  category_id: number | null
}

/** type별로 다른 설정을 분리 */
const CONFIG = {
  expense: {
    categoryFilter: { type: 'expense' as const },
    listRoute: '/expenses',
    eventPrefix: 'expense',
    successMessage: TOAST.SAVED,
    noParseMessage: '지출 정보를 인식하지 못했습니다',
  },
  income: {
    categoryFilter: undefined, // 전체 불러온 뒤 income/both 필터
    listRoute: '/income',
    eventPrefix: 'income',
    successMessage: TOAST.SAVED,
    noParseMessage: '수입 정보를 인식하지 못했습니다',
  },
} as const

export function useNaturalInput(type: TransactionType) {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)
  const config = CONFIG[type]

  // 자연어 입력 상태
  const [naturalInput, setNaturalInput] = useState('')
  const [previewItems, setPreviewItems] = useState<EditableItem[] | null>(null)
  const [rawInput, setRawInput] = useState('')
  const [loading, setLoading] = useState(false)

  // 카테고리 상태
  const [categories, setCategories] = useState<Category[]>([])
  const [showNewCategoryFor, setShowNewCategoryFor] = useState<number | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [creatingCategory, setCreatingCategory] = useState(false)

  // income 전용: 지출로 분류된 항목 수
  const [expenseCount, setExpenseCount] = useState(0)

  useEffect(() => {
    categoryApi
      .getAll(config.categoryFilter)
      .then((res) => setCategories(res.data))
      .catch(() => {
        addToast('warning', TOAST.LOAD_FAILED)
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /** 카테고리 이름으로 ID 찾기 (income일 때 income/both 카테고리만 매칭) */
  const filteredCategories = type === 'income'
    ? categories.filter((c) => c.type === 'income' || c.type === 'both')
    : categories

  function findCategoryId(name: string): number | null {
    const cat = filteredCategories.find((c) => c.name === name)
    return cat ? cat.id : null
  }

  /**
   * Step 1: 자연어 입력 → LLM 프리뷰 요청
   */
  const handlePreview = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()

    if (!naturalInput.trim()) {
      addToast('error', '메시지를 입력해주세요')
      return
    }

    setLoading(true)
    try {
      const res = await chatApi.sendMessage(naturalInput.trim(), activeHouseholdId!, true)

      if (type === 'income') {
        // income: parsed_expenses와 parsed_items 모두 확인, income 항목만 필터
        const allItems = res.data.parsed_expenses ?? res.data.parsed_items ?? []
        const incomeItems = allItems.filter((item) => item.type === 'income')
        const expenseItems = allItems.filter((item) => item.type !== 'income')

        if (incomeItems.length > 0) {
          const editables: EditableItem[] = incomeItems.map((item) => ({
            ...item,
            category_id: findCategoryId(item.category),
          }))
          setPreviewItems(editables)
          setRawInput(naturalInput.trim())
          setExpenseCount(expenseItems.length)
        } else if (expenseItems.length > 0) {
          addToast('info', '지출로 분류되었습니다. 지출 입력을 이용해주세요')
        } else {
          addToast('info', res.data.message || config.noParseMessage)
        }
      } else {
        // expense: 기존 로직 유지
        if (res.data.parsed_expenses && res.data.parsed_expenses.length > 0) {
          const editables: EditableItem[] = res.data.parsed_expenses.map((item) => ({
            ...item,
            category_id: findCategoryId(item.category),
          }))
          setPreviewItems(editables)
          setRawInput(naturalInput.trim())
          trackEvent('expense_preview', { mode: 'natural', item_count: editables.length })
        } else {
          addToast('info', res.data.message || config.noParseMessage)
        }
      }
    } catch {
      addToast('error', TOAST.PARSE_FAILED)
    } finally {
      setLoading(false)
    }
  }, [naturalInput, activeHouseholdId, type, categories]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Step 2: 프리뷰 수정 후 확인 → 개별 create API로 저장
   */
  const handleConfirmSave = useCallback(async () => {
    if (!previewItems || previewItems.length === 0) return

    setLoading(true)
    try {
      let savedCount = 0
      for (const item of previewItems) {
        const dateValue = item.date.includes('T') ? item.date : `${item.date}T00:00:00`
        const payload = {
          amount: item.amount,
          description: item.description,
          category_id: item.category_id,
          date: dateValue,
          household_id: activeHouseholdId,
          raw_input: rawInput,
          memo: item.memo || undefined,
        }

        if (type === 'expense') {
          // expense 모드: item.type에 따라 income/expense 분기 (OCR에서 혼합 가능)
          if (item.type === 'income') {
            await incomeApi.create(payload)
          } else {
            await expenseApi.create(payload)
          }
        } else {
          // income 모드: 항상 incomeApi 사용
          await incomeApi.create(payload)
        }
        savedCount++
      }
      trackEvent(`${config.eventPrefix}_saved`, { mode: 'natural', item_count: savedCount })
      addToast('success', config.successMessage)
      setPreviewItems(null)
      setNaturalInput('')
      sessionStorage.removeItem(FILTER_STORAGE_KEY)
      setTimeout(() => navigate(config.listRoute), 500)
    } catch {
      addToast('error', TOAST.SAVE_FAILED)
    } finally {
      setLoading(false)
    }
  }, [previewItems, activeHouseholdId, rawInput, type, navigate]) // eslint-disable-line react-hooks/exhaustive-deps

  /** 프리뷰 항목 수정 */
  const updatePreviewItem = useCallback((index: number, field: string, value: string | number | null) => {
    setPreviewItems((prev) => {
      if (!prev) return prev
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      if (field === 'category_id') {
        const cat = filteredCategories.find((c) => c.id === value)
        updated[index].category = cat?.name ?? '기타'
      }
      return updated
    })
  }, [filteredCategories])

  /** 프리뷰 항목 삭제 */
  const removePreviewItem = useCallback((index: number) => {
    setPreviewItems((prev) => {
      if (!prev) return prev
      const updated = prev.filter((_, i) => i !== index)
      return updated.length === 0 ? null : updated
    })
  }, [])

  /** 프리뷰 카드에서 새 카테고리 즉시 생성 후 적용 */
  const handleCreateCategory = useCallback(async (index: number) => {
    const name = newCategoryName.trim()
    if (!name) return
    setCreatingCategory(true)
    try {
      const res = await categoryApi.create({ name })
      const newCat = res.data
      setCategories((prev) => [...prev, newCat])
      // updatePreviewItem 대신 직접 업데이트 (콜백 내부에서 최신 상태 사용)
      setPreviewItems((prev) => {
        if (!prev) return prev
        const updated = [...prev]
        updated[index] = { ...updated[index], category_id: newCat.id }
        return updated
      })
      setShowNewCategoryFor(null)
      setNewCategoryName('')
      addToast('success', TOAST.CATEGORY_ADDED)
    } catch {
      addToast('error', TOAST.SAVE_FAILED)
    } finally {
      setCreatingCategory(false)
    }
  }, [newCategoryName, addToast])

  /** OCR 파싱 결과를 프리뷰에 설정 (ExpenseForm의 OCR 모드에서 사용) */
  const setOcrPreviewItems = useCallback((items: ParsedExpenseItem[], fileName: string) => {
    const editables: EditableItem[] = items.map((item) => ({
      ...item,
      category_id: findCategoryId(item.category),
    }))
    setPreviewItems(editables)
    setRawInput(`[OCR] ${fileName}`)
    trackEvent('ocr_upload', { item_count: editables.length })
  }, [categories]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // 자연어 입력 상태
    naturalInput,
    setNaturalInput,
    previewItems,
    setPreviewItems,
    rawInput,
    loading,

    // 핸들러
    handlePreview,
    handleConfirmSave,
    updatePreviewItem,
    removePreviewItem,

    // 카테고리 관련
    categories: filteredCategories,
    allCategories: categories,
    showNewCategoryFor,
    setShowNewCategoryFor,
    newCategoryName,
    setNewCategoryName,
    handleCreateCategory,
    creatingCategory,

    // income 전용
    expenseCount,

    // OCR 지원 (expense 전용)
    setOcrPreviewItems,
  }
}
