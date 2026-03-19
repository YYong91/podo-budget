/** 금액을 ₩ 형식으로 포맷 (소수점 제거) */
export function formatAmount(amount: number): string {
  return `₩${Math.round(amount).toLocaleString('ko-KR')}`
}

/** 금액을 ₩ 형식으로 포맷 (수입이면 + 접두사 추가) */
export function formatAmountWithSign(amount: number, type: 'expense' | 'income'): string {
  const formatted = formatAmount(amount)
  return type === 'income' ? `+${formatted}` : formatted
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
