/** 날짜를 YYYY-MM-DD 문자열로 변환 (로컬 타임존 기준) */
export function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 빠른 날짜 선택 프리셋 */
export const DATE_PRESETS = [
  {
    label: '이번주',
    getRange: () => {
      const today = new Date()
      const day = today.getDay()
      const diff = day === 0 ? -6 : 1 - day
      const monday = new Date(today)
      monday.setDate(today.getDate() + diff)
      return { start: toDateString(monday), end: toDateString(today) }
    },
  },
  {
    label: '지난주',
    getRange: () => {
      const today = new Date()
      const day = today.getDay()
      const diff = day === 0 ? -6 : 1 - day
      const monday = new Date(today)
      monday.setDate(today.getDate() + diff - 7)
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      return { start: toDateString(monday), end: toDateString(sunday) }
    },
  },
  {
    label: '이번달',
    getRange: () => {
      const today = new Date()
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      return { start: toDateString(start), end: toDateString(today) }
    },
  },
  {
    label: '저번달',
    getRange: () => {
      const today = new Date()
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const end = new Date(today.getFullYear(), today.getMonth(), 0)
      return { start: toDateString(start), end: toDateString(end) }
    },
  },
]
