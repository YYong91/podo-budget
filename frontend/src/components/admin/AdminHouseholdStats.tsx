/* Admin 가구 통계 — 가구 수, 멤버 분포, 초대 현황 */

import { Home, UserPlus, Mail } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { HouseholdStats } from '../../types'

interface Props {
  data: HouseholdStats
}

export default function AdminHouseholdStats({ data }: Props) {
  const distData = Object.entries(data.member_distribution)
    .map(([members, count]) => ({ members: `${members}명`, count }))
    .sort((a, b) => parseInt(a.members) - parseInt(b.members))

  const inv = data.invitation_stats
  const acceptRate = inv.total > 0
    ? Math.round(inv.accepted / inv.total * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-4 border border-warm-200">
          <div className="flex items-center gap-2 text-warm-500 mb-1">
            <Home className="w-4 h-4" />
            <span className="text-xs font-medium">총 가구</span>
          </div>
          <div className="text-2xl font-bold text-warm-900">{data.total_households}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-warm-200">
          <div className="flex items-center gap-2 text-warm-500 mb-1">
            <UserPlus className="w-4 h-4" />
            <span className="text-xs font-medium">총 멤버</span>
          </div>
          <div className="text-2xl font-bold text-warm-900">{data.total_members}</div>
          <div className="text-xs text-warm-400">
            평균 {data.total_households > 0 ? (data.total_members / data.total_households).toFixed(1) : 0}명/가구
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-warm-200">
          <div className="flex items-center gap-2 text-warm-500 mb-1">
            <Mail className="w-4 h-4" />
            <span className="text-xs font-medium">초대</span>
          </div>
          <div className="text-2xl font-bold text-warm-900">{inv.total}</div>
          <div className="text-xs text-warm-400">
            수락률 {acceptRate}% · 대기 {inv.pending}
          </div>
        </div>
      </div>

      {/* 멤버 분포 차트 */}
      {distData.length > 0 && (
        <div className="bg-white rounded-xl p-4 border border-warm-200">
          <h3 className="text-sm font-semibold text-warm-700 mb-3">멤버 수별 가구 분포</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={distData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ebe3" />
              <XAxis dataKey="members" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" name="가구 수" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
