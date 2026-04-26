/* 결산 리포트 본문 컴포넌트 — 완성된 리포트의 findings, action_items 렌더링 */

import { Lightbulb, Target } from 'lucide-react'
import type { StructuredInsights } from '../../types'

type Props = {
  insights: StructuredInsights
  month: string
  completedAt: string | null
}

export default function ReportContent({ insights, month, completedAt }: Props) {
  const [year, m] = month.split('-')
  const monthLabel = `${year}년 ${parseInt(m)}월호`
  const dateLabel = completedAt
    ? new Date(completedAt).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
    : ''

  return (
    <article className="max-w-[640px] mx-auto px-4 pb-16 space-y-12">
      {/* 표지 헤더 */}
      <header className="pt-6 space-y-3">
        <p className="text-xs text-[var(--text-muted)] font-medium tracking-wider uppercase">
          {monthLabel}
        </p>
        {insights.findings[0] && (
          <h1 className="text-3xl font-bold text-[var(--text-primary)] leading-snug">
            {insights.findings[0].what}
          </h1>
        )}
        {dateLabel && (
          <p className="text-sm text-[var(--text-tertiary)]">📬 {dateLabel}에 도착</p>
        )}
        <div className="h-px bg-gradient-to-r from-grape-300 to-transparent" />
      </header>

      {/* 격려 메시지 */}
      {insights.encouragement && (
        <blockquote className="border-l-4 border-grape-400 pl-4">
          <p className="text-lg text-[var(--text-secondary)] leading-relaxed italic">
            {insights.encouragement}
          </p>
        </blockquote>
      )}

      {/* 핵심 발견 */}
      <section className="space-y-8">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
          <Lightbulb className="w-4 h-4 text-grape-500" />
          핵심 발견
        </h2>
        {insights.findings.map((f, i) => (
          <div key={i} className="space-y-3">
            <h3 className="text-xl font-semibold text-[var(--text-primary)] leading-snug">
              {i + 1}. {f.what}
            </h3>
            <p className="text-base text-[var(--text-secondary)] leading-relaxed">
              {f.so_what}
            </p>
            <div className="bg-leaf-50 rounded-xl p-4">
              <p className="text-sm text-leaf-700 font-medium">
                → {f.now_what}
              </p>
            </div>
          </div>
        ))}
      </section>

      {/* 이번 달 액션 */}
      {insights.action_items.length > 0 && (
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
            <Target className="w-4 h-4 text-grape-500" />
            이번 달 액션
          </h2>
          <div className="space-y-3">
            {insights.action_items.map((item, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="shrink-0 w-6 h-6 rounded-full bg-grape-100 text-grape-600 text-sm font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <p className="text-base font-semibold text-[var(--text-primary)]">{item.title}</p>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed mt-0.5">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 일반 정보 고지 */}
      <p className="text-xs text-[var(--text-muted)] leading-relaxed border-t border-[var(--border-subtle)] pt-4">
        ⓘ 이 정보는 일반적인 재무 정보이며, 개인 맞춤 투자 자문이 아닙니다.
      </p>
    </article>
  )
}
