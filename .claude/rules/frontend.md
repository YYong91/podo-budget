---
paths:
  - "frontend/**"
---

# 프론트엔드 규칙

## 페이지 컴포넌트 구조
```typescript
// 1. 훅 초기화 (라우터, 스토어, 상태)
const activeHouseholdId = useHouseholdStore((s) => s.activeHouseholdId)
const [data, setData] = useState<Type[]>([])

// 2. 데이터 로딩 (useEffect → API 호출)
useEffect(() => { fetchData() }, [dependencies])

// 3. 이벤트 핸들러 (useCallback)
const handleSubmit = useCallback(async () => { ... }, [deps])

// 4. 렌더링 (로딩 → 에러 → 빈 상태 → 데이터)
return loading ? <Loader /> : data.length ? <List /> : <EmptyState />
```

## 상태 관리 분리
- **전역 (Zustand):** 가구 정보, 활성 가구 ID — `useHouseholdStore`
- **전역 (Context):** 인증(AuthContext), 토스트(ToastContext)
- **로컬 (useState):** 폼 입력, UI 토글, 일시적 데이터
- Zustand selector로 필요한 값만 구독: `useHouseholdStore((s) => s.activeHouseholdId)`

## API 클라이언트 패턴
- 엔드포인트별 파일 분리 (`api/expenses.ts`, `api/income.ts` 등)
- Axios 인스턴스 공유 (`api/client.ts`)
- household_id는 항상 전달 (non-null assertion `activeHouseholdId!`)
- 응답 타입 제네릭: `apiClient.get<Expense[]>('/expenses', { params })`

## 폼 패턴
- 자연어 모드: 텍스트 → LLM 프리뷰 → 수정 → 저장
- 직접 입력 모드: 폼 필드 직접 입력
- 제출 후: toast 알림 + 목록으로 navigate

## 라우팅
- 모든 페이지 `lazy()` import (코드 스플리팅)
- `ProtectedRoute` > `Layout` > 페이지 (중첩 구조)
- 온보딩: 가구 0개이면 `/onboarding`으로 리디렉션

## 알림
- `useToast()` 훅으로 토스트 표시
- 타입: success, error, warning, info
- 사용법: `addToast('success', '저장되었습니다')`

## PWA
- Workbox 기반 서비스 워커 (vite-plugin-pwa)
- 정적 자산만 캐시, API 응답 캐시 안 함
- 앱 구조 변경 시 `vite.config.ts`의 `cacheId` 버전 올릴 것
