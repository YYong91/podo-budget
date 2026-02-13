# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HomeNRich is a personal AI-powered expense tracker (가계부) where users input expenses in natural language (e.g., "오늘 점심에 김치찌개 8000원 먹었어") and an LLM automatically categorizes and stores them. Korean is the primary user-facing language.

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
├── api/          # Route handlers (chat, expenses, insights)
├── core/         # Config (Pydantic BaseSettings) and async DB engine
├── models/       # SQLAlchemy 2.0 ORM models (Expense, Category, Budget)
├── schemas/      # Pydantic request/response schemas
├── services/     # Business logic (LLM integration)
└── main.py       # FastAPI app entry, CORS config, router registration
```

### Frontend (React + TypeScript + Vite)

```
frontend/src/
├── api/           # Axios API clients (expenses, categories, insights)
├── components/    # Reusable components (Layout with sidebar navigation)
├── pages/         # Page components (Dashboard, ExpenseList, ExpenseDetail, CategoryManager, InsightsPage)
├── hooks/         # Custom hooks (empty — not yet implemented)
├── types/         # TypeScript type definitions (Expense, Category, MonthlyStats, etc.)
├── assets/        # Static assets
├── App.tsx        # React Router routes
├── main.tsx       # Entry point
└── index.css      # Tailwind CSS v4 with custom Indigo theme
```

### Frontend key patterns
- **React 19** with TypeScript strict mode
- **Vite 7** dev server with `/api` proxy to `http://localhost:8000`
- **Tailwind CSS v4** with custom color palette and Korean font stack (Pretendard)
- **Axios** with response interceptor for error handling
- **Recharts** for data visualization (PieChart, LineChart)
- **React Router v7** with nested layout routing
- **react-hot-toast** for toast notifications

### Backend key patterns
- **Async throughout**: asyncpg driver, AsyncSession, async route handlers
- **LLM provider abstraction**: `services/llm_service.py` uses Strategy pattern — abstract `LLMProvider` base class with `OpenAIProvider`, `AnthropicProvider`, `LocalLLMProvider`. Selected at runtime via `LLM_PROVIDER` env var
- **Dependency injection**: FastAPI `Depends()` for database sessions (`get_db` in `core/database.py`)
- **Config via Pydantic BaseSettings**: `core/config.py` loads from `.env` with typed defaults

### Database
- PostgreSQL 16 with asyncpg driver
- Seven models: User, Expense, Category, Budget, Household, HouseholdMember, HouseholdInvitation
- Alembic 초기화 완료 (초기 마이그레이션: ef6a56f45278)

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

Frontend: `frontend/.env.development`:
- `VITE_API_URL` — API base URL (default: `/api`, proxied by Vite)

## Project Documents

프로젝트 방향성은 아래 3개 기준 문서로 관리합니다:

- **`docs/PRODUCT.md`** — 프로덕트 정의서 (Source of Truth). 기획 변경 시 가장 먼저 업데이트
- **`docs/ROADMAP.md`** — 단계별 구현 계획 (Phase 1~4)
- **`docs/IMPLEMENTATION_STATUS.md`** — 기능별 구현 현황 추적

기타 문서:
- `docs/features/` — 기능별 상세 (USER_FLOWS, CATEGORY_RULES, BOT_MESSAGES)
- `docs/operations/` — 운영/배포 가이드
- `docs/archive/` — 폐기된 문서 (참고용)

## Current State (2026-02-14)

- **Backend**: 인증, 지출 CRUD, 카테고리, 예산, 인사이트, Household/초대 API 모두 구현됨. LLM 파싱(Anthropic/OpenAI) + 프리뷰 모드 구현. 자연어 컨텍스트 탐지("우리"→공유/"나"→개인). 멤버별 필터링. Alembic 초기화 완료. 테스트 199개.
- **Frontend**: React 19 SPA. 자연어 입력 → 프리뷰 → 수정 → 확인 플로우. 가구 전환 드롭다운. 멤버별 필터링. 테스트 157개.
- **Infrastructure**: Docker Compose로 PostgreSQL + Backend + Frontend 실행 가능.
- **Phase 1**: 100% 완료. **Phase 2**: 95% 완료 (이메일 발송 제외).
