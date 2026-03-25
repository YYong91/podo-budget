/**
 * @file SettingsTab.tsx
 * @description 가구 설정 탭 컴포넌트
 * 가구 이름/설명 수정, 가구 삭제(owner만) 기능을 제공한다.
 */

import { useState, useMemo } from 'react'
import type { HouseholdDetail, UpdateHouseholdDto } from '../../types'

interface SettingsTabProps {
  /** 가구 상세 정보 */
  household: HouseholdDetail
  /** 소유자 여부 */
  isOwner: boolean
  /** 가구 정보 수정 핸들러 */
  onUpdate: (data: UpdateHouseholdDto) => Promise<void>
  /** 가구 삭제 핸들러 */
  onDelete: () => void
}

export default function SettingsTab({
  household,
  isOwner,
  onUpdate,
  onDelete,
}: SettingsTabProps) {
  const [editMode, setEditMode] = useState(false)

  /** 가구 정보가 변경되면 폼 데이터를 동기화 (editMode가 아닐 때만) */
  const initialFormData = useMemo<UpdateHouseholdDto>(() => ({
    name: household.name,
    description: household.description || '',
  }), [household.name, household.description])

  const [formData, setFormData] = useState<UpdateHouseholdDto>(initialFormData)

  // editMode가 아닌 경우 household 변경에 따라 동기화
  if (!editMode && (formData.name !== initialFormData.name || formData.description !== initialFormData.description)) {
    setFormData(initialFormData)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onUpdate(formData)
    setEditMode(false)
  }

  const handleCancel = () => {
    setEditMode(false)
    setFormData({
      name: household.name,
      description: household.description || '',
    })
  }

  return (
    <div className="space-y-6">
      {/* 가구 정보 수정 */}
      <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-[var(--border-default)] p-6">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
          가구 정보
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
            >
              가구 이름
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-[var(--input-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500"
              disabled={!editMode}
              required
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-[var(--text-secondary)] mb-1"
            >
              설명
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-3 py-2 border border-[var(--input-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-grape-500/30 focus:border-grape-500 resize-none"
              rows={3}
              disabled={!editMode}
            />
          </div>

          <div className="flex gap-3">
            {editMode ? (
              <>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-[var(--surface-card)] border border-[var(--input-border)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700 transition-colors"
                >
                  저장
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEditMode(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-grape-600 rounded-lg hover:bg-grape-700 transition-colors"
              >
                수정
              </button>
            )}
          </div>
        </form>
      </div>

      {/* 가구 삭제 (owner만) */}
      {isOwner && (
        <div className="bg-[var(--surface-card)] rounded-2xl shadow-sm border border-rose-200 p-6">
          <h2 className="text-lg font-semibold text-rose-600 mb-2">
            위험 영역
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            가구를 삭제하면 모든 데이터가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
          </p>
          <button
            onClick={onDelete}
            className="px-4 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors"
          >
            가구 삭제
          </button>
        </div>
      )}
    </div>
  )
}
