import { getLocalDateString } from '../utils/format'
/**
 * @file ExpenseForm.tsx
 * @description 지출 입력 폼 페이지
 * 두 가지 입력 모드를 제공한다:
 * 1. 자연어 입력 모드: 텍스트로 입력 → LLM 파싱 프리뷰 → 수정 → 확인 저장
 * 2. 폼 입력 모드: 금액, 설명, 카테고리 등을 직접 입력
 */

import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Camera } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { expenseApi } from '../api/expenses'
import { categoryApi } from '../api/categories'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import { useNaturalInput } from '../hooks/useNaturalInput'
import ParsedItemPreviewCard from '../components/ParsedItemPreviewCard'
import { trackEvent } from '../utils/analytics'

type InputMode = 'natural' | 'form' | 'ocr'

export default function ExpenseForm() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)

  // 자연어 입력 훅
  const ni = useNaturalInput('expense')

  // 입력 모드 상태
  const [mode, setMode] = useState<InputMode>('natural')

  // OCR 상태
  const [ocrPreview, setOcrPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 폼 입력 상태
  const [formLoading, setFormLoading] = useState(false)
  // 폼용 카테고리 추가 상태
  const [showNewCategoryForForm, setShowNewCategoryForForm] = useState(false)
  const [newCategoryNameForForm, setNewCategoryNameForForm] = useState('')
  const [creatingCategoryForForm, setCreatingCategoryForForm] = useState(false)
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    category_id: '',
    date: getLocalDateString(),
    memo: '',
    exclude_from_stats: false,
  })

  // 폼 모드의 카테고리 목록 (allCategories에서 expense 타입만 — 훅의 categories와 동일)
  const formCategories = ni.categories

  /** 폼 입력 모드에서 새 카테고리 즉시 생성 후 적용 */
  const handleCreateCategoryForForm = async () => {
    const name = newCategoryNameForForm.trim()
    if (!name) return
    setCreatingCategoryForForm(true)
    try {
      const res = await categoryApi.create({ name })
      const newCat = res.data
      // 훅 내부 카테고리 목록에도 추가할 수 없으므로 별도 관리하지 않음
      // 대신 formData에 새 카테고리 ID를 설정
      setFormData((prev) => ({ ...prev, category_id: String(newCat.id) }))
      setShowNewCategoryForForm(false)
      setNewCategoryNameForForm('')
      addToast('success', `"${name}" 카테고리가 추가되었습니다`)
    } catch {
      addToast('error', '카테고리 생성에 실패했습니다')
    } finally {
      setCreatingCategoryForForm(false)
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
      addToast('error', 'OCR 처리에 실패했습니다')
      setOcrPreview(null)
    } finally {
      setFormLoading(false)
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

    setFormLoading(true)
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
      trackEvent('expense_saved', { mode: 'form' })
      addToast('success', '지출이 저장되었습니다')
      setTimeout(() => navigate('/expenses'), 500)
    } catch {
      addToast('error', '지출 저장에 실패했습니다')
    } finally {
      setFormLoading(false)
    }
  }

  const loading = ni.loading || formLoading

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        to="/expenses"
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
              ? 'bg-grape-600 text-white shadow-sm shadow-grape-200'
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
              ? 'bg-grape-600 text-white shadow-sm shadow-grape-200'
              : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }
          `}
        >
          직접 입력
        </button>
        <button
          onClick={() => { setMode('ocr'); ni.setPreviewItems(null); setOcrPreview(null) }}
          className={`
            flex-1 px-3 py-2.5 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-1.5
            ${mode === 'ocr'
              ? 'bg-grape-600 text-white shadow-sm shadow-grape-200'
              : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }
          `}
        >
          <Camera className="w-4 h-4" />
          이미지
        </button>
      </div>

      {/* 자연어 입력 모드 */}
      {mode === 'natural' && !ni.previewItems && (
        <form onSubmit={ni.handlePreview} className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60 p-6 space-y-4">
          <div>
            <label htmlFor="expense-natural-input" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              말하듯이 지출 입력하기
            </label>
            <textarea
              id="expense-natural-input"
              value={ni.naturalInput}
              onChange={(e) => ni.setNaturalInput(e.target.value)}
              placeholder="예: 오늘 점심에 김치찌개 8000원 먹었어&#10;어제 스타벅스에서 아메리카노 4500원"
              rows={5}
              className="w-full px-4 py-3 bg-grape-50/50 border border-[var(--input-border)] rounded-xl focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500 resize-none"
              disabled={loading}
            />
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              날짜, 내용, 금액을 편하게 입력하면 AI가 자동으로 분석합니다. 결과를 확인한 뒤 저장됩니다.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !ni.naturalInput.trim()}
            className="w-full px-4 py-3 text-sm font-medium text-white bg-grape-600 rounded-xl hover:bg-grape-700 shadow-sm shadow-grape-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? '분석 중...' : '분석하기'}
          </button>
        </form>
      )}

      {/* OCR 입력 모드 */}
      {mode === 'ocr' && !ni.previewItems && (
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
              className="border-2 border-dashed border-[var(--input-border)] rounded-xl p-8 text-center cursor-pointer hover:border-grape-400 hover:bg-grape-50/30 transition-all"
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
            className="w-full px-4 py-3 text-sm font-medium text-grape-600 border border-grape-300 bg-grape-50 rounded-xl hover:bg-grape-100 transition-colors disabled:opacity-50"
          >
            갤러리에서 선택
          </button>
        </div>
      )}

      {/* 파싱 결과 프리뷰 카드 (OCR 모드) */}
      {mode === 'ocr' && ni.previewItems && (
        <div className="space-y-4">
          {/* OCR 원본 이미지 */}
          {ocrPreview && (
            <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)]/60 overflow-hidden">
              <img src={ocrPreview} alt="인식된 이미지" className="w-full max-h-40 object-contain bg-[var(--surface-elevated)]" />
            </div>
          )}

          <div className="bg-grape-50 border border-grape-200 rounded-2xl p-4">
            <p className="text-sm text-grape-600 font-medium">
              {ni.previewItems.length}건의 지출을 인식했습니다. 내용을 확인하고 수정한 뒤 저장하세요.
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
              className="flex-1 px-4 py-3 text-sm font-medium text-white bg-grape-600 rounded-xl hover:bg-grape-700 shadow-sm shadow-grape-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? '저장 중...' : `${ni.previewItems.length}건 저장하기`}
            </button>
          </div>
        </div>
      )}

      {/* 파싱 결과 프리뷰 카드 */}
      {mode === 'natural' && ni.previewItems && (
        <div className="space-y-4">
          <div className="bg-grape-50 border border-grape-200 rounded-2xl p-4">
            <p className="text-sm text-grape-600 font-medium">
              {ni.previewItems.length}건의 지출을 인식했습니다. 내용을 확인하고 수정한 뒤 저장하세요.
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
            />
          ))}

          {/* 확인/취소 버튼 */}
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
              className="flex-1 px-4 py-3 text-sm font-medium text-white bg-grape-600 rounded-xl hover:bg-grape-700 shadow-sm shadow-grape-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
            <label htmlFor="expense-amount" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              금액 <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">₩</span>
              <input
                id="expense-amount"
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="10000"
                className="w-full pl-8 pr-4 py-3 border border-[var(--input-border)] rounded-xl focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                disabled={loading}
                min="1"
                step="any"
              />
            </div>
          </div>

          {/* 설명 (필수) */}
          <div>
            <label htmlFor="expense-description" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              설명 <span className="text-rose-500">*</span>
            </label>
            <input
              id="expense-description"
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="김치찌개"
              className="w-full px-4 py-3 border border-[var(--input-border)] rounded-xl focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
              disabled={loading}
            />
          </div>

          {/* 카테고리 (선택) */}
          <div>
            <label htmlFor="expense-category" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              카테고리
            </label>
            <select
              id="expense-category"
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              className="w-full px-4 py-3 border border-[var(--input-border)] rounded-xl focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
              disabled={loading}
            >
              <option value="">미분류</option>
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
                  className="flex-1 px-3 py-2 border border-grape-300 rounded-lg text-sm focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateCategoryForForm() } }}
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleCreateCategoryForForm}
                  disabled={creatingCategoryForForm || !newCategoryNameForForm.trim()}
                  className="px-3 py-2 text-sm font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700 disabled:opacity-50"
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
                className="mt-2 text-sm text-grape-600 hover:text-grape-600 font-medium"
              >
                + 새 카테고리
              </button>
            )}
          </div>

          {/* 날짜 (기본 오늘) */}
          <div>
            <label htmlFor="expense-date" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              날짜 <span className="text-rose-500">*</span>
            </label>
            <input
              id="expense-date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-3 border border-[var(--input-border)] rounded-xl focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
              disabled={loading}
            />
          </div>

          {/* 메모 (선택) */}
          <div>
            <label htmlFor="expense-memo" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              메모
            </label>
            <input
              id="expense-memo"
              type="text"
              value={formData.memo}
              onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
              placeholder="추가 메모 (선택)"
              className="w-full px-4 py-3 border border-[var(--input-border)] rounded-xl focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
              disabled={loading}
            />
          </div>

          {/* 통계 제외 */}
          <label htmlFor="expense-exclude-stats" className="flex items-center gap-3 cursor-pointer select-none">
            <div className="relative">
              <input
                id="expense-exclude-stats"
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
              <p className="text-xs text-[var(--text-muted)]">저축, 퇴직금 등 비정형 거래를 차트/통계에서 제외합니다</p>
            </div>
          </label>

          {/* 제출 버튼 */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/expenses')}
              className="flex-1 px-4 py-3 text-sm font-medium text-[var(--text-secondary)] bg-[var(--surface-hover)] rounded-xl hover:bg-[var(--surface-hover)] transition-colors"
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
