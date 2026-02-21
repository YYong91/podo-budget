/**
 * @file households.test.ts
 * @description 공유 가계부 API 단위 테스트
 * householdApi의 주요 메서드를 MSW로 테스트한다.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../mocks/server'
import householdApi from '../households'

const BASE_URL = '/api'

// 테스트용 Household 데이터
const mockHouseholds = [
  {
    id: 1,
    name: '우리 가족',
    description: '가족 가계부',
    currency: 'KRW',
    my_role: 'owner' as const,
    member_count: 2,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    name: '동아리',
    description: null,
    currency: 'KRW',
    my_role: 'member' as const,
    member_count: 5,
    created_at: '2024-01-15T00:00:00Z',
  },
]

const mockHouseholdDetail = {
  ...mockHouseholds[0],
  members: [
    {
      user_id: 1,
      username: 'owner',
      email: 'owner@test.com',
      role: 'owner' as const,
      joined_at: '2024-01-01T00:00:00Z',
    },
    {
      user_id: 2,
      username: 'member1',
      email: 'member1@test.com',
      role: 'member' as const,
      joined_at: '2024-01-02T00:00:00Z',
    },
  ],
}

const mockInvitation = {
  id: 1,
  household_id: 1,
  household_name: '우리 가족',
  invitee_email: 'invite@test.com',
  inviter_username: 'owner',
  role: 'member' as const,
  status: 'pending' as const,
  token: 'invite-token-123',
  expires_at: '2024-02-01T00:00:00Z',
  created_at: '2024-01-15T00:00:00Z',
}

// 핸들러 정의
const householdHandlers = [
  http.get(`${BASE_URL}/households/`, () =>
    HttpResponse.json(mockHouseholds)
  ),
  http.get(`${BASE_URL}/households/:id`, ({ params }) => {
    if (Number(params.id) === 1) {
      return HttpResponse.json(mockHouseholdDetail)
    }
    return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
  }),
  http.post(`${BASE_URL}/households/`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    const newHousehold = {
      id: 3,
      name: body.name,
      description: body.description ?? null,
      currency: body.currency ?? 'KRW',
      my_role: 'owner',
      member_count: 1,
      created_at: new Date().toISOString(),
    }
    return HttpResponse.json(newHousehold, { status: 201 })
  }),
  http.put(`${BASE_URL}/households/:id`, async ({ params, request }) => {
    const household = mockHouseholds.find((h) => h.id === Number(params.id))
    if (!household) {
      return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    }
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({ ...household, ...body })
  }),
  http.delete(`${BASE_URL}/households/:id`, ({ params }) => {
    const household = mockHouseholds.find((h) => h.id === Number(params.id))
    if (!household) {
      return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
    }
    return new HttpResponse(null, { status: 204 })
  }),
  http.post(`${BASE_URL}/households/:id/leave`, () =>
    new HttpResponse(null, { status: 204 })
  ),
  http.put(`${BASE_URL}/households/:householdId/members/:userId/role`, () =>
    HttpResponse.json({ message: 'ok' })
  ),
  http.delete(`${BASE_URL}/households/:householdId/members/:userId`, () =>
    new HttpResponse(null, { status: 204 })
  ),
  http.get(`${BASE_URL}/households/:id/invitations`, () =>
    HttpResponse.json([mockInvitation])
  ),
  http.post(`${BASE_URL}/households/:id/invitations`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      ...mockInvitation,
      invitee_email: body.email,
      role: body.role ?? 'member',
    }, { status: 201 })
  }),
  http.delete(`${BASE_URL}/households/:householdId/invitations/:invitationId`, () =>
    new HttpResponse(null, { status: 204 })
  ),
  http.get(`${BASE_URL}/invitations/my`, () =>
    HttpResponse.json([mockInvitation])
  ),
  http.post(`${BASE_URL}/invitations/:token/accept`, () =>
    HttpResponse.json({ household_id: 1, household_name: '우리 가족' })
  ),
  http.post(`${BASE_URL}/invitations/:token/reject`, () =>
    new HttpResponse(null, { status: 204 })
  ),
]

describe('householdApi', () => {
  beforeEach(() => {
    server.use(...householdHandlers)
  })

  describe('getHouseholds', () => {
    it('GET /api/households/를 호출하여 Household 목록을 반환한다', async () => {
      const response = await householdApi.getHouseholds()

      expect(response.data).toEqual(mockHouseholds)
      expect(response.data).toHaveLength(2)
    })
  })

  describe('getHouseholdDetail', () => {
    it('GET /api/households/:id를 호출하여 상세 정보를 반환한다', async () => {
      const response = await householdApi.getHouseholdDetail(1)

      expect(response.data).toEqual(mockHouseholdDetail)
      expect(response.data.members).toHaveLength(2)
    })

    it('존재하지 않는 ID로 조회 시 404 에러를 반환한다', async () => {
      await expect(householdApi.getHouseholdDetail(999)).rejects.toThrow()
    })
  })

  describe('createHousehold', () => {
    it('POST /api/households/를 호출하여 Household를 생성한다', async () => {
      const response = await householdApi.createHousehold({
        name: '새 가구',
        description: '테스트용',
      })

      expect(response.data.id).toBe(3)
      expect(response.data.name).toBe('새 가구')
      expect(response.data.my_role).toBe('owner')
      expect(response.status).toBe(201)
    })
  })

  describe('updateHousehold', () => {
    it('PUT /api/households/:id를 호출하여 Household를 수정한다', async () => {
      const response = await householdApi.updateHousehold(1, { name: '수정된 가구' })

      expect(response.data.name).toBe('수정된 가구')
    })
  })

  describe('deleteHousehold', () => {
    it('DELETE /api/households/:id를 호출하여 Household를 삭제한다', async () => {
      const response = await householdApi.deleteHousehold(1)

      expect(response.status).toBe(204)
    })
  })

  describe('leaveHousehold', () => {
    it('POST /api/households/:id/leave를 호출하여 Household를 탈퇴한다', async () => {
      const response = await householdApi.leaveHousehold(1)

      expect(response.status).toBe(204)
    })
  })

  describe('updateMemberRole', () => {
    it('PUT /api/households/:id/members/:userId/role을 호출하여 역할을 변경한다', async () => {
      const response = await householdApi.updateMemberRole(1, 2, 'admin')

      expect(response.data).toEqual({ message: 'ok' })
    })
  })

  describe('removeMember', () => {
    it('DELETE /api/households/:id/members/:userId를 호출하여 멤버를 추방한다', async () => {
      const response = await householdApi.removeMember(1, 2)

      expect(response.status).toBe(204)
    })
  })

  describe('getHouseholdInvitations', () => {
    it('GET /api/households/:id/invitations를 호출하여 초대 목록을 반환한다', async () => {
      const response = await householdApi.getHouseholdInvitations(1)

      expect(response.data).toHaveLength(1)
      expect(response.data[0].invitee_email).toBe('invite@test.com')
    })
  })

  describe('createInvitation', () => {
    it('POST /api/households/:id/invitations를 호출하여 초대를 생성한다', async () => {
      const response = await householdApi.createInvitation(1, {
        email: 'new@test.com',
        role: 'member',
      })

      expect(response.data.invitee_email).toBe('new@test.com')
      expect(response.status).toBe(201)
    })
  })

  describe('cancelInvitation', () => {
    it('DELETE /api/households/:id/invitations/:invId를 호출하여 초대를 취소한다', async () => {
      const response = await householdApi.cancelInvitation(1, 1)

      expect(response.status).toBe(204)
    })
  })

  describe('getMyInvitations', () => {
    it('GET /api/invitations/를 호출하여 받은 초대 목록을 반환한다', async () => {
      const response = await householdApi.getMyInvitations()

      expect(response.data).toHaveLength(1)
      expect(response.data[0].status).toBe('pending')
    })
  })

  describe('acceptInvitation', () => {
    it('POST /api/invitations/:token/accept를 호출하여 초대를 수락한다', async () => {
      const response = await householdApi.acceptInvitation('invite-token-123')

      expect(response.data).toEqual({
        household_id: 1,
        household_name: '우리 가족',
      })
    })
  })

  describe('rejectInvitation', () => {
    it('POST /api/invitations/:token/reject를 호출하여 초대를 거절한다', async () => {
      const response = await householdApi.rejectInvitation('invite-token-123')

      expect(response.status).toBe(204)
    })
  })
})
