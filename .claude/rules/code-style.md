# 코드 스타일

## 언어
- 코드 주석: 한국어
- 변수/함수/클래스명: 영어
- 커밋 메시지: 한국어
- 사용자 응답 메시지: 한국어

## Python (백엔드)
- snake_case: 변수, 함수, 모듈
- PascalCase: 클래스, Pydantic 모델, SQLAlchemy 모델
- UPPER_SNAKE_CASE: 상수, 환경변수
- async/await 우선 사용 (동기 함수 대신 비동기)
- 타입 힌트 필수
- Pydantic v2 스타일 (model_config, field_validator 등)
- 린트/포맷: ruff check + ruff format

## TypeScript (프론트엔드)
- camelCase: 변수, 함수, 훅 (useXxx)
- PascalCase: 컴포넌트, 타입, 인터페이스
- UPPER_SNAKE_CASE: 상수
- 함수형 컴포넌트 + 훅 패턴 (클래스 컴포넌트 사용 안 함)
- `type` 키워드 우선 (interface보다 type 선호, 단 export용 인터페이스는 interface 가능)
- strict 모드 활성화
- 린트: ESLint (typescript-eslint + react-hooks + react-refresh)

## CSS (Tailwind v4)
- Grape 디자인 시스템: grape/leaf/warm/cream 컬러 팔레트
- 유틸리티 클래스 직접 사용 (CSS 파일 최소화)
- 반응형: 모바일 퍼스트 (기본 모바일 → md/lg로 확장)
