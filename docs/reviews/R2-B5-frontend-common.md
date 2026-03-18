# R2-B5: 프론트엔드 공통 레이어 (성능+아키텍처)

리뷰 대상: App.tsx, main.tsx, index.css, 공통 컴포넌트, contexts, hooks, utils, types, stores (22개 파일)

---

## Critical

### [1] Layout.tsx: useHouseholdStore() 풀 구독으로 과도한 리렌더링

- **심각도**: Critical
- **카테고리**: 성능
- **위치**: `frontend/src/components/Layout.tsx:27-29`
- **문제**: 스토어 전체 구독. isLoading, currentHousehold, error 등 Layout이 사용하지 않는 필드 변경 시에도 리렌더
- **영향**: Layout은 중첩 라우팅 공통 껍데기 → 모든 자식 페이지까지 리렌더 파급
- **제안**: Zustand selector로 필요한 값만 구독

### [2] ToastContext: addToast/removeToast가 매 렌더마다 새 참조 → Toast 타이머 무한 재등록

- **심각도**: Critical
- **카테고리**: 성능
- **위치**: `frontend/src/contexts/ToastContext.tsx:44-51`, `Toast.tsx:83`
- **문제**: useCallback 미적용으로 toasts 변경 시 Context value 새 생성. Toast의 useEffect deps에 onClose 포함 → 타이머 리셋
- **영향**: 새 토스트 추가 시 기존 토스트들의 자동 소멸 타이머가 모두 재시작
- **제안**: addToast/removeToast를 useCallback, value를 useMemo로 안정화

---

## High

### [3] 미사용 자체 인증 타입 잔존 (LoginRequest, RegisterRequest, AuthResponse)

- **심각도**: High
- **카테고리**: 아키텍처
- **위치**: `frontend/src/types/index.ts:206-220`
- **문제**: SSO 전환 후 사용처 없음. barrel export로 번들러 최적화 방해
- **영향**: 코드베이스에 폐기된 API 계약 유지 → 혼란
- **제안**: 세 타입 제거

### [4] initializeApp StrictMode 경쟁 조건

- **심각도**: High
- **카테고리**: 아키텍처
- **위치**: `frontend/src/stores/useHouseholdStore.ts:379-389`
- **문제**: hasInitialized 체크와 실제 실행 사이에 gap. StrictMode에서 두 번째 호출이 동일 체크 통과
- **영향**: 두 번의 병렬 fetchHouseholds 호출 발생
- **제안**: isInitializing ref 또는 Promise 캐싱으로 중복 실행 방지

### [5] pwa-fab-position 클래스 미사용 — FAB 위치 오적용

- **심각도**: High
- **카테고리**: 아키텍처
- **위치**: `frontend/src/index.css:163`, `components/FloatingActionButton.tsx:38`
- **문제**: CSS에서 .pwa-fab-position을 정의했으나 FAB div에 해당 클래스 없음. Tailwind bottom-[...] 인라인값이 우선
- **영향**: PWA standalone 모드에서 FAB 위치 조정 무효
- **제안**: FAB div에 pwa-fab-position 클래스 추가

### [6] ThemeProvider 초기 mount 시 applyTheme 미호출

- **심각도**: High
- **카테고리**: 아키텍처
- **위치**: `frontend/src/contexts/ThemeContext.tsx:47-88`
- **문제**: 초기 mount 시 applyTheme() 호출 없음. setMode 호출이나 OS 변경 이벤트 시에만 실행
- **영향**: 저장된 dark/light 모드가 첫 로드 시 미적용 → FOUC(Flash of Unstyled Content)
- **제안**: useEffect mount 시 1회 applyTheme 실행

---

## 긍정적인 측면

- lazy import로 코드 스플리팅 적용
- PullToRefresh의 non-passive 이벤트 등록/해제 패턴 올바름
- useIsStandalone의 cleanup 올바르게 처리
- Sentry 통합이 환경별로 잘 분리
