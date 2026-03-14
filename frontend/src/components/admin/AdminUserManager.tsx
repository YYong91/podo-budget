/* Admin 사용자 관리 — 검색, 목록, 상세/비활성화 */

import { useState, useEffect, useCallback } from 'react'
import { Search, ChevronLeft, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { adminApi } from '../../api/admin'
import type { AdminUserItem, AdminUserDetail, AdminUserListResponse } from '../../types'

export default function AdminUserManager() {
  const [data, setData] = useState<AdminUserListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.getUserList(page, 20, search || undefined)
      setData(res.data)
    } catch {
      toast.error('사용자 목록 로딩 실패')
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchUsers()
  }

  const handleSelectUser = async (userId: number) => {
    try {
      const res = await adminApi.getUserDetail(userId)
      setSelectedUser(res.data)
    } catch {
      toast.error('사용자 정보 로딩 실패')
    }
  }

  const handleToggleActive = async (userId: number, currentActive: boolean) => {
    try {
      const res = await adminApi.updateUser(userId, { is_active: !currentActive })
      setSelectedUser(res.data)
      toast.success(res.data.is_active ? '사용자 활성화' : '사용자 비활성화')
      fetchUsers()
    } catch {
      toast.error('상태 변경 실패')
    }
  }

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0

  if (selectedUser) {
    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedUser(null)} className="text-sm text-grape-600 hover:text-grape-700 flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" /> 목록으로
        </button>
        <div className="bg-white rounded-xl p-6 border border-warm-200 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-warm-900">{selectedUser.username}</h3>
              <p className="text-sm text-warm-500">{selectedUser.email ?? '이메일 없음'}</p>
            </div>
            <button
              onClick={() => handleToggleActive(selectedUser.id, selectedUser.is_active)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
                selectedUser.is_active
                  ? 'bg-green-50 text-green-700 hover:bg-green-100'
                  : 'bg-red-50 text-red-700 hover:bg-red-100'
              }`}
            >
              {selectedUser.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              {selectedUser.is_active ? '활성' : '비활성'}
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div><span className="text-warm-500">가입일:</span> <span className="text-warm-900">{new Date(selectedUser.created_at).toLocaleDateString('ko-KR')}</span></div>
            <div><span className="text-warm-500">지출:</span> <span className="text-warm-900">{selectedUser.expense_count}건 ({selectedUser.total_spent.toLocaleString()}원)</span></div>
            <div><span className="text-warm-500">수입:</span> <span className="text-warm-900">{selectedUser.income_count}건 ({selectedUser.total_earned.toLocaleString()}원)</span></div>
            <div><span className="text-warm-500">가구:</span> <span className="text-warm-900">{selectedUser.household_count}개</span></div>
            <div><span className="text-warm-500">텔레그램:</span> <span className="text-warm-900">{selectedUser.is_telegram_linked ? '연동' : '미연동'}</span></div>
            <div><span className="text-warm-500">마지막 활동:</span> <span className="text-warm-900">{selectedUser.last_activity_at ? new Date(selectedUser.last_activity_at).toLocaleDateString('ko-KR') : '-'}</span></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 검색 */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름 또는 이메일 검색..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-warm-200 text-sm focus:ring-2 focus:ring-grape-200 focus:border-grape-400"
          />
        </div>
        <button type="submit" className="px-4 py-2 bg-grape-600 text-white rounded-lg text-sm hover:bg-grape-700">검색</button>
      </form>

      {/* 사용자 목록 */}
      {loading ? (
        <div className="text-center py-8 text-warm-400">로딩 중...</div>
      ) : data && data.users.length > 0 ? (
        <>
          <div className="bg-white rounded-xl border border-warm-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-warm-50 text-warm-600">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">사용자</th>
                  <th className="text-right px-4 py-2 font-medium hidden md:table-cell">거래 수</th>
                  <th className="text-right px-4 py-2 font-medium hidden md:table-cell">마지막 활동</th>
                  <th className="text-center px-4 py-2 font-medium">상태</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u: AdminUserItem) => (
                  <tr
                    key={u.id}
                    onClick={() => handleSelectUser(u.id)}
                    className="border-t border-warm-100 hover:bg-warm-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-warm-900">{u.username}</div>
                      <div className="text-xs text-warm-400">{u.email ?? ''}</div>
                    </td>
                    <td className="text-right px-4 py-3 text-warm-600 hidden md:table-cell">{u.expense_count + u.income_count}</td>
                    <td className="text-right px-4 py-3 text-warm-500 text-xs hidden md:table-cell">
                      {u.last_activity_at ? new Date(u.last_activity_at).toLocaleDateString('ko-KR') : '-'}
                    </td>
                    <td className="text-center px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {u.is_active ? '활성' : '비활성'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg hover:bg-warm-100 disabled:opacity-30"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-warm-600">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg hover:bg-warm-100 disabled:opacity-30"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8 text-warm-400">사용자가 없습니다</div>
      )}
    </div>
  )
}
