import { Lightbulb, Target, TrendingUp, Info } from 'lucide-react'
import type { StructuredInsights } from '../../types'

interface StructuredInsightsViewProps {
  insights: StructuredInsights
}

export default function StructuredInsightsView({ insights }: StructuredInsightsViewProps) {
  return (
    <div className="space-y-4">
      {/* 격려 메시지 */}
      {insights.encouragement && (
        <div className="bg-leaf-50 rounded-xl p-3 text-sm text-leaf-600">{insights.encouragement}</div>
      )}

      {/* 핵심 발견 */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
          <Lightbulb className="w-4 h-4 text-grape-500" />
          핵심 발견
        </h4>
        {insights.findings.map((f, i) => (
          <div key={i} className="bg-[var(--surface-elevated)] rounded-xl p-3 space-y-1.5">
            <p className="text-sm font-medium text-[var(--text-primary)]">{f.what}</p>
            <p className="text-xs text-[var(--text-secondary)]">{f.so_what}</p>
            <p className="text-xs text-grape-600 font-medium">→ {f.now_what}</p>
          </div>
        ))}
      </div>

      {/* 자산 분석 */}
      {insights.asset_analysis && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-grape-500" />
            자산 분석
          </h4>
          <div className="bg-[var(--surface-elevated)] rounded-xl p-3 space-y-1.5">
            <p className="text-sm font-medium text-[var(--text-primary)]">{insights.asset_analysis.summary}</p>
            <p className="text-xs text-[var(--text-secondary)]">{insights.asset_analysis.allocation_analysis}</p>
            <p className="text-xs text-[var(--text-tertiary)] italic">{insights.asset_analysis.diversification_tip}</p>
          </div>
        </div>
      )}

      {/* 액션 아이템 */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
          <Target className="w-4 h-4 text-grape-500" />
          이번 달 액션
        </h4>
        <div className="space-y-2">
          {insights.action_items.map((item, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="shrink-0 w-5 h-5 rounded-full bg-grape-100 text-grape-600 text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{item.title}</p>
                <p className="text-xs text-[var(--text-secondary)]">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 면책 조항 */}
      <div className="flex items-start gap-1.5 pt-2 border-t border-[var(--border-subtle)]">
        <Info className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 mt-0.5" />
        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
          이 정보는 일반적인 재무 정보이며, 개인 맞춤 투자 자문이 아닙니다. 투자 결정은 전문가와 상담하세요.
        </p>
      </div>
    </div>
  )
}
