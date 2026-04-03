/* 자산 등록/수정 폼 */

import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Search, Trash2 } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { TOAST } from '../constants/toastMessages'
import { useTickerSearch } from '../hooks/useTickerSearch'
import { assetApi } from '../api/assets'
import { accountApi } from '../api/accounts'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import { Skeleton } from '../components/skeleton/Skeleton'
import type { CreateAssetParams, Account } from '../types'
import { trackEvent } from '../utils/analytics'

type Mode = 'natural' | 'direct'
type AssetType = 'stock_kr' | 'stock_us' | 'crypto' | 'deposit' | 'real_estate' | 'other' | 'loan' | 'insurance' | 'vehicle'

const TYPE_LABELS: Record<AssetType, string> = {
  stock_kr: '한국주식/ETF',
  stock_us: '미국주식/ETF',
  crypto: '코인',
  deposit: '예적금',
  real_estate: '부동산',
  insurance: '보험/연금',
  vehicle: '자동차',
  other: '기타자산',
  loan: '대출/부채',
}

const LIABILITY_TYPES: AssetType[] = ['loan']

function isLiabilityType(type: AssetType): boolean {
  return LIABILITY_TYPES.includes(type)
}

export default function AssetForm() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const isEdit = !!id
  const { addToast } = useToast()

  const preselectedType = (searchParams.get('type') as AssetType | null) ?? 'deposit'

  const [mode, setMode] = useState<Mode>('natural')
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(isEdit)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // 자연어 모드
  const [naturalInput, setNaturalInput] = useState('')
  const [previewItems, setPreviewItems] = useState<CreateAssetParams[] | null>(null)

  // 직접 입력 모드
  const [assetType, setAssetType] = useState<AssetType>(preselectedType)
  const [form, setForm] = useState<CreateAssetParams>({
    name: '',
    type: preselectedType,
    is_liability: isLiabilityType(preselectedType),
  })

  // 계좌 목록
  const [accounts, setAccounts] = useState<Account[]>([])
  const { activeHouseholdId } = useHouseholdStore()

  // 종목 검색
  const {
    searchQuery, setSearchQuery,
    searchResults, showDropdown, setShowDropdown,
    searchLoading, searchError,
    manualMode, setManualMode,
    dropdownRef, resetSearch,
  } = useTickerSearch(assetType)

  // 계좌 목록 로드
  useEffect(() => {
    accountApi.getAll(activeHouseholdId!)
      .then(res => setAccounts(res.data))
      .catch(() => {})
  }, [activeHouseholdId])

  // 수정 모드: 기존 자산 데이터 로드
  useEffect(() => {
    if (!isEdit) return
    setInitialLoading(true)
    assetApi.getById(Number(id))
      .then(res => {
        const asset = res.data
        setAssetType(asset.type as AssetType)
        setMode('direct')
        setForm({
          name: asset.name,
          type: asset.type as AssetType,
          is_liability: asset.is_liability,
          ticker: asset.ticker ?? undefined,
          quantity: asset.quantity ?? undefined,
          avg_buy_price: asset.avg_buy_price ?? undefined,
          manual_value: asset.manual_value ?? undefined,
          interest_rate: asset.interest_rate ?? undefined,
          maturity_date: asset.maturity_date ?? undefined,
          repayment_type: asset.repayment_type ?? undefined,
          monthly_payment: asset.monthly_payment ?? undefined,
          original_amount: asset.original_amount ?? null,
          account_id: asset.account_id ?? undefined,
          memo: asset.memo ?? undefined,
        })
        if (asset.ticker) setSearchQuery(asset.ticker)
        else if (['stock_kr', 'stock_us', 'crypto'].includes(asset.type)) setSearchQuery(asset.name)
      })
      .catch(() => {
        addToast('error', TOAST.ASSET_LOAD_FAILED)
        navigate('/assets')
      })
      .finally(() => setInitialLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // 자산 타입 변경 시 폼 초기화 (신규 모드에서만)
  useEffect(() => {
    if (isEdit) return
    setForm({ name: '', type: assetType, is_liability: isLiabilityType(assetType) })
    resetSearch()
  }, [assetType, isEdit, resetSearch])

  // 자연어 분석
  async function handleNaturalParse() {
    if (!naturalInput.trim()) return
    setLoading(true)
    try {
      const res = await assetApi.parse(naturalInput)
      setPreviewItems(res.data.items)
    } catch {
      addToast('error', TOAST.ASSET_PARSE_FAILED)
    } finally {
      setLoading(false)
    }
  }

  // 자연어 프리뷰 저장
  async function handleNaturalSave() {
    if (!previewItems || previewItems.length === 0) return
    setLoading(true)
    try {
      for (const item of previewItems) {
        await assetApi.create(item)
      }
      addToast('success', TOAST.ASSET_SAVED)
      trackEvent('asset_added')
      await assetApi.createSnapshot(activeHouseholdId!)
      await queryClient.invalidateQueries({ queryKey: ['assets'] })
      await queryClient.invalidateQueries({ queryKey: ['asset-snapshots'] })
      navigate('/assets')
    } catch {
      addToast('error', TOAST.SAVE_FAILED)
    } finally {
      setLoading(false)
    }
  }

  // 직접 입력 저장 (신규/수정 공통)
  async function handleDirectSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name?.trim()) {
      addToast('error', '자산명을 입력해주세요')
      return
    }
    setLoading(true)
    try {
      if (isEdit) {
        await assetApi.update(Number(id), form)
        addToast('success', TOAST.ASSET_UPDATED)
      } else {
        await assetApi.create(form)
        addToast('success', TOAST.ASSET_SAVED)
        trackEvent('asset_added')
      }
      await assetApi.createSnapshot(activeHouseholdId!)
      await queryClient.invalidateQueries({ queryKey: ['assets'] })
      await queryClient.invalidateQueries({ queryKey: ['asset-snapshots'] })
      navigate('/assets')
    } catch {
      addToast('error', TOAST.SAVE_FAILED)
    } finally {
      setLoading(false)
    }
  }

  // 삭제
  async function handleDelete() {
    setLoading(true)
    try {
      await assetApi.delete(Number(id))
      addToast('success', TOAST.ASSET_DELETED)
      await assetApi.createSnapshot(activeHouseholdId!)
      await queryClient.invalidateQueries({ queryKey: ['assets'] })
      await queryClient.invalidateQueries({ queryKey: ['asset-snapshots'] })
      navigate('/assets')
    } catch {
      addToast('error', TOAST.DELETE_FAILED)
    } finally {
      setLoading(false)
    }
  }

  const isInvestmentType = ['stock_kr', 'stock_us', 'crypto'].includes(assetType)
  const isManualType = ['deposit', 'real_estate', 'other', 'loan'].includes(assetType)

  if (initialLoading) {
    return (
      <div className="max-w-xl mx-auto space-y-6 animate-pulse">
        <Skeleton className="w-9 h-9 rounded-lg" />
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-12 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-page-in">
      <Link to="/assets" aria-label="뒤로가기" className="p-2 -ml-2 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-tertiary)] inline-block">
        <ArrowLeft className="w-5 h-5" />
      </Link>

      {/* 모드 탭 (신규 모드에서만) */}
      {!isEdit && (
        <div className="flex rounded-xl bg-[var(--surface-hover)] p-1">
          {(['natural', 'direct'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setPreviewItems(null) }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                mode === m ? 'bg-[var(--surface-card)] text-grape-600 shadow-sm' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {m === 'natural' ? '간편 입력' : '직접 입력'}
            </button>
          ))}
        </div>
      )}

      {/* 자연어 모드 */}
      {mode === 'natural' && !isEdit && (
        <div className="space-y-4">
          <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)]/60 shadow-sm p-6 space-y-3">
            <p className="text-sm text-[var(--text-tertiary)]">
              보유 자산을 자유롭게 입력하면 자동으로 분석해드립니다.
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              예) "삼성전자 100주 7만원에 매수, 비트코인 0.5개, 신한 적금 500만원, 주담대 2억 3.5%"
            </p>
            <textarea
              value={naturalInput}
              onChange={e => setNaturalInput(e.target.value)}
              placeholder="보유 자산을 입력하세요..."
              rows={4}
              className="input-base resize-none"
            />
            <button
              onClick={handleNaturalParse}
              disabled={loading || !naturalInput.trim()}
              className="w-full py-3 bg-grape-600 text-white rounded-xl text-sm font-medium hover:bg-grape-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading && !previewItems ? <div className="animate-spin rounded-full border-b-2 border-current w-4 h-4" /> : null}
              분석하기
            </button>
          </div>

          {/* 프리뷰 */}
          {previewItems && (
            <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)]/60 shadow-sm p-6 space-y-3">
              <h3 className="text-sm font-semibold text-[var(--text-secondary)]">분석 결과 ({previewItems.length}건)</h3>
              <div className="space-y-2">
                {previewItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-[var(--surface-elevated)] rounded-lg text-sm">
                    <div>
                      <span className="font-medium text-[var(--text-primary)]">{item.name}</span>
                      <span className="ml-2 text-xs text-[var(--text-muted)]">{TYPE_LABELS[item.type as AssetType] ?? item.type}</span>
                      {item.ticker && <span className="ml-1 text-xs text-grape-600">{item.ticker}</span>}
                    </div>
                    <div className="text-right text-xs text-[var(--text-tertiary)]">
                      {item.quantity != null && <div>수량 {item.quantity}</div>}
                      {item.manual_value != null && <div>₩{item.manual_value.toLocaleString()}</div>}
                      {item.avg_buy_price != null && <div>매입가 ₩{item.avg_buy_price.toLocaleString()}</div>}
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={handleNaturalSave}
                disabled={loading}
                className="w-full py-3 bg-grape-600 text-white rounded-xl text-sm font-medium hover:bg-grape-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <div className="animate-spin rounded-full border-b-2 border-current w-4 h-4" /> : null}
                저장하기
              </button>
            </div>
          )}
        </div>
      )}

      {/* 직접 입력 모드 */}
      {(mode === 'direct' || isEdit) && (
        <form onSubmit={handleDirectSave} className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)]/60 shadow-sm p-6 space-y-5">
          {/* 자산 유형 선택 */}
          <div>
            <label htmlFor="asset-type" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">자산 유형</label>
            <select
              id="asset-type"
              value={assetType}
              onChange={e => {
                const t = e.target.value as AssetType
                setAssetType(t)
                if (isEdit) setForm(f => ({ ...f, type: t, is_liability: isLiabilityType(t) }))
              }}
              className="input-base"
            >
              {(Object.entries(TYPE_LABELS) as [AssetType, string][]).map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
          </div>

          {/* 자산명 (수동형에서만) */}
          {!isInvestmentType && (
            <div>
              <label htmlFor="asset-name" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">자산명</label>
              <input
                id="asset-name"
                type="text"
                value={form.name ?? ''}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="예) 내 적금, 주택담보대출"
                className="input-base"
                required
              />
            </div>
          )}

          {/* 투자형: 종목 검색 (자산명 대체) */}
          {isInvestmentType && (
            <>
              <div className="relative" ref={dropdownRef}>
                <label htmlFor="asset-ticker-search" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">종목명</label>
                {form.ticker && !manualMode ? (
                  /* 선택된 상태 */
                  <div className="flex items-center gap-2 p-2.5 border border-grape-200 bg-grape-50 rounded-lg">
                    <div className="flex-1">
                      <span className="text-sm font-medium text-[var(--text-primary)]">{form.name}</span>
                      <span className="ml-2 text-xs text-grape-600 font-mono">{form.ticker}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setForm(f => ({ ...f, name: '', ticker: undefined }))
                        setSearchQuery('')
                        setManualMode(false)
                      }}
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-2 py-0.5 rounded hover:bg-[var(--surface-hover)]"
                    >
                      변경
                    </button>
                  </div>
                ) : manualMode ? (
                  /* 직접 입력 모드 */
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={form.name ?? ''}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="종목명 (예: 삼성전자)"
                      className="input-base"
                      required
                    />
                    <input
                      type="text"
                      value={form.ticker ?? ''}
                      onChange={e => setForm(f => ({ ...f, ticker: e.target.value || undefined }))}
                      placeholder="티커/코드 (선택, 예: 005930)"
                      className="input-base"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setManualMode(false)
                        setForm(f => ({ ...f, name: '', ticker: undefined }))
                        setSearchQuery('')
                      }}
                      className="text-xs text-grape-600 hover:text-grape-600 font-medium"
                    >
                      ← 검색으로 돌아가기
                    </button>
                  </div>
                ) : (
                  /* 검색 상태 */
                  <div className="relative">
                    {searchLoading ? (
                      <div className="animate-spin rounded-full border-b-2 border-grape-500 w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" />
                    ) : (
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    )}
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onFocus={() => { if (searchResults.length > 0 || searchError) setShowDropdown(true) }}
                      onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
                      id="asset-ticker-search"
                      placeholder={assetType === 'crypto' ? 'BTC, 비트코인...' : '종목명 또는 코드 검색'}
                      className="input-base pl-9"
                    />
                    {showDropdown && (
                      <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-[var(--surface-card)] border border-[var(--input-border)] rounded-xl shadow-lg py-1 max-h-48 overflow-y-auto">
                        {searchError ? (
                          /* 에러 상태 */
                          <div className="px-3 py-4 text-center">
                            <p className="text-sm text-rose-600">{searchError}</p>
                            <button
                              type="button"
                              onClick={() => setManualMode(true)}
                              className="mt-2 text-xs text-grape-600 hover:text-grape-600 font-medium"
                            >
                              직접 입력하기
                            </button>
                          </div>
                        ) : searchResults.length === 0 ? (
                          /* 빈 결과 */
                          <div className="px-3 py-4 text-center">
                            <p className="text-sm text-[var(--text-tertiary)]">"{searchQuery}"에 대한 검색 결과가 없습니다</p>
                            <button
                              type="button"
                              onClick={() => setManualMode(true)}
                              className="mt-2 text-xs text-grape-600 hover:text-grape-600 font-medium"
                            >
                              직접 입력하기
                            </button>
                          </div>
                        ) : (
                          /* 결과 목록 */
                          searchResults.map(r => (
                            <button
                              key={r.ticker}
                              type="button"
                              onClick={() => {
                                setForm(f => ({ ...f, name: r.name || r.ticker, ticker: r.ticker }))
                                setSearchQuery(r.name || r.ticker)
                                setShowDropdown(false)
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--surface-hover)] flex items-center justify-between"
                            >
                              <span className="font-medium text-[var(--text-primary)]">{r.name}</span>
                              <span className="text-xs text-[var(--text-muted)]">{r.ticker}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="asset-quantity" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">수량</label>
                  <input
                    id="asset-quantity"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={form.quantity ?? ''}
                    onChange={e => setForm(f => ({ ...f, quantity: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="0"
                    className="input-base"
                  />
                </div>
                <div>
                  <label htmlFor="asset-avg-buy-price" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">매입 평균가 (원)</label>
                  <input
                    id="asset-avg-buy-price"
                    type="number"
                    inputMode="numeric"
                    step="any"
                    value={form.avg_buy_price ?? ''}
                    onChange={e => setForm(f => ({ ...f, avg_buy_price: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="0"
                    className="input-base"
                  />
                </div>
              </div>
            </>
          )}

          {/* 수동형: 금액 + 이율 + 만기일 */}
          {isManualType && (
            <>
              <div>
                <label htmlFor="asset-manual-value" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  {assetType === 'loan' ? '대출 잔액 (원)' : '금액 (원)'}
                </label>
                <input
                  id="asset-manual-value"
                  type="number"
                  inputMode="numeric"
                  step="any"
                  value={form.manual_value ?? ''}
                  onChange={e => setForm(f => ({ ...f, manual_value: e.target.value ? Number(e.target.value) : null }))}
                  placeholder="0"
                  className="input-base"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="asset-interest-rate" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">이자율 (%)</label>
                  <input
                    id="asset-interest-rate"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={form.interest_rate ?? ''}
                    onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="연 이자율"
                    className="input-base"
                  />
                </div>
                <div>
                  <label htmlFor="asset-maturity-date" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">만기일</label>
                  <input
                    id="asset-maturity-date"
                    type="date"
                    value={form.maturity_date ?? ''}
                    onChange={e => setForm(f => ({ ...f, maturity_date: e.target.value || null }))}
                    className="input-base"
                  />
                </div>
              </div>
              {assetType === 'loan' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="asset-repayment-type" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">상환방식</label>
                      <select
                        id="asset-repayment-type"
                        value={form.repayment_type ?? ''}
                        onChange={e => setForm(f => ({ ...f, repayment_type: e.target.value || null }))}
                        className="input-base"
                      >
                        <option value="">선택</option>
                        <option value="equal_principal_interest">원리금균등</option>
                        <option value="equal_principal">원금균등</option>
                        <option value="bullet">만기일시</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="asset-monthly-payment" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">월 상환액 (원)</label>
                      <input
                        id="asset-monthly-payment"
                        type="number"
                        inputMode="numeric"
                        step="any"
                        value={form.monthly_payment ?? ''}
                        onChange={e => setForm(f => ({ ...f, monthly_payment: e.target.value ? Number(e.target.value) : null }))}
                        placeholder="0"
                        className="input-base"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="asset-original-amount" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">원래 대출금 (선택)</label>
                    <input
                      id="asset-original-amount"
                      type="number"
                      inputMode="numeric"
                      value={form.original_amount ?? ''}
                      onChange={e => setForm(f => ({ ...f, original_amount: e.target.value ? Number(e.target.value) : null }))}
                      placeholder="대출 원금 (상환 진척도 표시용)"
                      className="input-base"
                    />
                  </div>
                </>
              )}
            </>
          )}

          {/* 계좌 선택 (선택) */}
          {accounts.length > 0 && (
            <div>
              <label htmlFor="asset-account" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">계좌 (선택)</label>
              <select
                id="asset-account"
                value={form.account_id ?? ''}
                onChange={e => setForm(f => ({ ...f, account_id: e.target.value ? Number(e.target.value) : null }))}
                className="input-base"
              >
                <option value="">계좌 미지정</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* 메모 */}
          <div>
            <label htmlFor="asset-memo" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">메모 (선택)</label>
            <input
              id="asset-memo"
              type="text"
              value={form.memo ?? ''}
              onChange={e => setForm(f => ({ ...f, memo: e.target.value || null }))}
              placeholder="메모"
              className="input-base"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-grape-600 text-white rounded-xl text-sm font-medium hover:bg-grape-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <div className="animate-spin rounded-full w-4 h-4 border-b-2 border-current" /> : null}
            {isEdit ? '수정하기' : '저장하기'}
          </button>
        </form>
      )}

      {/* 삭제 버튼 (수정 모드에서만) */}
      {isEdit && (
        <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)]/60 shadow-sm p-5">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 text-sm text-rose-600 hover:text-rose-700 font-medium"
            >
              <Trash2 className="w-4 h-4" />
              자산 삭제
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-secondary)]">정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</p>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex-1 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? <div className="animate-spin rounded-full border-b-2 border-current w-4 h-4 mx-auto" /> : '삭제'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 py-2 border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg text-sm font-medium hover:bg-[var(--surface-elevated)] transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
