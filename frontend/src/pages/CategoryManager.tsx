/**
 * @file CategoryManager.tsx
 * @description 카테고리 관리 페이지
 * 카테고리 목록 조회, 추가, 수정, 삭제 기능을 제공한다.
 */

import { useEffect, useState } from 'react'
import { useToast } from '../hooks/useToast'
import { categoryApi } from '../api/categories'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import type { Category } from '../types'

export default function CategoryManager() {
  const { addToast } = useToast()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // 추가 폼 상태
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  // 편집 모드 (카테고리 ID)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ name: '', description: '' })

  // 삭제 확인 모달
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

  useEffect(() => {
    fetchCategories()
  }, [])

  /**
   * 카테고리 목록 조회
   */
  const fetchCategories = async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await categoryApi.getAll()
      setCategories(res.data)
    } catch {
      setError(true)
      addToast('error', '카테고리 목록을 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  /**
   * 새 카테고리 추가
   */
  const handleAdd = async () => {
    if (!newName.trim()) {
      addToast('error', '카테고리 이름을 입력해주세요')
      return
    }

    try {
      await categoryApi.create({
        name: newName.trim(),
        description: newDescription.trim() || undefined,
      })
      addToast('success', '카테고리가 추가되었습니다')
      setNewName('')
      setNewDescription('')
      setIsAdding(false)
      fetchCategories()
    } catch {
      addToast('error', '카테고리 추가에 실패했습니다')
    }
  }

  /**
   * 카테고리 편집 시작
   */
  const startEdit = (category: Category) => {
    setEditingId(category.id)
    setEditForm({
      name: category.name,
      description: category.description || '',
    })
  }

  /**
   * 카테고리 수정 저장
   */
  const handleUpdate = async (id: number) => {
    if (!editForm.name.trim()) {
      addToast('error', '카테고리 이름을 입력해주세요')
      return
    }

    try {
      await categoryApi.update(id, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || undefined,
      })
      addToast('success', '카테고리가 수정되었습니다')
      setEditingId(null)
      fetchCategories()
    } catch {
      addToast('error', '카테고리 수정에 실패했습니다')
    }
  }

  /**
   * 카테고리 삭제
   */
  const handleDelete = async (id: number) => {
    try {
      await categoryApi.delete(id)
      addToast('success', '카테고리가 삭제되었습니다')
      setDeleteTarget(null)
      fetchCategories()
    } catch {
      addToast('error', '카테고리 삭제에 실패했습니다')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  /* 에러 발생 시 */
  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">카테고리 관리</h1>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <ErrorState onRetry={fetchCategories} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">카테고리 관리</h1>
        <button
          onClick={() => setIsAdding(true)}
          className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
        >
          + 추가
        </button>
      </div>

      {/* 카테고리 목록 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  이름
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                  설명
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                  생성일
                </th>
                <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
          <tbody className="divide-y divide-gray-100">
            {/* 추가 폼 (isAdding일 때) */}
            {isAdding && (
              <tr className="bg-primary-50">
                <td className="px-4 sm:px-6 py-4">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="카테고리 이름"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    autoFocus
                  />
                </td>
                <td className="px-4 sm:px-6 py-4 hidden md:table-cell">
                  <input
                    type="text"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="설명 (선택)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </td>
                <td className="px-4 sm:px-6 py-4 hidden sm:table-cell"></td>
                <td className="px-4 sm:px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={handleAdd}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      저장
                    </button>
                    <button
                      onClick={() => {
                        setIsAdding(false)
                        setNewName('')
                        setNewDescription('')
                      }}
                      className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      취소
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {/* 카테고리 목록 */}
            {categories.length > 0 ? (
              categories.map((category) => {
                const isEditing = editingId === category.id
                return (
                  <tr
                    key={category.id}
                    className={isEditing ? 'bg-primary-50' : 'hover:bg-gray-50 transition-colors'}
                  >
                    <td className="px-4 sm:px-6 py-4">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) =>
                            setEditForm({ ...editForm, name: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          autoFocus
                        />
                      ) : (
                        <div>
                          <span className="font-medium text-gray-900">
                            {category.name}
                          </span>
                          {/* 모바일에서만 설명 표시 */}
                          <div className="md:hidden text-sm text-gray-600 mt-1">
                            {category.description || '-'}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-4 hidden md:table-cell">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.description}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              description: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      ) : (
                        <span className="text-sm text-gray-600">
                          {category.description || '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-4 hidden sm:table-cell">
                      <span className="text-sm text-gray-500">
                        {category.created_at.slice(0, 10).replace(/-/g, '.')}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleUpdate(category.id)}
                            className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                          >
                            저장
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => startEdit(category)}
                            className="px-3 py-1.5 text-sm font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => setDeleteTarget(category.id)}
                            className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                          >
                            삭제
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={4}>
                  <EmptyState
                    icon="📁"
                    title="아직 카테고리가 없습니다"
                    description="새 카테고리를 추가하여 지출을 체계적으로 관리해보세요."
                    action={{
                      label: '+ 카테고리 추가',
                      onClick: () => setIsAdding(true),
                    }}
                  />
                </td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
      </div>

      {/* 삭제 확인 모달 */}
      {deleteTarget !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              카테고리 삭제
            </h3>
            <p className="text-gray-600 mb-6">
              정말로 이 카테고리를 삭제하시겠습니까?
              <br />
              <span className="text-sm text-red-600">
                이 카테고리에 연결된 지출 내역은 미분류가 됩니다.
              </span>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
