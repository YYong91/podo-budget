/**
 * @file ProfileEditSection.tsx
 * @description 설정 페이지 > AI 분석 설정 섹션
 * 현재 저장된 가구 프로필을 요약 표시하고, 수정 버튼으로 ProfileCollectionFlow를 트리거한다.
 */

import type { HouseholdProfile } from '../../types'

/* 각 필드의 한국어 레이블 매핑 */
const PROFILE_LABELS = {
  householdType: {
    single: '1인 가구',
    dual_income: '맞벌이',
    single_income: '외벌이',
    retired: '은퇴/연금',
  },
  housingType: {
    own_no_loan: '자가(무대출)',
    own_with_loan: '자가(대출)',
    jeonse: '전세',
    monthly_rent: '월세',
    with_parents: '부모님 동거',
  },
  incomeType: {
    salary: '급여',
    freelance: '프리랜서',
    business: '사업',
    pension: '연금',
    investment: '투자/배당',
    side_job: '부업',
  },
  ageRange: { '20s': '20대', '30s': '30대', '40s': '40대', '50s_plus': '50대 이상' },
  financialGoal: {
    emergency_fund: '비상금 마련',
    debt_payoff: '대출 상환',
    home_purchase: '내 집 마련',
    investment: '투자/자산 증식',
    retirement: '노후 준비',
    travel: '여행/큰 지출 준비',
    none: '목표 없음',
  },
  primaryConcern: {
    overspending: '지출 통제',
    no_savings: '저축 부족',
    too_much_debt: '부채 걱정',
    irregular_income: '수입 불규칙',
    none: '고민 없음',
  },
} as const

interface Props {
  profile: HouseholdProfile | null | undefined
  onEditClick: () => void
}

/* ─── 프로필 미설정 상태 ─── */
function EmptyProfileCard({ onEditClick }: { onEditClick: () => void }) {
  return (
    <div className="rounded-xl border border-warm-200 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-warm-900">AI 분석 설정</h3>
      <p className="text-sm text-warm-500">AI 분석을 사용하려면 가구 정보를 입력해주세요.</p>
      <button
        onClick={onEditClick}
        className="text-sm text-grape-500 font-medium"
      >
        설정하기 →
      </button>
    </div>
  )
}

/* ─── 프로필 설정된 상태 — 요약 표시 ─── */
function ProfileSummaryCard({ profile, onEditClick }: { profile: HouseholdProfile; onEditClick: () => void }) {
  const incomeLabels = profile.incomeTypes
    .map((t) => PROFILE_LABELS.incomeType[t] ?? t)
    .join(', ')

  const lastUpdated = new Date(profile.updatedAt).toLocaleDateString('ko-KR')

  return (
    <div className="rounded-xl border border-warm-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-warm-900">AI 분석 설정</h3>
        <button onClick={onEditClick} className="text-xs text-grape-500">
          수정
        </button>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-warm-500">가구 유형</span>
          <span className="text-warm-900">{PROFILE_LABELS.householdType[profile.householdType]}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-warm-500">주거 형태</span>
          <span className="text-warm-900">{PROFILE_LABELS.housingType[profile.housingType]}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-warm-500">소득 유형</span>
          <span className="text-warm-900">{incomeLabels}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-warm-500">연령대</span>
          <span className="text-warm-900">{PROFILE_LABELS.ageRange[profile.ageRange]}</span>
        </div>
        {profile.financialGoal && profile.financialGoal !== 'none' && (
          <div className="flex justify-between">
            <span className="text-warm-500">재무 목표</span>
            <span className="text-warm-900">{PROFILE_LABELS.financialGoal[profile.financialGoal]}</span>
          </div>
        )}
        {profile.primaryConcern && profile.primaryConcern !== 'none' && (
          <div className="flex justify-between">
            <span className="text-warm-500">주요 고민</span>
            <span className="text-warm-900">{PROFILE_LABELS.primaryConcern[profile.primaryConcern]}</span>
          </div>
        )}
      </div>

      <p className="text-xs text-warm-400">마지막 수정: {lastUpdated}</p>
    </div>
  )
}

export default function ProfileEditSection({ profile, onEditClick }: Props) {
  if (!profile) {
    return <EmptyProfileCard onEditClick={onEditClick} />
  }
  return <ProfileSummaryCard profile={profile} onEditClick={onEditClick} />
}
