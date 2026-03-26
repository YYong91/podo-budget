/**
 * @file MembersTab.tsx
 * @description 가구 멤버 목록 탭 컴포넌트
 * 멤버 테이블, 역할 변경, 내보내기/탈퇴 기능을 제공한다.
 */

import type { HouseholdDetail, HouseholdMember, MemberRole } from '../../types'
import { formatDate, formatRole, getRoleBadgeColor } from '../../utils/household'

interface MembersTabProps {
  /** 가구 상세 정보 */
  household: HouseholdDetail
  /** 현재 로그인 유저 ID */
  currentUserId: number
  /** 멤버 관리 가능 여부 판단 함수 */
  canManageMember: (member: HouseholdMember, currentUserId: number) => boolean
  /** 역할 변경 핸들러 */
  onRoleChange: (userId: number, newRole: MemberRole) => void
  /** 멤버 내보내기 핸들러 */
  onRemoveMember: (userId: number, username: string) => void
  /** 가구 탈퇴 핸들러 */
  onLeave: () => void
}

export default function MembersTab({
  household,
  currentUserId,
  canManageMember,
  onRoleChange,
  onRemoveMember,
  onLeave,
}: MembersTabProps) {
  return (
    <div className="space-y-4">
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[var(--surface-elevated)] border-b border-[var(--border-default)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                  이름
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                  이메일
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                  역할
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                  가입일
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                  관리
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {household.members.map((member) => {
                const isMe = member.user_id === currentUserId
                const canManage = canManageMember(member, currentUserId)

                return (
                  <tr key={member.user_id} className="hover:bg-[var(--surface-hover)]">
                    <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)]">
                      {member.username}
                      {isMe && (
                        <span className="ml-2 text-xs text-[var(--text-tertiary)]">(나)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                      {member.email || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {canManage ? (
                        <select
                          value={member.role}
                          onChange={(e) =>
                            onRoleChange(
                              member.user_id,
                              e.target.value as MemberRole
                            )
                          }
                          className="text-sm px-2 py-1 border border-[var(--input-border)] rounded bg-[var(--surface-card)] focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
                        >
                          <option value="member">멤버</option>
                          <option value="admin">관리자</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-block text-xs px-2 py-1 rounded-full ${getRoleBadgeColor(
                            member.role
                          )}`}
                        >
                          {formatRole(member.role)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                      {formatDate(member.joined_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {canManage ? (
                        <button
                          onClick={() =>
                            onRemoveMember(member.user_id, member.username)
                          }
                          className="text-rose-600 hover:text-rose-700 font-medium"
                        >
                          내보내기
                        </button>
                      ) : isMe && (member.role !== 'owner' || household.members.length > 1) ? (
                        <button
                          onClick={onLeave}
                          className="text-rose-600 hover:text-rose-700 font-medium"
                        >
                          탈퇴
                        </button>
                      ) : (
                        <span className="text-[var(--text-muted)]">-</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
