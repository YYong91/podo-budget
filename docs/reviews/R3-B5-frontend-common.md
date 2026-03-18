# R3-B5: 프론트엔드 공통 레이어 (코드품질+테스트)

리뷰 대상: `App.tsx`, `main.tsx`, `index.css`, 공통 컴포넌트, contexts, hooks, utils, types 및 대응 테스트 파일 전체.

---

## Critical

### [1] ThemeProvider 초기 마운트 시 DOM에 테마가 적용되지 않음

- **심각도**: Critical
- **카테고리**: 코드품질
- **위치**: `frontend/src/contexts/ThemeContext.tsx:47-88`
- **문제**: 초기 mode/resolvedTheme state는 올바르게 계산되나, 마운트 시점에 document.documentElement에 .dark 클래스를 적용하는 코드 없음. applyTheme은 setMode 호출이나 OS 변경 이벤트 시에만 실행
- **영향**: dark/system(+OS다크) 모드 저장 사용자의 첫 로딩 시 라이트 테마로 렌더링 (FOUC)
- **제안**: useEffect mount 시 1회 applyTheme 실행

> ⚠️ R1-B5 [4], R2-B5 [6]에서도 지적됨 — 코드품질 관점 재확인

---

## High

### [2] format.test.ts — formatAmount/formatAmountWithSign 테스트 완전 누락

- **심각도**: High
- **카테고리**: 테스트
- **위치**: `frontend/src/utils/__tests__/format.test.ts`
- **문제**: format.ts의 3개 함수 중 formatCompactAmount만 테스트. formatAmount/formatAmountWithSign은 앱 전반 금액 표시 핵심 함수임에도 테스트 없음
- **영향**: 금액 포맷 변경 시 회귀 미감지
- **제안**: formatAmount(0), formatAmount(-5000), formatAmountWithSign(5000, 'income') 등 엣지 케이스 추가

### [3] ThemeContext 테스트 파일 완전 부재

- **심각도**: High
- **카테고리**: 테스트
- **위치**: (파일 미존재)
- **문제**: localStorage 읽기/쓰기, classList 조작, matchMedia 구독 등 복잡한 부수 효과를 가진 ThemeContext에 테스트 없음
- **영향**: [1]번 FOUC 버그가 테스트로 감지 가능했음
- **제안**: localStorage 모킹으로 dark/light/system 모드 초기화 + setMode 변경 테스트

### [4] ToastContext addToast/removeToast가 useCallback 미적용

- **심각도**: High
- **카테고리**: 코드품질
- **위치**: `frontend/src/contexts/ToastContext.tsx:44-51`
- **문제**: useCallback 미적용으로 toasts 변경 시 Context value 새 생성. Toast의 useEffect deps에 onClose 포함되어 타이머 리셋
- **영향**: 토스트 추가 시 기존 토스트 자동 소멸 타이머가 모두 재시작
- **제안**: addToast/removeToast를 useCallback으로 감싸기

> ⚠️ R2-B5 [2]에서도 지적됨 — 코드품질 관점 재확인

### [5] healthScore.test.ts 핵심 엣지 케이스 미테스트

- **심각도**: High
- **카테고리**: 테스트
- **위치**: `frontend/src/utils/__tests__/healthScore.test.ts`
- **문제**: spending 점수 80-100% 구간 선형 보간, debt 점수 totalAssets=0 케이스, overall 점수 0-100 범위 보장 미테스트
- **영향**: 건강점수 경계값 버그 미감지
- **제안**: 각 서브 점수별 경계값 테스트 추가

---

## 긍정적인 측면

- lazy import로 코드 스플리팅 적용
- PullToRefresh의 non-passive 이벤트 등록/해제 패턴 올바름
- useIsStandalone의 cleanup 올바르게 처리
- Sentry 통합이 환경별로 잘 분리
