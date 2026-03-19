FROM python:3.12-slim

WORKDIR /app

# uv 설치
COPY --from=ghcr.io/astral-sh/uv:0.5.20 /uv /uvx /bin/  # 버전 고정 — 공급망 보안 (#139)

# 의존성 파일 복사 (build context = 프로젝트 루트)
COPY pyproject.toml uv.lock ./

# 의존성 설치 (dev 제외)
RUN uv sync --frozen --no-dev --no-install-project

# 백엔드 앱 복사 (.dockerignore로 backend/pyproject.toml, uv.lock 제외)
COPY backend/ .

# SQLite 데이터 디렉토리 생성
RUN mkdir -p /app/data

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
