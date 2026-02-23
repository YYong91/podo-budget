FROM python:3.12-slim

WORKDIR /app

# uv 설치
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# 의존성 파일 복사 (build context = 프로젝트 루트)
COPY pyproject.toml uv.lock ./

# 의존성 설치 (dev 제외)
RUN uv sync --frozen --no-dev --no-install-project

# 백엔드 앱 복사 (backend/pyproject.toml, backend/uv.lock이 루트 파일을 덮어쓸 수 있음)
COPY backend/ .

# 루트 의존성 파일 복원 (COPY backend/가 덮어쓴 것을 되돌림)
COPY pyproject.toml uv.lock ./

# SQLite 데이터 디렉토리 생성
RUN mkdir -p /app/data

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
