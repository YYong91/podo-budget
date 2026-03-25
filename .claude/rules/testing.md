# 테스트 규칙

## 백엔드 (pytest + pytest-asyncio)

### 구조
- `tests/unit/` — 서비스, 유틸리티 로직 (HTTP 없이 직접 호출)
- `tests/integration/` — API 엔드포인트 (AsyncClient로 HTTP 테스트)
- `tests/conftest.py` — 공유 fixture

### 핵심 fixture
- `db_session` — SQLite in-memory (CI 속도 + 외부 의존성 없음), 테스트마다 테이블 생성/삭제
- `test_user` / `test_user2` — Shadow User (podo-auth 스타일, auth_user_id 사용)
- `test_household` — 기본 가구 + owner 멤버십
- `authenticated_client` — JWT 헤더 포함된 AsyncClient
- `mock_llm_*` — LLM 프로바이더 모킹

### 패턴
```python
@pytest.mark.asyncio
async def test_기능_설명(authenticated_client, test_user, db_session):
    # 1. 데이터 준비 (db_session으로 직접 삽입)
    # 2. API 호출 (authenticated_client)
    response = await authenticated_client.post("/api/expenses", json=payload)
    # 3. 응답 검증
    assert response.status_code == 201
    assert response.json()["amount"] == 8000
```

### 주의사항
- 테스트 데이터에 `household_id` 필수 포함
- rate limiter는 테스트 시 비활성화됨
- `test_api_budget_bulk.py` — 벌크 저장 + 월별 알림 6개 테스트 (#354)

## 프론트엔드 (Vitest + React Testing Library + MSW)

### 구조
- `src/**/__tests__/` — 각 디렉토리 하위에 테스트 배치
- `src/mocks/server.ts` — MSW 서버 설정
- `src/mocks/handlers.ts` — API 엔드포인트 모킹 (50+ 핸들러)
- `src/mocks/fixtures.ts` — 테스트용 목 데이터

### MSW 설정
```typescript
// setup.ts에서 전역 설정
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

### 모킹 패턴
```typescript
// 라우터
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
}))

// Zustand 스토어
vi.mock('../../stores/useHouseholdStore', () => ({
  useHouseholdStore: (selector?: Function) => {
    const state = { activeHouseholdId: 1, households: [{ id: 1 }], isLoading: false }
    return selector ? selector(state) : state
  },
}))

// 커스텀 훅
vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ addToast: vi.fn(), removeToast: vi.fn() }),
}))
```

### 테스트 네이밍
- 함수명: 영어 (`test_create_expense`, `it('renders ...')`)
- 설명/describe: 한국어 (`describe('지출 생성')`, `it('금액이 표시된다')`)

## 전체 테스트 실행
```bash
# 백엔드
cd backend && pytest -v

# 프론트엔드
cd frontend && npm run test:run

# PR 전 필수
cd frontend && npm run lint && npm run test:run && npm run build
```
