# Supabase PostgreSQL 마이그레이션 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DB를 SQLite(파일 기반)에서 Supabase PostgreSQL(도쿄 리전)로 전환하여 동시 쓰기 락, 볼륨 유실 위험, prod/dev 환경 불일치를 해소한다. 동시에 전체 모델의 타임스탬프 일관성을 정비한다 (#310).

**Architecture:** `DATABASE_URL` 환경변수 교체가 핵심. SQLAlchemy ORM이 DB 차이를 추상화하므로 비즈니스 로직 변경 없음. SQLite 전용 코드(PRAGMA, check_same_thread)를 제거하고, Fly.io mounts를 제거한다. main.py의 `create_all` fallback은 PostgreSQL에서 스키마 드리프트 위험이 있으므로 제거한다. 타임스탬프 정비: 전체 모델에 `server_default=func.now()`, `nullable=False`를 일관 적용하여 raw SQL INSERT 안전성 확보. 테스트는 SQLite in-memory 유지(CI 속도 + 외부 의존성 없음).

**Tech Stack:** Supabase PostgreSQL (Transaction pooler, port 6543), asyncpg, SQLAlchemy 2.0 async, Alembic

**Supabase 연결 정보:**
- URL: `postgresql+asyncpg://postgres.hhmrlhmwwvkepcmfdkon:[PASSWORD]@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres`
- 리전: ap-northeast-1 (Tokyo) — Fly.io Tokyo(nrt)와 동일 리전
- 모드: Transaction pooler (port 6543) — `connect_args={"prepared_statement_cache_size": 0}` 필수 (PgBouncer transaction mode 호환)

**기존 데이터:** dev/prod 모두 신규 Supabase DB를 사용. 기존 SQLite 데이터는 테스트 데이터만 있으므로 별도 마이그레이션 불필요.

---

## 파일 구조

### 수정 대상

| 파일 | 변경 내용 |
|------|----------|
| `backend/app/core/config.py` | DATABASE_URL 기본값을 PostgreSQL로 변경 |
| `backend/app/core/database.py` | SQLite 전용 코드 제거 |
| `backend/alembic/env.py` | 주석 정리 (SQLite 분기는 테스트 호환용으로 유지) |
| `backend/app/main.py` | `create_all` fallback 제거 + SQLite 주석 정리 |
| `backend/fly.dev.toml` | SQLite URL 제거, mounts 제거 |
| `backend/fly.toml` | mounts 제거 |
| `backend/Dockerfile` | `/app/data` mkdir 제거 |
| `backend/.env.example` | PostgreSQL 예시로 변경 |
| `docker-compose.yml` | SQLite URL → .env 참조, 볼륨 정리 |
| `backend/tests/unit/test_config.py` | 기본값 assert 수정 |
| `backend/tests/unit/test_group31_arch.py` | DATABASE_URL 파라미터 수정 |
| `backend/tests/conftest.py` | 주석 업데이트 |
| `backend/tests/test_admin.py` | SQLite 주석 업데이트 |
| `backend/app/services/admin_service.py` | SQLite 호환 주석 정리 |
| `backend/app/services/bot_user_service.py` | SQLite 호환 주석 정리 |
| `backend/app/api/expenses.py` | SQLite 호환 주석 정리 |
| `backend/app/models/*.py` (12개) | `server_default=func.now()`, `nullable=False` 추가 (#310) |
| `backend/scripts/migrate_sqlite_to_pg.py` | 신규: 운영 데이터 마이그레이션 스크립트 |
| `backend/scripts/seed_demo_data.py` | "SQLite create_all" 주석 정리 |
| `backend/scripts/seed_multi_household.py` | "SQLite create_all" 주석 정리 |
| `backend/run_tests.sh` | "HomeNRich" → "포도가계부" 주석 정리 |
| `CLAUDE.md` | SQLite 언급 업데이트 |
| `.claude/rules/backend.md` | SQLite 언급 업데이트 |
| `.claude/rules/testing.md` | SQLite 언급 업데이트 |
| `docs/operations/deployment-strategy-summary.md` | SQLite → PostgreSQL |
| `docs/operations/production-checklist.md` | SQLite → PostgreSQL |
| `backend/tests/README.md` | SQLite 가이드 업데이트 |

### 변경하지 않는 파일

| 파일 | 이유 |
|------|------|
| `alembic/versions/*.py` (14개) | `batch_alter_table`은 PostgreSQL에서도 정상 동작 |
| `.github/workflows/ci-test.yml` | 테스트는 SQLite in-memory 유지 — CI에서 변경 불필요 |
| `.github/workflows/e2e.yml` | 테스트는 SQLite in-memory 유지 — CI에서 변경 불필요 |
| `tests/conftest.py`의 TEST_DATABASE_URL | SQLite in-memory 테스트 유지 |
| `pyproject.toml`의 aiosqlite | 테스트 의존성으로 유지 |
| `requirements.txt`의 aiosqlite | 테스트 의존성으로 유지 |
| `docs/reviews/R1-B7-infra.md` | 과거 리뷰 기록 — 역사적 문서로 유지 |
| `docs/plans/2026-03-13-environment-separation-*.md` | 과거 계획 문서 — 역사적 문서로 유지 |
| `content/projects/podonest.md` | tags에 SQLite 포함 — 기술 이력이므로 유지 |

---

### Task 1: 핵심 설정 변경 — config.py, database.py

**Files:**
- Modify: `backend/app/core/config.py:23`
- Modify: `backend/app/core/database.py:1-24`

- [ ] **Step 1: config.py — DATABASE_URL 기본값을 PostgreSQL로 변경**

```python
# 변경 전
DATABASE_URL: str = "sqlite+aiosqlite:///./data/db.sqlite3"

# 변경 후
DATABASE_URL: str = "postgresql+asyncpg://localhost:5432/podo_budget"
```

기본값을 PostgreSQL 로컬 개발 URL로 설정. `.env` 미설정 시 로컬 PostgreSQL 연결 시도하여 명확한 에러 발생.

- [ ] **Step 2: database.py — SQLite 전용 코드 제거**

```python
# 변경 후 전체 파일
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True,
    # PostgreSQL: Supabase Transaction pooler (PgBouncer) 호환 — prepared statement 비활성화
    # SQLite (테스트): connect_args 불필요
    connect_args=(
        {"prepared_statement_cache_size": 0}
        if "postgresql" in settings.DATABASE_URL
        else {}
    ),
    # Fly.io 하이버네이션 후 stale 커넥션 자동 감지 + 30분마다 커넥션 재생성 (#241)
    pool_pre_ping=True,
    pool_recycle=1800,
)

AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
```

제거 항목:
- `from sqlalchemy import event` import
- `connect_args={"check_same_thread": False}` 조건문 → PostgreSQL일 때 `{"prepared_statement_cache_size": 0}`, 그 외 `{}`로 교체
- `set_sqlite_pragmas` 이벤트 리스너 전체

- [ ] **Step 3: 커밋**

```bash
git add backend/app/core/config.py backend/app/core/database.py
git commit -m "chore: SQLite 전용 코드 제거, DATABASE_URL 기본값을 PostgreSQL로 변경 (#336)"
```

---

### Task 2: main.py — create_all fallback 제거

**Files:**
- Modify: `backend/app/main.py:95-131`

**배경:** 기존 코드는 Alembic 실패 시 `Base.metadata.create_all`로 fallback한다. SQLite에서는 무해했지만, PostgreSQL에서는 Alembic 마이그레이션 히스토리 없이 테이블이 생성되어 스키마 드리프트 위험이 있다. Alembic이 유일한 스키마 관리 경로여야 한다.

- [ ] **Step 1: lifespan에서 create_all fallback 제거**

```python
# 변경 전 (라인 100-112)
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        capture_output=True,
        text=True,
        cwd=str(alembic_dir),
    )
    if result.returncode != 0:
        # 마이그레이션 실패 시 로그 출력 후 fallback으로 create_all 실행
        logger.error("Alembic 마이그레이션 실패, create_all로 폴백: %s", result.stderr)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    else:
        logger.info("Alembic 마이그레이션 완료: %s", result.stdout)

# 변경 후
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        capture_output=True,
        text=True,
        cwd=str(alembic_dir),
    )
    if result.returncode != 0:
        # PostgreSQL에서는 Alembic이 유일한 스키마 관리 경로 — fallback 없이 에러 로그만 출력
        logger.error("Alembic 마이그레이션 실패: %s", result.stderr)
    else:
        logger.info("Alembic 마이그레이션 완료: %s", result.stdout)
```

- [ ] **Step 2: sort_order 초기화 주석 정리**

```python
# 변경 전 (라인 114-115)
    # sort_order=0인 카테고리를 실제 사용 횟수(지출+수입)로 초기화
    # Alembic 마이그레이션이 실패(로컬 SQLite)해도 create_all 이후 동작

# 변경 후
    # sort_order=0인 카테고리를 실제 사용 횟수(지출+수입)로 초기화
```

- [ ] **Step 3: 커밋**

```bash
git add backend/app/main.py
git commit -m "fix: Alembic 실패 시 create_all fallback 제거 — PostgreSQL 스키마 드리프트 방지 (#336)"
```

---

### Task 3: Alembic 환경 정리

**Files:**
- Modify: `backend/alembic/env.py:1-107`

- [ ] **Step 1: alembic/env.py 주석 정리**

```python
"""Alembic 환경 설정 — async PostgreSQL 지원

이 파일은 Alembic 마이그레이션 실행 시 사용되는 환경 설정입니다.
- async URL을 동기 URL로 변환하여 Alembic이 실행 가능하도록 합니다
- render_as_batch=True로 기존 마이그레이션 호환성을 유지합니다
- app.models의 모든 모델을 import하여 Base.metadata에 등록합니다
"""
```

`get_url()` 함수:
- SQLite 분기는 테스트 호환을 위해 **유지**
- PostgreSQL 변환(`asyncpg → postgresql`)은 그대로 유지
- docstring만 정리

`render_as_batch=True`:
- 기존 14개 마이그레이션이 `batch_alter_table`을 사용하므로 **유지**
- 주석만 "SQLite ALTER TABLE 지원 필수" → "기존 마이그레이션 호환 유지"로 변경

`run_async_migrations()`:
- `settings.DATABASE_URL`을 직접 사용하는 것은 async driver가 필요하므로 정상 (주석 추가)

- [ ] **Step 2: 커밋**

```bash
git add backend/alembic/env.py
git commit -m "chore: Alembic 환경 설정 주석을 PostgreSQL 기반으로 정리 (#336)"
```

---

### Task 4: 타임스탬프 일관성 정비 (#310)

**Files:**
- Modify: `backend/app/models/user.py:42-43`
- Modify: `backend/app/models/expense.py:49-50`
- Modify: `backend/app/models/income.py:49-50`
- Modify: `backend/app/models/budget.py:47-48`
- Modify: `backend/app/models/recurring_transaction.py:52-53`
- Modify: `backend/app/models/asset.py:38-39`
- Modify: `backend/app/models/asset_snapshot.py:19`
- Modify: `backend/app/models/asset_goal.py:21-22`
- Modify: `backend/app/models/category_mapping.py:35`
- Modify: `backend/app/models/account.py:21-22`
- Modify: `backend/app/models/category.py:41`
- Modify: `backend/app/models/household.py:44-45`
- Modify: `backend/app/models/household_member.py:52`
- Modify: `backend/app/models/household_invitation.py:67`
- Modify: `backend/app/models/feedback.py:38-39`

**배경:** 모든 모델이 `default=func.now()`만 사용하고 `server_default`가 없음. ORM 경유 시 문제없지만 raw SQL INSERT(마이그레이션, Supabase 대시보드 직접 접근) 시 NULL 발생 가능. Supabase 전환과 동시에 일관 정비.

- [ ] **Step 1: 모든 모델의 created_at에 server_default, nullable=False 추가**

패턴 A — created_at + updated_at 모델 (10개: user, expense, income, budget, recurring_transaction, asset, asset_goal, account, household, feedback):

```python
# 변경 전
created_at = Column(DateTime, default=func.now())
updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

# 변경 후
created_at = Column(DateTime, default=func.now(), server_default=func.now(), nullable=False)
updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), server_default=func.now(), nullable=False)
```

참고: user, household, feedback는 이미 `nullable=False`이므로 `server_default`만 추가.

패턴 B — created_at만 있는 모델 (3개: category, category_mapping, asset_snapshot):

```python
# 변경 전
created_at = Column(DateTime, default=func.now())

# 변경 후
created_at = Column(DateTime, default=func.now(), server_default=func.now(), nullable=False)
```

패턴 C — joined_at (household_member):

```python
# 변경 전
joined_at = Column(DateTime, default=func.now(), nullable=False)

# 변경 후
joined_at = Column(DateTime, default=func.now(), server_default=func.now(), nullable=False)
```

패턴 D — created_at만 (household_invitation):

```python
# 변경 전
created_at = Column(DateTime, default=func.now(), nullable=False)

# 변경 후
created_at = Column(DateTime, default=func.now(), server_default=func.now(), nullable=False)
```

- [ ] **Step 2: Alembic 마이그레이션 생성**

Run: `cd backend && PYTHONPATH=. DATABASE_URL=sqlite+aiosqlite:///./data/temp.db uv run alembic revision --autogenerate -m "타임스탬프 server_default 추가 및 nullable=False 일관 적용"`

생성된 마이그레이션 파일 확인:
- `server_default=sa.func.now()` 추가
- `nullable=False` 변경 (기존 NULL 데이터가 있는 컬럼은 UPDATE 선행 필요)

- [ ] **Step 3: 마이그레이션 파일 수정 — 기존 NULL 데이터 처리**

autogenerate된 마이그레이션의 `upgrade()` 함수 상단에 추가:

```python
def upgrade():
    # 기존 NULL 타임스탬프를 현재 시각으로 채움 (nullable=False 전환 전 필수)
    # SQLite(테스트)와 PostgreSQL(운영) 모두 호환되도록 dialect 분기
    bind = op.get_bind()
    now_func = "datetime('now')" if bind.dialect.name == "sqlite" else "NOW()"

    tables_with_both = ["expenses", "incomes", "budgets", "recurring_transactions", "assets", "asset_goals", "accounts"]
    tables_created_only = ["categories", "category_mappings", "asset_snapshots"]

    for table in tables_with_both:
        op.execute(f"UPDATE {table} SET created_at = {now_func} WHERE created_at IS NULL")
        op.execute(f"UPDATE {table} SET updated_at = {now_func} WHERE updated_at IS NULL")
    for table in tables_created_only:
        op.execute(f"UPDATE {table} SET created_at = {now_func} WHERE created_at IS NULL")

    # 이후 autogenerate된 ALTER TABLE 문들...
```

- [ ] **Step 4: 테스트 실행**

Run: `cd backend && DATABASE_URL=sqlite+aiosqlite:///:memory: pytest tests/ --ignore=tests/integration/test_api_budget_bulk.py -v`

Expected: 전체 통과 (server_default 추가는 기존 ORM 동작에 영향 없음)

- [ ] **Step 5: temp.db 정리 + 커밋**

```bash
rm -f backend/data/temp.db
git add backend/app/models/ backend/alembic/versions/
git commit -m "feat: 전체 모델 타임스탬프 server_default + nullable=False 일관 적용 (#310)"
```

---

### Task 5: 테스트 코드 수정

**Files:**
- Modify: `backend/tests/unit/test_config.py:24,82-87`
- Modify: `backend/tests/unit/test_group31_arch.py:35,44,53`
- Modify: `backend/tests/conftest.py:1-4,30`
- Modify: `backend/tests/test_admin.py:8,25`

- [ ] **Step 1: test_config.py — 기본값 assert 수정**

```python
# test_settings_default_values (라인 24)
# 변경 전
assert "sqlite+aiosqlite" in settings.DATABASE_URL
# 변경 후
assert "postgresql+asyncpg" in settings.DATABASE_URL

# test_database_url_default (라인 82-87) — 전체 교체
def test_database_url_default():
    """DATABASE_URL 기본값 검증"""
    with patch.dict("os.environ", {}, clear=True):
        settings = Settings(_env_file=None)
        assert "postgresql+asyncpg" in settings.DATABASE_URL
        assert "podo_budget" in settings.DATABASE_URL
```

- [ ] **Step 2: test_group31_arch.py — DATABASE_URL 파라미터 수정**

3곳 모두 `sqlite+aiosqlite:///./test.db` → `postgresql+asyncpg://localhost/test` 로 변경.

```python
# 라인 35
Settings(LLM_PROVIDER="openai", OPENAI_API_KEY="", DATABASE_URL="postgresql+asyncpg://localhost/test")
# 라인 44
Settings(LLM_PROVIDER="anthropic", ANTHROPIC_API_KEY="", DATABASE_URL="postgresql+asyncpg://localhost/test")
# 라인 53
Settings(CORS_ORIGINS="*", DATABASE_URL="postgresql+asyncpg://localhost/test")
```

- [ ] **Step 3: conftest.py — 주석 업데이트 (코드 변경 없음)**

```python
# 라인 1-4 docstring
"""
테스트용 공통 fixture 모듈

- 테스트 DB: SQLite in-memory (CI 속도 + 외부 의존성 없음, 프로덕션은 Supabase PostgreSQL)
- LLM 서비스: Mock으로 대체
...
"""

# 라인 30 주석
# 테스트용 SQLite 데이터베이스 URL (in-memory, StaticPool로 연결 공유 — 프로덕션은 Supabase PostgreSQL)
```

- [ ] **Step 4: test_admin.py — 주석 업데이트**

```python
# 라인 8 — docstring 내
# 변경 전
#       SQLite in-memory 테스트 DB에서 test_user는 항상 id=1로 생성됩니다.
# 변경 후
#       테스트 DB(SQLite in-memory)에서 test_user는 항상 id=1로 생성됩니다.

# 라인 25
# 변경 전
# SQLite in-memory 테스트 DB에서 test_user는 항상 id=1
# 변경 후
# 테스트 DB에서 test_user는 항상 id=1
```

- [ ] **Step 5: 테스트 실행**

Run: `cd backend && DATABASE_URL=sqlite+aiosqlite:///:memory: pytest tests/ --ignore=tests/integration/test_api_budget_bulk.py -v`

Expected: 전체 통과

- [ ] **Step 6: 커밋**

```bash
git add backend/tests/unit/test_config.py backend/tests/unit/test_group31_arch.py backend/tests/conftest.py backend/tests/test_admin.py
git commit -m "test: DATABASE_URL 기본값 변경에 따른 테스트 수정 (#336)"
```

---

### Task 6: 배포 설정 변경 — fly.toml, fly.dev.toml, Dockerfile, docker-compose

**Files:**
- Modify: `backend/fly.dev.toml:11-15,37-39`
- Modify: `backend/fly.toml:43-45`
- Modify: `backend/Dockerfile:17-18`
- Modify: `docker-compose.yml:16,20`
- Modify: `backend/.env.example:1-3`

- [ ] **Step 1: fly.dev.toml — SQLite URL 제거 + mounts 제거**

```toml
[env]
  PORT = "8000"
  APP_NAME = "PodoBudget-Dev"
  # DEBUG는 Fly.io secrets로 관리 — 스택 트레이스 공개 노출 방지 (#157)
  # DATABASE_URL은 Fly.io secrets로 관리 (fly secrets set DATABASE_URL=postgresql+asyncpg://...)
  SENTRY_ENVIRONMENT = "development"
```

`[[mounts]]` 섹션 전체 제거.

- [ ] **Step 2: fly.toml — mounts 제거**

`[[mounts]]` 섹션 (라인 43-45) 제거.

- [ ] **Step 3: Dockerfile — /app/data mkdir 제거**

```dockerfile
# 삭제할 두 줄
# SQLite 데이터 디렉토리 생성
RUN mkdir -p /app/data
```

- [ ] **Step 4: docker-compose.yml — SQLite 설정 정리**

```yaml
services:
  backend:
    # ...
    volumes:
      - ./backend:/app
      - ./pyproject.toml:/app/pyproject.toml
      - ./uv.lock:/app/uv.lock
      # ./data:/app/data 볼륨 제거
    env_file:
      - ./backend/.env
    environment:
      # DATABASE_URL은 .env 파일에서 로드
      - JWT_SECRET=${JWT_SECRET:?JWT_SECRET 환경변수를 설정하세요}
      - AUTH_SERVER_URL=https://auth.podonest.com
```

- [ ] **Step 5: .env.example — PostgreSQL 예시로 변경**

```bash
# ──────────────── Database ────────────────
# Supabase PostgreSQL (Transaction pooler)
DATABASE_URL=postgresql+asyncpg://postgres.[PROJECT_REF]:[PASSWORD]@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres
```

- [ ] **Step 6: 커밋**

```bash
git add backend/fly.dev.toml backend/fly.toml backend/Dockerfile docker-compose.yml backend/.env.example
git commit -m "chore: 배포 설정에서 SQLite 제거, Supabase PostgreSQL 전환 (#336)"
```

---

### Task 7: 비즈니스 로직 + 스크립트 주석 정리

**Files:**
- Modify: `backend/app/services/admin_service.py:72,207`
- Modify: `backend/app/services/bot_user_service.py:115,218,260`
- Modify: `backend/app/api/expenses.py:467`
- Modify: `backend/scripts/seed_demo_data.py:132`
- Modify: `backend/scripts/seed_multi_household.py:319`
- Modify: `backend/run_tests.sh:3,17`

- [ ] **Step 1: admin_service.py — SQLite 호환 주석 정리**

```python
# 라인 72: 주석 변경
# 변경 전
#    SQLite에서 UNION ALL + ORDER BY/LIMIT 서브쿼리 호환 문제 회피
# 변경 후
#    개별 쿼리 후 Python에서 합치기 (UNION ALL 대비 쿼리 구조 단순화)

# 라인 207: 주석 변경
# 변경 전
# max(last_expense, last_income) — SQLite에는 greatest()가 없으므로 case 사용
# 변경 후
# max(last_expense, last_income) — NULL 처리를 위한 case 사용
```

참고: `greatest()` 전환은 이번 스코프 밖. 동작에 문제 없으므로 주석만 정리.

- [ ] **Step 2: bot_user_service.py — SQLite 호환 주석 정리**

```python
# 라인 115: 주석 변경
# 변경 전
# 만료 확인 (SQLite는 naive datetime 반환 → UTC로 간주하여 비교)
# 변경 후
# 만료 확인 (naive datetime이면 UTC로 간주하여 비교)

# 라인 218: 주석 변경
# 변경 전
# 이관할 지출 건수 먼저 조회 (RETURNING 대신 count 사용 — SQLite 호환)
# 변경 후
# 이관할 지출 건수 먼저 조회

# 라인 260: 동일하게 처리 (라인 115과 같은 패턴)
```

- [ ] **Step 3: expenses.py — SQLite 호환 주석 제거**

```python
# 라인 467: 주석 변경
# 변경 전
# 일별 추이 (DATE() 함수 — SQLite/PostgreSQL 모두 지원)
# 변경 후
# 일별 추이
```

- [ ] **Step 4: seed 스크립트 주석 정리**

```python
# seed_demo_data.py 라인 132
# 변경 전
# 테이블 생성 (SQLite create_all)
# 변경 후
# 테이블 생성

# seed_multi_household.py 라인 319
# 변경 전
# 테이블 생성 (SQLite create_all)
# 변경 후
# 테이블 생성
```

- [ ] **Step 5: run_tests.sh — 프로젝트명 정리**

```bash
# 라인 3
# 변경 전
# HomeNRich 백엔드 테스트 실행 스크립트
# 변경 후
# 포도가계부 백엔드 테스트 실행 스크립트

# 라인 17
# 변경 전
echo -e "${GREEN}HomeNRich 백엔드 테스트 시작${NC}"
# 변경 후
echo -e "${GREEN}포도가계부 백엔드 테스트 시작${NC}"
```

aiosqlite 체크 로직은 테스트에서 여전히 사용하므로 유지.

- [ ] **Step 6: 테스트 실행**

Run: `cd backend && DATABASE_URL=sqlite+aiosqlite:///:memory: pytest tests/ --ignore=tests/integration/test_api_budget_bulk.py -v`

Expected: 전체 통과

- [ ] **Step 7: 커밋**

```bash
git add backend/app/services/admin_service.py backend/app/services/bot_user_service.py backend/app/api/expenses.py backend/scripts/ backend/run_tests.sh
git commit -m "chore: 비즈니스 로직/스크립트에서 SQLite 호환 주석 정리 (#336)"
```

---

### Task 8: Supabase 연결 검증 + Alembic 마이그레이션 + 데이터 이관

**Files:**
- Create: `backend/scripts/migrate_sqlite_to_pg.py`

**운영 데이터 현황 (540KB):**
| 테이블 | 레코드 |
|--------|--------|
| users | 16 |
| expenses | 307 |
| incomes | 19 |
| categories | 47 |
| budgets | 8 |
| households | 15 |
| household_members | 16 |
| recurring_transactions | 19 |
| feedbacks | 1 |
| assets | 2 |
| accounts | 11 |
| category_mappings | 80 |

- [ ] **Step 1: 로컬 .env에 Supabase URL 설정**

```bash
# backend/.env (gitignore 대상)
DATABASE_URL=postgresql+asyncpg://postgres.hhmrlhmwwvkepcmfdkon:[PASSWORD]@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres
```

- [ ] **Step 2: Alembic 마이그레이션 실행 (스키마 생성)**

Run: `cd backend && PYTHONPATH=. uv run alembic upgrade head`

Expected: 모든 마이그레이션 적용 성공 (타임스탬프 정비 포함)

- [ ] **Step 3: 운영 SQLite DB 다운로드**

```bash
fly sftp get /app/data/db.sqlite3 /tmp/podo-prod.sqlite3 -a podo-budget-backend
```

- [ ] **Step 4: 데이터 마이그레이션 스크립트 작성**

`backend/scripts/migrate_sqlite_to_pg.py`:

```python
"""운영 SQLite → Supabase PostgreSQL 데이터 마이그레이션 스크립트

사용법:
    PYTHONPATH=. uv run python scripts/migrate_sqlite_to_pg.py /tmp/podo-prod.sqlite3

동작:
    1. SQLite에서 모든 테이블 데이터 읽기
    2. PostgreSQL에 INSERT (FK 순서 준수)
    3. PostgreSQL SEQUENCE 값 재설정 (auto-increment 충돌 방지)
"""
import asyncio
import sqlite3
import sys
from datetime import datetime, UTC

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.core.config import settings

# FK 의존성 순서대로 마이그레이션
TABLE_ORDER = [
    "users",
    "households",
    "household_members",
    "household_invitations",
    "categories",
    "category_mappings",
    "expenses",
    "incomes",
    "budgets",
    "recurring_transactions",
    "accounts",           # assets.account_id FK → accounts보다 먼저 삽입
    "assets",
    "asset_snapshots",
    "asset_goals",
    "feedbacks",
]


async def migrate(sqlite_path: str):
    # SQLite 연결
    src = sqlite3.connect(sqlite_path)
    src.row_factory = sqlite3.Row

    # PostgreSQL 연결
    engine = create_async_engine(
        settings.DATABASE_URL,
        connect_args={"prepared_statement_cache_size": 0},
    )
    async_session = async_sessionmaker(engine, class_=AsyncSession)

    async with async_session() as session:
        for table in TABLE_ORDER:
            rows = src.execute(f"SELECT * FROM {table}").fetchall()
            if not rows:
                print(f"  {table}: 0건 (스킵)")
                continue

            columns = rows[0].keys()
            col_str = ", ".join(columns)
            param_str = ", ".join(f":{c}" for c in columns)

            # SQLite boolean(0/1) → Python bool 변환이 필요한 컬럼
            BOOL_COLUMNS = {"is_active", "is_liability", "exclude_from_stats"}

            inserted = 0
            for row in rows:
                row_dict = dict(row)
                for key in row_dict:
                    # NULL datetime → 현재 시각
                    if key in ("created_at", "updated_at", "joined_at") and row_dict[key] is None:
                        row_dict[key] = datetime.now(UTC).isoformat()
                    # SQLite int(0/1) → Python bool (asyncpg는 int를 boolean으로 캐스팅 안 함)
                    if key in BOOL_COLUMNS and isinstance(row_dict[key], int):
                        row_dict[key] = bool(row_dict[key])
                try:
                    await session.execute(
                        text(f"INSERT INTO {table} ({col_str}) VALUES ({param_str})"),
                        row_dict,
                    )
                    inserted += 1
                except Exception as e:
                    print(f"    ⚠️ {table} row 실패: {e}")

            await session.commit()
            print(f"  {table}: {inserted}/{len(rows)}건 이관 완료")

        # SEQUENCE 재설정 (auto-increment 충돌 방지)
        print("\nSEQUENCE 재설정 중...")
        for table in TABLE_ORDER:
            seq_result = await session.execute(
                text(f"SELECT pg_get_serial_sequence('{table}', 'id')")
            )
            seq_name = seq_result.scalar()
            if seq_name:
                await session.execute(
                    text(f"SELECT setval('{seq_name}', COALESCE((SELECT MAX(id) FROM {table}), 1))")
                )
                print(f"  {table}: sequence 재설정 완료")
            else:
                print(f"  {table}: sequence 없음 (스킵)")
        await session.commit()
        print("SEQUENCE 재설정 완료")

    await engine.dispose()
    src.close()
    print("\n데이터 마이그레이션 완료!")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("사용법: PYTHONPATH=. uv run python scripts/migrate_sqlite_to_pg.py <sqlite_path>")
        sys.exit(1)
    asyncio.run(migrate(sys.argv[1]))
```

- [ ] **Step 5: 데이터 마이그레이션 실행**

Run: `cd backend && PYTHONPATH=. uv run python scripts/migrate_sqlite_to_pg.py /tmp/podo-prod.sqlite3`

Expected: 전체 테이블 이관 완료, SEQUENCE 재설정 완료

- [ ] **Step 6: 데이터 정합성 확인**

Supabase 대시보드 또는 로컬에서 확인:

```bash
cd backend && PYTHONPATH=. uv run python -c "
import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings

async def check():
    engine = create_async_engine(settings.DATABASE_URL, connect_args={'prepared_statement_cache_size': 0})
    async with engine.connect() as conn:
        for table in ['users', 'expenses', 'incomes', 'categories', 'budgets', 'households']:
            result = await conn.execute(text(f'SELECT COUNT(*) FROM {table}'))
            print(f'{table}: {result.scalar()}건')
    await engine.dispose()

asyncio.run(check())
"
```

- [ ] **Step 7: API 동작 확인**

Run: `cd backend && uv run uvicorn app.main:app --reload`

헬스체크: `curl http://localhost:8000/health`
DB 헬스체크: `curl http://localhost:8000/health/db`

Expected: 둘 다 200 OK

- [ ] **Step 8: 프론트엔드 연동 확인**

Run: `cd frontend && npm run dev`

로그인 후 기존 데이터가 정상 표시되는지 확인.

- [ ] **Step 9: 커밋**

```bash
git add backend/scripts/migrate_sqlite_to_pg.py
git commit -m "chore: SQLite → PostgreSQL 데이터 마이그레이션 스크립트 (#336)"
```

---

### Task 9: Fly.io secrets 설정

**Files:** 없음 (인프라 작업)

- [ ] **Step 1: dev 환경 secrets 설정**

```bash
fly secrets set DATABASE_URL="postgresql+asyncpg://postgres.hhmrlhmwwvkepcmfdkon:[PASSWORD]@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres" -a podo-budget-dev
```

- [ ] **Step 2: dev 환경 배포 확인**

develop 브랜치 머지 후 CD가 자동 배포. 또는 수동 배포:

```bash
cd backend && fly deploy --config fly.dev.toml -a podo-budget-dev
```

헬스체크: `curl https://podo-budget-dev.fly.dev/health/db`

- [ ] **Step 3: prod 환경 secrets 설정 (release 시)**

```bash
fly secrets set DATABASE_URL="postgresql+asyncpg://postgres.hhmrlhmwwvkepcmfdkon:[PASSWORD]@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres" -a podo-budget-backend
```

참고: prod는 release → main 머지 시 자동 배포.

---

### Task 10: 문서 업데이트

**Files:**
- Modify: `CLAUDE.md`
- Modify: `.claude/rules/backend.md`
- Modify: `.claude/rules/testing.md`
- Modify: `docs/operations/deployment-strategy-summary.md`
- Modify: `docs/operations/production-checklist.md`
- Modify: `backend/tests/README.md`

- [ ] **Step 1: CLAUDE.md — SQLite 언급 수정**

```markdown
# 라인 104
# 변경 전
- Docker Compose: `backend` + `frontend` (SQLite, 볼륨 마운트)
# 변경 후
- Docker Compose: `backend` + `frontend`

# 라인 167
# 변경 전
- **Infrastructure**: Docker Compose로 SQLite + Backend + Frontend 실행. post-merge 훅으로 자동 배포.
# 변경 후
- **Infrastructure**: Docker Compose로 Backend + Frontend 실행. Supabase PostgreSQL(도쿄). post-merge 훅으로 자동 배포.
```

또한 Database 섹션에 Supabase 정보 추가:
```markdown
### Database
- PostgreSQL 17 (Supabase, 도쿄 리전) with asyncpg driver — Transaction pooler (port 6543)
```

- [ ] **Step 2: .claude/rules/backend.md — 테스트 DB 설명 수정**

```markdown
# 변경 전
- DB: SQLite in-memory (StaticPool), 테스트마다 테이블 생성/삭제
# 변경 후
- DB: SQLite in-memory (StaticPool, CI 속도용), 테스트마다 테이블 생성/삭제. 프로덕션은 Supabase PostgreSQL
```

- [ ] **Step 3: .claude/rules/testing.md — SQLite 언급 수정**

```markdown
# 변경 전
- `db_session` — SQLite in-memory, 테스트마다 테이블 생성/삭제
# 변경 후
- `db_session` — SQLite in-memory (CI 속도 + 외부 의존성 없음), 테스트마다 테이블 생성/삭제
```

- [ ] **Step 4: docs/operations/ 문서 업데이트**

`deployment-strategy-summary.md`:
- "FastAPI + SQLite" → "FastAPI + Supabase PostgreSQL"
- "SQLite (Fly Volume)" → "Supabase PostgreSQL (도쿄 리전, Transaction pooler)"
- "리스크 3: SQLite 한계 도달" → 해결됨으로 표기

`production-checklist.md`:
- "Backend 앱 생성 (Fly.io, SQLite + Volume)" → "Backend 앱 생성 (Fly.io + Supabase PostgreSQL)"
- "SQLite DB 파일 백업 전략 수립" → "Supabase 자동 백업 확인"

- [ ] **Step 5: tests/README.md — 프로덕션 DB 설명 추가**

aiosqlite 에러 섹션은 테스트에서 여전히 사용하므로 유지. 상단에 "프로덕션은 Supabase PostgreSQL, 테스트는 SQLite in-memory" 설명 추가.

- [ ] **Step 6: 커밋**

```bash
git add CLAUDE.md .claude/rules/backend.md .claude/rules/testing.md docs/operations/ backend/tests/README.md
git commit -m "docs: SQLite → Supabase PostgreSQL 마이그레이션 반영 (#336)"
```

---

### Task 11: 최종 검증 + PR

- [ ] **Step 1: ruff 린트/포맷**

Run: `cd backend && ruff check --fix . && ruff format .`

- [ ] **Step 2: 전체 백엔드 테스트**

Run: `cd backend && DATABASE_URL=sqlite+aiosqlite:///:memory: pytest tests/ --ignore=tests/integration/test_api_budget_bulk.py -v`

- [ ] **Step 3: 프론트엔드 빌드 검증**

Run: `cd frontend && npm run lint && npm run test:run && npm run build`

- [ ] **Step 4: PR 생성**

```bash
git push -u origin feature/336-supabase-migration
gh pr create --base develop --title "chore: DB를 Supabase PostgreSQL로 마이그레이션 (#336)" --body "..."
```
