/**
 * @file PaymentMethodManager.tsx
 * @description 결제수단 관리 페이지 (#305, #477)
 * 주 결제수단 드롭다운 + 일반/편집 모드 + 실적 넛지를 제공한다.
 */

import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, CreditCard, Plus, Trash2, Pencil, ChevronUp, ChevronDown } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { useGoBack } from '../hooks/useGoBack'
import { TOAST } from '../constants/toastMessages'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import { paymentMethodApi } from '../api/paymentMethods'
import { formatAmount } from '../utils/format'
import type { PaymentMethod, PaymentMethodUsage, PaymentMethodType } from '../types'
import { Skeleton } from '../components/skeleton/Skeleton'
import EmptyState from '../components/EmptyState'

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
  const goBack = useGoBack('/settings')
  const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)

  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [usageMap, setUsageMap] = useState<Map<number, PaymentMethodUsage>>(new Map())
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)

  // 추가 폼 상태
  const [showForm, setShowForm] = useState(false)
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState<PaymentMethodType>('credit_card')
  const [formTarget, setFormTarget] = useState('')
  const [showDetailSettings, setShowDetailSettings] = useState(false)
  const [saving, setSaving] = useState(false)

  // 삭제 확인 상태
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // 편집 폼 상태
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState<PaymentMethodType>('credit_card')
  const [editTarget, setEditTarget] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const fetchData = useCallback(async () => {
    if (!activeHouseholdId) return
    setLoading(true)
    try {
      const [methodsRes, usageRes] = await Promise.all([
        paymentMethodApi.getAll(activeHouseholdId),
        paymentMethodApi.getMonthlyUsage(getCurrentMonth(), activeHouseholdId),
      ])
      // display_order 기준 정렬
      const sorted = [...methodsRes.data].sort((a, b) => a.display_order - b.display_order)
      setMethods(sorted)
      const map = new Map<number, PaymentMethodUsage>()
      usageRes.data.forEach((u) => map.set(u.id, u))
      setUsageMap(map)
    } catch {
      addToast('error', TOAST.LOAD_FAILED)
    } finally {
      setLoading(false)
    }
  }, [activeHouseholdId, addToast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  /** 주 결제수단 드롭다운 변경 */
  const handlePrimaryChange = useCallback(async (newDefaultId: string) => {
    const currentDefault = methods.find((m) => m.is_default)

    // 현재 기본 해제
    if (currentDefault) {
      try {
        await paymentMethodApi.update(currentDefault.id, { is_default: false })
      } catch {
        addToast('error', TOAST.PAYMENT_CHANGE_FAILED)
        return
      }
    }

    // "없음" 선택
    if (!newDefaultId) {
      addToast('info', TOAST.PAYMENT_DEFAULT_UNSET)
      await fetchData()
      return
    }

    // 새 기본 설정
    const target = methods.find((m) => m.id === Number(newDefaultId))
    if (!target) return

    try {
      await paymentMethodApi.update(target.id, { is_default: true })
      addToast('success', TOAST.PAYMENT_DEFAULT_SET(target.name))
      await fetchData()
    } catch {
      addToast('error', TOAST.PAYMENT_CHANGE_FAILED)
    }
  }, [methods, fetchData, addToast])

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
        is_default: false,
      })
      addToast('success', TOAST.PAYMENT_ADDED)
      setShowForm(false)
      setFormName('')
      setFormType('credit_card')
      setFormTarget('')
      setShowDetailSettings(false)
      await fetchData()
    } catch {
      addToast('error', TOAST.SAVE_FAILED)
    } finally {
      setSaving(false)
    }
  }, [formName, formType, formTarget, fetchData, addToast])

  /** 결제수단 삭제 */
  const handleDelete = useCallback(async (method: PaymentMethod) => {
    try {
      await paymentMethodApi.delete(method.id)
      addToast('success', TOAST.PAYMENT_DELETED)
      await fetchData()
    } catch {
      addToast('error', TOAST.DELETE_FAILED)
    }
  }, [fetchData, addToast])

  /** 순서 변경 (위/아래) — 사용자 결제수단만 대상 */
  const handleReorder = useCallback(async (index: number, direction: 'up' | 'down') => {
    const userMethods = methods.filter((m) => !m.is_system)
    const systemMethods = methods.filter((m) => m.is_system)
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= userMethods.length) return

    ;[userMethods[index], userMethods[swapIndex]] = [userMethods[swapIndex], userMethods[index]]
    setMethods([...systemMethods, ...userMethods])

    try {
      await paymentMethodApi.reorder(userMethods.map((m) => m.id))
    } catch {
      addToast('error', TOAST.ORDER_CHANGE_FAILED)
      await fetchData()
    }
  }, [methods, fetchData, addToast])

  /** 편집 시작 */
  const handleStartEdit = useCallback((method: PaymentMethod) => {
    setEditingMethod(method)
    setEditName(method.name)
    setEditType(method.type)
    setEditTarget(method.monthly_target ? String(method.monthly_target) : '')
  }, [])

  /** 편집 저장 */
  const handleSaveEdit = useCallback(async () => {
    if (!editingMethod || !editName.trim()) return
    setEditSaving(true)
    try {
      await paymentMethodApi.update(editingMethod.id, {
        name: editName.trim(),
        type: editType,
        monthly_target: editTarget ? Number(editTarget) : null,
      })
      addToast('success', TOAST.PAYMENT_UPDATED)
      setEditingMethod(null)
      await fetchData()
    } catch {
      addToast('error', TOAST.SAVE_FAILED)
    } finally {
      setEditSaving(false)
    }
  }, [editingMethod, editName, editType, editTarget, fetchData, addToast])

  const defaultMethodId = methods.find((m) => m.is_default)?.id ?? ''

  return (
    <div className="space-y-4 max-w-2xl">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => goBack()}
            aria-label="뒤로가기"
            className="p-2.5 -ml-2.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-grape-500" />
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">결제수단</h1>
          </div>
        </div>
        {!loading && methods.length > 0 && (
          <button
            onClick={() => setEditMode(!editMode)}
            className="text-sm font-medium text-grape-600 hover:text-grape-700 transition-colors"
          >
            {editMode ? '완료' : '편집'}
          </button>
        )}
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-[var(--surface-card)] rounded-2xl p-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 빈 상태 */}
      {!loading && methods.length === 0 && (
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60">
          <EmptyState
            variant="section"
            title="등록된 결제수단이 없습니다"
            description="결제수단을 추가하면 지출 입력 시 태깅할 수 있어요"
            action={{ label: '결제수단 추가', onClick: () => setShowForm(true) }}
          />
        </div>
      )}

      {/* 주 결제수단 + 목록 */}
      {!loading && methods.length > 0 && !editMode && (
        <div className="space-y-4">
          {/* 주 결제수단 드롭다운 */}
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60 p-5">
            <label htmlFor="primary-payment" className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
              주 결제수단
            </label>
            <select
              id="primary-payment"
              value={defaultMethodId}
              onChange={(e) => handlePrimaryChange(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--input-border)] rounded-xl text-sm focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
            >
              <option value="">없음</option>
              {methods.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            {defaultMethodId && (
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                입력 시 자동으로 이 결제수단이 선택돼요
              </p>
            )}
          </div>

          {/* 내 결제수단 목록 — 일반 모드 */}
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">내 결제수단</h2>
            <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60 overflow-hidden">
              <div className="divide-y divide-[var(--border-subtle)]">
                {methods.map((method) => {
                  const usage = usageMap.get(method.id)
                  const hasTarget = method.monthly_target && method.monthly_target > 0
                  const remaining = hasTarget && usage ? method.monthly_target! - usage.spent_amount : null
                  const isAchieved = hasTarget && usage && (usage.usage_percentage ?? 0) >= 100

                  return (
                    <div
                      key={method.id}
                      data-testid={`payment-method-${method.id}`}
                      className="p-4"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[var(--text-primary)]">{method.name}</span>
                          <span className="text-xs text-[var(--text-muted)]">{TYPE_LABELS[method.type]}</span>
                          {method.is_system && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--surface-elevated)] text-[var(--text-muted)]">기본</span>
                          )}
                        </div>
                      </div>

                      {/* 실적 프로그레스 바: monthly_target이 있는 경우만 */}
                      {hasTarget && usage && (
                        <div className="mt-2" data-testid={`usage-bar-${method.id}`}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs text-[var(--text-secondary)] tabular-nums">
                              {formatAmount(usage.spent_amount)} / {formatAmount(method.monthly_target!)}
                            </span>
                            <span className={`text-xs tabular-nums ${isAchieved ? 'text-leaf-600 font-medium' : 'text-[var(--text-muted)]'}`}>
                              {isAchieved ? '실적 달성' : `잔여 ${formatAmount(usage.remaining ?? 0)}`}
                            </span>
                          </div>
                          <div className="w-full bg-[var(--border-default)] rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full transition-all ${
                                isAchieved
                                  ? 'bg-leaf-500'
                                  : (usage.usage_percentage ?? 0) >= 80
                                    ? 'bg-grape-500'
                                    : 'bg-grape-400'
                              }`}
                              style={{ width: `${Math.min(usage.usage_percentage ?? 0, 100)}%` }}
                            />
                          </div>
                          {/* 실적 넛지 */}
                          {!isAchieved && remaining !== null && remaining > 0 && (
                            <p className="text-xs text-grape-600 mt-1 tabular-nums" data-testid={`nudge-${method.id}`}>
                              실적까지 {formatAmount(remaining)} 남음
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 편집 모드 */}
      {!loading && methods.length > 0 && editMode && (
        <div className="space-y-3">
          {methods.filter((m) => !m.is_system).map((method, index) => (
            <div
              key={method.id}
              data-testid={`payment-method-${method.id}`}
              className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60 overflow-hidden"
            >
              <div className="p-4">
                {/* 편집 중인 항목 */}
                {editingMethod?.id === method.id ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 border border-[var(--input-border)] rounded-xl text-sm focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                      placeholder="결제수단 이름"
                    />
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value as PaymentMethodType)}
                      className="w-full px-3 py-2 border border-[var(--input-border)] rounded-xl text-sm"
                    >
                      {TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] text-sm">₩</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={editTarget}
                        onChange={(e) => setEditTarget(e.target.value)}
                        placeholder="월 실적 목표 (선택)"
                        min="0"
                        className="w-full pl-7 pr-3 py-2 border border-[var(--input-border)] rounded-xl text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingMethod(null)}
                        className="flex-1 px-3 py-2 text-sm text-[var(--text-secondary)] bg-[var(--surface-hover)] rounded-xl"
                      >
                        취소
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        disabled={editSaving || !editName.trim()}
                        className="flex-1 px-3 py-2 text-sm font-medium text-white bg-grape-600 rounded-xl hover:bg-grape-700 disabled:opacity-50"
                      >
                        {editSaving ? '저장 중...' : '저장'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {/* 순서 변경 버튼 */}
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => handleReorder(index, 'up')}
                          disabled={index === 0}
                          aria-label="위로"
                          className="p-0.5 rounded hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-30"
                        >
                          <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
                        </button>
                        <button
                          onClick={() => handleReorder(index, 'down')}
                          disabled={index === methods.filter((m) => !m.is_system).length - 1}
                          aria-label="아래로"
                          className="p-0.5 rounded hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-30"
                        >
                          <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold text-[var(--text-primary)]">{method.name}</span>
                      <span className="text-xs text-[var(--text-muted)]">{TYPE_LABELS[method.type]}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleStartEdit(method)}
                        aria-label="편집"
                        className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors text-[var(--text-muted)] hover:text-grape-600"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingId(method.id)}
                        aria-label="삭제"
                        className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors text-[var(--text-muted)] hover:text-rose-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {/* 삭제 인라인 확인 */}
              {deletingId === method.id && (
                <div className="px-4 py-2.5 bg-rose-500/5 flex items-center justify-between border-t border-rose-200/50">
                  <p className="text-sm text-[var(--text-secondary)]">'{method.name}'을 삭제할까요?</p>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => setDeletingId(null)}
                      className="px-3 py-1.5 text-xs rounded-lg bg-[var(--surface-hover)] text-[var(--text-secondary)]"
                    >
                      취소
                    </button>
                    <button
                      onClick={async () => { await handleDelete(method); setDeletingId(null) }}
                      className="px-3 py-1.5 text-xs rounded-lg bg-rose-500 text-white font-medium"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 추가 폼 */}
      {showForm && (
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">새 결제수단</h2>

          <div>
            <label htmlFor="pm-name" className="block text-xs text-[var(--text-tertiary)] mb-1">이름 <span className="text-rose-500">*</span></label>
            <input
              id="pm-name"
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="결제수단 이름"
              className="w-full px-3 py-2 border border-[var(--input-border)] rounded-xl text-sm focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
            />
          </div>

          {/* 상세 설정 (접힘) */}
          <button
            type="button"
            onClick={() => setShowDetailSettings(!showDetailSettings)}
            className="text-sm text-grape-600 hover:text-grape-700 font-medium"
          >
            {showDetailSettings ? '상세 설정 접기' : '상세 설정'}
          </button>

          {showDetailSettings && (
            <>
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
                <label htmlFor="pm-target" className="block text-xs text-[var(--text-tertiary)] mb-1">월 실적 목표</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] text-sm">₩</span>
                  <input
                    id="pm-target"
                    type="number"
                    inputMode="numeric"
                    value={formTarget}
                    onChange={(e) => setFormTarget(e.target.value)}
                    placeholder="0"
                    min="0"
                    className="w-full pl-7 pr-3 py-2 border border-[var(--input-border)] rounded-xl text-sm focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => { setShowForm(false); setFormName(''); setFormTarget(''); setShowDetailSettings(false) }}
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

      {/* 추가 버튼 (하단) */}
      {!loading && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-grape-600 bg-[var(--surface-card)] border border-dashed border-grape-300 rounded-2xl hover:bg-[var(--surface-hover)] transition-colors"
        >
          <Plus className="w-4 h-4" />
          결제수단 추가
        </button>
      )}
    </div>
  )
}
