FROM python:3.12-slim

WORKDIR /app

# uv 설치
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# 백엔드 앱 복사 먼저 (build context = 프로젝트 루트)
COPY backend/ .

# 의존성 파일 복사 (backend/uv.lock이 있으면 덮어씀)
COPY pyproject.toml uv.lock ./

# 의존성 설치 (dev 제외)
RUN uv sync --no-dev --no-install-project

# SQLite 데이터 디렉토리 생성
RUN mkdir -p /app/data

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
