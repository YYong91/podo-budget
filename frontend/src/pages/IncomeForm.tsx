import { getLocalDateString } from '../utils/format'
/**
 * @file IncomeForm.tsx
 * @description 수입 입력 폼 페이지
 * 두 가지 입력 모드를 제공한다:
 * 1. 자연어 입력 모드: 텍스트로 입력 → LLM 파싱 프리뷰 → 수정 → 확인 저장
 * 2. 폼 입력 모드: 금액, 설명, 카테고리 등을 직접 입력
 */

import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { incomeApi } from '../api/income'
import { categoryApi } from '../api/categories'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import { useNaturalInput } from '../hooks/useNaturalInput'
import ParsedItemPreviewCard from '../components/ParsedItemPreviewCard'
import { trackEvent } from '../utils/analytics'

type InputMode = 'natural' | 'form'

export default function IncomeForm() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)

  // 자연어 입력 훅
  const ni = useNaturalInput('income')

  // 입력 모드 상태
  const [mode, setMode] = useState<InputMode>('natural')

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

  // 수입용 카테고리 (훅에서 이미 income/both만 필터링)
  const incomeCategories = ni.categories

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
      addToast('success', `"${name}" 카테고리가 추가되었습니다`)
    } catch {
      addToast('error', '카테고리 생성에 실패했습니다')
    } finally {
      setCreatingCategoryForForm(false)
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
      await incomeApi.create({
        amount,
        description: formData.description.trim(),
        category_id: formData.category_id ? Number(formData.category_id) : null,
        date: formData.date.includes('T') ? formData.date : `${formData.date}T00:00:00`,
        household_id: activeHouseholdId,
        memo: formData.memo.trim() || undefined,
        exclude_from_stats: formData.exclude_from_stats,
      })
      addToast('success', '수입이 저장되었습니다')
      trackEvent('income_saved', { mode: 'form' })
      setTimeout(() => navigate('/income'), 500)
    } catch {
      addToast('error', '수입 저장에 실패했습니다')
    } finally {
      setFormLoading(false)
    }
  }

  const loading = ni.loading || formLoading

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        to="/income"
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
              ? 'bg-leaf-600 text-white shadow-sm shadow-leaf-200'
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
              ? 'bg-leaf-600 text-white shadow-sm shadow-leaf-200'
              : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }
          `}
        >
          직접 입력
        </button>
      </div>

      {/* 자연어 입력 모드 */}
      {mode === 'natural' && !ni.previewItems && (
        <form onSubmit={ni.handlePreview} className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60 p-6 space-y-4">
          <div>
            <label htmlFor="income-natural-input" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              말하듯이 수입 입력하기
            </label>
            <textarea
              id="income-natural-input"
              value={ni.naturalInput}
              onChange={(e) => ni.setNaturalInput(e.target.value)}
              placeholder={"예: 이번 달 월급 350만원 들어왔어\n부업으로 50만원 받았어"}
              rows={5}
              className="w-full px-4 py-3 bg-leaf-50/50 border border-[var(--input-border)] rounded-xl focus:ring-2 focus:ring-leaf-500/30 focus:border-leaf-500 resize-none"
              disabled={loading}
            />
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              수입 내용을 편하게 입력하면 AI가 자동으로 분석합니다. 결과를 확인한 뒤 저장됩니다.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !ni.naturalInput.trim()}
            className="w-full px-4 py-3 text-sm font-medium text-white bg-leaf-600 rounded-xl hover:bg-leaf-700 shadow-sm shadow-leaf-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? '분석 중...' : '분석하기'}
          </button>
        </form>
      )}

      {/* 파싱 결과 프리뷰 카드 */}
      {mode === 'natural' && ni.previewItems && (
        <div className="space-y-4">
          <div className="bg-leaf-50 border border-leaf-200 rounded-2xl p-4">
            <p className="text-sm text-leaf-600 font-medium">
              {ni.previewItems.length}건의 수입을 인식했습니다. 내용을 확인하고 수정한 뒤 저장하세요.
            </p>
            {ni.expenseCount > 0 && (
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
              categories={incomeCategories}
              colorScheme="leaf"
              label="수입"
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
              className="flex-1 px-4 py-3 text-sm font-medium text-white bg-leaf-600 rounded-xl hover:bg-leaf-700 shadow-sm shadow-leaf-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
            <label htmlFor="income-amount" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              금액 <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">₩</span>
              <input
                id="income-amount"
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="3500000"
                className="w-full pl-8 pr-4 py-3 border border-[var(--input-border)] rounded-xl focus:ring-2 focus:ring-leaf-500/30 focus:border-leaf-500"
                disabled={loading}
                min="1"
                step="any"
              />
            </div>
          </div>

          {/* 설명 (필수) */}
          <div>
            <label htmlFor="income-description" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              설명 <span className="text-rose-500">*</span>
            </label>
            <input
              id="income-description"
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="월급"
              className="w-full px-4 py-3 border border-[var(--input-border)] rounded-xl focus:ring-2 focus:ring-leaf-500/30 focus:border-leaf-500"
              disabled={loading}
            />
          </div>

          {/* 카테고리 (선택) — income/both만 표시 */}
          <div>
            <label htmlFor="income-category" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              카테고리
            </label>
            <select
              id="income-category"
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              className="w-full px-4 py-3 border border-[var(--input-border)] rounded-xl focus:ring-2 focus:ring-leaf-500/30 focus:border-leaf-500"
              disabled={loading}
            >
              <option value="">미분류</option>
              {incomeCategories.map((cat) => (
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
                  className="flex-1 px-3 py-2 border border-leaf-300 rounded-lg text-sm focus:ring-2 focus:ring-leaf-500/30 focus:border-leaf-500"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateCategoryForForm() } }}
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleCreateCategoryForForm}
                  disabled={creatingCategoryForForm || !newCategoryNameForForm.trim()}
                  className="px-3 py-2 text-sm font-medium text-white bg-leaf-600 rounded-lg hover:bg-leaf-700 disabled:opacity-50"
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
                className="mt-2 text-sm text-leaf-600 hover:text-leaf-600 font-medium"
              >
                + 새 카테고리
              </button>
            )}
          </div>

          {/* 날짜 (기본 오늘) */}
          <div>
            <label htmlFor="income-date" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              날짜 <span className="text-rose-500">*</span>
            </label>
            <input
              id="income-date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-3 border border-[var(--input-border)] rounded-xl focus:ring-2 focus:ring-leaf-500/30 focus:border-leaf-500"
              disabled={loading}
            />
          </div>

          {/* 메모 (선택) */}
          <div>
            <label htmlFor="income-memo" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              메모
            </label>
            <input
              id="income-memo"
              type="text"
              value={formData.memo}
              onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
              placeholder="추가 메모 (선택)"
              className="w-full px-4 py-3 border border-[var(--input-border)] rounded-xl focus:ring-2 focus:ring-leaf-500/30 focus:border-leaf-500"
              disabled={loading}
            />
          </div>

          {/* 통계 제외 */}
          <label htmlFor="income-exclude-stats" className="flex items-center gap-3 cursor-pointer select-none">
            <div className="relative">
              <input
                id="income-exclude-stats"
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
              <p className="text-xs text-[var(--text-muted)]">퇴직금, 일시금 등 비정형 수입을 차트/통계에서 제외합니다</p>
            </div>
          </label>

          {/* 제출 버튼 */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/income')}
              className="flex-1 px-4 py-3 text-sm font-medium text-[var(--text-secondary)] bg-[var(--surface-hover)] rounded-xl hover:bg-[var(--surface-hover)] transition-colors"
              disabled={loading}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 text-sm font-medium text-white bg-leaf-600 rounded-xl hover:bg-leaf-700 shadow-sm shadow-leaf-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? '저장 중...' : '저장하기'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
