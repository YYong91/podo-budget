/**
 * @file CategoryManager.test.tsx
 * @description CategoryManager 페이지 테스트
 * 카테고리 목록, 추가, 수정, 삭제 기능을 테스트한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import CategoryManager from '../CategoryManager'
import { mockCategories } from '../../mocks/fixtures'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'
import { ToastProvider } from '../../contexts/ToastContext'

/**
 * addToast 함수를 모킹하기 위한 변수
 */
let mockAddToast: ReturnType<typeof vi.fn>

/**
 * useToast 훅 모킹
 */
vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({
    addToast: mockAddToast,
    removeToast: vi.fn(),
  }),
}))

/**
 * CategoryManager를 ToastProvider로 감싸서 렌더링
 */
function renderCategoryManager() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <CategoryManager />
      </ToastProvider>
    </MemoryRouter>
  )
}

/**
 * 각 테스트 전에 mockAddToast 초기화
 */
beforeEach(() => {
  mockAddToast = vi.fn()
})

describe('CategoryManager', () => {
  describe('기본 렌더링', () => {
    it('추가 버튼과 테이블을 포함한 페이지를 표시한다', async () => {
      renderCategoryManager()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '추가' })).toBeInTheDocument()
      })
    })

    it('추가 버튼을 표시한다', async () => {
      renderCategoryManager()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '추가' })).toBeInTheDocument()
      })
    })

    it('카테고리 테이블을 표시한다', async () => {
      renderCategoryManager()
      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument()
      })
    })
  })

  describe('카테고리 목록 표시', () => {
    it('모든 카테고리를 표시한다', async () => {
      renderCategoryManager()
      await waitFor(() => {
        mockCategories.forEach((category) => {
          expect(screen.getByText(category.name)).toBeInTheDocument()
        })
      })
    })

    it('카테고리 설명을 표시한다', async () => {
      renderCategoryManager()
      await waitFor(() => {
        // 데스크탑에서는 설명 컬럼에, 모바일에서는 이름 아래에 표시됨
        // description이 있는 카테고리가 있으면 텍스트로 확인
        const categoryWithDesc = mockCategories.find((c) => c.description)
        if (categoryWithDesc) {
          // 설명이 있는 경우 또는 "-" 표시
          const description = categoryWithDesc.description || '-'
          expect(screen.getAllByText(description).length).toBeGreaterThan(0)
        }
      })
    })

    it('각 카테고리에 수정/삭제 버튼을 표시한다', async () => {
      renderCategoryManager()
      await waitFor(() => {
        const editButtons = screen.getAllByRole('button', { name: '수정' })
        const deleteButtons = screen.getAllByRole('button', { name: '삭제' })
        expect(editButtons.length).toBeGreaterThan(0)
        expect(deleteButtons.length).toBeGreaterThan(0)
      })
    })

    it('시스템 카테고리에는 잠금 뱃지를 표시하고 수정/삭제 버튼을 숨긴다', async () => {
      renderCategoryManager()

      const systemCategories = mockCategories.filter((c) => c.is_system)
      const nonSystemCategories = mockCategories.filter((c) => !c.is_system)

      await waitFor(() => {
        // 시스템 카테고리 수만큼 '기본' 뱃지 표시
        const badges = screen.getAllByText('기본')
        expect(badges).toHaveLength(systemCategories.length)

        // 비시스템 카테고리 수만큼 수정/삭제 버튼 표시
        const editButtons = screen.getAllByRole('button', { name: '수정' })
        const deleteButtons = screen.getAllByRole('button', { name: '삭제' })
        expect(editButtons).toHaveLength(nonSystemCategories.length)
        expect(deleteButtons).toHaveLength(nonSystemCategories.length)
      })
    })
  })

  describe('카테고리 추가', () => {
    it('추가 버튼을 클릭하면 입력 폼이 표시된다', async () => {
      const user = userEvent.setup()
      renderCategoryManager()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '추가' })).toBeInTheDocument()
      })

      const addButton = screen.getByRole('button', { name: '추가' })
      await user.click(addButton)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('카테고리 이름')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument()
      })
    })

    it('카테고리 이름을 입력하고 저장할 수 있다', async () => {
      const user = userEvent.setup()

      renderCategoryManager()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '추가' })).toBeInTheDocument()
      })

      const addButton = screen.getByRole('button', { name: '추가' })
      await user.click(addButton)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('카테고리 이름')).toBeInTheDocument()
      })

      const nameInput = screen.getByPlaceholderText('카테고리 이름')
      await user.type(nameInput, '새 카테고리')

      const saveButton = screen.getByRole('button', { name: '저장' })
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('success', '카테고리를 추가했어요')
      })
    })

    it('빈 이름으로 저장하면 에러 메시지를 표시한다', async () => {
      const user = userEvent.setup()

      renderCategoryManager()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '추가' })).toBeInTheDocument()
      })

      const addButton = screen.getByRole('button', { name: '추가' })
      await user.click(addButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument()
      })

      const saveButton = screen.getByRole('button', { name: '저장' })
      await user.click(saveButton)

      expect(mockAddToast).toHaveBeenCalledWith('error', '카테고리 이름을 입력해주세요')
    })

    it('추가 폼에서 취소 버튼을 클릭하면 폼이 닫힌다', async () => {
      const user = userEvent.setup()
      renderCategoryManager()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '추가' })).toBeInTheDocument()
      })

      const addButton = screen.getByRole('button', { name: '추가' })
      await user.click(addButton)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('카테고리 이름')).toBeInTheDocument()
      })

      // 취소 버튼 중에서 추가 폼의 취소 버튼 찾기
      const cancelButtons = screen.getAllByRole('button', { name: '취소' })
      await user.click(cancelButtons[0])

      await waitFor(() => {
        expect(screen.queryByPlaceholderText('카테고리 이름')).not.toBeInTheDocument()
      })
    })
  })

  describe('카테고리 수정', () => {
    // 쇼핑(mockCategories[2])은 is_system: false → 수정/삭제 버튼 표시
    const editableCategory = mockCategories[2]

    it('수정 버튼을 클릭하면 편집 모드로 전환된다', async () => {
      const user = userEvent.setup()
      renderCategoryManager()

      await waitFor(() => {
        expect(screen.getByText(editableCategory.name)).toBeInTheDocument()
      })

      const editButtons = screen.getAllByRole('button', { name: '수정' })
      await user.click(editButtons[0])

      await waitFor(() => {
        const nameInput = screen.getByDisplayValue(editableCategory.name)
        expect(nameInput).toBeInTheDocument()
      })
    })

    it('카테고리 이름을 수정할 수 있다', async () => {
      const user = userEvent.setup()

      renderCategoryManager()

      await waitFor(() => {
        expect(screen.getByText(editableCategory.name)).toBeInTheDocument()
      })

      const editButtons = screen.getAllByRole('button', { name: '수정' })
      await user.click(editButtons[0])

      await waitFor(() => {
        expect(screen.getByDisplayValue(editableCategory.name)).toBeInTheDocument()
      })

      const nameInput = screen.getByDisplayValue(editableCategory.name)
      await user.clear(nameInput)
      await user.type(nameInput, '수정된 카테고리')

      const saveButton = screen.getByRole('button', { name: '저장' })
      await user.click(saveButton)

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('success', '카테고리를 수정했어요')
      })
    })

    it('편집 중 취소 버튼을 클릭하면 편집 모드를 종료한다', async () => {
      const user = userEvent.setup()
      renderCategoryManager()

      await waitFor(() => {
        expect(screen.getByText(editableCategory.name)).toBeInTheDocument()
      })

      const editButtons = screen.getAllByRole('button', { name: '수정' })
      await user.click(editButtons[0])

      await waitFor(() => {
        expect(screen.getByDisplayValue(editableCategory.name)).toBeInTheDocument()
      })

      const cancelButton = screen.getByRole('button', { name: '취소' })
      await user.click(cancelButton)

      await waitFor(() => {
        expect(screen.queryByDisplayValue(editableCategory.name)).not.toBeInTheDocument()
      })
    })
  })

  describe('카테고리 삭제', () => {
    it('삭제 버튼을 클릭하면 삭제 확인 모달이 표시된다', async () => {
      const user = userEvent.setup()
      renderCategoryManager()

      await waitFor(() => {
        expect(screen.getByText(mockCategories[0].name)).toBeInTheDocument()
      })

      const deleteButtons = screen.getAllByRole('button', { name: '삭제' })
      await user.click(deleteButtons[0])

      await waitFor(() => {
        expect(screen.getByText('카테고리 삭제')).toBeInTheDocument()
        expect(screen.getByText(/정말로 이 카테고리를 삭제하시겠습니까/i)).toBeInTheDocument()
      })
    })

    it('삭제 모달에서 취소를 클릭하면 모달이 닫힌다', async () => {
      const user = userEvent.setup()
      renderCategoryManager()

      await waitFor(() => {
        expect(screen.getByText(mockCategories[0].name)).toBeInTheDocument()
      })

      const deleteButtons = screen.getAllByRole('button', { name: '삭제' })
      await user.click(deleteButtons[0])

      await waitFor(() => {
        expect(screen.getByText('카테고리 삭제')).toBeInTheDocument()
      })

      const cancelButtons = screen.getAllByRole('button', { name: '취소' })
      const modalCancelButton = cancelButtons[cancelButtons.length - 1]
      await user.click(modalCancelButton)

      await waitFor(() => {
        expect(screen.queryByText('카테고리 삭제')).not.toBeInTheDocument()
      })
    })

    it('삭제 모달에서 삭제를 클릭하면 카테고리를 삭제한다', async () => {
      const user = userEvent.setup()

      renderCategoryManager()

      await waitFor(() => {
        expect(screen.getByText(mockCategories[0].name)).toBeInTheDocument()
      })

      const deleteButtons = screen.getAllByRole('button', { name: '삭제' })
      await user.click(deleteButtons[0])

      await waitFor(() => {
        expect(screen.getByText('카테고리 삭제')).toBeInTheDocument()
      })

      const modalDeleteButtons = screen.getAllByRole('button', { name: '삭제' })
      const modalDeleteButton = modalDeleteButtons[modalDeleteButtons.length - 1]
      await user.click(modalDeleteButton)

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('success', '카테고리를 삭제했어요')
      })
    })
  })

  describe('빈 상태', () => {
    it('카테고리가 없으면 빈 상태를 표시한다', async () => {
      server.use(
        http.get('/api/categories', () => {
          return HttpResponse.json([])
        })
      )

      renderCategoryManager()

      await waitFor(() => {
        expect(screen.getByText('아직 카테고리가 없습니다')).toBeInTheDocument()
      })
    })

    it('빈 상태에서 카테고리 추가 버튼을 표시한다', async () => {
      server.use(
        http.get('/api/categories', () => {
          return HttpResponse.json([])
        })
      )

      renderCategoryManager()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '+ 카테고리 추가' })).toBeInTheDocument()
      })
    })
  })

  describe('에러 상태', () => {
    it('API 에러 발생 시 에러 상태를 표시한다', async () => {
      server.use(
        http.get('/api/categories', () => {
          return HttpResponse.json({ detail: 'Server error' }, { status: 500 })
        })
      )

      renderCategoryManager()

      await waitFor(() => {
        expect(screen.getByText('문제가 발생했습니다')).toBeInTheDocument()
        expect(mockAddToast).toHaveBeenCalledWith('error', '불러오지 못했어요')
      })
    })
  })

  describe('카테고리 삭제 API 실패', () => {
    it('삭제 API 실패 시 에러 토스트를 표시한다', async () => {
      server.use(
        http.delete('/api/categories/:id', () => {
          return HttpResponse.json({ detail: 'Server error' }, { status: 500 })
        })
      )

      const user = userEvent.setup()
      renderCategoryManager()

      await waitFor(() => {
        expect(screen.getByText(mockCategories[0].name)).toBeInTheDocument()
      })

      const deleteButtons = screen.getAllByRole('button', { name: '삭제' })
      await user.click(deleteButtons[0])

      await waitFor(() => {
        expect(screen.getByText('카테고리 삭제')).toBeInTheDocument()
      })

      const modalDeleteButtons = screen.getAllByRole('button', { name: '삭제' })
      const modalDeleteButton = modalDeleteButtons[modalDeleteButtons.length - 1]
      await user.click(modalDeleteButton)

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('error', '삭제에 실패했어요')
      })
    })
  })

  describe('type 탭 전환', () => {
    it('수입 카테고리 탭 클릭 시 수입 카테고리를 표시한다', async () => {
      const incomeCategories = [
        { id: 10, name: '급여', type: 'income', description: '월급', sort_order: 1, is_savings: false, is_system: true, exclude_auto_payment: false, emoji: '📌', created_at: '2024-01-01T00:00:00Z' },
        { id: 11, name: '부수입', type: 'income', description: null, sort_order: 2, is_savings: false, is_system: false, exclude_auto_payment: false, emoji: '📌', created_at: '2024-01-01T00:00:00Z' },
      ]

      server.use(
        http.get('/api/categories', ({ request }) => {
          const url = new URL(request.url)
          const type = url.searchParams.get('type')
          if (type === 'income') {
            return HttpResponse.json(incomeCategories)
          }
          return HttpResponse.json(mockCategories)
        })
      )

      const user = userEvent.setup()
      renderCategoryManager()

      await waitFor(() => {
        expect(screen.getByText(mockCategories[0].name)).toBeInTheDocument()
      })

      // 수입 탭 클릭
      await user.click(screen.getByRole('button', { name: /수입 카테고리/ }))

      await waitFor(() => {
        expect(screen.getByText('급여')).toBeInTheDocument()
        expect(screen.getByText('부수입')).toBeInTheDocument()
      })
    })

    it('지출 탭이 기본 선택되어 있다', async () => {
      renderCategoryManager()

      await waitFor(() => {
        expect(screen.getByText(mockCategories[0].name)).toBeInTheDocument()
      })

      // 지출 탭 버튼이 활성 스타일 (bg-grape-100 class)
      const expenseTab = screen.getByRole('button', { name: /지출 카테고리/ })
      expect(expenseTab.className).toContain('grape')
    })
  })

  describe('시스템 카테고리 보호', () => {
    it('시스템 카테고리는 순서 이동 버튼이 비활성화되어 있다', async () => {
      renderCategoryManager()

      const systemCategory = mockCategories.find((c) => c.is_system)!
      await waitFor(() => {
        expect(screen.getByText(systemCategory.name)).toBeInTheDocument()
      })

      // 시스템 카테고리의 이동 버튼이 비활성화
      const upButton = screen.getByLabelText(`${systemCategory.name} 위로 이동`)
      const downButton = screen.getByLabelText(`${systemCategory.name} 아래로 이동`)
      expect(upButton).toBeDisabled()
      expect(downButton).toBeDisabled()
    })
  })

  describe('저축성 지출 토글', () => {
    it('추가 폼에 "저축성 지출" 체크박스가 표시된다', async () => {
      const user = userEvent.setup()
      renderCategoryManager()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '추가' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '추가' }))

      await waitFor(() => {
        expect(screen.getByLabelText('저축성 지출')).toBeInTheDocument()
      })
    })

    it('저축성 카테고리에 저축 뱃지를 표시한다', async () => {
      const savingsCategories = [
        { id: 10, name: '적금', type: 'expense' as const, description: null, sort_order: 1, is_savings: true, is_system: false, exclude_auto_payment: false, emoji: '📌', created_at: '2024-01-01T00:00:00Z' },
        { id: 11, name: '식비', type: 'expense' as const, description: null, sort_order: 2, is_savings: false, is_system: false, exclude_auto_payment: false, emoji: '📌', created_at: '2024-01-01T00:00:00Z' },
      ]

      server.use(
        http.get('/api/categories', () => {
          return HttpResponse.json(savingsCategories)
        })
      )

      renderCategoryManager()

      await waitFor(() => {
        expect(screen.getByText('적금')).toBeInTheDocument()
      })

      // 저축성 카테고리에만 "저축" 뱃지 표시
      expect(screen.getByText('저축')).toBeInTheDocument()
    })

    it('편집 모드에서 저축성 지출 체크박스가 표시된다', async () => {
      const user = userEvent.setup()
      renderCategoryManager()

      await waitFor(() => {
        expect(screen.getByText(mockCategories[2].name)).toBeInTheDocument()
      })

      const editButtons = screen.getAllByRole('button', { name: '수정' })
      await user.click(editButtons[0])

      await waitFor(() => {
        expect(screen.getByLabelText('저축성 지출')).toBeInTheDocument()
      })
    })
  })

  describe('카테고리 추가 실패', () => {
    it('카테고리 추가 API 실패 시 에러 토스트를 표시한다', async () => {
      server.use(
        http.post('/api/categories', () => {
          return HttpResponse.json({ detail: 'Server error' }, { status: 500 })
        })
      )

      const user = userEvent.setup()
      renderCategoryManager()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '추가' })).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '추가' }))

      await waitFor(() => {
        expect(screen.getByPlaceholderText('카테고리 이름')).toBeInTheDocument()
      })

      await user.type(screen.getByPlaceholderText('카테고리 이름'), '실패 카테고리')
      await user.click(screen.getByRole('button', { name: '저장' }))

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('error', '저장에 실패했어요')
      })
    })
  })

  describe('카테고리 수정 실패', () => {
    it('카테고리 수정 API 실패 시 에러 토스트를 표시한다', async () => {
      server.use(
        http.put('/api/categories/:id', () => {
          return HttpResponse.json({ detail: 'Server error' }, { status: 500 })
        })
      )

      const editableCategory = mockCategories[2]
      const user = userEvent.setup()
      renderCategoryManager()

      await waitFor(() => {
        expect(screen.getByText(editableCategory.name)).toBeInTheDocument()
      })

      const editButtons = screen.getAllByRole('button', { name: '수정' })
      await user.click(editButtons[0])

      await waitFor(() => {
        expect(screen.getByDisplayValue(editableCategory.name)).toBeInTheDocument()
      })

      const nameInput = screen.getByDisplayValue(editableCategory.name)
      await user.clear(nameInput)
      await user.type(nameInput, '수정 실패')

      await user.click(screen.getByRole('button', { name: '저장' }))

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('error', '저장에 실패했어요')
      })
    })
  })
})
