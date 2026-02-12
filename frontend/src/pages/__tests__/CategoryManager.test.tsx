/**
 * @file CategoryManager.test.tsx
 * @description CategoryManager 페이지 테스트
 * 카테고리 목록, 추가, 수정, 삭제 기능을 테스트한다.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CategoryManager from '../CategoryManager'
import { mockCategories } from '../../mocks/fixtures'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'
import toast from 'react-hot-toast'

function renderCategoryManager() {
  return render(<CategoryManager />)
}

describe('CategoryManager', () => {
  describe('기본 렌더링', () => {
    it('페이지 제목을 표시한다', async () => {
      renderCategoryManager()
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: '카테고리 관리' })).toBeInTheDocument()
      })
    })

    it('추가 버튼을 표시한다', async () => {
      renderCategoryManager()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: '+ 추가' })).toBeInTheDocument()
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
  })

  describe('카테고리 추가', () => {
    it('추가 버튼을 클릭하면 입력 폼이 표시된다', async () => {
      const user = userEvent.setup()
      renderCategoryManager()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '+ 추가' })).toBeInTheDocument()
      })

      const addButton = screen.getByRole('button', { name: '+ 추가' })
      await user.click(addButton)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('카테고리 이름')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument()
      })
    })

    it('카테고리 이름을 입력하고 저장할 수 있다', async () => {
      const user = userEvent.setup()
      const toastSpy = vi.spyOn(toast, 'success')

      renderCategoryManager()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '+ 추가' })).toBeInTheDocument()
      })

      const addButton = screen.getByRole('button', { name: '+ 추가' })
      await user.click(addButton)

      await waitFor(() => {
        expect(screen.getByPlaceholderText('카테고리 이름')).toBeInTheDocument()
      })

      const nameInput = screen.getByPlaceholderText('카테고리 이름')
      await user.type(nameInput, '새 카테고리')

      const saveButton = screen.getByRole('button', { name: '저장' })
      await user.click(saveButton)

      await waitFor(() => {
        expect(toastSpy).toHaveBeenCalledWith('카테고리가 추가되었습니다')
      })
    })

    it('빈 이름으로 저장하면 에러 메시지를 표시한다', async () => {
      const user = userEvent.setup()
      const toastSpy = vi.spyOn(toast, 'error')

      renderCategoryManager()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '+ 추가' })).toBeInTheDocument()
      })

      const addButton = screen.getByRole('button', { name: '+ 추가' })
      await user.click(addButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument()
      })

      const saveButton = screen.getByRole('button', { name: '저장' })
      await user.click(saveButton)

      expect(toastSpy).toHaveBeenCalledWith('카테고리 이름을 입력해주세요')
    })

    it('추가 폼에서 취소 버튼을 클릭하면 폼이 닫힌다', async () => {
      const user = userEvent.setup()
      renderCategoryManager()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '+ 추가' })).toBeInTheDocument()
      })

      const addButton = screen.getByRole('button', { name: '+ 추가' })
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
    it('수정 버튼을 클릭하면 편집 모드로 전환된다', async () => {
      const user = userEvent.setup()
      renderCategoryManager()

      await waitFor(() => {
        expect(screen.getByText(mockCategories[0].name)).toBeInTheDocument()
      })

      const editButtons = screen.getAllByRole('button', { name: '수정' })
      await user.click(editButtons[0])

      await waitFor(() => {
        const nameInput = screen.getByDisplayValue(mockCategories[0].name)
        expect(nameInput).toBeInTheDocument()
      })
    })

    it('카테고리 이름을 수정할 수 있다', async () => {
      const user = userEvent.setup()
      const toastSpy = vi.spyOn(toast, 'success')

      renderCategoryManager()

      await waitFor(() => {
        expect(screen.getByText(mockCategories[0].name)).toBeInTheDocument()
      })

      const editButtons = screen.getAllByRole('button', { name: '수정' })
      await user.click(editButtons[0])

      await waitFor(() => {
        expect(screen.getByDisplayValue(mockCategories[0].name)).toBeInTheDocument()
      })

      const nameInput = screen.getByDisplayValue(mockCategories[0].name)
      await user.clear(nameInput)
      await user.type(nameInput, '수정된 카테고리')

      const saveButton = screen.getByRole('button', { name: '저장' })
      await user.click(saveButton)

      await waitFor(() => {
        expect(toastSpy).toHaveBeenCalledWith('카테고리가 수정되었습니다')
      })
    })

    it('편집 중 취소 버튼을 클릭하면 편집 모드를 종료한다', async () => {
      const user = userEvent.setup()
      renderCategoryManager()

      await waitFor(() => {
        expect(screen.getByText(mockCategories[0].name)).toBeInTheDocument()
      })

      const editButtons = screen.getAllByRole('button', { name: '수정' })
      await user.click(editButtons[0])

      await waitFor(() => {
        expect(screen.getByDisplayValue(mockCategories[0].name)).toBeInTheDocument()
      })

      const cancelButton = screen.getByRole('button', { name: '취소' })
      await user.click(cancelButton)

      await waitFor(() => {
        expect(screen.queryByDisplayValue(mockCategories[0].name)).not.toBeInTheDocument()
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
      const toastSpy = vi.spyOn(toast, 'success')

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
        expect(toastSpy).toHaveBeenCalledWith('카테고리가 삭제되었습니다')
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

      const toastSpy = vi.spyOn(toast, 'error')
      renderCategoryManager()

      await waitFor(() => {
        expect(screen.getByText('문제가 발생했습니다')).toBeInTheDocument()
        expect(toastSpy).toHaveBeenCalledWith('카테고리 목록을 불러오는데 실패했습니다')
      })
    })
  })
})
