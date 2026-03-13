const DAY_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

/** 해당 월의 시작일과 마지막일을 YYYY-MM-DD 형식으로 반환 */
export function getMonthRange(year: number, month: number): { start: string; end: string } {
  const end = new Date(year, month + 1, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    start: `${year}-${pad(month + 1)}-01`,
    end: `${year}-${pad(month + 1)}-${pad(end.getDate())}`,
  }
}

export interface CalendarDay {
  date: number
  dateString: string
}

/** 캘린더 그리드 생성 (7열, 4~6행). 해당 월에 속하지 않는 셀은 null */
export function getCalendarGrid(year: number, month: number): (CalendarDay | null)[][] {
  const firstDay = new Date(year, month, 1).getDay()
  const lastDate = new Date(year, month + 1, 0).getDate()
  const pad = (n: number) => String(n).padStart(2, '0')

  const grid: (CalendarDay | null)[][] = []
  let currentDate = 1
  const totalCells = firstDay + lastDate
  const rows = Math.ceil(totalCells / 7)

  for (let row = 0; row < rows; row++) {
    const week: (CalendarDay | null)[] = []
    for (let col = 0; col < 7; col++) {
      const cellIndex = row * 7 + col
      if (cellIndex < firstDay || currentDate > lastDate) {
        week.push(null)
      } else {
        week.push({
          date: currentDate,
          dateString: `${year}-${pad(month + 1)}-${pad(currentDate)}`,
        })
        currentDate++
      }
    }
    grid.push(week)
  }
  return grid
}

/** "3월 13일 금요일" 형식으로 날짜 헤더 포맷 */
export function formatDateHeader(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00')
  const month = date.getMonth() + 1
  const day = date.getDate()
  const dayOfWeek = DAY_NAMES[date.getDay()]
  return `${month}월 ${day}일 ${dayOfWeek}`
}

/** 요일 문자열 반환 */
export function getDayOfWeek(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00')
  return DAY_NAMES[date.getDay()]
}
