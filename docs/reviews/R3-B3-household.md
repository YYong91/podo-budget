# R3-B3: 가구/멤버/초대/관리 (코드품질+테스트)

리뷰 대상: 가구/멤버/초대/관리 레이어 소스 파일 및 테스트 파일 전체.

---

## Critical

### [1] onboarding.py의 datetime.now()에 UTC 명시 누락

- **심각도**: Critical
- **카테고리**: 코드품질
- **위치**: `backend/app/api/onboarding.py:72`
- **문제**: `joined_at=datetime.now()` — 로컬 시스템 시간 사용. 프로젝트 전체는 `datetime.now(UTC).replace(tzinfo=None)` 패턴 사용 (households.py 309, 440, 502, 584행 등)
- **영향**: 비UTC 타임존 서버에서 joined_at이 다른 타임스탬프와 9시간 차이
- **제안**: `datetime.now(UTC).replace(tzinfo=None)` 통일

### [2] email_service.py의 resend.Emails.send()가 동기 호출 — async 이벤트 루프 블로킹

- **심각도**: Critical
- **카테고리**: 코드품질
- **위치**: `backend/app/services/email_service.py:42`
- **문제**: async def 함수 내에서 resend.Emails.send()를 await 없이 직접 호출. Resend SDK 동기 메서드가 blocking I/O 수행
- **영향**: 초대 이메일 발송 중 이벤트 루프 전체 블로킹
- **제안**: `run_in_threadpool()` 또는 `run_in_executor()` 사용

### [3] households.py 740행 단일 파일 — 복잡 로직이 서비스 미분리

- **심각도**: Critical
- **카테고리**: 코드품질
- **위치**: `backend/app/api/households.py`
- **문제**: create_invitation(515-631행)은 6개 이상 쿼리 + 외부 이메일 발송을 단일 핸들러에 집중. leave_household의 owner 양도 로직도 복합 트랜잭션
- **영향**: 아키텍처 원칙 위반 (복잡 로직 → services 분리 규칙)
- **제안**: `services/household_service.py`로 분리

---

## High

### [4] HouseholdDetailPage 테스트에 핵심 사용자 액션 커버리지 전무

- **심각도**: High
- **카테고리**: 테스트
- **위치**: `frontend/src/pages/__tests__/HouseholdDetailPage.test.tsx`
- **문제**: 9개 테스트 모두 순수 렌더링 검증. 역할 변경, 멤버 추방, 탈퇴, 초대 탭, 설정 수정, 가구 삭제 액션 미테스트
- **영향**: 핵심 멤버 관리 기능 회귀 보호 없음
- **제안**: 각 액션의 API 호출 및 상태 변경 테스트 추가

### [5] accept_invitation에서 만료 초대 처리 시 responded_at 설정 — 도메인 불일치

- **심각도**: High
- **카테고리**: 코드품질
- **위치**: `backend/app/api/invitations.py:141-146`
- **문제**: 만료 처리 시 responded_at을 설정하나, 도메인 모델 주석에서 responded_at은 "수락/거절 시각"으로 정의. 테스트에서도 이 필드 검증 없음
- **영향**: 도메인 모델 의미론 불일치
- **제안**: 만료 시 responded_at 설정 제거 또는 expired_at 별도 필드 사용

### [6] useHouseholdStore 비동기 액션 테스트 전무

- **심각도**: High
- **카테고리**: 테스트
- **위치**: `frontend/src/stores/__tests__/useHouseholdStore.test.ts`
- **문제**: 동기 액션 5개만 검증. fetchHouseholds, acceptInvitation, deleteHousehold 등 비동기 액션 미테스트
- **영향**: 비동기 상태 전이 버그 (isLoading 고착 등) 미감지
- **제안**: MSW 또는 API mock으로 비동기 액션 테스트 추가

### [7] schemas/admin.py에서 Pydantic v1 스타일 Config 사용

- **심각도**: High
- **카테고리**: 코드품질
- **위치**: `backend/app/schemas/admin.py:67-68,97-98`
- **문제**: AdminUserItem, AdminUserDetailResponse가 `class Config` 사용. 프로젝트 규칙은 v2 스타일
- **영향**: Pydantic v2 호환성 경고
- **제안**: `model_config = ConfigDict(from_attributes=True)` 변경

---

## 긍정적인 측면

- 초대 만료 7일 처리 및 상태 전이(pending → accepted/declined/expired) 구현 완료
- test_data_isolation.py로 가구 간 데이터 격리 검증
- Zustand 스토어에 가구 전환 로직이 잘 캡슐화
- CreateHouseholdModal/InviteMemberModal 테스트가 폼 제출 플로우를 커버
