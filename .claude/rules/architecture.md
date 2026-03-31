# 아키텍처 원칙

## 백엔드 레이어 구조
```
api/ → schemas/ → services/ → models/ → database
```

- api: HTTP 요청/응답, 간단한 CRUD 쿼리 가능. 복잡한 비즈니스 로직은 services로 분리
- services: 복잡한 비즈니스 로직, LLM 호출, 다중 모델 조합. DB 직접 접근 가능
- models: SQLAlchemy ORM 모델. 테이블 정의와 관계만
- schemas: Pydantic 모델. 입출력 검증과 직렬화

### 서비스 분리 기준
- 단순 CRUD (1~2 쿼리) → api에서 직접 처리
- LLM 호출, 외부 API 연동, 복잡한 집계 → services로 분리
- 여러 모델을 조합하는 트랜잭션 → services로 분리

## 의존성 방향
- api → services → models (단방향)
- schemas는 api와 services에서 사용
- api에서 models import 가능 (단순 CRUD용)

## DB 접근
- AsyncSession을 Depends(get_db)로 주입
- 서비스 함수에 session 파라미터로 전달
- ORM 쿼리는 select() 스타일 (2.0 방식)

## 데이터 소유권 (Household 필수)
- 모든 데이터는 household_id 기반 (NOT NULL)
- 모든 유저는 반드시 1개 이상의 가구에 소속
- API에서 household_id 없으면 `get_user_active_household_id()`로 자동 감지
- 가구 접근 권한은 `get_household_member()`로 검증
- user_id는 "누가 입력했는지" 기록용으로 유지

## 인증 (Supabase Auth)
- Supabase Auth 기반 Google OAuth
- 프론트: Supabase 클라이언트로 인증 상태 관리 → 미인증 시 `/login`으로 리디렉션
- 백엔드: Supabase JWT 검증

## LLM 통합
- LLMProvider 추상 클래스를 통해서만 접근
- 새 프로바이더 추가 시 LLMProvider 상속 후 get_llm_provider()에 등록
- LLM 응답은 반드시 Pydantic 스키마로 파싱하여 반환

## 프론트엔드 구조
```
pages/ → api/ → types/
  ↕         ↕
stores/   components/
```

- pages: 페이지 단위 컴포넌트. API 호출 + 상태 관리
- api: Axios 기반 API 클라이언트. 엔드포인트별 파일 분리
- types: TypeScript 타입 정의 (백엔드 스키마 대응)
- stores: Zustand 스토어 (전역 상태 — 현재 useHouseholdStore)
- components: 재사용 UI 컴포넌트
- contexts: React Context (AuthContext, ToastContext)
- hooks: 커스텀 훅
- utils: 헬퍼 함수 (format, calendar 등)
