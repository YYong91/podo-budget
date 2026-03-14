/* Admin 개요 — 사용자 현황 요약 카드 */

import { Users, UserPlus, Activity, MessageCircle } from 'lucide-react'
import type { OverviewStats } from '../../types'

interface Props {
  data: OverviewStats
}

function StatCard({ icon: Icon, label, value, sub }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <div className="bg-white rounded-xl p-4 border border-warm-200">
      <div className="flex items-center gap-2 text-warm-500 mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold text-warm-900">{value}</div>
      {sub && <div className="text-xs text-warm-500 mt-1">{sub}</div>}
    </div>
  )
}

export default function AdminOverview({ data }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Users} label="총 사용자" value={data.total_users} sub={`활성 ${data.active_users}명`} />
        <StatCard icon={Activity} label="DAU / MAU" value={`${data.dau} / ${data.mau}`}
          sub={data.retention_rate !== null ? `리텐션 ${data.retention_rate}%` : undefined} />
        <StatCard icon={UserPlus} label="신규 가입" value={data.new_signups_month}
          sub={`오늘 ${data.new_signups_today} / 이번주 ${data.new_signups_week}`} />
        <StatCard icon={MessageCircle} label="텔레그램 연동" value={data.telegram_linked_count}
          sub={data.total_users > 0 ? `${Math.round(data.telegram_linked_count / data.total_users * 100)}%` : undefined} />
      </div>
    </div>
  )
}
