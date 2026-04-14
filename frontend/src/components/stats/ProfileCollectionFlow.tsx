import { useState } from 'react'
import type { HouseholdProfileInput } from '../../types'

interface Props {
  onComplete: (profile: HouseholdProfileInput) => Promise<void>
  onAnalysisReady: () => void
  onCancel?: () => void
  isLoading?: boolean
}

const HOUSEHOLD_TYPE_OPTIONS = [
  { value: 'single', label: '1인 가구' },
  { value: 'dual_income', label: '맞벌이' },
  { value: 'single_income', label: '외벌이' },
  { value: 'retired', label: '은퇴/연금' },
] as const

const HOUSING_TYPE_OPTIONS = [
  { value: 'own_no_loan', label: '자가(무대출)' },
  { value: 'own_with_loan', label: '자가(대출)' },
  { value: 'jeonse', label: '전세' },
  { value: 'monthly_rent', label: '월세' },
  { value: 'with_parents', label: '부모님 동거' },
] as const

const INCOME_TYPE_OPTIONS = [
  { value: 'salary', label: '급여' },
  { value: 'freelance', label: '프리랜서' },
  { value: 'business', label: '사업' },
  { value: 'pension', label: '연금' },
  { value: 'investment', label: '투자/배당' },
  { value: 'side_job', label: '부업' },
] as const

const AGE_RANGE_OPTIONS = [
  { value: '20s', label: '20대' },
  { value: '30s', label: '30대' },
  { value: '40s', label: '40대' },
  { value: '50s_plus', label: '50대 이상' },
] as const

const FINANCIAL_GOAL_OPTIONS = [
  { value: 'emergency_fund', label: '비상금' },
  { value: 'debt_payoff', label: '대출상환' },
  { value: 'home_purchase', label: '내집마련' },
  { value: 'investment', label: '투자' },
  { value: 'retirement', label: '노후준비' },
  { value: 'travel', label: '여행' },
  { value: 'none', label: '없음' },
] as const

const PRIMARY_CONCERN_OPTIONS = [
  { value: 'overspending', label: '지출통제' },
  { value: 'no_savings', label: '저축부족' },
  { value: 'too_much_debt', label: '부채걱정' },
  { value: 'irregular_income', label: '수입불규칙' },
  { value: 'none', label: '없음' },
] as const

// ChipGroup을 모듈 스코프에 정의 — TSX에서 generic 함수를 컴포넌트 내부에 중첩하면
// <T extends string>이 JSX 태그로 파싱되는 에러 발생
function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  multi = false,
}: {
  options: readonly { value: T; label: string }[]
  value: string | string[]
  onChange: (v: T) => void
  multi?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = multi
          ? (value as string[]).includes(opt.value)
          : value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
              selected
                ? 'bg-grape-500 text-white border-grape-500'
                : 'bg-white text-warm-700 border-warm-300 hover:border-grape-400'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export default function ProfileCollectionFlow({ onComplete, onAnalysisReady, onCancel, isLoading }: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [householdType, setHouseholdType] = useState<string>('')
  const [housingType, setHousingType] = useState<string>('')
  const [incomeTypes, setIncomeTypes] = useState<string[]>([])
  const [ageRange, setAgeRange] = useState<string>('')
  const [financialGoal, setFinancialGoal] = useState<string | null>(null)
  const [goalAmount, setGoalAmount] = useState<string>('')
  const [goalDeadline, setGoalDeadline] = useState<string>('')
  const [primaryConcern, setPrimaryConcern] = useState<string | null>(null)

  const step1Complete = householdType && housingType && incomeTypes.length > 0 && ageRange

  function toggleIncomeType(value: string) {
    setIncomeTypes((prev) =>
      prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value],
    )
  }

  async function handleStep1Next() {
    const step1Data: HouseholdProfileInput = {
      householdType: householdType as HouseholdProfileInput['householdType'],
      housingType: housingType as HouseholdProfileInput['housingType'],
      incomeTypes: incomeTypes as HouseholdProfileInput['incomeTypes'],
      ageRange: ageRange as HouseholdProfileInput['ageRange'],
    }
    await onComplete(step1Data)
    setStep(2)
  }

  async function handleStep2Submit(skip: boolean) {
    if (skip) {
      onAnalysisReady()
      return
    }
    const fullData: HouseholdProfileInput = {
      householdType: householdType as HouseholdProfileInput['householdType'],
      housingType: housingType as HouseholdProfileInput['housingType'],
      incomeTypes: incomeTypes as HouseholdProfileInput['incomeTypes'],
      ageRange: ageRange as HouseholdProfileInput['ageRange'],
      financialGoal: (financialGoal as HouseholdProfileInput['financialGoal']) ?? null,
      goalAmount: goalAmount ? parseInt(goalAmount.replace(/,/g, ''), 10) : null,
      goalDeadline: goalDeadline || null,
      primaryConcern: (primaryConcern as HouseholdProfileInput['primaryConcern']) ?? null,
    }
    await onComplete(fullData)
    onAnalysisReady()
  }

  if (step === 1) {
    return (
      <div className="space-y-5">
        <div>
          <p className="text-sm font-medium text-warm-800 mb-2">AI가 더 정확한 분석을 하려면 가구 정보가 필요해요.</p>
          <p className="text-xs text-warm-500">입력하신 정보는 AI 분석에만 사용되며, 언제든 수정할 수 있어요.</p>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-warm-800 mb-2">가구 유형</p>
            <ChipGroup options={HOUSEHOLD_TYPE_OPTIONS} value={householdType} onChange={setHouseholdType} />
          </div>
          <div>
            <p className="text-sm font-medium text-warm-800 mb-2">주거 형태</p>
            <ChipGroup options={HOUSING_TYPE_OPTIONS} value={housingType} onChange={setHousingType} />
          </div>
          <div>
            <p className="text-sm font-medium text-warm-800 mb-2">소득 유형 (복수 선택 가능)</p>
            <ChipGroup options={INCOME_TYPE_OPTIONS} value={incomeTypes} onChange={toggleIncomeType} multi />
          </div>
          <div>
            <p className="text-sm font-medium text-warm-800 mb-2">연령대</p>
            <ChipGroup options={AGE_RANGE_OPTIONS} value={ageRange} onChange={setAgeRange} />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-warm-300 text-warm-600 text-sm">
              취소
            </button>
          )}
          <button
            type="button"
            onClick={handleStep1Next}
            disabled={!step1Complete || isLoading}
            className="flex-1 py-2.5 rounded-xl bg-grape-500 text-white text-sm font-medium disabled:opacity-40"
          >
            {isLoading ? '저장 중...' : '다음 →'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-warm-800 mb-2">재무 목표 (선택)</p>
          <ChipGroup
            options={FINANCIAL_GOAL_OPTIONS}
            value={financialGoal ?? ''}
            onChange={(v) => setFinancialGoal(v)}
          />
        </div>
        {financialGoal && financialGoal !== 'none' && (
          <div className="space-y-2 pl-2">
            <input
              type="text"
              placeholder="목표 금액 (만원)"
              value={goalAmount}
              onChange={(e) => setGoalAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-warm-300 text-sm"
            />
            <input
              type="month"
              value={goalDeadline}
              onChange={(e) => setGoalDeadline(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-warm-300 text-sm"
            />
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-warm-800 mb-2">가장 큰 재무 고민 (선택)</p>
          <ChipGroup
            options={PRIMARY_CONCERN_OPTIONS}
            value={primaryConcern ?? ''}
            onChange={(v) => setPrimaryConcern(v)}
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={() => handleStep2Submit(true)}
          className="flex-1 py-2.5 rounded-xl border border-warm-300 text-warm-600 text-sm"
        >
          건너뛰기
        </button>
        <button
          type="button"
          onClick={() => handleStep2Submit(false)}
          disabled={isLoading}
          className="flex-1 py-2.5 rounded-xl bg-grape-500 text-white text-sm font-medium disabled:opacity-40"
        >
          {isLoading ? '저장 중...' : '분석 시작 →'}
        </button>
      </div>
    </div>
  )
}
