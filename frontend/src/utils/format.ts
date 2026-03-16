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
    const man = amount / 10000
    const formatted = man % 1 === 0 ? man.toFixed(0) : man.toFixed(1)
    return `${formatted}만`
  }
  const man = Math.round(amount / 10000)
  return `${man}만`
}
