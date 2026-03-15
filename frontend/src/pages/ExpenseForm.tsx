/**
 * @file ExpenseForm.tsx
 * @description 지출 입력 폼 페이지
 * 두 가지 입력 모드를 제공한다:
 * 1. 자연어 입력 모드: 텍스트로 입력 → LLM 파싱 프리뷰 → 수정 → 확인 저장
 * 2. 폼 입력 모드: 금액, 설명, 카테고리 등을 직접 입력
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Camera } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { expenseApi } from '../api/expenses'
import { categoryApi } from '../api/categories'
import { chatApi } from '../api/chat'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import type { Category, ParsedExpenseItem } from '../types'

type InputMode = 'natural' | 'form' | 'ocr'

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

  // OCR 상태
  const [ocrPreview, setOcrPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 폼 입력 상태
  const [categories, setCategories] = useState<Category[]>([])
  // 프리뷰 카드 인라인 카테고리 추가 상태
  const [showNewCategoryFor, setShowNewCategoryFor] = useState<number | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    category_id: '',
    date: new Date().toISOString().slice(0, 10),
    memo: '',
    exclude_from_stats: false,
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
      const res = await chatApi.sendMessage(naturalInput.trim(), activeHouseholdId!, true)

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
          // date input은 YYYY-MM-DD 형식이므로 datetime으로 변환 (Pydantic v2는 날짜 전용 문자열 거부)
          date: item.date.includes('T') ? item.date : `${item.date}T00:00:00`,
          household_id: activeHouseholdId,
          raw_input: rawInput,
          memo: item.memo || undefined,
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

  /** 폼 입력 모드에서 새 카테고리 즉시 생성 후 적용 */
  const handleCreateCategoryForForm = async () => {
    const name = newCategoryName.trim()
    if (!name) return
    setCreatingCategory(true)
    try {
      const res = await categoryApi.create({ name })
      const newCat = res.data
      setCategories((prev) => [...prev, newCat])
      setFormData((prev) => ({ ...prev, category_id: String(newCat.id) }))
      setShowNewCategoryFor(null)
      setNewCategoryName('')
      addToast('success', `"${name}" 카테고리가 추가되었습니다`)
    } catch (error: unknown) {
      const errorMsg = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail || '카테고리 생성에 실패했습니다'
      addToast('error', errorMsg)
    } finally {
      setCreatingCategory(false)
    }
  }

  /** 프리뷰 카드에서 새 카테고리 즉시 생성 후 적용 */
  const handleCreateCategory = async (index: number) => {
    const name = newCategoryName.trim()
    if (!name) return
    setCreatingCategory(true)
    try {
      const res = await categoryApi.create({ name })
      const newCat = res.data
      setCategories((prev) => [...prev, newCat])
      updatePreviewItem(index, 'category_id', newCat.id)
      setShowNewCategoryFor(null)
      setNewCategoryName('')
      addToast('success', `"${name}" 카테고리가 추가되었습니다`)
    } catch (error: unknown) {
      const errorMsg = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail || '카테고리 생성에 실패했습니다'
      addToast('error', errorMsg)
    } finally {
      setCreatingCategory(false)
    }
  }

  /**
   * OCR: 파일 선택 시 자동 업로드 및 파싱
   */
  const handleOcrFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 로컬 미리보기 생성
    const url = URL.createObjectURL(file)
    setOcrPreview(url)

    setLoading(true)
    try {
      const res = await expenseApi.parseImage(file, activeHouseholdId)
      if (res.data.parsed_expenses && res.data.parsed_expenses.length > 0) {
        const editables: EditableExpense[] = res.data.parsed_expenses.map((item) => ({
          ...item,
          category_id: findCategoryId(item.category),
        }))
        setPreviewItems(editables)
        setRawInput(`[OCR] ${file.name}`)
      } else {
        addToast('info', res.data.message || '결제 정보를 인식하지 못했습니다')
        setOcrPreview(null)
      }
    } catch (error: unknown) {
      const errorMsg = (error as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'OCR 처리에 실패했습니다'
      addToast('error', errorMsg)
      setOcrPreview(null)
    } finally {
      setLoading(false)
      // 같은 파일 재선택 허용
      if (fileInputRef.current) fileInputRef.current.value = ''
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
        memo: formData.memo.trim() || undefined,
        exclude_from_stats: formData.exclude_from_stats,
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
      <Link
        to="/expenses"
        aria-label="뒤로가기"
        className="p-2 -ml-2 rounded-lg hover:bg-warm-100 transition-colors inline-block"
      >
        <ArrowLeft className="w-5 h-5 text-warm-600" />
      </Link>

      {/* 모드 전환 탭 */}
      <div className="bg-white rounded-xl shadow-sm border border-warm-200/60 p-2 flex gap-2">
        <button
          onClick={() => { setMode('natural'); setPreviewItems(null) }}
          className={`
            flex-1 px-3 py-2.5 text-sm font-medium rounded-lg transition-all
            ${mode === 'natural'
              ? 'bg-grape-600 text-white shadow-sm shadow-grape-200'
              : 'text-warm-600 hover:bg-warm-50'
            }
          `}
        >
          간편 입력
        </button>
        <button
          onClick={() => { setMode('form'); setPreviewItems(null) }}
          className={`
            flex-1 px-3 py-2.5 text-sm font-medium rounded-lg transition-all
            ${mode === 'form'
              ? 'bg-grape-600 text-white shadow-sm shadow-grape-200'
              : 'text-warm-600 hover:bg-warm-50'
            }
          `}
        >
          직접 입력
        </button>
        <button
          onClick={() => { setMode('ocr'); setPreviewItems(null); setOcrPreview(null) }}
          className={`
            flex-1 px-3 py-2.5 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-1.5
            ${mode === 'ocr'
              ? 'bg-grape-600 text-white shadow-sm shadow-grape-200'
              : 'text-warm-600 hover:bg-warm-50'
            }
          `}
        >
          <Camera className="w-4 h-4" />
          이미지
        </button>
      </div>

      {/* 자연어 입력 모드 */}
      {mode === 'natural' && !previewItems && (
        <form onSubmit={handlePreview} className="bg-white rounded-2xl shadow-sm border border-warm-200/60 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-2">
              말하듯이 지출 입력하기
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
              날짜, 내용, 금액을 편하게 입력하면 AI가 자동으로 분석합니다. 결과를 확인한 뒤 저장됩니다.
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

      {/* OCR 입력 모드 */}
      {mode === 'ocr' && !previewItems && (
        <div className="bg-white rounded-2xl shadow-sm border border-warm-200/60 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-2">
              결제 화면 이미지 인식
            </label>
            <p className="text-xs text-warm-400 mb-4">
              토스, 카카오페이, 카드사 앱 결제 화면이나 영수증 사진을 업로드하면 AI가 자동으로 금액과 가맹점을 인식합니다.
            </p>

            {/* 이미지 미리보기 */}
            {ocrPreview && (
              <div className="mb-4 rounded-xl overflow-hidden border border-warm-200">
                <img src={ocrPreview} alt="업로드된 이미지" className="w-full max-h-64 object-contain bg-warm-50" />
              </div>
            )}

            {/* 업로드 버튼 영역 */}
            <div
              className="border-2 border-dashed border-warm-300 rounded-xl p-8 text-center cursor-pointer hover:border-grape-400 hover:bg-grape-50/30 transition-all"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="w-10 h-10 text-warm-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-warm-600">
                {loading ? '인식 중...' : '이미지 선택 / 카메라 촬영'}
              </p>
              <p className="text-xs text-warm-400 mt-1">
                JPG, PNG, WEBP · 최대 10MB
              </p>
            </div>

            {/* 숨겨진 파일 input (모바일: 카메라 또는 갤러리) */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={handleOcrFileSelect}
              disabled={loading}
            />
          </div>

          {/* 갤러리에서 선택 버튼 (capture 없이 별도 제공) */}
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.removeAttribute('capture')
                fileInputRef.current.click()
                // 클릭 후 capture 복원
                requestAnimationFrame(() => {
                  if (fileInputRef.current) fileInputRef.current.setAttribute('capture', 'environment')
                })
              }
            }}
            className="w-full px-4 py-3 text-sm font-medium text-grape-700 border border-grape-300 bg-grape-50 rounded-xl hover:bg-grape-100 transition-colors disabled:opacity-50"
          >
            갤러리에서 선택
          </button>
        </div>
      )}

      {/* 파싱 결과 프리뷰 카드 (OCR 모드) */}
      {mode === 'ocr' && previewItems && (
        <div className="space-y-4">
          {/* OCR 원본 이미지 */}
          {ocrPreview && (
            <div className="bg-white rounded-2xl border border-warm-200/60 overflow-hidden">
              <img src={ocrPreview} alt="인식된 이미지" className="w-full max-h-40 object-contain bg-warm-50" />
            </div>
          )}

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

                <div>
                  <label className="block text-xs text-warm-500 mb-1">날짜</label>
                  <input
                    type="date"
                    value={item.date.slice(0, 10)}
                    onChange={(e) => updatePreviewItem(index, 'date', e.target.value)}
                    className="w-full px-3 py-2 border border-warm-300 rounded-xl text-sm focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-warm-500 mb-1">설명</label>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updatePreviewItem(index, 'description', e.target.value)}
                    className="w-full px-3 py-2 border border-warm-300 rounded-xl text-sm focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                  />
                </div>

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
                  {showNewCategoryFor === index ? (
                    <div className="flex gap-1.5 mt-1.5">
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="새 카테고리 이름"
                        className="flex-1 px-2 py-1.5 border border-grape-300 rounded-lg text-sm focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateCategory(index) } }}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleCreateCategory(index)}
                        disabled={creatingCategory || !newCategoryName.trim()}
                        className="px-2.5 py-1.5 text-xs font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700 disabled:opacity-50"
                      >
                        {creatingCategory ? '...' : '추가'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowNewCategoryFor(null); setNewCategoryName('') }}
                        className="px-2.5 py-1.5 text-xs font-medium text-warm-600 bg-warm-100 rounded-lg hover:bg-warm-200"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setShowNewCategoryFor(index); setNewCategoryName('') }}
                      className="mt-1.5 text-xs text-grape-600 hover:text-grape-800 font-medium"
                    >
                      + 새 카테고리
                    </button>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs text-warm-500 mb-1">메모 (선택)</label>
                  <input
                    type="text"
                    value={item.memo ?? ''}
                    onChange={(e) => updatePreviewItem(index, 'memo', e.target.value)}
                    placeholder="추가 메모 입력"
                    className="w-full px-3 py-2 border border-warm-300 rounded-xl text-sm focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                  />
                </div>
              </div>
            </div>
          ))}

          <div className="flex gap-3">
            <button
              onClick={() => { setPreviewItems(null); setOcrPreview(null) }}
              className="flex-1 px-4 py-3 text-sm font-medium text-warm-700 bg-warm-100 rounded-xl hover:bg-warm-200 transition-colors"
              disabled={loading}
            >
              다시 선택
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
                  {showNewCategoryFor === index ? (
                    <div className="flex gap-1.5 mt-1.5">
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="새 카테고리 이름"
                        className="flex-1 px-2 py-1.5 border border-grape-300 rounded-lg text-sm focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateCategory(index) } }}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => handleCreateCategory(index)}
                        disabled={creatingCategory || !newCategoryName.trim()}
                        className="px-2.5 py-1.5 text-xs font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700 disabled:opacity-50"
                      >
                        {creatingCategory ? '...' : '추가'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowNewCategoryFor(null); setNewCategoryName('') }}
                        className="px-2.5 py-1.5 text-xs font-medium text-warm-600 bg-warm-100 rounded-lg hover:bg-warm-200"
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setShowNewCategoryFor(index); setNewCategoryName('') }}
                      className="mt-1.5 text-xs text-grape-600 hover:text-grape-800 font-medium"
                    >
                      + 새 카테고리
                    </button>
                  )}
                </div>

                {/* 메모 (선택) */}
                <div className="sm:col-span-2">
                  <label className="block text-xs text-warm-500 mb-1">메모 (선택)</label>
                  <input
                    type="text"
                    value={item.memo ?? ''}
                    onChange={(e) => updatePreviewItem(index, 'memo', e.target.value)}
                    placeholder="추가 메모 입력"
                    className="w-full px-3 py-2 border border-warm-300 rounded-xl text-sm focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                  />
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
            <label htmlFor="expense-amount" className="block text-sm font-medium text-warm-700 mb-2">
              금액 <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-500">₩</span>
              <input
                id="expense-amount"
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="10000"
                className="w-full pl-8 pr-4 py-3 border border-warm-300 rounded-xl focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                disabled={loading}
                min="1"
                step="any"
              />
            </div>
          </div>

          {/* 설명 (필수) */}
          <div>
            <label htmlFor="expense-description" className="block text-sm font-medium text-warm-700 mb-2">
              설명 <span className="text-rose-500">*</span>
            </label>
            <input
              id="expense-description"
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
            <label htmlFor="expense-category" className="block text-sm font-medium text-warm-700 mb-2">
              카테고리
            </label>
            <select
              id="expense-category"
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
            {showNewCategoryFor === -1 ? (
              <div className="flex gap-1.5 mt-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="새 카테고리 이름"
                  className="flex-1 px-3 py-2 border border-grape-300 rounded-lg text-sm focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateCategoryForForm() } }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleCreateCategoryForForm}
                  disabled={creatingCategory || !newCategoryName.trim()}
                  className="px-3 py-2 text-sm font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700 disabled:opacity-50"
                >
                  {creatingCategory ? '...' : '추가'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNewCategoryFor(null); setNewCategoryName('') }}
                  className="px-3 py-2 text-sm font-medium text-warm-600 bg-warm-100 rounded-lg hover:bg-warm-200"
                >
                  취소
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setShowNewCategoryFor(-1); setNewCategoryName('') }}
                className="mt-2 text-sm text-grape-600 hover:text-grape-800 font-medium"
              >
                + 새 카테고리
              </button>
            )}
          </div>

          {/* 날짜 (기본 오늘) */}
          <div>
            <label htmlFor="expense-date" className="block text-sm font-medium text-warm-700 mb-2">
              날짜 <span className="text-rose-500">*</span>
            </label>
            <input
              id="expense-date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-3 border border-warm-300 rounded-xl focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
              disabled={loading}
            />
          </div>

          {/* 메모 (선택) */}
          <div>
            <label htmlFor="expense-memo" className="block text-sm font-medium text-warm-700 mb-2">
              메모
            </label>
            <input
              id="expense-memo"
              type="text"
              value={formData.memo}
              onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
              placeholder="추가 메모 (선택)"
              className="w-full px-4 py-3 border border-warm-300 rounded-xl focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
              disabled={loading}
            />
          </div>

          {/* 통계 제외 */}
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div className="relative">
              <input
                type="checkbox"
                checked={formData.exclude_from_stats}
                onChange={(e) => setFormData({ ...formData, exclude_from_stats: e.target.checked })}
                className="sr-only"
                disabled={loading}
              />
              <div className={`w-10 h-6 rounded-full transition-colors ${formData.exclude_from_stats ? 'bg-warm-400' : 'bg-warm-200'}`} />
              <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${formData.exclude_from_stats ? 'translate-x-4' : ''}`} />
            </div>
            <div>
              <span className="text-sm font-medium text-warm-700">통계에서 제외</span>
              <p className="text-xs text-warm-400">저축, 퇴직금 등 비정형 거래를 차트/통계에서 제외합니다</p>
            </div>
          </label>

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
