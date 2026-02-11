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
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env              # Configure before first run
uvicorn app.main:app --reload     # Dev server at http://localhost:8000
```

### Testing
```bash
cd backend
pytest                            # Run all tests
pytest --cov=app tests/           # With coverage
pytest tests/test_foo.py::test_bar  # Single test
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

### Key patterns
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
- Frontend directory exists but is not yet implemented

## Environment Variables

Key variables in `backend/.env` (see `.env.example`):
- `DATABASE_URL` — async PostgreSQL connection string (`postgresql+asyncpg://...`)
- `LLM_PROVIDER` — `openai` | `anthropic` | `local`
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` — LLM credentials
- `DEBUG`, `SECRET_KEY`

## Current State

Foundational structure is in place. LLM integration methods (`parse_expense`, `generate_insights`) are stubbed but not implemented. Tests directory is empty. No linter/formatter configured. Frontend not started.
