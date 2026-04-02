/** 금액을 ₩ 형식으로 포맷 (소수점 제거) */
export function formatAmount(amount: number): string {
  return `₩${Math.round(amount).toLocaleString('ko-KR')}`
}

/** 금액을 ₩ 형식으로 포맷 (수입이면 + 접두사 추가) */
export function formatAmountWithSign(amount: number, type: 'expense' | 'income'): string {
  const formatted = formatAmount(amount)
  return type === 'income' ? `+${formatted}` : formatted
}

/** 사용자 이름 마스킹 — 관리자 페이지 프라이버시 보호 (#129)
 *
 * 봇 유저: "kakao_5f2a8b..." → "카카오(5f**)"
 *         "telegram_123..." → "텔레그램(12**)"
 * 웹 유저: "김수연" → "김**", "John" → "J**"
 */
export function maskUsername(name: string): string {
  if (!name || name.length <= 1) return name

  // 봇 유저: platform_userId 패턴
  if (name.startsWith('kakao_')) {
    const id = name.slice(6)
    return `카카오(${id.slice(0, 2)}**)`
  }
  if (name.startsWith('telegram_')) {
    const id = name.slice(9)
    return `텔레그램(${id.slice(0, 2)}**)`
  }

  // 일반 유저: 첫 글자 + **
  return name[0] + '*'.repeat(Math.min(name.length - 1, 2))
}

/** 로컬 시간 기준 오늘 날짜를 YYYY-MM-DD로 반환 (#331)
 *
 * new Date().toISOString().slice(0,10)은 UTC 기준이라
 * 한국(UTC+9)에서 자정~오전 9시 사이에 전날로 표시되는 버그가 있음.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 금액을 한국어 단위로 포맷 (억/만원)
 * 예: 240_000_000 → "2억 4,000만원", 43_000_000 → "4,300만원"
 * 주의: 10,000원 미만 금액은 "0만원"으로 표시됨 — 만원 이상의 값에서만 사용할 것
 */
export function formatKoreanAmount(amount: number): string {
  const eok = Math.floor(amount / 100_000_000)
  const man = Math.floor((amount % 100_000_000) / 10_000)

  if (eok > 0 && man > 0) {
    return `${eok}억 ${man.toLocaleString('ko-KR')}만원`
  }
  if (eok > 0) {
    return `${eok}억원`
  }
  return `${man.toLocaleString('ko-KR')}만원`
}

/** 금액을 축약 형태로 포맷 (캘린더 셀용) */
export function formatCompactAmount(amount: number): string {
  if (amount < 10000) {
    return amount.toLocaleString('ko-KR')
  }
  if (amount < 1000000) {
    // Math.floor로 반올림 방지 (예: 999,999원 → "99.9만", "100.0만" 아님)
    const man = Math.floor(amount / 10000)
    const tenths = Math.floor((amount % 10000) / 1000)
    return tenths === 0 ? `${man}만` : `${man}.${tenths}만`
  }
  const man = Math.floor(amount / 10000)
  return `${man}만`
}
