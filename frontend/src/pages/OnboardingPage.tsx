/**
 * @file OnboardingPage.tsx
 * @description 온보딩 페이지 — 가계부가 없는 사용자가 첫 가계부를 생성하는 페이지
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import { onboardingApi } from '../api/onboarding'
import { useHouseholdStore } from '../stores/useHouseholdStore'

export default function OnboardingPage() {
  const navigate = useNavigate()
  const fetchHouseholds = useHouseholdStore((s) => s.fetchHouseholds)

  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    setLoading(true)
    try {
      await onboardingApi.createHousehold(name.trim() || undefined)
      await fetchHouseholds()
      toast.success('가계부가 생성되었습니다!')
      navigate('/', { replace: true })
    } catch {
      toast.error('가계부 생성에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--surface)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* 아이콘 + 제목 */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-grape-900 dark:text-grape-200">포도가계부 시작하기</h1>
          <p className="text-sm text-[var(--text-tertiary)]">
            나만의 가계부를 만들어보세요
          </p>
        </div>

        {/* 가계부 이름 입력 */}
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              가계부 이름
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="가계부 이름 (비워두면 기본 이름)"
              className="w-full border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--text-primary)] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/40 focus:border-grape-400"
              disabled={loading}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
            />
          </div>

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full py-3 bg-grape-600 text-white rounded-lg text-sm font-medium hover:bg-grape-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            새 가계부 만들기
          </button>
        </div>

        {/* 안내 텍스트 */}
        <p className="text-xs text-[var(--text-muted)] text-center">
          초대받은 가계부가 있다면, 생성 후 설정에서 참여할 수 있습니다.
        </p>
      </div>
    </div>
  )
}
