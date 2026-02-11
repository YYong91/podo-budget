# 코드 스타일

## 언어
- 코드 주석: 한국어
- 변수/함수/클래스명: 영어
- 커밋 메시지: 한국어
- 사용자 응답 메시지: 한국어

## Python
- snake_case: 변수, 함수, 모듈
- PascalCase: 클래스, Pydantic 모델, SQLAlchemy 모델
- UPPER_SNAKE_CASE: 상수, 환경변수
- async/await 우선 사용 (동기 함수 대신 비동기)
- 타입 힌트 필수
- Pydantic v2 스타일 사용 (model_config, field_validator 등)
