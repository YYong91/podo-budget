# #74 + #85 UX 정비 설계 — 성능 체감 + 에러/빈 상태 일관성

## 목표
모든 페이지에서 에러/빈 상태/로딩이 일관되게 동작하고, 사용자가 "앱이 망가졌다"가 아닌 "잠시 문제가 있네" 수준으로 느끼도록 정비.

## 범위

### 1. 글로벌 API 에러 toast
- `api/client.ts` response interceptor에서 401 제외 모든 에러에 자동 toast
- 페이지별 수동 catch 없어도 기본 에러 메시지 표시
- 기존 페이지의 커스텀 에러 메시지가 있으면 그게 우선 (글로벌은 fallback)

### 2. 빠진 에러/빈 상태 추가
| 페이지 | 현재 | 추가 |
|--------|------|------|
| InsightsPage | 에러/빈 상태 없음 | ErrorState + EmptyState |
| ExpenseDetail | toast만 | ErrorState (데이터 로드 실패 시) |
| IncomeDetail | toast만 | ErrorState (데이터 로드 실패 시) |
| BudgetManager | 에러만 있음 | EmptyState (예산 0개일 때) |
| FeedbackPage | 최소 처리 | ErrorState |

### 3. 로딩 스피너 통일
- 인라인 로딩에 `PageLoading` 스타일 통일 (grape-600, w-8 h-8)
- 각 페이지 제각각인 스피너 크기/스타일 → 공통 패턴

### 4. 스켈레톤 UI
- InsightsPage: 카드형 스켈레톤 (TransactionList 패턴 참고)
- 나머지 페이지는 기존 스피너 유지

## 범위 밖 (Backlog)
- React Query 도입
- Vite 청크 분리 전략
- 이미지 최적화 (WebP, srcset, lazy loading)
