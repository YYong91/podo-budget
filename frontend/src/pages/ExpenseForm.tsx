/**
 * @file ExpenseForm.tsx
 * @description 지출 입력 폼 페이지
 * 두 가지 입력 모드를 제공한다:
 * 1. 자연어 입력 모드: 텍스트로 입력하면 LLM이 자동 파싱
 * 2. 폼 입력 모드: 금액, 설명, 카테고리 등을 직접 입력
 */

import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useToast } from '../hooks/useToast'
import { expenseApi } from '../api/expenses'
import { categoryApi } from '../api/categories'
import { chatApi } from '../api/chat'
import type { Category } from '../types'

type InputMode = 'natural' | 'form'

export default function ExpenseForm() {
  const navigate = useNavigate()
  const { addToast } = useToast()

  // 입력 모드 상태
  const [mode, setMode] = useState<InputMode>('natural')
  const [loading, setLoading] = useState(false)

  // 자연어 입력 상태
  const [naturalInput, setNaturalInput] = useState('')

  // 폼 입력 상태
  const [categories, setCategories] = useState<Category[]>([])
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    category_id: '',
    date: new Date().toISOString().slice(0, 10), // YYYY-MM-DD (오늘)
    memo: '',
  })

  useEffect(() => {
    // 카테고리 목록 로드
    categoryApi
      .getAll()
      .then((res) => setCategories(res.data))
      .catch(() => {
        addToast('warning', '카테고리 목록을 불러오지 못했습니다')
      })
  }, [])

  /**
   * 자연어 입력 제출
   * POST /api/chat/ 호출
   */
  const handleNaturalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!naturalInput.trim()) {
      addToast('error', '메시지를 입력해주세요')
      return
    }

    setLoading(true)
    try {
      const res = await chatApi.sendMessage(naturalInput.trim())

      if (res.data.expenses_created && res.data.expenses_created.length > 0) {
        addToast('success', `${res.data.expenses_created.length}건의 지출이 저장되었습니다`)
        // 지출 목록으로 이동
        setTimeout(() => navigate('/expenses'), 500)
      } else {
        addToast('info', res.data.message || '지출 정보를 인식하지 못했습니다')
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || '지출 저장에 실패했습니다'
      addToast('error', errorMsg)
    } finally {
      setLoading(false)
    }
  }

  /**
   * 폼 입력 제출
   * POST /api/expenses/ 호출
   */
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 유효성 검사
    if (!formData.description.trim()) {
      addToast('error', '설명을 입력해주세요')
      return
    }

    const amount = Number(formData.amount)
    if (!amount || amount <= 0) {
      addToast('error', '금액은 0보다 큰 숫자여야 합니다')
      return
    }

    if (!formData.date) {
      addToast('error', '날짜를 선택해주세요')
      return
    }

    setLoading(true)
    try {
      await expenseApi.create({
        amount,
        description: formData.description.trim(),
        category_id: formData.category_id ? Number(formData.category_id) : null,
        date: formData.date,
      })
      addToast('success', '지출이 저장되었습니다')
      // 지출 목록으로 이동
      setTimeout(() => navigate('/expenses'), 500)
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || '지출 저장에 실패했습니다'
      addToast('error', errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link
          to="/expenses"
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <span className="text-xl">←</span>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">지출 입력</h1>
      </div>

      {/* 모드 전환 탭 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2 flex gap-2">
        <button
          onClick={() => setMode('natural')}
          className={`
            flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-all
            ${
              mode === 'natural'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-50'
            }
          `}
        >
          💬 자연어 입력
        </button>
        <button
          onClick={() => setMode('form')}
          className={`
            flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-all
            ${
              mode === 'form'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-50'
            }
          `}
        >
          📝 직접 입력
        </button>
      </div>

      {/* 자연어 입력 모드 */}
      {mode === 'natural' && (
        <form onSubmit={handleNaturalSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              자연어로 지출 입력하기
            </label>
            <textarea
              value={naturalInput}
              onChange={(e) => setNaturalInput(e.target.value)}
              placeholder="예: 오늘 점심에 김치찌개 8000원 먹었어&#10;어제 스타벅스에서 아메리카노 4500원"
              rows={5}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              disabled={loading}
            />
            <p className="mt-2 text-xs text-gray-500">
              💡 날짜, 내용, 금액을 자연스럽게 입력하면 AI가 자동으로 분석해 저장합니다.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !naturalInput.trim()}
            className="w-full px-4 py-3 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? '처리 중...' : '저장하기'}
          </button>
        </form>
      )}

      {/* 폼 입력 모드 */}
      {mode === 'form' && (
        <form onSubmit={handleFormSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
          {/* 금액 (필수) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              금액 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">₩</span>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="10000"
                className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                disabled={loading}
                min="1"
                step="100"
              />
            </div>
          </div>

          {/* 설명 (필수) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              설명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="김치찌개"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={loading}
            />
          </div>

          {/* 카테고리 (선택) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              카테고리
            </label>
            <select
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={loading}
            >
              <option value="">미분류</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* 날짜 (기본 오늘) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              날짜 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={loading}
            />
          </div>

          {/* 메모 (선택) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              메모 (선택)
            </label>
            <textarea
              value={formData.memo}
              onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
              placeholder="추가 메모를 입력하세요"
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500">
              (참고: 현재 백엔드에서 메모 필드가 지원되지 않을 수 있습니다)
            </p>
          </div>

          {/* 제출 버튼 */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/expenses')}
              className="flex-1 px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              disabled={loading}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '저장 중...' : '저장하기'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
