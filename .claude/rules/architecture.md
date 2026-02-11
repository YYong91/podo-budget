# 아키텍처 원칙

## 레이어 구조
```
api/ → schemas/ → services/ → models/ → database
```

- api: HTTP 요청/응답 처리만. 비즈니스 로직 금지
- services: 비즈니스 로직 집중. DB 직접 접근 가능
- models: SQLAlchemy ORM 모델. 테이블 정의와 관계만
- schemas: Pydantic 모델. 입출력 검증과 직렬화

## 의존성 방향
- api → services → models (단방향)
- schemas는 api와 services에서 사용
- models는 services에서만 import
- api에서 models 직접 import 금지

## DB 접근
- AsyncSession을 Depends(get_db)로 주입
- 서비스 함수에 session 파라미터로 전달
- ORM 쿼리는 select() 스타일 (2.0 방식)

## LLM 통합
- LLMProvider 추상 클래스를 통해서만 접근
- 새 프로바이더 추가 시 LLMProvider 상속 후 get_llm_provider()에 등록
- LLM 응답은 반드시 Pydantic 스키마로 파싱하여 반환
