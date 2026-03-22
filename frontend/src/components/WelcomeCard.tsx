/**
 * @file WelcomeCard.tsx
 * @description 온보딩 단계별 안내 카드 — 홈화면 상단에 표시
 *
 * 한 번에 하나의 다음 행동만 안내하여 사용자 부담을 최소화한다.
 * - 1단계: 첫 거래 입력 유도 (핵심 가치 체험)
 * - 2단계: 리포트 확인 유도 (데이터 활용 체험)
 * - 3단계: 봇 연동 안내 (편의 기능, 3건 이상 입력 후)
 * 모든 단계 완료 or 닫기 → localStorage에 저장하여 재표시 방지
 */

import { useNavigate } from 'react-router-dom'
import { X, ChevronRight, PenLine, TrendingUp, MessageCircle } from 'lucide-react'

interface WelcomeCardProps {
  /** 거래 건수 (limit 3 샘플 — 0/1~2/3+ 단계 판정용) */
  transactionCount: number
  /** 텔레그램 or 카카오 연동 여부 */
  isBotLinked: boolean
  /** 닫기 클릭 */
  onDismiss: () => void
}

interface Step {
  icon: React.ReactNode
  title: string
  description: string
  action: () => void
  actionLabel: string
}

export default function WelcomeCard({
  transactionCount,
  isBotLinked,
  onDismiss,
}: WelcomeCardProps) {
  const navigate = useNavigate()

  // 현재 표시할 단계 결정
  const currentStep = getCurrentStep({ transactionCount, isBotLinked }, navigate)

  // 모든 단계 완료 → 렌더링 안 함 (부모에서도 체크하지만 방어적)
  if (!currentStep) return null

  return (
    <div className="bg-gradient-to-r from-grape-50 to-grape-50/50 rounded-2xl shadow-sm border border-grape-200/60 overflow-hidden">
      <div className="px-4 py-4">
        {/* 헤더 */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <span className="text-xs font-medium text-grape-500">시작 가이드</span>
            <h3 className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
              {currentStep.title}
            </h3>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 -mr-1 rounded-lg hover:bg-grape-100 text-[var(--text-muted)] transition-colors"
            aria-label="시작 가이드 닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 설명 */}
        <p className="text-xs text-[var(--text-tertiary)] mb-3">
          {currentStep.description}
        </p>

        {/* CTA 버튼 */}
        <button
          onClick={currentStep.action}
          className="flex items-center gap-1.5 px-4 py-2 bg-grape-600 text-white text-sm font-medium rounded-xl hover:bg-grape-700 active:scale-[0.98] transition-all shadow-sm shadow-grape-200"
        >
          {currentStep.icon}
          {currentStep.actionLabel}
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

/** 현재 표시할 단계를 결정 — null이면 모든 단계 완료 */
function getCurrentStep(
  state: { transactionCount: number; isBotLinked: boolean },
  navigate: ReturnType<typeof useNavigate>,
): Step | null {
  // 1단계: 첫 거래 입력
  if (state.transactionCount === 0) {
    return {
      icon: <PenLine className="w-4 h-4" />,
      title: '첫 거래를 입력해보세요',
      description: '"점심 김치찌개 8000원" 처럼 자연어로 입력하면 AI가 자동 분류해요',
      actionLabel: '거래 입력하기',
      action: () => navigate('/expenses/new'),
    }
  }

  // 2단계: 리포트 확인 (첫 거래 입력 후)
  if (state.transactionCount < 3) {
    return {
      icon: <TrendingUp className="w-4 h-4" />,
      title: '내 지출 리포트를 확인해보세요',
      description: '거래를 입력할수록 더 정확한 분석을 볼 수 있어요',
      actionLabel: '리포트 보기',
      action: () => navigate('/insights'),
    }
  }

  // 3단계: 봇 연동 (3건 이상 입력 후)
  if (!state.isBotLinked) {
    return {
      icon: <MessageCircle className="w-4 h-4" />,
      title: '카카오톡에서도 입력할 수 있어요',
      description: '봇을 연동하면 메신저에서 바로 가계부를 쓸 수 있어요',
      actionLabel: '연동하기',
      action: () => navigate('/settings/my-account'),
    }
  }

  // 모든 단계 완료
  return null
}
