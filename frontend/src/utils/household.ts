/** HouseholdListPage / HouseholdDetailPage 공유 유틸 (#173) */

/** 날짜 포맷팅 (YYYY-MM-DD → YYYY.MM.DD) */
export function formatDate(dateStr: string): string {
  return dateStr.slice(0, 10).replace(/-/g, '.')
}

/** 역할 한글 변환 */
export function formatRole(role: string): string {
  const roleMap: Record<string, string> = {
    owner: '소유자',
    admin: '관리자',
    member: '멤버',
  }
  return roleMap[role] || role
}

/** 역할별 배지 색상 (border 포함 full 버전) */
export function getRoleBadgeColor(role: string): string {
  switch (role) {
    case 'owner':
      return 'bg-purple-50 text-purple-700 border-purple-200'
    case 'admin':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    default:
      return 'bg-[var(--surface-elevated)] text-[var(--text-secondary)] border-[var(--border-default)]'
  }
}
