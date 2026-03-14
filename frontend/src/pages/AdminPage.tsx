/**
 * @file AdminPage.tsx
 * @description 관리자 대시보드 — 탭 기반 단일 페이지
 * 탭: 개요 | 거래 | 가구 | 피드백 | 사용자 관리
 */

import { useEffect, useState } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { adminApi } from '../api/admin'

import AdminOverview from '../components/admin/AdminOverview'
import AdminTransactionStats from '../components/admin/AdminTransactionStats'
import AdminHouseholdStats from '../components/admin/AdminHouseholdStats'
import AdminFeedbackDashboard from '../components/admin/AdminFeedbackDashboard'
import AdminUserManager from '../components/admin/AdminUserManager'

import type {
  OverviewStats,
  TransactionStats,
  HouseholdStats,
  FeedbackStats,
} from '../types'

const TABS = ['개요', '거래', '가구', '피드백', '사용자'] as const
type TabName = typeof TABS[number]

export default function AdminPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabName>('개요')
  const [loading, setLoading] = useState(true)

  const [overview, setOverview] = useState<OverviewStats | null>(null)
  const [transactions, setTransactions] = useState<TransactionStats | null>(null)
  const [households, setHouseholds] = useState<HouseholdStats | null>(null)
  const [feedback, setFeedback] = useState<FeedbackStats | null>(null)

  useEffect(() => {
    if (!user?.is_admin) return

    let active = true
    Promise.allSettled([
      adminApi.getOverviewStats(),
      adminApi.getTransactionStats(30),
      adminApi.getHouseholdStats(),
      adminApi.getFeedbackStats(),
    ]).then(([ov, tx, hh, fb]) => {
      if (!active) return
      if (ov.status === 'fulfilled') setOverview(ov.value.data)
      if (tx.status === 'fulfilled') setTransactions(tx.value.data)
      if (hh.status === 'fulfilled') setHouseholds(hh.value.data)
      if (fb.status === 'fulfilled') setFeedback(fb.value.data)
    }).catch(() => {
      if (active) toast.error('데이터 로딩 실패')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [user?.is_admin])

  // 비관리자 접근 방지
  if (!user?.is_admin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-warm-400">
        <ShieldCheck className="w-12 h-12 mb-3" />
        <p>관리자만 접근할 수 있습니다</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-grape-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-6 h-6 text-grape-600" />
        <h1 className="text-xl font-bold text-warm-900">관리자 대시보드</h1>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex gap-1 bg-warm-100 rounded-lg p-1 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab
                ? 'bg-white text-grape-700 shadow-sm'
                : 'text-warm-500 hover:text-warm-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === '개요' && overview && <AdminOverview data={overview} />}
      {activeTab === '거래' && transactions && <AdminTransactionStats data={transactions} />}
      {activeTab === '가구' && households && <AdminHouseholdStats data={households} />}
      {activeTab === '피드백' && feedback && <AdminFeedbackDashboard data={feedback} />}
      {activeTab === '사용자' && <AdminUserManager />}
    </div>
  )
}
