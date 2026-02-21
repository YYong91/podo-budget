# Podo Budget (포도가계부)

> 채팅하듯 말하면 알아서 정리되는 AI 가계부 앱

집에서 엑셀로 가계부 정리하는 것이 귀찮아서 만든 퍼스널 가계부 서비스입니다.
채팅하듯이 지출을 말하면 LLM이 자동으로 분석하여 가계부 데이터로 정리해줍니다.

## 주요 기능

- **자연어 지출 입력**: "오늘 점심에 김치찌개 8000원 먹었어" → 자동으로 카테고리 분류 및 저장
- **과지출 경고**: 설정한 예산을 초과하면 알림
- **예산 관리**: 카테고리별 예산 설정 및 모니터링
- **AI 인사이트**: 지출 패턴 분석 및 절약 제안

## 기술 스택

### Backend
- **FastAPI**: 고성능 비동기 Python 웹 프레임워크
- **PostgreSQL**: 관계형 데이터베이스
- **SQLAlchemy 2.0**: 비동기 ORM
- **Pydantic**: 데이터 검증 및 설정 관리
- **LLM Integration**: OpenAI / Anthropic Claude / Local LLM 지원

### Infrastructure
- **Docker**: 컨테이너화
- **Docker Compose**: 로컬 개발 환경 구성

### Frontend
- **React 19**: 최신 React 기능 활용
- **Vite 7**: 빠른 빌드 및 HMR
- **Tailwind CSS v4**: 유틸리티 우선 스타일링
- **Nginx**: 프로덕션 서빙

### Deployment
- **Fly.io**: 컨테이너 호스팅 (도쿄 리전)
- **Cloudflare**: CDN + DNS + DDoS 방어
- **GitHub Actions**: CI/CD 자동화

## 시작하기

### 사전 요구사항

- Docker & Docker Compose
- Python 3.12+ (로컬 개발시)

### 설치 및 실행

1. 저장소 클론
```bash
git clone <repository-url>
cd podobudget
```

2. 환경 변수 설정
```bash
cd backend
cp .env.example .env
# .env 파일을 열어서 필요한 설정을 입력하세요
```

3. Docker Compose로 실행
```bash
cd ..
docker-compose up -d
```

4. API 문서 확인
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 로컬 개발 (Docker 없이)

1. PostgreSQL 설치 및 실행

2. Python 가상환경 생성 및 의존성 설치
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. 환경 변수 설정
```bash
cp .env.example .env
# .env 파일 수정
```

4. 데이터베이스 마이그레이션
```bash
alembic upgrade head
```

5. 개발 서버 실행
```bash
uvicorn app.main:app --reload
```

## 프로젝트 구조

```
podobudget/
├── backend/
│   ├── app/
│   │   ├── api/           # API 라우터
│   │   │   ├── chat.py    # 채팅 인터페이스
│   │   │   ├── expenses.py # 지출 CRUD
│   │   │   └── insights.py # 인사이트 생성
│   │   ├── core/          # 핵심 설정
│   │   │   ├── config.py  # 환경 설정
│   │   │   └── database.py # DB 연결
│   │   ├── models/        # SQLAlchemy 모델
│   │   │   ├── expense.py
│   │   │   ├── category.py
│   │   │   └── budget.py
│   │   ├── schemas/       # Pydantic 스키마
│   │   ├── services/      # 비즈니스 로직
│   │   │   └── llm_service.py # LLM 통합
│   │   └── main.py        # FastAPI 앱
│   ├── tests/             # 테스트
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/              # 프론트엔드 (예정)
├── docker-compose.yml
└── README.md
```

## API 엔드포인트

### 채팅 인터페이스
- `POST /api/chat/` - 자연어로 지출 입력 및 질의

### 지출 관리
- `POST /api/expenses/` - 지출 생성
- `GET /api/expenses/` - 지출 목록 조회
- `GET /api/expenses/{id}` - 특정 지출 조회
- `DELETE /api/expenses/{id}` - 지출 삭제

### 인사이트
- `GET /api/insights/` - AI 인사이트 조회
- `GET /api/insights/budget-alerts` - 예산 경고 알림

## LLM 설정

`.env` 파일에서 사용할 LLM provider를 선택할 수 있습니다:

```env
# OpenAI 사용
LLM_PROVIDER=openai
OPENAI_API_KEY=your_api_key_here

# 또는 Claude 사용
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_api_key_here

# 또는 로컬 LLM 사용 (Ollama 등)
LLM_PROVIDER=local
```

## 배포 (Production)

Docker Compose로 홈 서버에서 실행하고, Cloudflare Tunnel로 외부 노출합니다.

```bash
docker compose up -d
```

| 서비스 | URL |
|--------|-----|
| 웹 | http://localhost:3000 |
| API | http://localhost:8000 |
| 운영 URL | https://budget.podonest.com |

Cloudflare Tunnel 설정으로 `budget.podonest.com`이 localhost:3000으로 라우팅됩니다.

---

## 개발 로드맵

- [x] 프로젝트 초기 구조 설정
- [x] FastAPI 백엔드 기본 구조
- [x] Docker 환경 구성
- [x] 데이터베이스 마이그레이션 설정 (Alembic)
- [x] 프론트엔드 개발 (React 19)
- [x] 배포 설정 (Fly.io)
- [x] CI/CD 파이프라인 (GitHub Actions)
- [ ] LLM 통합 및 자연어 파싱 구현
- [ ] 예산 관리 기능
- [ ] 인사이트 생성 로직
- [ ] 테스트 작성 (Backend + Frontend)

## 라이선스

MIT License

## 기여

이슈와 PR은 언제나 환영합니다!
