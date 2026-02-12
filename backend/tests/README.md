# HomeNRich 백엔드 테스트 가이드

## 테스트 구조

```
tests/
├── conftest.py              # 공통 fixture (DB, HTTP 클라이언트, Mock)
├── unit/                    # 단위 테스트
│   ├── test_models.py       # ORM 모델 테스트
│   ├── test_schemas.py      # Pydantic 스키마 테스트
│   ├── test_llm_service.py  # LLM 서비스 Mock 테스트
│   ├── test_category_service.py  # 카테고리 서비스 테스트
│   └── test_config.py       # Config 설정 테스트
├── integration/             # 통합 테스트
│   ├── test_api_expenses.py    # 지출 API 테스트
│   ├── test_api_categories.py  # 카테고리 API 테스트
│   ├── test_api_chat.py        # 채팅 API 테스트
│   ├── test_api_insights.py    # 인사이트 API 테스트
│   └── test_database.py        # DB 세션 테스트
└── e2e/                     # E2E 테스트
    └── test_app.py          # 전체 앱 시나리오 테스트
```

## 설치

```bash
cd backend
pip install -r requirements.txt
```

**중요:** `aiosqlite` 패키지가 requirements.txt에 포함되어 있어야 합니다.

## 테스트 실행

### 전체 테스트 실행
```bash
pytest tests/ -v
```

### 특정 카테고리만 실행
```bash
# 단위 테스트만
pytest tests/unit/ -v

# 통합 테스트만
pytest tests/integration/ -v

# E2E 테스트만
pytest tests/e2e/ -v
```

### 특정 파일만 실행
```bash
pytest tests/unit/test_models.py -v
```

### 특정 테스트만 실행
```bash
pytest tests/unit/test_models.py::test_create_category -v
```

### 커버리지 포함 실행
```bash
pytest --cov=app tests/ -v
pytest --cov=app --cov-report=html tests/
```

### 실패한 테스트만 재실행
```bash
pytest --lf
```

### 출력 상세도 조절
```bash
pytest tests/ -v        # verbose (상세)
pytest tests/ -vv       # very verbose (더 상세)
pytest tests/ -q        # quiet (간결)
```

## 테스트 설계 원칙

### 1. 테스트 DB 격리성
- 각 테스트는 독립적인 SQLite 메모리 DB 사용
- 테스트 종료 시 자동으로 테이블 DROP
- PostgreSQL 의존성 제거로 빠른 실행

### 2. LLM API Mock 처리
- 실제 Anthropic/OpenAI API 호출 없음
- `mock_llm_parse_expense`, `mock_llm_generate_insights` fixture 사용
- 테스트마다 원하는 반환값 설정 가능

### 3. 비동기 테스트
- `@pytest.mark.asyncio` 데코레이터 사용
- `pytest-asyncio` 플러그인 자동 활성화 (`asyncio_mode = auto`)

### 4. Fixture 활용
- `db_session`: 테스트용 DB 세션
- `client`: FastAPI AsyncClient (HTTP 요청 테스트)
- `mock_llm_*`: LLM 서비스 Mock

## 테스트 작성 예시

### 단위 테스트 예시
```python
import pytest
from app.models.category import Category

@pytest.mark.asyncio
async def test_create_category(db_session):
    """카테고리 생성 테스트"""
    category = Category(name="식비", description="음식 관련")
    db_session.add(category)
    await db_session.commit()
    await db_session.refresh(category)

    assert category.id is not None
    assert category.name == "식비"
```

### 통합 테스트 예시
```python
import pytest

@pytest.mark.asyncio
async def test_create_expense(client, db_session):
    """지출 생성 API 테스트"""
    payload = {
        "amount": 8000.0,
        "description": "김치찌개",
        "date": "2026-02-11T12:00:00",
    }
    response = await client.post("/api/expenses/", json=payload)
    assert response.status_code == 200
    assert response.json()["amount"] == 8000.0
```

### Mock 사용 예시
```python
import pytest

@pytest.mark.asyncio
async def test_chat_with_mock(client, db_session, mock_llm_parse_expense):
    """LLM Mock을 사용한 채팅 테스트"""
    # Mock 반환값 설정
    mock_llm_parse_expense.return_value = {
        "amount": 8000,
        "category": "식비",
        "description": "김치찌개",
        "date": "2026-02-11",
        "memo": "",
    }

    response = await client.post("/api/chat/", json={"message": "김치찌개 8000원"})
    assert response.status_code == 200
    assert "기록되었습니다" in response.json()["message"]
```

## 주요 테스트 커버리지

### Models (ORM)
- ✅ Category, Expense, Budget 생성
- ✅ Relationship (1:N) 검증
- ✅ 기본값 및 Nullable 필드

### Schemas (Pydantic)
- ✅ 유효성 검증 (ValidationError)
- ✅ 선택 필드 처리
- ✅ ORM 모델 변환 (from_attributes)

### Services
- ✅ LLM 프로바이더 팩토리 함수
- ✅ parse_expense, generate_insights Mock
- ✅ get_or_create_category 중복 방지

### API Endpoints
- ✅ CRUD 전체 (Create, Read, Update, Delete)
- ✅ 필터링 (날짜, 카테고리)
- ✅ 페이지네이션 (skip, limit)
- ✅ 월별 통계 및 인사이트 생성
- ✅ 에러 핸들링 (404, 400, 422)

### E2E Scenarios
- ✅ 전체 워크플로우 (채팅 → 지출 생성 → 통계 → 인사이트)
- ✅ 데이터 영속성 및 격리성
- ✅ 페이지네이션 및 필터링 조합

## 문제 해결

### ImportError 발생 시
```bash
# PYTHONPATH 설정
export PYTHONPATH=/Users/yyong/Developer/homenrich/backend:$PYTHONPATH
pytest tests/
```

### SQLite 에러 발생 시
```bash
pip install --upgrade aiosqlite
```

### asyncio 에러 발생 시
```bash
# pytest-asyncio 버전 확인
pip install --upgrade pytest-asyncio
```

## CI/CD 통합 예시

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
        with:
          python-version: '3.12'
      - run: pip install -r requirements.txt
      - run: pytest tests/ -v --cov=app
```

## 참고 자료

- [pytest 공식 문서](https://docs.pytest.org/)
- [pytest-asyncio 문서](https://pytest-asyncio.readthedocs.io/)
- [FastAPI 테스트 가이드](https://fastapi.tiangolo.com/tutorial/testing/)
- [SQLAlchemy 비동기 테스트](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)
