/* 결산 리포트 자격 미달 시 표시되는 빈 상태 컴포넌트 */
import { useNavigate } from 'react-router-dom'
import type { ReportEligibility, ReportBlocker } from '../../types/report'

interface Props {
  eligibility: ReportEligibility | null
}

type BlockerContent = {
  title: string
  description: string
  ctaLabel: string | null
  ctaPath: string | null
}

/** blocker 유형별 안내 문구 매핑 */
function resolveContent(eligibility: ReportEligibility | null): BlockerContent {
  if (!eligibility) {
    return {
      title: '결산 리포트를 준비 중이에요',
      description: '매달 1일에 지난 달 결산 리포트가 자동으로 도착해요.',
      ctaLabel: null,
      ctaPath: null,
    }
  }

  const blocker: ReportBlocker = eligibility.blocker

  switch (blocker) {
    case 'profile_missing':
      return {
        title: '가구 프로필을 완성해주세요',
        description: '프로필을 완성하면 개인화된 결산 리포트를 다음 달 1일에 받아보실 수 있어요.',
        ctaLabel: '프로필 완성하기',
        ctaPath: '/settings',
      }
    case 'transactions_short':
      return {
        title: '다음 달부터 결산 리포트를 받아보세요',
        description: `이번 달 거래를 15건 이상 입력하시면 다음 달 1일에 결산 리포트가 도착해요. (현재 ${eligibility.transaction_count}건)`,
        ctaLabel: '거래 입력하기',
        ctaPath: '/home',
      }
    case 'first_month':
      return {
        title: '첫 결산 리포트가 준비 중이에요',
        description: '다음 달 1일에 첫 결산 리포트가 도착해요. 그동안 거래를 입력해주세요.',
        ctaLabel: '거래 입력하기',
        ctaPath: '/home',
      }
    case 'categories_short':
    case 'spend_short':
    default:
      return {
        title: '이번 달은 결산 리포트가 없어요',
        description: '거래를 꾸준히 입력하시면 다음 달부터 결산 리포트를 받아보실 수 있어요.',
        ctaLabel: null,
        ctaPath: null,
      }
  }
}

export default function ReportEmptyState({ eligibility }: Props) {
  const navigate = useNavigate()
  const { title, description, ctaLabel, ctaPath } = resolveContent(eligibility)

  return (
    <div className="flex flex-col items-center gap-4 py-8 px-4 text-center">
      <span className="text-4xl">📬</span>
      <div className="space-y-1.5">
        <p className="font-semibold text-[var(--text-primary)]">{title}</p>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{description}</p>
      </div>
      {ctaLabel && ctaPath && (
        <button
          onClick={() => navigate(ctaPath)}
          className="mt-2 text-sm text-grape-600 font-medium underline underline-offset-2"
        >
          {ctaLabel} →
        </button>
      )}
    </div>
  )
}
