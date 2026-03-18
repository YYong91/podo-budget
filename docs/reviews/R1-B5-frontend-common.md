# R1-B5: 프론트엔드 공통 레이어 (보안+버그)

리뷰 대상: App.tsx, main.tsx, index.css, 공통 컴포넌트, contexts, hooks, utils, types (21개 파일)

---

## Critical

### [1] AdminPage 권한 검사가 user 로딩 완료 전에 실패 + FE-only 가드

- **심각도**: Critical
- **카테고리**: 보안
- **위치**: `frontend/src/pages/AdminPage.tsx:49`
- **문제**: `user?.is_admin`이 null(프로필 로딩 중)일 때 즉시 차단 화면 표시. 또한 순수 FE 클라이언트 측 가드만으로 관리자 기능 보호 — `user.is_admin = true`로 조작하면 관리자 API 호출 가능
- **영향**: 정상 관리자도 로딩 중 차단 화면, 비관리자가 FE 검사 우회 가능
- **제안**: loading 상태 시 스피너 표시, 백엔드 admin API에서 반드시 권한 검증 확인

---

## High

### [2] JWT base64url 디코딩 미처리 — 한국어 username 시 로그인 루프

- **심각도**: High
- **카테고리**: 버그
- **위치**: `frontend/src/contexts/AuthContext.tsx:49`
- **문제**: `atob()`은 순수 base64만 처리. JWT 표준은 base64url(패딩 없음, `-`/`_` 치환). 한국어 등 UTF-8 문자가 payload에 있으면 예외 → catch에서 만료로 판정
- **영향**: 한국어 사용자명이 JWT payload에 포함된 경우 유효한 토큰이 만료로 오인, 로그인 루프
- **제안**: base64url → base64 변환 + `decodeURIComponent(escape(atob()))` 패턴 사용

### [3] console.warn에서 인증 상태 정보를 프로덕션에서도 출력

- **심각도**: High
- **카테고리**: 보안
- **위치**: `frontend/src/contexts/AuthContext.tsx:117-122`
- **문제**: 토큰 없이 요청 시 tokenRef, 쿠키 상태, localStorage 상태를 콘솔에 출력. 프로덕션에서도 그대로 남음
- **영향**: XSS나 악성 확장이 콘솔 출력을 수집하면 인증 진단 정보 유출
- **제안**: `import.meta.env.DEV` 조건으로 개발 환경에서만 출력

### [4] ThemeProvider 초기 마운트 시 테마 미적용 — FOUC

- **심각도**: High
- **카테고리**: 버그
- **위치**: `frontend/src/contexts/ThemeContext.tsx:47-88`
- **문제**: 초기 마운트 시 `applyTheme()` 호출 없음. `setMode` 호출이나 OS 변경 이벤트 시에만 실행
- **영향**: 저장된 dark/light 모드가 첫 로드 시 적용되지 않아 잠깐 잘못된 테마 표시, PWA 상태바 색상 미갱신
- **제안**: `useEffect(() => applyTheme(resolveTheme(mode)), [])` 마운트 시 1회 실행

---

## Medium

### [5] formatCompactAmount 경계값 문제 — 999,999원이 "100.0만"으로 표시

- **심각도**: Medium
- **카테고리**: 버그
- **위치**: `frontend/src/utils/format.ts:22-24`
- **문제**: 999,999원이 toFixed(1) 반올림으로 "100.0만" 표시
- **영향**: 캘린더 셀에서 혼란스러운 금액 표시
- **제안**: `Math.floor` 사용하여 올림 방지

### [6] calculateHealthScore — 수입 0일 때 저축률 점수 항상 0

- **심각도**: Medium
- **카테고리**: 버그
- **위치**: `frontend/src/utils/healthScore.ts:33-39`
- **문제**: 수입=0, 지출=0인 신규 사용자가 C+ 등급 받음 (overall=51)
- **영향**: 신규 사용자에게 부정확한 재정 건강 점수 표시
- **제안**: 수입/지출 모두 0인 경우 "데이터 없음" 처리

### [7] Toast 컴포넌트 stale closure — 타이머 리셋 문제

- **심각도**: Medium
- **카테고리**: 버그
- **위치**: `frontend/src/components/Toast.tsx:76-83`
- **문제**: `removeToast`가 useCallback으로 메모이제이션되지 않아, 새 토스트 추가 시 기존 토스트들의 타이머가 리셋
- **영향**: 여러 토스트 동시 표시 시 자동 소멸이 지연
- **제안**: ToastContext의 removeToast를 useCallback으로 감싸기

---

## 긍정적인 측면

- PullToRefresh의 non-passive 이벤트 등록/해제 패턴 올바름
- useIsStandalone의 cleanup 올바르게 처리
- Sentry 통합이 환경별로 잘 분리
- lazy import로 코드 스플리팅 적용
- 타입 정의가 백엔드 스키마와 대체로 일치
