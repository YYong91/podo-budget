/* 계좌 관리 페이지 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Wallet, Trash2, ArrowLeft } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { accountApi } from '../api/accounts'
import { useHouseholdStore } from '../stores/useHouseholdStore'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import type { Account, AccountType, CreateAccountParams } from '../types'

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  brokerage: '증권',
  bank: '은행',
  crypto_exchange: '거래소',
  other: '기타',
}

export default function AccountManager() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<CreateAccountParams>({ name: '', type: 'brokerage' })
  const { addToast } = useToast()
  const { activeHouseholdId } = useHouseholdStore()

  function loadAccounts() {
    if (!activeHouseholdId) return  // null 안전 처리 (#200)
    setError(false)
    accountApi.getAll(activeHouseholdId)
      .then(res => setAccounts(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    setLoading(true)
    loadAccounts()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHouseholdId])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      addToast('error', '계좌명을 입력해주세요')
      return
    }
    setSaving(true)
    try {
      await accountApi.create(form)
      addToast('success', '계좌가 등록되었습니다')
      setForm({ name: '', type: 'brokerage' })
      setShowForm(false)
      loadAccounts()
    } catch {
      addToast('error', '저장 중 오류가 발생했습니다')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    try {
      await accountApi.delete(id)
      setAccounts(prev => prev.filter(a => a.id !== id))
      addToast('success', '계좌가 삭제되었습니다')
    } catch {
      addToast('error', '삭제 중 오류가 발생했습니다')
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/assets" aria-label="뒤로가기" className="p-2 -ml-2 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-tertiary)]">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 bg-grape-600 text-white rounded-lg text-sm font-medium hover:bg-grape-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          계좌 추가
        </button>
      </div>

      {/* 추가 폼 */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)]/60 shadow-sm p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)]">새 계좌</h2>
          <div>
            <label htmlFor="account-type" className="block text-xs font-medium text-[var(--text-secondary)] mb-1">계좌 유형</label>
            <select
              id="account-type"
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value as AccountType }))}
              className="w-full border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-grape-300"
            >
              {(Object.entries(ACCOUNT_TYPE_LABELS) as [AccountType, string][]).map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="account-name" className="block text-xs font-medium text-[var(--text-secondary)] mb-1">계좌명</label>
            <input
              id="account-name"
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="예) 키움증권, KB국민은행, 업비트"
              className="w-full border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-grape-300"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 py-2 border border-[var(--border-default)] text-[var(--text-secondary)] rounded-lg text-sm font-medium hover:bg-[var(--surface-hover)] transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 bg-grape-600 text-white rounded-lg text-sm font-medium hover:bg-grape-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
            >
              {saving && <div className="animate-spin rounded-full border-b-2 border-current w-3.5 h-3.5" />}
              저장
            </button>
          </div>
        </form>
      )}

      {/* 계좌 목록 */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full border-b-2 border-grape-600 w-6 h-6" />
        </div>
      ) : error ? (
        <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)]/60 shadow-sm">
          <ErrorState onRetry={loadAccounts} />
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)]/60 shadow-sm">
          <EmptyState
            icon={<Wallet className="w-8 h-8 text-grape-400" />}
            title="등록된 계좌가 없습니다"
            description="계좌를 등록하면 자산을 계좌별로 관리할 수 있습니다"
            action={{ label: '계좌 추가하기', onClick: () => setShowForm(true) }}
          />
        </div>
      ) : (
        <div className="bg-[var(--surface-card)] rounded-2xl border border-[var(--border-default)]/60 shadow-sm overflow-hidden">
          {accounts.map((account, i) => (
            <div
              key={account.id}
              className={`flex items-center justify-between px-5 py-4 ${i < accounts.length - 1 ? 'border-b border-[var(--border-subtle)]' : ''}`}
            >
              <div className="flex items-center gap-3">
                <Wallet className="w-4 h-4 text-grape-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{account.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">{ACCOUNT_TYPE_LABELS[account.type] ?? account.type}</p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(account.id)}
                className="p-2 text-warm-300 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
