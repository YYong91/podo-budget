# #2 포도가계부 전용 모드 — 포도책장 임시 비활성화

## 목표
podo-auth에서 포도책장을 숨기고, 로그인 후 바로 포도가계부로 리디렉션.

## 변경 범위 (podo-auth frontend)

### 1. ServiceHubPage → 가계부 직행 리디렉션
- `App.tsx`에서 `/` 라우트를 ServiceHubPage 대신 가계부 URL로 리디렉션
- ServiceHubPage 코드는 삭제하지 않음 (복구 대비)

### 2. LoginPage 하단 링크 제거
- "포도 서비스 바로가기" 섹션(포도책방 + 포도가계부 링크) 제거

### 3. redirect_uri 없는 로그인 후 동작
- 기존: ServiceHubPage로 이동
- 변경: 가계부 URL(`https://budget.podonest.com`)로 리디렉션

## 복구 방법
라우터에서 `/`를 ServiceHubPage로 되돌리고, LoginPage 링크 섹션 복원.
