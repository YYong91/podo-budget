/**
 * @file AdminPage.tsx
 * @description 관리자 대시보드 — 운영 중심 3탭 구조
 * 탭: 현황 | 피드백 | 사용자
 */

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { adminApi } from '../api/admin'

import AdminOverview from '../components/admin/AdminOverview'
import AdminFeedbackDashboard from '../components/admin/AdminFeedbackDashboard'
import AdminUserManager from '../components/admin/AdminUserManager'

import type { DashboardStats } from '../types'

const TABS = ['현황', '피드백', '사용자'] as const
type TabName = typeof TABS[number]

export default function AdminPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabName>('현황')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null)

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await adminApi.getDashboardStats()
      setDashboard(res.data)
    } catch {
      toast.error('데이터 로딩 실패')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!user?.is_admin) return
    loadData()
  }, [user?.is_admin, loadData])

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-grape-600" />
          <h1 className="text-xl font-bold text-warm-900">관리자 대시보드</h1>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="p-2 rounded-lg text-warm-500 hover:bg-warm-100 transition-colors disabled:opacity-50"
          title="새로고침"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex gap-1 bg-warm-100 rounded-lg p-1">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors flex-1 ${
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
      {activeTab === '현황' && dashboard && (
        <AdminOverview data={dashboard} onTabChange={(tab) => setActiveTab(tab as TabName)} />
      )}
      {activeTab === '피드백' && <AdminFeedbackDashboard />}
      {activeTab === '사용자' && <AdminUserManager />}
    </div>
  )
}
