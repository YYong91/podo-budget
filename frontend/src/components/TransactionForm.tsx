import { getLocalDateString } from '../utils/format'
/**
 * @file TransactionForm.tsx
 * @description 지출/수입 공통 입력 폼 컴포넌트
 * type prop에 따라 색상, OCR 모드, API, 라우팅이 달라진다.
 * ExpenseForm과 IncomeForm에서 wrapper로 사용한다.
 */

import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Camera } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { TOAST } from '../constants/toastMessages'
import { expenseApi } from '../api/expenses'
import { incomeApi } from '../api/income'
import { categoryApi } from '../api/categories'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import { paymentMethodApi } from '../api/paymentMethods'
import type { PaymentMethod } from '../types'
import { useNaturalInput } from '../hooks/useNaturalInput'
import ParsedItemPreviewCard from './ParsedItemPreviewCard'
import { trackEvent } from '../utils/analytics'
import { FILTER_STORAGE_KEY } from '../hooks/useMonthlyTransactions'

type TransactionType = 'expense' | 'income'
type InputMode = 'natural' | 'form' | 'ocr'

/** type별 설정 */
const TYPE_CONFIG = {
  expense: {
    color: 'grape',
    listRoute: '/',
    naturalLabel: '말하듯이 지출 입력하기',
    naturalPlaceholder: '예: 오늘 점심에 김치찌개 8000원 먹었어\n어제 스타벅스에서 아메리카노 4500원',
    naturalHint: '날짜, 내용, 금액을 편하게 입력하면 AI가 자동으로 분석합니다. 결과를 확인한 뒤 저장됩니다.',
    formPlaceholder: { amount: '10000', description: '김치찌개' },
    previewLabel: '지출',
    savedMessage: TOAST.SAVED,
    statsExcludeHint: '저축, 퇴직금 등 비정형 거래를 차트/통계에서 제외합니다',
    eventName: 'expense_saved',
    hasOcr: true,
  },
  income: {
    color: 'leaf',
    listRoute: '/',
    naturalLabel: '말하듯이 수입 입력하기',
    naturalPlaceholder: '예: 이번 달 월급 350만원 들어왔어\n부업으로 50만원 받았어',
    naturalHint: '수입 내용을 편하게 입력하면 AI가 자동으로 분석합니다. 결과를 확인한 뒤 저장됩니다.',
    formPlaceholder: { amount: '3500000', description: '월급' },
    previewLabel: '수입',
    savedMessage: TOAST.SAVED,
    statsExcludeHint: '퇴직금, 일시금 등 비정형 수입을 차트/통계에서 제외합니다',
    eventName: 'income_saved',
    hasOcr: false,
  },
} as const

interface TransactionFormProps {
  type: TransactionType
}

export default function TransactionForm({ type }: TransactionFormProps) {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)
  const cfg = TYPE_CONFIG[type]

  // 자연어 입력 훅
  const ni = useNaturalInput(type)

  // 입력 모드 상태
  const [mode, setMode] = useState<InputMode>('natural')

  // OCR 상태 (expense 전용)
  const [ocrPreview, setOcrPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 폼 입력 상태
  const [formLoading, setFormLoading] = useState(false)
  const [showNewCategoryForForm, setShowNewCategoryForForm] = useState(false)
  const [newCategoryNameForForm, setNewCategoryNameForForm] = useState('')
  const [creatingCategoryForForm, setCreatingCategoryForForm] = useState(false)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    category_id: '',
    payment_method_id: '',
    date: getLocalDateString(),
    memo: '',
    exclude_from_stats: false,
  })

  // 결제수단 목록 로드 (지출 모드 전용)
  useEffect(() => {
    if (type !== 'expense' || !activeHouseholdId) return
    paymentMethodApi.getAll(activeHouseholdId).then((res) => {
      setPaymentMethods(res.data.filter((m) => m.is_active))
    }).catch(() => {
      // 결제수단 로드 실패 시 무시 — 선택 필드이므로 동작에 지장 없음
    })
  }, [type, activeHouseholdId])

  const formCategories = ni.categories

  // API 선택
  const api = type === 'expense' ? expenseApi : incomeApi

  /** 폼 입력 모드에서 새 카테고리 즉시 생성 후 적용 */
  const handleCreateCategoryForForm = async () => {
    const name = newCategoryNameForForm.trim()
    if (!name) return
    setCreatingCategoryForForm(true)
    try {
      const res = await categoryApi.create({ name })
      const newCat = res.data
      setFormData((prev) => ({ ...prev, category_id: String(newCat.id) }))
      setShowNewCategoryForForm(false)
      setNewCategoryNameForForm('')
      addToast('success', TOAST.CATEGORY_ADDED)
    } catch {
      addToast('error', TOAST.SAVE_FAILED)
    } finally {
      setCreatingCategoryForForm(false)
    }
  }

  /**
   * OCR: 파일 선택 시 자동 업로드 및 파싱 (expense 전용)
   */
  const handleOcrFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const url = URL.createObjectURL(file)
    setOcrPreview(url)

    setFormLoading(true)
    try {
      const res = await expenseApi.parseImage(file, activeHouseholdId)
      if (res.data.parsed_expenses && res.data.parsed_expenses.length > 0) {
        ni.setOcrPreviewItems(res.data.parsed_expenses, file.name)
      } else {
        addToast('info', res.data.message || '결제 정보를 인식하지 못했습니다')
        setOcrPreview(null)
      }
    } catch {
      addToast('error', TOAST.PARSE_FAILED)
      setOcrPreview(null)
    } finally {
      setFormLoading(false)
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

    setFormLoading(true)
    try {
      await api.create({
        amount,
        description: formData.description.trim(),
        category_id: formData.category_id ? Number(formData.category_id) : null,
        ...(type === 'expense' && formData.payment_method_id
          ? { payment_method_id: Number(formData.payment_method_id) }
          : {}),
        date: formData.date.includes('T') ? formData.date : `${formData.date}T00:00:00`,
        household_id: activeHouseholdId,
        memo: formData.memo.trim() || undefined,
        exclude_from_stats: formData.exclude_from_stats,
      })
      trackEvent(cfg.eventName, { mode: 'form' })
      addToast('success', cfg.savedMessage)
      sessionStorage.removeItem(FILTER_STORAGE_KEY)
      setTimeout(() => navigate(cfg.listRoute), 500)
    } catch {
      addToast('error', TOAST.SAVE_FAILED)
    } finally {
      setFormLoading(false)
    }
  }

  const loading = ni.loading || formLoading

  // 색상 유틸리티 — cfg.color를 기반으로 Tailwind 클래스 생성
  const c = cfg.color

  // HTML id prefix
  const idPrefix = type

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        to={cfg.listRoute}
        aria-label="뒤로가기"
        className="p-2 -ml-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors inline-block"
      >
        <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
      </Link>

      {/* 모드 전환 탭 */}
      <div className="bg-[var(--surface-card)] rounded-xl shadow-sm border border-[var(--border-default)]/60 p-2 flex gap-2">
        <button
          onClick={() => { setMode('natural'); ni.setPreviewItems(null) }}
          className={`
            flex-1 px-3 py-2.5 text-sm font-medium rounded-lg transition-all
            ${mode === 'natural'
              ? `bg-${c}-600 text-white shadow-sm shadow-${c}-200`
              : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }
          `}
        >
          간편 입력
        </button>
        <button
          onClick={() => { setMode('form'); ni.setPreviewItems(null) }}
          className={`
            flex-1 px-3 py-2.5 text-sm font-medium rounded-lg transition-all
            ${mode === 'form'
              ? `bg-${c}-600 text-white shadow-sm shadow-${c}-200`
              : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }
          `}
        >
          직접 입력
        </button>
        {cfg.hasOcr && (
          <button
            onClick={() => { setMode('ocr'); ni.setPreviewItems(null); setOcrPreview(null) }}
            className={`
              flex-1 px-3 py-2.5 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-1.5
              ${mode === 'ocr'
                ? `bg-${c}-600 text-white shadow-sm shadow-${c}-200`
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
              }
            `}
          >
            <Camera className="w-4 h-4" />
            이미지
          </button>
        )}
      </div>

      {/* 자연어 입력 모드 */}
      {mode === 'natural' && !ni.previewItems && (
        <form onSubmit={ni.handlePreview} className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60 p-6 space-y-4">
          <div>
            <label htmlFor={`${idPrefix}-natural-input`} className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              {cfg.naturalLabel}
            </label>
            <textarea
              id={`${idPrefix}-natural-input`}
              value={ni.naturalInput}
              onChange={(e) => ni.setNaturalInput(e.target.value)}
              placeholder={cfg.naturalPlaceholder}
              rows={5}
              className={`w-full px-4 py-3 bg-${c}-50/50 border border-[var(--input-border)] rounded-xl focus:ring-2 focus:ring-${c}-500/30 focus:border-${c}-500 resize-none`}
              disabled={loading}
            />
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              {cfg.naturalHint}
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !ni.naturalInput.trim()}
            className={`w-full px-4 py-3 text-sm font-medium text-white bg-${c}-600 rounded-xl hover:bg-${c}-700 shadow-sm shadow-${c}-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
          >
            {loading ? '분석 중...' : '분석하기'}
          </button>
        </form>
      )}

      {/* OCR 입력 모드 (expense 전용) */}
      {cfg.hasOcr && mode === 'ocr' && !ni.previewItems && (
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60 p-6 space-y-4">
          <div>
            <span className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              결제 화면 이미지 인식
            </span>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              토스, 카카오페이, 카드사 앱 결제 화면이나 영수증 사진을 업로드하면 AI가 자동으로 금액과 가맹점을 인식합니다.
            </p>

            {/* 이미지 미리보기 */}
            {ocrPreview && (
              <div className="mb-4 rounded-xl overflow-hidden border border-[var(--border-default)]">
                <img src={ocrPreview} alt="업로드된 이미지" className="w-full max-h-64 object-contain bg-[var(--surface-elevated)]" />
              </div>
            )}

            {/* 업로드 버튼 영역 */}
            <div
              role="button"
              tabIndex={0}
              className={`border-2 border-dashed border-[var(--input-border)] rounded-xl p-8 text-center cursor-pointer hover:border-${c}-400 hover:bg-${c}-50/30 transition-all`}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click() } }}
            >
              <Camera className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
              <p className="text-sm font-medium text-[var(--text-secondary)]">
                {loading ? '인식 중...' : '이미지 선택 / 카메라 촬영'}
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                JPG, PNG, WEBP · 최대 10MB
              </p>
            </div>

            {/* 숨겨진 파일 input */}
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

          {/* 갤러리에서 선택 버튼 */}
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.removeAttribute('capture')
                fileInputRef.current.click()
                requestAnimationFrame(() => {
                  if (fileInputRef.current) fileInputRef.current.setAttribute('capture', 'environment')
                })
              }
            }}
            className={`w-full px-4 py-3 text-sm font-medium text-${c}-600 border border-${c}-300 bg-${c}-50 rounded-xl hover:bg-${c}-100 transition-colors disabled:opacity-50`}
          >
            갤러리에서 선택
          </button>
        </div>
      )}

      {/* OCR 파싱 결과 프리뷰 카드 */}
      {cfg.hasOcr && mode === 'ocr' && ni.previewItems && (
        <div className="space-y-4">
          {ocrPreview && (
            <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)]/60 overflow-hidden">
              <img src={ocrPreview} alt="인식된 이미지" className="w-full max-h-40 object-contain bg-[var(--surface-elevated)]" />
            </div>
          )}

          <div className={`bg-${c}-50 border border-${c}-200 rounded-2xl p-4`}>
            <p className={`text-sm text-${c}-600 font-medium`}>
              {ni.previewItems.length}건의 {cfg.previewLabel}을 인식했습니다. 내용을 확인하고 수정한 뒤 저장하세요.
            </p>
          </div>

          {ni.previewItems.map((item, index) => (
            <ParsedItemPreviewCard
              key={index}
              item={item}
              index={index}
              totalCount={ni.previewItems!.length}
              categories={ni.categories}
              colorScheme={item.type === 'income' ? 'leaf' : 'grape'}
              label={item.type === 'income' ? '수입' : '지출'}
              onUpdate={ni.updatePreviewItem}
              onRemove={ni.removePreviewItem}
              showNewCategoryFor={ni.showNewCategoryFor}
              newCategoryName={ni.newCategoryName}
              creatingCategory={ni.creatingCategory}
              onSetShowNewCategory={ni.setShowNewCategoryFor}
              onSetNewCategoryName={ni.setNewCategoryName}
              onCreateCategory={ni.handleCreateCategory}
              paymentMethods={paymentMethods}
            />
          ))}

          <div className="flex gap-3">
            <button
              onClick={() => { ni.setPreviewItems(null); setOcrPreview(null) }}
              className="flex-1 px-4 py-3 text-sm font-medium text-[var(--text-secondary)] bg-[var(--surface-hover)] rounded-xl hover:bg-[var(--surface-hover)] transition-colors"
              disabled={loading}
            >
              다시 선택
            </button>
            <button
              onClick={ni.handleConfirmSave}
              disabled={loading}
              className={`flex-1 px-4 py-3 text-sm font-medium text-white bg-${c}-600 rounded-xl hover:bg-${c}-700 shadow-sm shadow-${c}-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
            >
              {loading ? '저장 중...' : `${ni.previewItems.length}건 저장하기`}
            </button>
          </div>
        </div>
      )}

      {/* 자연어 파싱 결과 프리뷰 카드 */}
      {mode === 'natural' && ni.previewItems && (
        <div className="space-y-4">
          <div className={`bg-${c}-50 border border-${c}-200 rounded-2xl p-4`}>
            <p className={`text-sm text-${c}-600 font-medium`}>
              {ni.previewItems.length}건의 {cfg.previewLabel}을 인식했습니다. 내용을 확인하고 수정한 뒤 저장하세요.
            </p>
            {type === 'income' && ni.expenseCount > 0 && (
              <p className="text-xs text-[var(--text-tertiary)] mt-1">
                지출로 분류된 {ni.expenseCount}건은 별도로 지출 입력 페이지에서 등록해주세요.
              </p>
            )}
          </div>

          {ni.previewItems.map((item, index) => (
            <ParsedItemPreviewCard
              key={index}
              item={item}
              index={index}
              totalCount={ni.previewItems!.length}
              categories={ni.categories}
              colorScheme={type === 'income' ? 'leaf' : (item.type === 'income' ? 'leaf' : 'grape')}
              label={type === 'income' ? '수입' : (item.type === 'income' ? '수입' : '지출')}
              onUpdate={ni.updatePreviewItem}
              onRemove={ni.removePreviewItem}
              showNewCategoryFor={ni.showNewCategoryFor}
              newCategoryName={ni.newCategoryName}
              creatingCategory={ni.creatingCategory}
              onSetShowNewCategory={ni.setShowNewCategoryFor}
              onSetNewCategoryName={ni.setNewCategoryName}
              onCreateCategory={ni.handleCreateCategory}
              paymentMethods={paymentMethods}
            />
          ))}

          <div className="flex gap-3">
            <button
              onClick={() => { ni.setPreviewItems(null) }}
              className="flex-1 px-4 py-3 text-sm font-medium text-[var(--text-secondary)] bg-[var(--surface-hover)] rounded-xl hover:bg-[var(--surface-hover)] transition-colors"
              disabled={loading}
            >
              다시 입력
            </button>
            <button
              onClick={ni.handleConfirmSave}
              disabled={loading}
              className={`flex-1 px-4 py-3 text-sm font-medium text-white bg-${c}-600 rounded-xl hover:bg-${c}-700 shadow-sm shadow-${c}-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
            >
              {loading ? '저장 중...' : `${ni.previewItems.length}건 저장하기`}
            </button>
          </div>
        </div>
      )}

      {/* 폼 입력 모드 */}
      {mode === 'form' && (
        <form onSubmit={handleFormSubmit} className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60 p-6 space-y-5">
          {/* 금액 (필수) */}
          <div>
            <label htmlFor={`${idPrefix}-amount`} className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              금액 <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">₩</span>
              <input
                id={`${idPrefix}-amount`}
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder={cfg.formPlaceholder.amount}
                className={`w-full pl-8 pr-4 py-3 border border-[var(--input-border)] rounded-xl focus:ring-2 focus:ring-${c}-500/30 focus:border-${c}-500`}
                disabled={loading}
                min="1"
                step="any"
              />
            </div>
          </div>

          {/* 설명 (필수) */}
          <div>
            <label htmlFor={`${idPrefix}-description`} className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              설명 <span className="text-rose-500">*</span>
            </label>
            <input
              id={`${idPrefix}-description`}
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={cfg.formPlaceholder.description}
              className={`w-full px-4 py-3 border border-[var(--input-border)] rounded-xl focus:ring-2 focus:ring-${c}-500/30 focus:border-${c}-500`}
              disabled={loading}
            />
          </div>

          {/* 카테고리 (선택) */}
          <div>
            <label htmlFor={`${idPrefix}-category`} className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              카테고리
            </label>
            <select
              id={`${idPrefix}-category`}
              value={formData.category_id}
              onChange={(e) => {
                const catId = e.target.value
                const selectedCat = formCategories.find((cat) => String(cat.id) === catId)
                const isSavings = selectedCat ? (selectedCat.exclude_auto_payment || selectedCat.is_savings) : false
                if (isSavings) {
                  setFormData({ ...formData, category_id: catId, payment_method_id: '' })
                } else {
                  setFormData({ ...formData, category_id: catId })
                }
              }}
              className={`w-full px-4 py-3 border border-[var(--input-border)] rounded-xl focus:ring-2 focus:ring-${c}-500/30 focus:border-${c}-500`}
              disabled={loading}
            >
              <option value="">분류 안 됨</option>
              {formCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {showNewCategoryForForm ? (
              <div className="flex gap-1.5 mt-2">
                <input
                  type="text"
                  value={newCategoryNameForForm}
                  onChange={(e) => setNewCategoryNameForForm(e.target.value)}
                  placeholder="새 카테고리 이름"
                  className={`flex-1 px-3 py-2 border border-${c}-300 rounded-lg text-sm focus:ring-2 focus:ring-${c}-500/30 focus:border-${c}-500`}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateCategoryForForm() } }}
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleCreateCategoryForForm}
                  disabled={creatingCategoryForForm || !newCategoryNameForForm.trim()}
                  className={`px-3 py-2 text-sm font-medium text-white bg-${c}-600 rounded-lg hover:bg-${c}-700 disabled:opacity-50`}
                >
                  {creatingCategoryForForm ? '...' : '추가'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNewCategoryForForm(false); setNewCategoryNameForForm('') }}
                  className="px-3 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--surface-hover)] rounded-lg hover:bg-[var(--surface-hover)]"
                >
                  취소
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setShowNewCategoryForForm(true); setNewCategoryNameForForm('') }}
                className={`mt-2 text-sm text-${c}-600 hover:text-${c}-600 font-medium`}
              >
                + 새 카테고리
              </button>
            )}
          </div>

          {/* 결제수단 (지출 모드 전용, 선택) */}
          {type === 'expense' && (() => {
            const selectedCat = formCategories.find((cat) => String(cat.id) === formData.category_id)
            const isSavingsCategory = selectedCat ? (selectedCat.exclude_auto_payment || selectedCat.is_savings) : false
            return (
              <div>
                <label htmlFor={`${idPrefix}-payment-method`} className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  결제수단
                </label>
                <select
                  id={`${idPrefix}-payment-method`}
                  value={formData.payment_method_id}
                  onChange={(e) => setFormData({ ...formData, payment_method_id: e.target.value })}
                  className={`w-full px-4 py-3 border border-[var(--input-border)] rounded-xl focus:ring-2 focus:ring-${c}-500/30 focus:border-${c}-500`}
                  disabled={loading}
                >
                  <option value="">선택 안 함</option>
                  {paymentMethods.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.name}
                    </option>
                  ))}
                </select>
                {isSavingsCategory && (
                  <p className="mt-1.5 text-xs text-[var(--text-muted)]" data-testid="savings-payment-hint">
                    저축성 지출은 결제수단이 자동 적용되지 않아요
                  </p>
                )}
              </div>
            )
          })()}

          {/* 날짜 (기본 오늘) */}
          <div>
            <label htmlFor={`${idPrefix}-date`} className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              날짜 <span className="text-rose-500">*</span>
            </label>
            <input
              id={`${idPrefix}-date`}
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className={`w-full px-4 py-3 border border-[var(--input-border)] rounded-xl focus:ring-2 focus:ring-${c}-500/30 focus:border-${c}-500`}
              disabled={loading}
            />
          </div>

          {/* 메모 (선택) */}
          <div>
            <label htmlFor={`${idPrefix}-memo`} className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              메모
            </label>
            <input
              id={`${idPrefix}-memo`}
              type="text"
              value={formData.memo}
              onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
              placeholder="추가 메모 (선택)"
              className={`w-full px-4 py-3 border border-[var(--input-border)] rounded-xl focus:ring-2 focus:ring-${c}-500/30 focus:border-${c}-500`}
              disabled={loading}
            />
          </div>

          {/* 통계 제외 */}
          <label htmlFor={`${idPrefix}-exclude-stats`} className="flex items-center gap-3 cursor-pointer select-none">
            <div className="relative">
              <input
                id={`${idPrefix}-exclude-stats`}
                type="checkbox"
                checked={formData.exclude_from_stats}
                onChange={(e) => setFormData({ ...formData, exclude_from_stats: e.target.checked })}
                className="sr-only"
                disabled={loading}
              />
              <div className={`w-10 h-6 rounded-full transition-colors ${formData.exclude_from_stats ? 'bg-[var(--text-muted)]' : 'bg-[var(--surface-hover)]'}`} />
              <div className={`absolute top-1 left-1 w-4 h-4 bg-[var(--surface-card)] rounded-full shadow transition-transform ${formData.exclude_from_stats ? 'translate-x-4' : ''}`} />
            </div>
            <div>
              <span className="text-sm font-medium text-[var(--text-secondary)]">통계에서 제외</span>
              <p className="text-xs text-[var(--text-muted)]">{cfg.statsExcludeHint}</p>
            </div>
          </label>

          {/* 제출 버튼 */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate(cfg.listRoute)}
              className="flex-1 px-4 py-3 text-sm font-medium text-[var(--text-secondary)] bg-[var(--surface-hover)] rounded-xl hover:bg-[var(--surface-hover)] transition-colors"
              disabled={loading}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 px-4 py-3 text-sm font-medium text-white bg-${c}-600 rounded-xl hover:bg-${c}-700 shadow-sm shadow-${c}-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all`}
            >
              {loading ? '저장 중...' : '저장하기'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
