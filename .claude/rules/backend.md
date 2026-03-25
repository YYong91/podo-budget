---
paths:
  - "backend/**"
---

# 백엔드 규칙

## API 엔드포인트
- 라우터 prefix: `/api/{리소스명}`
- CRUD 순서: Create → Read(list) → Read(detail) → Update → Delete
- 응답은 Pydantic 스키마 (`response_model` 명시)
- 에러는 HTTPException으로 처리
- household_id 필수: 없으면 `get_user_active_household_id()` fallback, 접근 권한은 `get_household_member()` 검증

## Household 접근 패턴
```python
# 모든 데이터 엔드포인트의 표준 패턴
if household_id is None:
    household_id = await get_user_active_household_id(current_user, db)
await get_household_member(household_id, current_user, db)
```

## 새 기능 추가 시 순서
1. models/에 모델 정의 (필요시) — `household_id` NOT NULL 포함
2. schemas/에 요청/응답 스키마
3. services/에 비즈니스 로직 (복잡한 경우)
4. api/에 라우터 추가
5. main.py에 라우터 등록
6. Alembic 마이그레이션 생성 (`alembic revision --autogenerate -m "설명"`)

## 테스트
- pytest + pytest-asyncio
- 디렉토리: `tests/integration/` (API), `tests/unit/` (서비스/유틸)
- 비동기 테스트에 `@pytest.mark.asyncio`
- httpx.AsyncClient로 API 테스트 (`authenticated_client` fixture)
- DB: SQLite in-memory (StaticPool, CI 속도용), 테스트마다 테이블 생성/삭제. 프로덕션은 Supabase PostgreSQL
- conftest.py fixtures: `test_user`, `test_household`, `db_session`, `authenticated_client`
- 테스트 데이터에 household_id 필수 포함
- `test_api_budget_bulk.py` — 벌크 저장 + 월별 알림 6개 테스트 (#354)
