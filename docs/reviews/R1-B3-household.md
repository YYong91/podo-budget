# R1-B3: 가구/멤버/초대/관리 (보안+버그)

리뷰 대상: BE 13개 파일 + FE 12개 파일

---

## Critical

### [1] admin 엔드포인트의 ADMIN_USER_ID 기본값 1로 하드코딩

- **심각도**: Critical
- **카테고리**: 보안
- **위치**: `backend/app/core/config.py:56`, `backend/app/api/dependencies.py:189`
- **문제**: `ADMIN_USER_ID`의 기본값이 `1`. `.env` 미설정 시 ID=1인 사용자가 자동으로 admin 권한 획득
- **영향**: 임의 사용자가 전체 사용자 데이터 열람 및 계정 비활성화 가능
- **제안**: 기본값을 `-1`로 변경, 환경변수 미설정 시 admin 기능 비활성화

### [2] 초대 수락 시 레이스 컨디션 — 동시 요청으로 중복 멤버 생성 가능

- **심각도**: Critical
- **카테고리**: 보안/버그
- **위치**: `backend/app/api/invitations.py:124-199`
- **문제**: 활성 멤버 확인 → 멤버 추가 → 초대 상태 변경 사이에 DB 레벨 잠금 없음. 동일 토큰으로 동시 요청 시 중복 처리 가능
- **영향**: 한 사용자가 같은 가구에 두 번 수락되거나 만료된 초대 처리
- **제안**: `SELECT ... FOR UPDATE` 또는 초대 status 업데이트를 조건부 UPDATE로 원자화

---

## High

### [3] remove_member에서 admin이 다른 admin을 추방 가능

- **심각도**: High
- **카테고리**: 보안
- **위치**: `backend/app/api/households.py:390-441`
- **문제**: owner 추방만 방지하고 admin이 다른 admin을 추방하는 케이스 미방지. 역할 변경은 owner만 가능한데 추방은 admin도 가능 — 일관성 없음
- **영향**: admin 간 권한 남용 가능
- **제안**: 추방 대상이 admin 이상이면 owner 권한 요구

### [4] 이메일 HTML 인젝션 — inviter_name/household_name이 HTML에 직접 삽입

- **심각도**: High
- **카테고리**: 보안
- **위치**: `backend/app/services/email_service.py:51-61`
- **문제**: username과 household_name이 f-string으로 HTML에 직접 삽입. HTML 이스케이프 없음
- **영향**: 초대 이메일에 피싱 링크 또는 스크립트 주입 가능
- **제안**: `html.escape()`로 모든 사용자 입력 이스케이프

### [5] 온보딩 가구 생성 시 중복 생성 방지 없음

- **심각도**: High
- **카테고리**: 버그
- **위치**: `backend/app/api/onboarding.py:53-79`
- **문제**: 이미 가구에 소속된 사용자도 추가 가구 생성 가능. URL 직접 접근 시 빈 가구 중복 생성
- **영향**: 앱 UX 혼란 (activeHousehold 자동 선택 로직)
- **제안**: 이미 활성 가구가 있으면 기존 가구 반환 또는 에러 처리

### [6] 초대 토큰이 list_invitations 응답에 포함 — 최소 권한 원칙 위반

- **심각도**: High
- **카테고리**: 보안
- **위치**: `backend/app/api/households.py:583`, `backend/app/services/email_service.py:39`
- **문제**: pending 상태 초대의 토큰이 admin/owner에게 API 응답으로 그대로 반환됨
- **영향**: admin이 토큰으로 다른 계정에서 수락 시도 가능 (이메일 검증으로 완전 공격은 어려움)
- **제안**: list_invitations에서 토큰 제거, 재발송 기능 별도 제공

### [7] owner 탈퇴 UI 없음 — 가구 삭제 외 출구 없음

- **심각도**: High
- **카테고리**: 버그
- **위치**: `frontend/src/pages/HouseholdDetailPage.tsx:447-454`
- **문제**: owner는 탈퇴 버튼이 안 보임. 백엔드는 owner 탈퇴를 허용(자동 양도)하지만 FE에서 차단
- **영향**: owner가 떠나고 싶을 때 UX 막힘. 가구 삭제를 잘못 선택하면 다른 멤버 데이터도 삭제
- **제안**: 멤버 2명 이상일 때 owner 탈퇴 옵션 추가

### [8] updateMemberRole API가 PUT으로 호출 — 백엔드는 PATCH

- **심각도**: High
- **카테고리**: 버그
- **위치**: `frontend/src/api/households.ts:72-73`, `backend/app/api/households.py:320`
- **문제**: 백엔드는 `PATCH`로 정의, 프론트엔드는 `PUT`으로 호출 → `405 Method Not Allowed`
- **영향**: **역할 변경 기능 전체가 동작하지 않음**
- **제안**: `apiClient.put` → `apiClient.patch`로 변경

### [9] OnboardingPage에서 inv.token! non-null assertion 사용

- **심각도**: High
- **카테고리**: 버그
- **위치**: `frontend/src/pages/OnboardingPage.tsx:93`
- **문제**: token이 null일 수 있는 선택적 필드인데 non-null assertion 사용
- **영향**: 드문 경우 런타임 크래시
- **제안**: token null 체크 추가, 없으면 버튼 비활성화

---

## 긍정적인 측면

- 가구 멤버 권한 체계(owner/admin/member) 명확히 구현
- 초대 토큰에 UUID v4 사용으로 충분한 엔트로피(122비트)
- 초대 만료 처리(7일) 구현됨
- 데이터 격리가 household_id 기반으로 일관 적용
- 가구 삭제 시 소프트 삭제(deleted_at) 사용
