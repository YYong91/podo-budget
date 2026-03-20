/* Admin 현황 대시보드 — 헬스 카드 + 최근 활동 피드 + 이탈 감지 */

import { Users, Activity, MessageSquare, Home, AlertTriangle, ExternalLink } from 'lucide-react'
import type { DashboardStats } from '../../types'

interface Props {
  data: DashboardStats
  onTabChange?: (tab: string) => void
}

function StatCard({ icon: Icon, label, value, sub, onClick }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  sub?: string
  onClick?: () => void
}) {
  return (
    <div
      className={`bg-[var(--surface-card)] rounded-xl p-4 border border-[var(--border-default)] ${onClick ? 'cursor-pointer hover:border-grape-300 transition-colors' : ''}`}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
    >
      <div className="flex items-center gap-2 text-[var(--text-tertiary)] mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold text-[var(--text-primary)]">{value}</div>
      {sub && <div className="text-xs text-[var(--text-tertiary)] mt-1">{sub}</div>}
    </div>
  )
}

const ACTIVITY_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  expense: { label: '지출', color: 'bg-red-100 text-red-600' },
  income: { label: '수입', color: 'bg-green-100 text-green-600' },
  signup: { label: '가입', color: 'bg-grape-100 text-grape-600' },
  feedback: { label: '피드백', color: 'bg-yellow-100 text-yellow-600' },
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return '방금'
  if (diffMin < 60) return `${diffMin}분 전`
  if (diffHour < 24) return `${diffHour}시간 전`
  if (diffDay < 7) return `${diffDay}일 전`
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원'
}

function getInactiveColor(days: number): string {
  if (days >= 30) return 'text-red-600'
  if (days >= 14) return 'text-orange-500'
  return 'text-yellow-600'
}

function getInactiveBg(days: number): string {
  if (days >= 30) return 'bg-red-50'
  if (days >= 14) return 'bg-orange-50'
  return 'bg-yellow-50'
}

export default function AdminOverview({ data, onTabChange }: Props) {
  return (
    <div className="space-y-6">
      {/* 헬스 카드 */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={Users}
          label="총 사용자"
          value={data.total_users}
          sub={`활성 ${data.active_users}명`}
        />
        <StatCard
          icon={Activity}
          label="오늘 활동"
          value={`${data.today_active_users}명`}
          sub={`거래 ${data.today_transaction_count}건`}
        />
        <StatCard
          icon={MessageSquare}
          label="미처리 피드백"
          value={data.pending_feedback_count}
          sub={data.pending_feedback_count > 0 ? '확인하기 →' : '없음'}
          onClick={data.pending_feedback_count > 0 ? () => onTabChange?.('피드백') : undefined}
        />
        <StatCard
          icon={Home}
          label="서비스"
          value={`${data.total_households}가구`}
          sub={`텔레그램 ${data.telegram_linked_count}명`}
        />
      </div>

      {/* Anthropic Console 바로가기 */}
      <a
        href="https://console.anthropic.com/settings/billing"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between bg-[var(--surface-card)] rounded-xl p-4 border border-[var(--border-default)] hover:border-grape-300 transition-colors"
      >
        <div>
          <div className="text-sm font-semibold text-[var(--text-primary)]">Anthropic Console</div>
          <div className="text-xs text-[var(--text-tertiary)] mt-0.5">잔액 확인 · 자동 충전 설정 · 사용량 조회</div>
        </div>
        <ExternalLink className="w-4 h-4 text-[var(--text-muted)]" />
      </a>

      {/* 최근 활동 피드 */}
      <div className="bg-[var(--surface-card)] rounded-xl border border-[var(--border-default)]">
        <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)]">최근 활동</h3>
        </div>
        {data.recent_activity.length === 0 ? (
          <div className="px-4 py-8 text-center text-[var(--text-muted)] text-sm">
            아직 활동이 없습니다
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)]">
            {data.recent_activity.map((activity, i) => {
              const meta = ACTIVITY_TYPE_LABELS[activity.type] ?? { label: activity.type, color: 'bg-[var(--surface-hover)] text-[var(--text-secondary)]' }
              return (
                <div key={`${activity.type}-${activity.created_at}-${i}`} className="px-4 py-3 flex items-start gap-3">
                  <span className={`${meta.color} text-[10px] font-medium px-1.5 py-0.5 rounded-md shrink-0 mt-0.5`}>
                    {meta.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[var(--text-primary)]">
                      <span className="font-medium">{activity.username}</span>
                      {' '}
                      <span className="text-[var(--text-secondary)]">
                        {activity.description}
                        {activity.amount != null && (
                          <> · <span className={activity.type === 'income' ? 'text-green-600' : 'text-red-500'}>{formatAmount(activity.amount)}</span></>
                        )}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)] shrink-0">
                    {formatRelativeTime(activity.created_at)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 이탈 감지 */}
      {data.inactive_users.length > 0 && (
        <div className="bg-[var(--surface-card)] rounded-xl border border-[var(--border-default)]">
          <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-semibold text-[var(--text-secondary)]">이탈 감지</h3>
            <span className="text-xs text-[var(--text-muted)]">7일 이상 비활동</span>
          </div>
          <div className="divide-y divide-[var(--border-subtle)]">
            {data.inactive_users.map(user => (
              <div key={user.id} className={`px-4 py-3 flex items-center justify-between ${getInactiveBg(user.days_inactive)}`}>
                <div>
                  <span className="text-sm font-medium text-[var(--text-primary)]">{user.username}</span>
                  {user.last_activity_at && (
                    <span className="text-xs text-[var(--text-muted)] ml-2">
                      마지막: {new Date(user.last_activity_at).toLocaleDateString('ko-KR')}
                    </span>
                  )}
                </div>
                <span className={`text-xs font-semibold ${getInactiveColor(user.days_inactive)}`}>
                  {user.days_inactive >= 9999 ? '활동 없음' : `${user.days_inactive}일`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
