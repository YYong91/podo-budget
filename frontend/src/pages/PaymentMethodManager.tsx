/**
 * @file PaymentMethodManager.tsx
 * @description 결제수단 관리 페이지 (#305)
 * 결제수단 CRUD + 월 실적 프로그레스 바를 제공한다.
 */

import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CreditCard, Plus, Trash2, Star } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import { paymentMethodApi } from '../api/paymentMethods'
import { formatAmount } from '../utils/format'
import type { PaymentMethod, PaymentMethodUsage, PaymentMethodType } from '../types'

const TYPE_LABELS: Record<PaymentMethodType, string> = {
  credit_card: '신용카드',
  debit_card: '체크카드',
  cash: '현금',
  transfer: '이체',
}

const TYPE_OPTIONS: { value: PaymentMethodType; label: string }[] = [
  { value: 'credit_card', label: '신용카드' },
  { value: 'debit_card', label: '체크카드' },
  { value: 'cash', label: '현금' },
  { value: 'transfer', label: '이체' },
]

/** 현재 월 문자열 반환 */
function getCurrentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function PaymentMethodManager() {
  const { addToast } = useToast()
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)

  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [usageMap, setUsageMap] = useState<Map<number, PaymentMethodUsage>>(new Map())
  const [loading, setLoading] = useState(true)

  // 추가 폼 상태
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState<PaymentMethodType>('credit_card')
  const [formTarget, setFormTarget] = useState('')
  const [formDefault, setFormDefault] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    if (!activeHouseholdId) return
    setLoading(true)
    try {
      const [methodsRes, usageRes] = await Promise.all([
        paymentMethodApi.getAll(activeHouseholdId),
        paymentMethodApi.getMonthlyUsage(getCurrentMonth(), activeHouseholdId),
      ])
      setMethods(methodsRes.data)
      const map = new Map<number, PaymentMethodUsage>()
      usageRes.data.forEach((u) => map.set(u.id, u))
      setUsageMap(map)
    } catch {
      addToast('error', '결제수단을 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }, [activeHouseholdId, addToast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  /** 결제수단 추가 */
  const handleCreate = useCallback(async () => {
    if (!formName.trim()) {
      addToast('error', '이름을 입력해주세요')
      return
    }
    setSaving(true)
    try {
      await paymentMethodApi.create({
        name: formName.trim(),
        type: formType,
        monthly_target: formTarget ? Number(formTarget) : null,
        is_default: formDefault,
      })
      addToast('success', `"${formName.trim()}" 결제수단이 추가되었습니다`)
      setShowForm(false)
      setFormName('')
      setFormType('credit_card')
      setFormTarget('')
      setFormDefault(false)
      await fetchData()
    } catch {
      addToast('error', '결제수단 추가에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }, [formName, formType, formTarget, formDefault, fetchData, addToast])

  /** 기본 결제수단 설정 */
  const handleSetDefault = useCallback(async (method: PaymentMethod) => {
    try {
      await paymentMethodApi.update(method.id, { is_default: true })
      addToast('success', `이제부터 결제수단을 따로 말하지 않으면 ${method.name}(으)로 자동 저장됩니다`)
      await fetchData()
    } catch {
      addToast('error', '기본 결제수단 설정에 실패했습니다')
    }
  }, [fetchData, addToast])

  /** 결제수단 삭제 */
  const handleDelete = useCallback(async (method: PaymentMethod) => {
    try {
      await paymentMethodApi.delete(method.id)
      addToast('success', `"${method.name}" 결제수단이 삭제되었습니다`)
      await fetchData()
    } catch {
      addToast('error', '결제수단 삭제에 실패했습니다')
    }
  }, [fetchData, addToast])

  return (
    <div className="space-y-4 max-w-2xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/settings"
            aria-label="뒤로가기"
            className="p-2 -ml-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
          </Link>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-grape-500" />
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">결제수단</h1>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          추가
        </button>
      </div>

      {/* 추가 폼 */}
      {showForm && (
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">새 결제수단</h2>

          <div>
            <label htmlFor="pm-name" className="block text-xs text-[var(--text-tertiary)] mb-1">이름</label>
            <input
              id="pm-name"
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="결제수단 이름"
              className="w-full px-3 py-2 border border-[var(--input-border)] rounded-xl text-sm focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
            />
          </div>

          <div>
            <label htmlFor="pm-type" className="block text-xs text-[var(--text-tertiary)] mb-1">유형</label>
            <select
              id="pm-type"
              value={formType}
              onChange={(e) => setFormType(e.target.value as PaymentMethodType)}
              className="w-full px-3 py-2 border border-[var(--input-border)] rounded-xl text-sm focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="pm-target" className="block text-xs text-[var(--text-tertiary)] mb-1">월 실적 목표 (선택)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] text-sm">₩</span>
              <input
                id="pm-target"
                type="number"
                value={formTarget}
                onChange={(e) => setFormTarget(e.target.value)}
                placeholder="0"
                min="0"
                className="w-full pl-7 pr-3 py-2 border border-[var(--input-border)] rounded-xl text-sm focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
              />
            </div>
          </div>

          <label htmlFor="pm-default" className="flex items-center gap-2 cursor-pointer select-none">
            <input
              id="pm-default"
              type="checkbox"
              checked={formDefault}
              onChange={(e) => setFormDefault(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--input-border)] text-grape-600 focus:ring-grape-500"
            />
            <span className="text-sm text-[var(--text-secondary)]">기본 결제수단으로 설정</span>
          </label>

          <div className="flex gap-3">
            <button
              onClick={() => { setShowForm(false); setFormName(''); setFormTarget(''); setFormDefault(false) }}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] bg-[var(--surface-hover)] rounded-xl hover:bg-[var(--surface-hover)] transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !formName.trim()}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-grape-600 rounded-xl hover:bg-grape-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-[var(--surface-card)] rounded-2xl p-4 animate-pulse">
              <div className="h-4 w-24 bg-warm-200 rounded mb-2" />
              <div className="h-3 w-16 bg-warm-200 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* 빈 상태 */}
      {!loading && methods.length === 0 && (
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-8 text-center">
          <CreditCard className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-sm font-medium text-[var(--text-secondary)]">등록된 결제수단이 없습니다</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">카드나 현금 등 결제수단을 추가하면 지출별로 태깅할 수 있습니다</p>
        </div>
      )}

      {/* 결제수단 목록 */}
      {!loading && methods.length > 0 && (
        <div className="space-y-3">
          {methods.map((method) => {
            const usage = usageMap.get(method.id)
            return (
              <div
                key={method.id}
                data-testid={`payment-method-${method.id}`}
                className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-4"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{method.name}</span>
                    <span className="text-xs text-[var(--text-muted)]">{TYPE_LABELS[method.type]}</span>
                    {method.is_default && (
                      <span className="text-xs px-1.5 py-0.5 bg-grape-100 text-grape-600 rounded-full font-medium">기본</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {!method.is_default && (
                      <button
                        onClick={() => handleSetDefault(method)}
                        aria-label="기본으로 설정"
                        className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors text-[var(--text-muted)] hover:text-grape-600"
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(method)}
                      aria-label="삭제"
                      className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors text-[var(--text-muted)] hover:text-rose-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 실적 프로그레스 바: monthly_target이 있는 경우만 */}
                {method.monthly_target && usage && (
                  <div className="mt-2" data-testid={`usage-bar-${method.id}`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-[var(--text-secondary)]">
                        {formatAmount(usage.spent_amount)} / {formatAmount(method.monthly_target)}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        잔여 {formatAmount(usage.remaining ?? 0)}
                      </span>
                    </div>
                    <div className="w-full bg-[var(--border-default)] rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          (usage.usage_percentage ?? 0) > 100
                            ? 'bg-red-500'
                            : (usage.usage_percentage ?? 0) >= 80
                              ? 'bg-amber-500'
                              : 'bg-grape-500'
                        }`}
                        style={{ width: `${Math.min(usage.usage_percentage ?? 0, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5 text-right">
                      {(usage.usage_percentage ?? 0).toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
