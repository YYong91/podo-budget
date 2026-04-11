import { Link } from 'react-router-dom'

interface InsightsOnboardingProps {
  hasTransactions: boolean    // expenseCount + incomeCount >= 5
  hasBudget: boolean
  hasRecurring: boolean
  hasSavingsCategory: boolean
}

interface CheckItem {
  label: string
  done: boolean
  link: string
}

export default function InsightsOnboarding({
  hasTransactions,
  hasBudget,
  hasRecurring,
  hasSavingsCategory,
}: InsightsOnboardingProps) {
  const items: CheckItem[] = [
    { label: '거래 5건 이상 기록하기', done: hasTransactions, link: '/home' },
    { label: '예산 설정하기', done: hasBudget, link: '/settings/budget' },
    { label: '정기거래 등록하기', done: hasRecurring, link: '/recurring' },
    { label: '저축 카테고리 설정하기', done: hasSavingsCategory, link: '/settings/categories' },
  ]

  return (
    <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-6 text-center">
      <p className="text-2xl mb-3">🍇</p>
      <h2 className="text-base font-semibold text-[var(--text-primary)] mb-4">
        아직 데이터가 모이는 중이에요
      </h2>
      <ul className="space-y-2 text-left mb-5">
        {items.map(({ label, done, link }) => (
          <li
            key={label}
            className={`flex items-center gap-2 text-sm ${done ? 'line-through text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}`}
          >
            <span className="text-base shrink-0">{done ? '✓' : '○'}</span>
            {done ? (
              <span>{label}</span>
            ) : (
              <Link to={link} className="hover:text-grape-600 transition-colors">{label}</Link>
            )}
          </li>
        ))}
      </ul>
      <Link
        to="/home"
        className="inline-flex items-center gap-1 text-sm font-medium text-grape-600 hover:text-grape-700 transition-colors"
      >
        가계부로 가기 →
      </Link>
    </div>
  )
}
