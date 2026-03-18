# R2-B3: 가구/멤버/초대/관리 (성능+아키텍처)

리뷰 대상: BE 13개 파일 + FE 12개 파일

---

## Critical

### [1] list_households — 가구 수만큼 추가 COUNT 쿼리 발생 (N+1)

- **심각도**: Critical
- **카테고리**: 성능
- **위치**: `backend/app/api/households.py:138-147`
- **문제**: 가구 목록 조회 후 루프에서 가구마다 SELECT COUNT(*) 쿼리 실행. N개 가구 → 1+N 쿼리
- **영향**: 가구 수에 비례하여 응답 시간 선형 증가
- **제안**: 서브쿼리로 member_count를 원래 쿼리에 포함

### [2] get_household — 멤버 수만큼 추가 User SELECT 발생 (N+1)

- **심각도**: Critical
- **카테고리**: 성능
- **위치**: `backend/app/api/households.py:192-198`
- **문제**: selectinload(Household.members) 후에도 각 멤버의 User를 개별 쿼리로 조회. M명 → 1+M 쿼리
- **영향**: 멤버 많을수록 응답 시간 선형 증가
- **제안**: selectinload(HouseholdMember.user) 관계 함께 로드

### [3] list_invitations — 초대 건수만큼 추가 User SELECT 발생 (N+1)

- **심각도**: Critical
- **카테고리**: 성능
- **위치**: `backend/app/api/households.py:668-672`, `backend/app/api/invitations.py:63-76`
- **문제**: 두 엔드포인트 모두 초대 루프에서 가구/초대자 정보를 매번 개별 조회. list_my_invitations는 초대당 2쿼리
- **영향**: 초대 수에 비례하여 쿼리 수 증가
- **제안**: selectinload(HouseholdInvitation.household, .inviter) 함께 로드

---

## High

### [4] isLoading이 전역 단일 플래그 — 동시 동작 시 상태 오염

- **심각도**: High
- **카테고리**: 아키텍처
- **위치**: `frontend/src/stores/useHouseholdStore.ts` (전체 액션)
- **문제**: 모든 비동기 액션이 동일한 isLoading 플래그 공유. 두 useEffect 동시 실행 시 로딩 상태 오염
- **영향**: 실제 진행 중 작업 있어도 로딩 UI 사라짐
- **제안**: 관심사별 로딩 플래그 분리 또는 로컬 useState 사용

### [5] 유틸 함수 3개가 HouseholdListPage/HouseholdDetailPage에 중복 정의

- **심각도**: High
- **카테고리**: 아키텍처
- **위치**: `frontend/src/pages/HouseholdListPage.tsx:22-52`, `pages/HouseholdDetailPage.tsx:23-53`
- **문제**: formatDate, formatRole, getRoleBadgeColor가 두 페이지에 완전 동일하게 복붙
- **영향**: 한쪽만 수정 시 불일치 유지보수 부채
- **제안**: utils/household.ts로 공유 유틸 분리

---

## Medium

### [6] HouseholdDetailPage에서 스토어 전체 구독 (selector 미사용)

- **심각도**: Medium
- **카테고리**: 성능
- **위치**: `frontend/src/pages/HouseholdDetailPage.tsx:63-80`
- **문제**: useHouseholdStore() 전체 구독. households 배열 변경에도 리렌더링
- **영향**: 불필요한 리렌더링
- **제안**: Zustand selector로 필요한 값만 구독

### [7] admin_service.py get_user_detail이 6개 직렬 쿼리 실행

- **심각도**: Medium
- **카테고리**: 성능
- **위치**: `backend/app/services/admin_service.py:262-300`
- **문제**: User 조회 후 5개 독립 쿼리를 순차 실행. get_user_list는 이미 서브쿼리 최적화 적용 — 불일치
- **영향**: Admin 대시보드 사용자 상세에서 순차 대기
- **제안**: 서브쿼리 방식으로 단일 쿼리 통합

---

## 긍정적인 측면

- selectinload를 가구-멤버 관계에 사용 (부분적이나마 eager loading 인지)
- Zustand 스토어에 가구 전환 로직이 잘 캡슐화
- 초대 만료 7일 처리 구현
- 데이터 격리가 household_id 기반으로 일관 적용
