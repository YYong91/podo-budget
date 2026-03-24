FROM python:3.12-slim

WORKDIR /app

# uv 설치 — 버전 고정으로 공급망 보안 확보 (#139)
COPY --from=ghcr.io/astral-sh/uv:0.5.20 /uv /uvx /bin/

# 의존성 파일 복사 (build context = 프로젝트 루트)
COPY pyproject.toml uv.lock ./

# 의존성 설치 (dev 제외)
RUN uv sync --frozen --no-dev --no-install-project

# .venv/bin을 PATH에 추가 — release_command에서 alembic 직접 실행 가능
ENV PATH="/app/.venv/bin:$PATH"

# 백엔드 앱 복사 (.dockerignore로 backend/pyproject.toml, uv.lock 제외)
COPY backend/ .

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
