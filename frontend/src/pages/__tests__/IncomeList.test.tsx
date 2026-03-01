import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'
import IncomeList from '../IncomeList'

function renderIncomeList() {
  return render(
    <MemoryRouter>
      <IncomeList />
    </MemoryRouter>,
  )
}

describe('IncomeList', () => {
  it('페이지 제목을 표시한다', async () => {
    renderIncomeList()
    expect(screen.getByText('수입 목록')).toBeInTheDocument()
  })

  it('수입 목록을 표시한다', async () => {
    renderIncomeList()
    await waitFor(() => {
      expect(screen.getByText('2월 월급')).toBeInTheDocument()
    })
    expect(screen.getByText('프리랜스 수입')).toBeInTheDocument()
  })

  it('금액을 원화로 표시한다', async () => {
    renderIncomeList()
    await waitFor(() => {
      expect(screen.getByText('+₩3,500,000')).toBeInTheDocument()
    })
  })

  it('날짜 프리셋 버튼이 4개 표시된다', async () => {
    renderIncomeList()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '이번주' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '지난주' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '이번달' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '저번달' })).toBeInTheDocument()
    })
  })

  it('이번달 버튼을 클릭하면 날짜 필터가 이번달 범위로 설정된다', async () => {
    const user = userEvent.setup()
    renderIncomeList()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '이번달' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '이번달' }))

    // 이번달 1일이 시작일로 설정됨 (로컬 타임존 기준)
    const today = new Date()
    const expectedStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
    await waitFor(() => {
      const inputs = document.querySelectorAll('input[type="date"]')
      expect(inputs[0]).toHaveValue(expectedStart)
    })
  })

  it('수입이 없으면 빈 상태를 표시한다', async () => {
    server.use(http.get('/api/income', () => HttpResponse.json([])))
    renderIncomeList()
    await waitFor(() => {
      expect(screen.getByText(/수입 내역이 없습니다/)).toBeInTheDocument()
    })
  })

  it('에러 발생 시 에러 상태를 표시한다', async () => {
    server.use(http.get('/api/income', () => HttpResponse.json({ detail: 'Error' }, { status: 500 })))
    renderIncomeList()
    await waitFor(() => {
      expect(screen.getByText('문제가 발생했습니다')).toBeInTheDocument()
    })
  })
})
