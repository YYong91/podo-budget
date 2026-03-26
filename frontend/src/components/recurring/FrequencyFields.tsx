/**
 * @file FrequencyFields.tsx
 * @description 반복 거래 주기별 조건부 필드 컴포넌트
 * frequency 값에 따라 반복일, 요일, 반복 월, 반복 주기 필드를 표시한다.
 */

type Frequency = 'monthly' | 'weekly' | 'yearly' | 'custom'

interface FrequencyFieldsProps {
  /** 선택된 주기 */
  frequency: Frequency
  /** 반복일 (monthly, yearly) */
  dayOfMonth: string
  /** 요일 (weekly) — 0=월, 6=일 */
  dayOfWeek: string
  /** 반복 월 (yearly) — 1~12 */
  monthOfYear: string
  /** 반복 주기 일수 (custom) */
  interval: string
  /** 시작일 */
  startDate: string
  /** 필드 변경 핸들러 */
  onChange: (field: string, value: string) => void
}

const INPUT_CLASSES = 'w-full px-3 py-2 rounded-xl border border-[var(--input-border)] text-sm focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500'

export default function FrequencyFields({
  frequency,
  dayOfMonth,
  dayOfWeek,
  monthOfYear,
  interval,
  startDate,
  onChange,
}: FrequencyFieldsProps) {
  return (
    <>
      {/* 주기 선택 */}
      <div>
        <label htmlFor="reclist-frequency" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">반복 주기</label>
        <select
          id="reclist-frequency"
          value={frequency}
          onChange={(e) => onChange('frequency', e.target.value)}
          className={INPUT_CLASSES}
        >
          <option value="monthly">매월</option>
          <option value="weekly">매주</option>
          <option value="yearly">매년</option>
          <option value="custom">사용자 지정</option>
        </select>
      </div>

      {/* 반복일 (monthly, yearly) */}
      {(frequency === 'monthly' || frequency === 'yearly') && (
        <div>
          <label htmlFor="reclist-day-of-month" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">반복일</label>
          <input
            id="reclist-day-of-month"
            type="number"
            value={dayOfMonth}
            onChange={(e) => onChange('day_of_month', e.target.value)}
            min="1"
            max="31"
            className={INPUT_CLASSES}
          />
        </div>
      )}

      {/* 요일 (weekly) */}
      {frequency === 'weekly' && (
        <div>
          <label htmlFor="reclist-day-of-week" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">요일</label>
          <select
            id="reclist-day-of-week"
            value={dayOfWeek}
            onChange={(e) => onChange('day_of_week', e.target.value)}
            className={INPUT_CLASSES}
          >
            {['월', '화', '수', '목', '금', '토', '일'].map((d, i) => (
              <option key={i} value={i}>{d}요일</option>
            ))}
          </select>
        </div>
      )}

      {/* 반복 월 (yearly) */}
      {frequency === 'yearly' && (
        <div>
          <label htmlFor="reclist-month-of-year" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">반복 월</label>
          <select
            id="reclist-month-of-year"
            value={monthOfYear}
            onChange={(e) => onChange('month_of_year', e.target.value)}
            className={INPUT_CLASSES}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1}월</option>
            ))}
          </select>
        </div>
      )}

      {/* 반복 주기 (custom) */}
      {frequency === 'custom' && (
        <div>
          <label htmlFor="reclist-interval" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">반복 주기 (일)</label>
          <input
            id="reclist-interval"
            type="number"
            value={interval}
            onChange={(e) => onChange('interval', e.target.value)}
            min="1"
            className={INPUT_CLASSES}
          />
        </div>
      )}

      {/* 시작일 */}
      <div>
        <label htmlFor="reclist-start-date" className="block text-sm font-medium text-[var(--text-secondary)] mb-2">시작일</label>
        <input
          id="reclist-start-date"
          type="date"
          value={startDate}
          onChange={(e) => onChange('start_date', e.target.value)}
          className={INPUT_CLASSES}
        />
      </div>
    </>
  )
}
