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

### Database migrations (Alembic — not yet initialized)
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
- Three models: Expense → Category (FK), Budget → Category (FK)
- Alembic listed in dependencies but migrations not yet initialized

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

## Current State

- **Backend**: Foundational structure in place. LLM integration methods (`parse_expense`, `generate_insights`) implemented with Anthropic provider. Tests directory is empty.
- **Frontend**: React SPA implemented with 5 pages (Dashboard, ExpenseList, ExpenseDetail, CategoryManager, InsightsPage). API clients, layout, routing complete. Custom hooks and tests not yet implemented.
- **Infrastructure**: Docker Compose configured. ESLint configured for frontend. Backend uses pre-commit hooks (ruff, detect-secrets).
