/**
 * @file BudgetManager.tsx
 * @description 예산 관리 페이지
 * 카테고리별 예산 설정, 지출 현황 조회, 초과/경고 알림 표시 기능을 제공한다.
 */

import { useState, useEffect } from 'react'
import { useToast } from '../hooks/useToast'
import budgetApi from '../api/budgets'
import { categoryApi } from '../api/categories'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import type { Budget, BudgetAlert, Category, BudgetCreateRequest } from '../types'

export default function BudgetManager() {
  const { addToast } = useToast()

  const [budgets, setBudgets] = useState<Budget[]>([])
  const [alerts, setAlerts] = useState<BudgetAlert[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)

  // 폼 상태
  const [formData, setFormData] = useState({
    category_id: '',
    amount: '',
    period: 'monthly' as 'monthly' | 'weekly' | 'daily',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: '',
    alert_threshold: '80',
  })

  /**
   * 데이터 로드
   */
  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const [budgetsRes, alertsRes, categoriesRes] = await Promise.all([
        budgetApi.getBudgets(),
        budgetApi.getBudgetAlerts(),
        categoryApi.getAll(),
      ])

      setBudgets(budgetsRes.data)
      setAlerts(alertsRes.data)
      setCategories(categoriesRes.data)
    } catch (err) {
      console.error('Failed to load data:', err)
      setError('데이터를 불러오는데 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  /**
   * 예산 추가 모달 열기
   */
  const handleAddClick = () => {
    setEditingBudget(null)
    setFormData({
      category_id: '',
      amount: '',
      period: 'monthly',
      start_date: new Date().toISOString().slice(0, 10),
      end_date: '',
      alert_threshold: '80',
    })
    setShowModal(true)
  }

  /**
   * 예산 수정 모달 열기
   */
  const handleEditClick = (budget: Budget) => {
    setEditingBudget(budget)
    setFormData({
      category_id: String(budget.category_id),
      amount: String(budget.amount),
      period: budget.period,
      start_date: budget.start_date,
      end_date: budget.end_date || '',
      alert_threshold: String(budget.alert_threshold || 80),
    })
    setShowModal(true)
  }

  /**
   * 폼 제출 핸들러
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.category_id || !formData.amount) {
      addToast('error', '카테고리와 금액은 필수입니다')
      return
    }

    try {
      const data: BudgetCreateRequest = {
        category_id: Number(formData.category_id),
        amount: Number(formData.amount),
        period: formData.period,
        start_date: formData.start_date,
        ...(formData.end_date && { end_date: formData.end_date }),
        ...(formData.alert_threshold && { alert_threshold: Number(formData.alert_threshold) }),
      }

      if (editingBudget) {
        await budgetApi.updateBudget(editingBudget.id, data)
        addToast('success', '예산이 수정되었습니다')
      } else {
        await budgetApi.createBudget(data)
        addToast('success', '예산이 추가되었습니다')
      }

      setShowModal(false)
      loadData()
    } catch (err) {
      console.error('Failed to save budget:', err)
      addToast('error', '예산 저장에 실패했습니다')
    }
  }

  /**
   * 예산 삭제 핸들러
   */
  const handleDelete = async (id: number) => {
    if (!confirm('정말 이 예산을 삭제하시겠습니까?')) {
      return
    }

    try {
      await budgetApi.deleteBudget(id)
      addToast('success', '예산이 삭제되었습니다')
      loadData()
    } catch (err) {
      console.error('Failed to delete budget:', err)
      addToast('error', '예산 삭제에 실패했습니다')
    }
  }

  /**
   * 카테고리 이름 조회
   */
  const getCategoryName = (categoryId: number): string => {
    return categories.find((c) => c.id === categoryId)?.name || '알 수 없음'
  }

  /**
   * 금액 포맷팅
   */
  const formatAmount = (amount: number): string => {
    return `₩${amount.toLocaleString('ko-KR')}`
  }

  /**
   * 날짜 포맷팅
   */
  const formatDate = (dateStr: string): string => {
    return dateStr.slice(0, 10).replace(/-/g, '.')
  }

  /**
   * 기간 한글 변환
   */
  const formatPeriod = (period: string): string => {
    const map: Record<string, string> = {
      monthly: '월간',
      weekly: '주간',
      daily: '일간',
    }
    return map[period] || period
  }

  /**
   * 프로그레스바 색상 결정
   */
  const getProgressColor = (alert: BudgetAlert): string => {
    if (alert.is_exceeded) return 'bg-red-500'
    if (alert.is_warning) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">예산 관리</h1>
          <p className="text-sm text-gray-500 mt-1">카테고리별 예산을 설정하고 지출 현황을 확인하세요</p>
        </div>
        <button
          onClick={handleAddClick}
          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
        >
          + 예산 추가
        </button>
      </div>

      {/* 알림 카드 */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">🔔 예산 알림</h2>
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div
                key={alert.budget_id}
                className={`p-4 rounded-lg border ${
                  alert.is_exceeded
                    ? 'bg-red-50 border-red-200'
                    : alert.is_warning
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-green-50 border-green-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">{alert.category_name}</span>
                  <span
                    className={`text-sm font-semibold ${
                      alert.is_exceeded
                        ? 'text-red-600'
                        : alert.is_warning
                        ? 'text-yellow-700'
                        : 'text-green-600'
                    }`}
                  >
                    {alert.usage_percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div
                    className={`h-2 rounded-full ${getProgressColor(alert)}`}
                    style={{ width: `${Math.min(alert.usage_percentage, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>
                    사용: {formatAmount(alert.spent_amount)} / {formatAmount(alert.budget_amount)}
                  </span>
                  <span>남은 금액: {formatAmount(alert.remaining_amount)}</span>
                </div>
                {alert.is_exceeded && (
                  <p className="text-xs text-red-600 mt-2">⚠️ 예산을 초과했습니다!</p>
                )}
                {alert.is_warning && !alert.is_exceeded && (
                  <p className="text-xs text-yellow-700 mt-2">⚠️ 예산의 80%를 사용했습니다</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 예산 목록 */}
      {budgets.length === 0 ? (
        <EmptyState
          icon="📋"
          title="아직 설정된 예산이 없습니다"
          description="예산을 추가하여 지출을 계획하고 관리해보세요"
          action={{
            label: '예산 추가하기',
            onClick: handleAddClick,
          }}
        />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    카테고리
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    금액
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    기간
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    시작일
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    종료일
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    알림 임계값
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {budgets.map((budget) => (
                  <tr key={budget.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {getCategoryName(budget.category_id)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {formatAmount(budget.amount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatPeriod(budget.period)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(budget.start_date)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {budget.end_date ? formatDate(budget.end_date) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {budget.alert_threshold ? `${budget.alert_threshold}%` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <button
                        onClick={() => handleEditClick(budget)}
                        className="text-primary-600 hover:text-primary-700 font-medium mr-3"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(budget.id)}
                        className="text-red-600 hover:text-red-700 font-medium"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 예산 추가/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingBudget ? '예산 수정' : '예산 추가'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 카테고리 선택 */}
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                  카테고리 *
                </label>
                <select
                  id="category"
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  required
                >
                  <option value="">선택하세요</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 금액 입력 */}
              <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                  금액 *
                </label>
                <input
                  id="amount"
                  type="number"
                  min="0"
                  step="1000"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="0"
                  required
                />
              </div>

              {/* 기간 선택 */}
              <div>
                <label htmlFor="period" className="block text-sm font-medium text-gray-700 mb-1">
                  기간
                </label>
                <select
                  id="period"
                  value={formData.period}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      period: e.target.value as 'monthly' | 'weekly' | 'daily',
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="monthly">월간</option>
                  <option value="weekly">주간</option>
                  <option value="daily">일간</option>
                </select>
              </div>

              {/* 시작일 */}
              <div>
                <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-1">
                  시작일
                </label>
                <input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* 종료일 */}
              <div>
                <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-1">
                  종료일 (선택)
                </label>
                <input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* 알림 임계값 */}
              <div>
                <label
                  htmlFor="alert_threshold"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  알림 임계값 (%)
                </label>
                <input
                  id="alert_threshold"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.alert_threshold}
                  onChange={(e) => setFormData({ ...formData, alert_threshold: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="80"
                />
                <p className="text-xs text-gray-500 mt-1">
                  예산의 이 비율을 초과하면 경고를 표시합니다
                </p>
              </div>

              {/* 버튼 */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                >
                  {editingBudget ? '수정' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
