/**
 * @file ExpenseForm.tsx
 * @description 지출 입력 폼 페이지
 * 두 가지 입력 모드를 제공한다:
 * 1. 자연어 입력 모드: 텍스트로 입력 → LLM 파싱 프리뷰 → 수정 → 확인 저장
 * 2. 폼 입력 모드: 금액, 설명, 카테고리 등을 직접 입력
 */

import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { expenseApi } from '../api/expenses'
import { categoryApi } from '../api/categories'
import { chatApi } from '../api/chat'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import type { Category, ParsedExpenseItem } from '../types'

type InputMode = 'natural' | 'form'

/** 프리뷰 카드에서 편집 가능한 항목 */
interface EditableExpense extends ParsedExpenseItem {
  category_id: number | null
}

export default function ExpenseForm() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)

  // 입력 모드 상태
  const [mode, setMode] = useState<InputMode>('natural')
  const [loading, setLoading] = useState(false)

  // 자연어 입력 상태
  const [naturalInput, setNaturalInput] = useState('')
  const [previewItems, setPreviewItems] = useState<EditableExpense[] | null>(null)
  const [rawInput, setRawInput] = useState('')

  // 폼 입력 상태
  const [categories, setCategories] = useState<Category[]>([])
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    category_id: '',
    date: new Date().toISOString().slice(0, 10),
    memo: '',
  })

  useEffect(() => {
    categoryApi
      .getAll()
      .then((res) => setCategories(res.data))
      .catch(() => {
        addToast('warning', '카테고리 목록을 불러오지 못했습니다')
      })
  }, [])

  /** 카테고리 이름으로 ID 찾기 */
  function findCategoryId(name: string): number | null {
    const cat = categories.find((c) => c.name === name)
    return cat ? cat.id : null
  }

  /**
   * Step 1: 자연어 입력 → LLM 프리뷰 요청
   */
  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!naturalInput.trim()) {
      addToast('error', '메시지를 입력해주세요')
      return
    }

    setLoading(true)
    try {
      const res = await chatApi.sendMessage(naturalInput.trim(), activeHouseholdId ?? undefined, true)

      if (res.data.parsed_expenses && res.data.parsed_expenses.length > 0) {
        // 파싱 결과를 편집 가능한 형태로 변환
        const editables: EditableExpense[] = res.data.parsed_expenses.map((item) => ({
          ...item,
          category_id: findCategoryId(item.category),
        }))
        setPreviewItems(editables)
        setRawInput(naturalInput.trim())
      } else {
        addToast('info', res.data.message || '지출 정보를 인식하지 못했습니다')
      }
    } catch (error: unknown) {
      const errorMsg = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail || '파싱에 실패했습니다'
      addToast('error', errorMsg)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Step 2: 프리뷰 수정 후 확인 → 개별 expense create API로 저장
   */
  const handleConfirmSave = async () => {
    if (!previewItems || previewItems.length === 0) return

    setLoading(true)
    try {
      let savedCount = 0
      for (const item of previewItems) {
        await expenseApi.create({
          amount: item.amount,
          description: item.description,
          category_id: item.category_id,
          date: item.date,
          household_id: activeHouseholdId,
          raw_input: rawInput,
        })
        savedCount++
      }
      addToast('success', `🍇 포도알 +${savedCount}! 지출이 저장되었습니다`)
      setPreviewItems(null)
      setNaturalInput('')
      setTimeout(() => navigate('/expenses'), 500)
    } catch (error: unknown) {
      const errorMsg = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail || '저장에 실패했습니다'
      addToast('error', errorMsg)
    } finally {
      setLoading(false)
    }
  }

  /** 프리뷰 항목 수정 */
  const updatePreviewItem = (index: number, field: keyof EditableExpense, value: string | number | null) => {
    if (!previewItems) return
    const updated = [...previewItems]
    updated[index] = { ...updated[index], [field]: value }
    // 카테고리 select 변경 시 category 이름도 동기화
    if (field === 'category_id') {
      const cat = categories.find((c) => c.id === value)
      updated[index].category = cat?.name ?? '기타'
    }
    setPreviewItems(updated)
  }

  /** 프리뷰 항목 삭제 */
  const removePreviewItem = (index: number) => {
    if (!previewItems) return
    const updated = previewItems.filter((_, i) => i !== index)
    if (updated.length === 0) {
      setPreviewItems(null)
    } else {
      setPreviewItems(updated)
    }
  }

  /**
   * 폼 입력 제출
   */
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.description.trim()) {
      addToast('error', '설명을 입력해주세요')
      return
    }

    const amount = Number(formData.amount)
    if (!amount || amount <= 0) {
      addToast('error', '금액은 0보다 큰 숫자여야 합니다')
      return
    }

    if (!formData.date) {
      addToast('error', '날짜를 선택해주세요')
      return
    }

    setLoading(true)
    try {
      await expenseApi.create({
        amount,
        description: formData.description.trim(),
        category_id: formData.category_id ? Number(formData.category_id) : null,
        // date input은 YYYY-MM-DD 형식이므로 datetime으로 변환
        date: formData.date.includes('T') ? formData.date : `${formData.date}T00:00:00`,
        household_id: activeHouseholdId,
      })
      addToast('success', '🍇 포도알 +1! 지출이 저장되었습니다')
      setTimeout(() => navigate('/expenses'), 500)
    } catch (error: unknown) {
      const errorMsg = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail || '지출 저장에 실패했습니다'
      addToast('error', errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link
          to="/expenses"
          className="p-2 rounded-lg hover:bg-warm-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-warm-600" />
        </Link>
        <h1 className="text-xl font-semibold text-warm-800">지출 입력</h1>
      </div>

      {/* 모드 전환 탭 */}
      <div className="bg-white rounded-xl shadow-sm border border-warm-200/60 p-2 flex gap-2">
        <button
          onClick={() => { setMode('natural'); setPreviewItems(null) }}
          className={`
            flex-1 px-4 py-3 text-sm font-medium rounded-lg transition-all
            ${mode === 'natural'
              ? 'bg-grape-600 text-white shadow-sm shadow-grape-200'
              : 'text-warm-600 hover:bg-warm-50'
            }
          `}
        >
          자연어 입력
        </button>
        <button
          onClick={() => { setMode('form'); setPreviewItems(null) }}
          className={`
            flex-1 px-4 py-3 text-sm font-medium rounded-lg transition-all
            ${mode === 'form'
              ? 'bg-grape-600 text-white shadow-sm shadow-grape-200'
              : 'text-warm-600 hover:bg-warm-50'
            }
          `}
        >
          직접 입력
        </button>
      </div>

      {/* 자연어 입력 모드 */}
      {mode === 'natural' && !previewItems && (
        <form onSubmit={handlePreview} className="bg-white rounded-2xl shadow-sm border border-warm-200/60 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-2">
              자연어로 지출 입력하기
            </label>
            <textarea
              value={naturalInput}
              onChange={(e) => setNaturalInput(e.target.value)}
              placeholder="예: 오늘 점심에 김치찌개 8000원 먹었어&#10;어제 스타벅스에서 아메리카노 4500원"
              rows={5}
              className="w-full px-4 py-3 bg-grape-50/50 border border-warm-300 rounded-xl focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500 resize-none"
              disabled={loading}
            />
            <p className="mt-2 text-xs text-warm-400">
              날짜, 내용, 금액을 자연스럽게 입력하면 AI가 자동으로 분석합니다. 결과를 확인한 뒤 저장됩니다.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !naturalInput.trim()}
            className="w-full px-4 py-3 text-sm font-medium text-white bg-grape-600 rounded-xl hover:bg-grape-700 shadow-sm shadow-grape-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? '분석 중...' : '분석하기'}
          </button>
        </form>
      )}

      {/* 파싱 결과 프리뷰 카드 */}
      {mode === 'natural' && previewItems && (
        <div className="space-y-4">
          <div className="bg-grape-50 border border-grape-200 rounded-2xl p-4">
            <p className="text-sm text-grape-800 font-medium">
              {previewItems.length}건의 지출을 인식했습니다. 내용을 확인하고 수정한 뒤 저장하세요.
            </p>
          </div>

          {previewItems.map((item, index) => (
            <div key={index} className="bg-white rounded-2xl shadow-sm border border-warm-200/60 border-l-4 border-l-grape-400 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-warm-500">지출 #{index + 1}</span>
                {previewItems.length > 1 && (
                  <button
                    onClick={() => removePreviewItem(index)}
                    className="text-sm text-rose-500 hover:text-rose-700 transition-colors"
                  >
                    삭제
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 금액 */}
                <div>
                  <label className="block text-xs text-warm-500 mb-1">금액</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-500 text-sm">₩</span>
                    <input
                      type="number"
                      value={item.amount}
                      onChange={(e) => updatePreviewItem(index, 'amount', Number(e.target.value))}
                      className="w-full pl-7 pr-3 py-2 border border-warm-300 rounded-xl text-sm focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                      min="1"
                    />
                  </div>
                </div>

                {/* 날짜 */}
                <div>
                  <label className="block text-xs text-warm-500 mb-1">날짜</label>
                  <input
                    type="date"
                    value={item.date.slice(0, 10)}
                    onChange={(e) => updatePreviewItem(index, 'date', e.target.value)}
                    className="w-full px-3 py-2 border border-warm-300 rounded-xl text-sm focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                  />
                </div>

                {/* 설명 */}
                <div>
                  <label className="block text-xs text-warm-500 mb-1">설명</label>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updatePreviewItem(index, 'description', e.target.value)}
                    className="w-full px-3 py-2 border border-warm-300 rounded-xl text-sm focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                  />
                </div>

                {/* 카테고리 */}
                <div>
                  <label className="block text-xs text-warm-500 mb-1">카테고리</label>
                  <select
                    value={item.category_id ?? ''}
                    onChange={(e) => updatePreviewItem(index, 'category_id', e.target.value ? Number(e.target.value) : null)}
                    className="w-full px-3 py-2 border border-warm-300 rounded-xl text-sm focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                  >
                    <option value="">미분류 ({item.category})</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}

          {/* 확인/취소 버튼 */}
          <div className="flex gap-3">
            <button
              onClick={() => { setPreviewItems(null) }}
              className="flex-1 px-4 py-3 text-sm font-medium text-warm-700 bg-warm-100 rounded-xl hover:bg-warm-200 transition-colors"
              disabled={loading}
            >
              다시 입력
            </button>
            <button
              onClick={handleConfirmSave}
              disabled={loading}
              className="flex-1 px-4 py-3 text-sm font-medium text-white bg-grape-600 rounded-xl hover:bg-grape-700 shadow-sm shadow-grape-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? '저장 중...' : `${previewItems.length}건 저장하기`}
            </button>
          </div>
        </div>
      )}

      {/* 폼 입력 모드 */}
      {mode === 'form' && (
        <form onSubmit={handleFormSubmit} className="bg-white rounded-2xl shadow-sm border border-warm-200/60 p-6 space-y-5">
          {/* 금액 (필수) */}
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-2">
              금액 <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-500">₩</span>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="10000"
                className="w-full pl-8 pr-4 py-3 border border-warm-300 rounded-xl focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                disabled={loading}
                min="1"
                step="100"
              />
            </div>
          </div>

          {/* 설명 (필수) */}
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-2">
              설명 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="김치찌개"
              className="w-full px-4 py-3 border border-warm-300 rounded-xl focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
              disabled={loading}
            />
          </div>

          {/* 카테고리 (선택) */}
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-2">
              카테고리
            </label>
            <select
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              className="w-full px-4 py-3 border border-warm-300 rounded-xl focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
              disabled={loading}
            >
              <option value="">미분류</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* 날짜 (기본 오늘) */}
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-2">
              날짜 <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-3 border border-warm-300 rounded-xl focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
              disabled={loading}
            />
          </div>

          {/* 제출 버튼 */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/expenses')}
              className="flex-1 px-4 py-3 text-sm font-medium text-warm-700 bg-warm-100 rounded-xl hover:bg-warm-200 transition-colors"
              disabled={loading}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 text-sm font-medium text-white bg-grape-600 rounded-xl hover:bg-grape-700 shadow-sm shadow-grape-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? '저장 중...' : '저장하기'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
