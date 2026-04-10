/**
 * @file CategoryManager.tsx
 * @description 카테고리 관리 페이지
 * 카테고리 목록 조회, 추가, 수정, 삭제 기능을 제공한다.
 */

import { useEffect, useState } from 'react'
import { useGoBack } from '../hooks/useGoBack'
import { ArrowLeft, Lock, Plus } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { TOAST } from '../constants/toastMessages'
import { categoryApi } from '../api/categories'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import { Skeleton } from '../components/skeleton/Skeleton'
import type { Category } from '../types'

function CategoryManagerSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="card-surface p-4 flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  )
}

export default function CategoryManager() {
  const goBack = useGoBack('/settings')
  const { addToast } = useToast()
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense')
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // 추가 폼 상태
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newIsSavings, setNewIsSavings] = useState(false)
  const [newEmoji, setNewEmoji] = useState('📌')
  const [isAdding, setIsAdding] = useState(false)

  // 편집 모드 (카테고리 ID)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ name: '', description: '', is_savings: false, emoji: '📌' })

  // 삭제 확인 모달
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

  // 순서 변경 중
  const [reordering, setReordering] = useState(false)

  useEffect(() => {
    fetchCategories()
  }, [activeTab])

  /**
   * 카테고리 목록 조회
   */
  const fetchCategories = async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await categoryApi.getAll({ type: activeTab })
      setCategories(res.data)
    } catch {
      setError(true)
      addToast('error', TOAST.LOAD_FAILED)
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
        is_savings: newIsSavings,
        emoji: newEmoji,
      })
      addToast('success', TOAST.CATEGORY_ADDED)
      setNewName('')
      setNewDescription('')
      setNewIsSavings(false)
      setNewEmoji('📌')
      setIsAdding(false)
      fetchCategories()
    } catch {
      addToast('error', TOAST.SAVE_FAILED)
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
      is_savings: category.is_savings,
      emoji: category.emoji || '📌',
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
        is_savings: editForm.is_savings,
        emoji: editForm.emoji,
      })
      addToast('success', TOAST.CATEGORY_UPDATED)
      setEditingId(null)
      fetchCategories()
    } catch {
      addToast('error', TOAST.SAVE_FAILED)
    }
  }

  /**
   * 카테고리 삭제
   */
  const handleDelete = async (id: number) => {
    try {
      await categoryApi.delete(id)
      addToast('success', TOAST.CATEGORY_DELETED)
      setDeleteTarget(null)
      fetchCategories()
    } catch {
      addToast('error', TOAST.DELETE_FAILED)
    }
  }

  /**
   * 카테고리 순서 이동
   */
  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= categories.length) return

    // 낙관적 업데이트
    const newCategories = [...categories]
    const [moved] = newCategories.splice(index, 1)
    newCategories.splice(targetIndex, 0, moved)
    setCategories(newCategories)

    // 서버에 순서 저장
    setReordering(true)
    try {
      const res = await categoryApi.reorder(newCategories.map((c) => c.id))
      setCategories(res.data)
    } catch {
      // 실패 시 원래 목록 복원
      fetchCategories()
      addToast('error', TOAST.ORDER_CHANGE_FAILED)
    } finally {
      setReordering(false)
    }
  }

  if (loading) {
    return <CategoryManagerSkeleton />
  }

  /* 에러 발생 시 */
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => goBack()} className="p-2.5 -ml-2.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors">
            <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">카테고리 관리</h1>
        </div>
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]">
          <ErrorState onRetry={fetchCategories} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-page-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => goBack()} className="p-2.5 -ml-2.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors">
            <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">카테고리 관리</h1>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-grape-600 text-white rounded-xl text-sm font-medium shadow-sm hover:bg-grape-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          추가
        </button>
      </div>

      {/* 지출/수입 탭 */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('expense')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            activeTab === 'expense'
              ? 'bg-grape-100 text-grape-700'
              : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
          }`}
        >
          💰 지출 카테고리
        </button>
        <button
          onClick={() => setActiveTab('income')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            activeTab === 'income'
              ? 'bg-leaf-100 text-leaf-700'
              : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
          }`}
        >
          💵 수입 카테고리
        </button>
      </div>

      {/* 카테고리 목록 */}
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)]/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-default)] bg-[var(--surface-elevated)]">
                <th className="px-2 sm:px-3 py-3 text-center text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider w-16">
                  순서
                </th>
                <th className="px-2 sm:px-3 py-3 text-center text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider w-16">
                  아이콘
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                  이름
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider hidden md:table-cell">
                  설명
                </th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider hidden sm:table-cell">
                  만든 날
                </th>
                <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {/* 추가 폼 (isAdding일 때) */}
            {isAdding && (
              <tr className="bg-grape-50">
                <td className="px-2 sm:px-3 py-4"></td>
                <td className="px-2 sm:px-3 py-4 text-center">
                  <input
                    type="text"
                    value={newEmoji}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val.length <= 2) setNewEmoji(val || '📌')
                    }}
                    className="input-base w-14 text-center text-xl p-2"
                    maxLength={2}
                  />
                </td>
                <td className="px-4 sm:px-6 py-4">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="카테고리 이름"
                    className="input-base w-full"
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                  />
                  {activeTab === 'expense' && (
                    <label className="flex items-center gap-1.5 mt-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newIsSavings}
                        onChange={(e) => setNewIsSavings(e.target.checked)}
                        className="rounded border-[var(--input-border)] text-grape-600 focus:ring-grape-500"
                      />
                      저축성 지출
                    </label>
                  )}
                </td>
                <td className="px-4 sm:px-6 py-4 hidden md:table-cell">
                  <input
                    type="text"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="설명 (선택)"
                    className="input-base w-full"
                  />
                </td>
                <td className="px-4 sm:px-6 py-4 hidden sm:table-cell"></td>
                <td className="px-4 sm:px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={handleAdd}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700 transition-colors"
                    >
                      저장
                    </button>
                    <button
                      onClick={() => {
                        setIsAdding(false)
                        setNewName('')
                        setNewDescription('')
                        setNewIsSavings(false)
                        setNewEmoji('📌')
                      }}
                      className="px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] bg-[var(--surface-hover)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
                    >
                      취소
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {/* 카테고리 목록 */}
            {categories.length > 0 ? (
              categories.map((category, index) => {
                const isEditing = editingId === category.id
                return (
                  <tr
                    key={category.id}
                    className={isEditing ? 'bg-grape-50' : 'hover:bg-[var(--surface-elevated)] transition-colors'}
                  >
                    <td className="px-2 sm:px-3 py-4">
                      <div className="flex flex-col items-center gap-0.5">
                        <button
                          onClick={() => handleMove(index, 'up')}
                          disabled={index === 0 || reordering || category.is_system}
                          className="p-0.5 text-[var(--text-muted)] hover:text-grape-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          aria-label={`${category.name} 위로 이동`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleMove(index, 'down')}
                          disabled={index === categories.length - 1 || reordering || category.is_system}
                          className="p-0.5 text-[var(--text-muted)] hover:text-grape-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          aria-label={`${category.name} 아래로 이동`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td className="px-2 sm:px-3 py-4 text-center">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.emoji}
                          onChange={(e) => {
                            const val = e.target.value
                            if (val.length <= 2) setEditForm({ ...editForm, emoji: val || '📌' })
                          }}
                          className="input-base w-14 text-center text-xl p-2"
                          maxLength={2}
                        />
                      ) : (
                        <span className="text-xl">{category.emoji}</span>
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      {isEditing ? (
                        <div>
                          <input
                            type="text"
                            value={editForm.name}
                            onChange={(e) =>
                              setEditForm({ ...editForm, name: e.target.value })
                            }
                            className="input-base w-full"
                            // eslint-disable-next-line jsx-a11y/no-autofocus
                            autoFocus
                          />
                          {activeTab === 'expense' && (
                            <label className="flex items-center gap-1.5 mt-2 text-xs text-[var(--text-secondary)] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editForm.is_savings}
                                onChange={(e) =>
                                  setEditForm({ ...editForm, is_savings: e.target.checked })
                                }
                                className="rounded border-[var(--input-border)] text-grape-600 focus:ring-grape-500"
                              />
                              저축성 지출
                            </label>
                          )}
                        </div>
                      ) : (
                        <div>
                          <span className="font-medium text-[var(--text-primary)]">
                            {category.name}
                          </span>
                          {category.is_savings && (
                            <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-leaf-700 bg-leaf-100 rounded">
                              저축
                            </span>
                          )}
                          {/* 모바일에서만 설명 표시 */}
                          <div className="md:hidden text-sm text-[var(--text-secondary)] mt-1">
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
                          className="input-base w-full"
                        />
                      ) : (
                        <span className="text-sm text-[var(--text-secondary)]">
                          {category.description || '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-4 hidden sm:table-cell">
                      <span className="text-sm text-[var(--text-tertiary)]">
                        {category.created_at.slice(0, 10).replace(/-/g, '.')}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right">
                      {category.is_system ? (
                        <div className="flex justify-end items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[var(--text-tertiary)] bg-[var(--surface-elevated)] rounded-md">
                            <Lock className="w-3 h-3" aria-hidden="true" />
                            기본
                          </span>
                        </div>
                      ) : isEditing ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleUpdate(category.id)}
                            className="px-3 py-1.5 text-sm font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700 transition-colors"
                          >
                            저장
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] bg-[var(--surface-hover)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => startEdit(category)}
                            className="px-3 py-1.5 text-sm font-medium text-grape-600 bg-grape-50 rounded-lg hover:bg-grape-100 transition-colors"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => setDeleteTarget(category.id)}
                            className="px-3 py-1.5 text-sm font-medium text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors"
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
                <td colSpan={6}>
                  <EmptyState
                    variant="section"
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
          <div className="bg-[var(--surface-card)] rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              카테고리 삭제
            </h3>
            <p className="text-[var(--text-secondary)] mb-6">
              정말로 이 카테고리를 삭제하시겠습니까?
              <br />
              <span className="text-sm text-rose-600">
                이 카테고리에 연결된 지출 내역은 '분류 안 됨' 상태가 됩니다.
              </span>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--surface-hover)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => handleDelete(deleteTarget)}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors"
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
