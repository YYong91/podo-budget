/* 자산 등록 폼 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Search, Loader2 } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { assetApi } from '../api/assets'
import { accountApi } from '../api/accounts'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import type { AssetSearchResult, CreateAssetParams, Account } from '../types'

type Mode = 'natural' | 'direct'
type AssetType = 'stock_kr' | 'stock_us' | 'crypto' | 'deposit' | 'real_estate' | 'other' | 'loan'

const TYPE_LABELS: Record<AssetType, string> = {
  stock_kr: '한국주식/ETF',
  stock_us: '미국주식/ETF',
  crypto: '코인',
  deposit: '예적금',
  real_estate: '부동산',
  other: '기타자산',
  loan: '대출/부채',
}

const LIABILITY_TYPES: AssetType[] = ['loan']

function isLiabilityType(type: AssetType): boolean {
  return LIABILITY_TYPES.includes(type)
}

export default function AssetForm() {
  const navigate = useNavigate()
  const { addToast } = useToast()

  const [mode, setMode] = useState<Mode>('natural')
  const [loading, setLoading] = useState(false)

  // 자연어 모드
  const [naturalInput, setNaturalInput] = useState('')
  const [previewItems, setPreviewItems] = useState<CreateAssetParams[] | null>(null)

  // 직접 입력 모드
  const [assetType, setAssetType] = useState<AssetType>('deposit')
  const [form, setForm] = useState<CreateAssetParams>({
    name: '',
    type: 'deposit',
    is_liability: false,
  })

  // 계좌 목록
  const [accounts, setAccounts] = useState<Account[]>([])
  const { activeHouseholdId } = useHouseholdStore()

  // 종목 검색
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<AssetSearchResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 계좌 목록 로드
  useEffect(() => {
    accountApi.getAll(activeHouseholdId ?? undefined)
      .then(res => setAccounts(res.data))
      .catch(() => {})
  }, [activeHouseholdId])

  // 자산 타입 변경 시 폼 초기화
  useEffect(() => {
    setForm({ name: '', type: assetType, is_liability: isLiabilityType(assetType) })
    setSearchQuery('')
    setSearchResults([])
  }, [assetType])

  // 종목 검색 디바운스
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 1) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }
    const market =
      assetType === 'stock_kr' ? 'kr' :
      assetType === 'stock_us' ? 'us' :
      assetType === 'crypto' ? 'crypto' : undefined

    if (!market) return

    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      assetApi.search(searchQuery, market)
        .then(res => {
          setSearchResults(res.data)
          setShowDropdown(res.data.length > 0)
        })
        .catch(() => {})
    }, 300)
  }, [searchQuery, assetType])

  // 자연어 분석
  async function handleNaturalParse() {
    if (!naturalInput.trim()) return
    setLoading(true)
    try {
      const res = await assetApi.parse(naturalInput)
      setPreviewItems(res.data.items)
    } catch {
      addToast('error', '분석 중 오류가 발생했습니다')
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
      addToast('success', `${previewItems.length}개 자산이 등록되었습니다`)
      navigate('/assets')
    } catch {
      addToast('error', '저장 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  // 직접 입력 저장
  async function handleDirectSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name?.trim()) {
      addToast('error', '자산명을 입력해주세요')
      return
    }
    setLoading(true)
    try {
      await assetApi.create(form)
      addToast('success', '자산이 등록되었습니다')
      navigate('/assets')
    } catch {
      addToast('error', '저장 중 오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }

  const isInvestmentType = ['stock_kr', 'stock_us', 'crypto'].includes(assetType)
  const isManualType = ['deposit', 'real_estate', 'other', 'loan'].includes(assetType)

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link to="/assets" className="p-2 rounded-lg hover:bg-warm-100 text-warm-500">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-warm-900">자산 등록</h1>
      </div>

      {/* 모드 탭 */}
      <div className="flex rounded-xl bg-warm-100 p-1">
        {(['natural', 'direct'] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => { setMode(m); setPreviewItems(null) }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              mode === m ? 'bg-white text-grape-700 shadow-sm' : 'text-warm-500 hover:text-warm-700'
            }`}
          >
            {m === 'natural' ? '간편 입력' : '직접 입력'}
          </button>
        ))}
      </div>

      {/* 자연어 모드 */}
      {mode === 'natural' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-warm-200/60 shadow-sm p-5 space-y-3">
            <p className="text-sm text-warm-500">
              보유 자산을 자유롭게 입력하면 자동으로 분석해드립니다.
            </p>
            <p className="text-xs text-warm-400">
              예) "삼성전자 100주 7만원에 매수, 비트코인 0.5개, 신한 적금 500만원, 주담대 2억 3.5%"
            </p>
            <textarea
              value={naturalInput}
              onChange={e => setNaturalInput(e.target.value)}
              placeholder="보유 자산을 입력하세요..."
              rows={4}
              className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-grape-300 resize-none"
            />
            <button
              onClick={handleNaturalParse}
              disabled={loading || !naturalInput.trim()}
              className="w-full py-2.5 bg-grape-600 text-white rounded-lg text-sm font-medium hover:bg-grape-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading && !previewItems ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              분석하기
            </button>
          </div>

          {/* 프리뷰 */}
          {previewItems && (
            <div className="bg-white rounded-2xl border border-warm-200/60 shadow-sm p-5 space-y-3">
              <h3 className="text-sm font-semibold text-warm-700">분석 결과 ({previewItems.length}건)</h3>
              <div className="space-y-2">
                {previewItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-warm-50 rounded-lg text-sm">
                    <div>
                      <span className="font-medium text-warm-800">{item.name}</span>
                      <span className="ml-2 text-xs text-warm-400">{TYPE_LABELS[item.type as AssetType] ?? item.type}</span>
                      {item.ticker && <span className="ml-1 text-xs text-grape-600">{item.ticker}</span>}
                    </div>
                    <div className="text-right text-xs text-warm-500">
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
                className="w-full py-2.5 bg-grape-600 text-white rounded-lg text-sm font-medium hover:bg-grape-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                저장하기
              </button>
            </div>
          )}
        </div>
      )}

      {/* 직접 입력 모드 */}
      {mode === 'direct' && (
        <form onSubmit={handleDirectSave} className="bg-white rounded-2xl border border-warm-200/60 shadow-sm p-5 space-y-4">
          {/* 자산 유형 선택 */}
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1.5">자산 유형</label>
            <select
              value={assetType}
              onChange={e => setAssetType(e.target.value as AssetType)}
              className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-grape-300"
            >
              {(Object.entries(TYPE_LABELS) as [AssetType, string][]).map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
          </div>

          {/* 자산명 */}
          <div>
            <label className="block text-sm font-medium text-warm-700 mb-1.5">자산명</label>
            <input
              type="text"
              value={form.name ?? ''}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="예) 삼성전자, 내 적금, 주택담보대출"
              className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-grape-300"
              required
            />
          </div>

          {/* 투자형: 종목 검색 */}
          {isInvestmentType && (
            <>
              <div className="relative">
                <label className="block text-sm font-medium text-warm-700 mb-1.5">종목 검색</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={assetType === 'crypto' ? 'BTC, ETH...' : '종목명 또는 코드 검색'}
                    className="w-full border border-warm-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-grape-300"
                  />
                </div>
                {showDropdown && (
                  <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-warm-200 rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto">
                    {searchResults.map(r => (
                      <button
                        key={r.ticker}
                        type="button"
                        onClick={() => {
                          setForm(f => ({ ...f, name: r.name || r.ticker, ticker: r.ticker }))
                          setSearchQuery(r.name || r.ticker)
                          setShowDropdown(false)
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-warm-100 flex items-center justify-between"
                      >
                        <span className="font-medium text-warm-800">{r.name}</span>
                        <span className="text-xs text-warm-400">{r.ticker}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-warm-700 mb-1.5">수량</label>
                  <input
                    type="number"
                    step="any"
                    value={form.quantity ?? ''}
                    onChange={e => setForm(f => ({ ...f, quantity: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="0"
                    className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-grape-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-warm-700 mb-1.5">매입 평균가 (원)</label>
                  <input
                    type="number"
                    step="any"
                    value={form.avg_buy_price ?? ''}
                    onChange={e => setForm(f => ({ ...f, avg_buy_price: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="0"
                    className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-grape-300"
                  />
                </div>
              </div>
            </>
          )}

          {/* 수동형: 금액 + 이율 + 만기일 */}
          {isManualType && (
            <>
              <div>
                <label className="block text-sm font-medium text-warm-700 mb-1.5">
                  {assetType === 'loan' ? '대출 잔액 (원)' : '금액 (원)'}
                </label>
                <input
                  type="number"
                  step="any"
                  value={form.manual_value ?? ''}
                  onChange={e => setForm(f => ({ ...f, manual_value: e.target.value ? Number(e.target.value) : null }))}
                  placeholder="0"
                  className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-grape-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-warm-700 mb-1.5">이율 (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.interest_rate ?? ''}
                    onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value ? Number(e.target.value) : null }))}
                    placeholder="연 이율"
                    className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-grape-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-warm-700 mb-1.5">만기일</label>
                  <input
                    type="date"
                    value={form.maturity_date ?? ''}
                    onChange={e => setForm(f => ({ ...f, maturity_date: e.target.value || null }))}
                    className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-grape-300"
                  />
                </div>
              </div>
              {assetType === 'loan' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-warm-700 mb-1.5">상환방식</label>
                    <select
                      value={form.repayment_type ?? ''}
                      onChange={e => setForm(f => ({ ...f, repayment_type: e.target.value || null }))}
                      className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-grape-300"
                    >
                      <option value="">선택</option>
                      <option value="equal_principal_interest">원리금균등</option>
                      <option value="equal_principal">원금균등</option>
                      <option value="bullet">만기일시</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-warm-700 mb-1.5">월 상환액 (원)</label>
                    <input
                      type="number"
                      step="any"
                      value={form.monthly_payment ?? ''}
                      onChange={e => setForm(f => ({ ...f, monthly_payment: e.target.value ? Number(e.target.value) : null }))}
                      placeholder="0"
                      className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-grape-300"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* 계좌 선택 (선택) */}
          {accounts.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-warm-700 mb-1.5">계좌 (선택)</label>
              <select
                value={form.account_id ?? ''}
                onChange={e => setForm(f => ({ ...f, account_id: e.target.value ? Number(e.target.value) : null }))}
                className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-grape-300"
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
            <label className="block text-sm font-medium text-warm-700 mb-1.5">메모 (선택)</label>
            <input
              type="text"
              value={form.memo ?? ''}
              onChange={e => setForm(f => ({ ...f, memo: e.target.value || null }))}
              placeholder="메모"
              className="w-full border border-warm-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-grape-300"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-grape-600 text-white rounded-lg text-sm font-medium hover:bg-grape-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            저장하기
          </button>
        </form>
      )}
    </div>
  )
}
