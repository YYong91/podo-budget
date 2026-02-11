# HomeNRich Backend

FastAPI 기반의 AI 가계부 백엔드 서버입니다.

## 개발 가이드

### 로컬 개발 환경 설정

1. 가상환경 생성
```bash
python -m venv venv
source venv/bin/activate
```

2. 의존성 설치
```bash
pip install -r requirements.txt
```

3. 환경 변수 설정
```bash
cp .env.example .env
# .env 파일을 수정하여 필요한 설정 입력
```

4. 개발 서버 실행
```bash
uvicorn app.main:app --reload
```

### 디렉토리 구조

```
backend/
├── app/
│   ├── api/              # API 엔드포인트
│   ├── core/             # 핵심 설정 (DB, config)
│   ├── models/           # SQLAlchemy 모델
│   ├── schemas/          # Pydantic 스키마
│   ├── services/         # 비즈니스 로직
│   └── main.py           # FastAPI 앱 진입점
├── tests/                # 테스트 코드
├── Dockerfile
└── requirements.txt
```

### 주요 컴포넌트

#### LLM Service
`app/services/llm_service.py`에서 다양한 LLM provider를 추상화하여 관리합니다.
- OpenAI GPT
- Anthropic Claude
- Local LLM (Ollama)

provider는 `.env`의 `LLM_PROVIDER` 설정으로 선택할 수 있습니다.

#### Database Models
- `Expense`: 지출 기록
- `Category`: 지출 카테고리
- `Budget`: 예산 설정

#### API Routers
- `/api/chat`: 자연어 인터페이스
- `/api/expenses`: 지출 CRUD
- `/api/insights`: AI 인사이트

## 테스트

```bash
pytest
```

커버리지 확인:
```bash
pytest --cov=app tests/
```
