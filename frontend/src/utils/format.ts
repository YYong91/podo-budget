/** 금액을 ₩ 형식으로 포맷 */
export function formatAmount(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}

/** 금액을 ₩ 형식으로 포맷 (수입이면 + 접두사 추가) */
export function formatAmountWithSign(amount: number, type: 'expense' | 'income'): string {
  const formatted = formatAmount(amount)
  return type === 'income' ? `+${formatted}` : formatted
}
