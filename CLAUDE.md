# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

포도가계부(Podo Budget)는 AI 기반 가계부 앱으로, 자연어 입력(예: "오늘 점심에 김치찌개 8000원 먹었어")을 LLM이 자동 분류/저장합니다. 포도책방과 동일한 Grape 디자인 시스템을 사용하며, 거래 건수 기반 포도알 성장 메타포를 제공합니다. Korean is the primary user-facing language.

## Commands

### Docker (full stack)
```bash
docker-compose up -d              # Start PostgreSQL + backend
docker-compose down               # Stop all services
```

### Backend local development
```bash
uv sync --all-extras              # Install all dependencies (dev 포함)
cp backend/.env.example backend/.env  # Configure before first run
uv run uvicorn app.main:app --reload --app-dir backend  # Dev server at http://localhost:8000
```

### Frontend local development
```bash
cd frontend
npm install                       # Install dependencies
npm run dev                       # Dev server at http://localhost:5173
npm run build                     # Production build (tsc + vite)
npm run lint                      # ESLint check
npm run preview                   # Preview production build
```

### Testing
```bash
# Backend
cd backend
pytest                            # Run all tests
pytest --cov=app tests/           # With coverage
pytest tests/test_foo.py::test_bar  # Single test

# Frontend (not yet configured)
cd frontend
npm test                          # Run all tests (Vitest)
```

### Database migrations (Alembic)
```bash
cd backend
alembic upgrade head              # Apply migrations
alembic revision --autogenerate -m "description"  # Generate migration
```

## Architecture

### Backend (FastAPI, async-first)

```
backend/app/
├── api/          # Route handlers (chat, expenses, income, recurring, insights)
├── core/         # Config (Pydantic BaseSettings) and async DB engine
├── models/       # SQLAlchemy 2.0 ORM models (Expense, Income, Category, Budget, RecurringTransaction)
├── schemas/      # Pydantic request/response schemas
├── services/     # Business logic (LLM integration)
└── main.py       # FastAPI app entry, CORS config, router registration
```

### Frontend (React + TypeScript + Vite)

```
frontend/src/
├── api/           # Axios API clients (expenses, income, recurring, categories, insights)
├── components/    # Reusable components (Layout with sidebar navigation)
├── pages/         # Page components (Dashboard, ExpenseList, ExpenseDetail, IncomeList, IncomeDetail, IncomeForm, RecurringList, CategoryManager, InsightsPage, AuthCallbackPage)
├── hooks/         # Custom hooks (empty — not yet implemented)
├── types/         # TypeScript type definitions (Expense, Category, MonthlyStats, etc.)
├── assets/        # Static assets
├── App.tsx        # React Router routes
├── main.tsx       # Entry point
└── index.css      # Tailwind CSS v4 with Grape/Leaf/Warm/Cream theme (포도책방 공유)
```

### Frontend key patterns
- **React 19** with TypeScript strict mode
- **Vite 7** dev server with `/api` proxy to `http://localhost:8000`
- **Tailwind CSS v4** with Grape design system (grape/leaf/warm/cream) and Korean font stack (Pretendard)
- **Axios** with response interceptor for error handling
- **Recharts** for data visualization (PieChart, LineChart)
- **React Router v7** with nested layout routing
- **react-hot-toast** for toast notifications

### Backend key patterns
- **Async throughout**: asyncpg driver, AsyncSession, async route handlers
- **LLM provider abstraction**: `services/llm_service.py` uses Strategy pattern — abstract `LLMProvider` base class with `OpenAIProvider`, `AnthropicProvider`, `GoogleProvider`, `LocalLLMProvider` (미구현은 NotImplementedError). Selected at runtime via `LLM_PROVIDER` env var
- **Dependency injection**: FastAPI `Depends()` for database sessions (`get_db` in `core/database.py`)
- **Config via Pydantic BaseSettings with `model_config = SettingsConfigDict()` (v2 style)**: `core/config.py` loads from `.env` with typed defaults

### Database
- PostgreSQL 16 with asyncpg driver
- Nine models: User, Expense, Income, Category, Budget, Household, HouseholdMember, HouseholdInvitation, RecurringTransaction
- Alembic: 6 migrations (초기 스키마, 인덱스/FK, Float→Numeric, Income+Category type, RecurringTransaction, telegram_link_code)

### Infrastructure
- Docker Compose: `db` (postgres:16-alpine with healthcheck) + `backend` (python:3.12-slim)
- Backend volume-mounted for hot reload in dev
- Frontend: Vite dev server with proxy to backend

## Environment Variables

Key variables in `backend/.env` (see `.env.example`):
- `DATABASE_URL` — async PostgreSQL connection string (`postgresql+asyncpg://...`)
- `LLM_PROVIDER` — `openai` | `anthropic` | `local`
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` — LLM credentials
- `DEBUG`, `SECRET_KEY`
- `SENTRY_DSN` — Sentry DSN (빈 문자열이면 비활성화)
- `SENTRY_ENVIRONMENT` — Sentry 환경 (`development` | `production`)
- `RESEND_API_KEY` — Resend 이메일 API 키 (빈 문자열이면 비활성화)
- `RESEND_FROM_EMAIL` — 발신자 이메일 주소

Frontend: `frontend/.env.development`:
- `VITE_API_URL` — API base URL (default: `/api`, proxied by Vite)
- `VITE_SENTRY_DSN` — Sentry DSN (빈 문자열이면 비활성화)
- `VITE_SENTRY_ENVIRONMENT` — Sentry 환경

## Project Documents

프로젝트 방향성은 아래 3개 기준 문서로 관리합니다:

- **`docs/PRODUCT.md`** — 프로덕트 정의서 (Source of Truth). 기획 변경 시 가장 먼저 업데이트
- **`docs/ROADMAP.md`** — 단계별 구현 계획 (Phase 1~4)
- **`docs/IMPLEMENTATION_STATUS.md`** — 기능별 구현 현황 추적

기타 문서:
- `docs/features/` — 기능별 상세 (USER_FLOWS, CATEGORY_RULES, BOT_MESSAGES)
- `docs/operations/` — 운영/배포 가이드
- `docs/archive/` — 폐기된 문서 (참고용)

## Current State (2026-02-23)

- **Backend**: **podo-auth SSO 전용** (자체 로그인/회원가입 없음, Shadow User 패턴), 지출 CRUD, **수입 CRUD + 통계**, 카테고리(type 필드), 예산, 인사이트, Household/초대 API 모두 구현됨. **정기 거래(RecurringTransaction) CRUD + execute/skip/pending API**. LLM 파싱(Anthropic/OpenAI) + 프리뷰 모드 + **수입/지출 자동 분류**. 자연어 컨텍스트 탐지. 멤버별 필터링. Telegram/Kakao 봇. **텔레그램 코드 기반 계정 연동**. Resend 이메일 발송(초대 전용). 금액 필드 Numeric(12,2). 테스트 375개.
- **Frontend**: React 19 SPA. **Grape 디자인 시스템(포도책방 공유)** — grape/leaf/warm/cream 컬러 + 포도알 성장 메타포(GrapeProgress). **podo-auth SSO 연동** (AuthCallbackPage, ProtectedRoute → auth.podonest.com 리디렉션). 자연어 입력 → 프리뷰 → 수정 → 확인 플로우. **수입 입력/목록/상세 페이지**. **정기 거래 관리 페이지 + 대시보드 알림 카드**. **대시보드 수입/순수익 카드 + 포도알 성장 카드**. **리포트 지출/수입 토글**. 대시보드 통합 뷰 (공유 우선 + 개인 접기). 가구 전환 드롭다운. 멤버별 필터링. **설정 페이지 텔레그램 연동 UI**.
- **Infrastructure**: Docker Compose로 SQLite + Backend + Frontend 실행. post-merge 훅으로 자동 배포.
- **Phase 1**: 100%. **Phase 2**: 100%. **Phase 3**: 100%. **Phase 4**: 85% (Sentry + CI/CD + Fly.io 설정 완료, 결제 활성화 후 배포).

## Known Issues

- `tests/integration/test_api_budget_bulk.py` — 4개 테스트 기존부터 실패 중 (CI에서 `--ignore` 처리됨, 별도 수정 필요)
- PWA 서비스 워커 캐시: 앱 구조 크게 변경 시 `frontend/vite.config.ts`의 `workbox.cacheId` 버전 올릴 것 (현재 `podo-budget-v2`)
