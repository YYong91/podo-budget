# Supabase Auth 전환 설계

## 목표
podo-auth 서버를 폐기하고 Supabase Auth로 전환한다.
포도가계부 + 포도책장 동시 전환.

## 결정 사항

| 항목 | 결정 |
|------|------|
| 범위 | 가계부 + 책장 동시 전환 |
| podo-auth | 폐기 |
| 로그인 방식 | 이메일+비밀번호 + Google + Kakao + Apple |
| Magic Link | 안 함 |
| 유저 마이그레이션 | Supabase Admin API 일괄 생성 + 비밀번호 재설정 메일 |
| Shadow User | 유지 — auth_user_id만 podo-auth TSID → Supabase UUID |
| FE 로그인 UI | 직접 구현 (Grape 디자인 + 다크모드) |
| 로그인 페이지 | 각 앱 내장 (/login) |
| SSO | 같은 Supabase 프로젝트 + .podonest.com 쿠키 도메인 |
| 전환 방식 | 점검 공지(30분) + 한번에 전환 |

## 영향도

### 포도가계부 (podo-budget)

| 영역 | 변경 | 난이도 |
|------|------|--------|
| BE auth.py | podo-auth JWT → Supabase JWT 검증 | 중 |
| BE User 모델 | auth_user_id TSID → UUID | 중 |
| FE AuthContext | auth.podonest.com → supabase.auth 세션 | 중 |
| FE AuthCallbackPage | ?token= → Supabase 세션 자동 | 소 |
| FE /login 페이지 | 신규 생성 (Grape 디자인) | 중 |
| 봇 연동 | 영향 없음 (Supabase Auth 안 거침) | 없음 |
| 환경변수 | JWT_SECRET, AUTH_SERVER_URL → SUPABASE_URL, SUPABASE_ANON_KEY | 소 |

### 포도책장 (podo-bookshelf)

| 영역 | 변경 | 난이도 |
|------|------|--------|
| BE auth.py | JWT 검증만 — Supabase JWT로 교체 | 소 |
| FE AuthContext | 가계부와 동일 패턴 | 소 |
| FE /login 페이지 | 신규 (Grape 디자인 공유) | 소 |
| User 모델 | 없음 (CurrentUser dataclass) | 없음 |

### podo-auth 서버
- 폐기 + auth.podonest.com DNS 정리

## 작업 순서

### Phase 1: Supabase Auth 설정
1. Supabase 프로젝트 Auth 활성화
2. OAuth 프로바이더 설정 (Google, Kakao, Apple)
3. 리디렉트 URL 설정 (budget.podonest.com, bookshelf.podonest.com)
4. JWT Secret 확인

### Phase 2: 유저 마이그레이션 준비
5. podo-auth DB에서 유저 목록 추출 (이메일, 이름)
6. Supabase Admin API로 유저 일괄 생성 스크립트 작성
7. auth_user_id 매핑 테이블 생성 (podo-auth TSID → Supabase UUID)

### Phase 3: 가계부 전환
8. BE: auth.py Supabase JWT 검증으로 교체
9. BE: User 모델 auth_user_id를 UUID로 마이그레이션 (Alembic)
10. FE: /login 페이지 구현 (이메일+비밀번호 + 소셜 3종)
11. FE: AuthContext Supabase 세션으로 교체
12. FE: AuthCallbackPage → Supabase OAuth 콜백 처리
13. 환경변수 교체 (Fly.io secrets)
14. 테스트 전체 통과 확인

### Phase 4: 책장 전환
15. BE: auth.py Supabase JWT로 교체
16. FE: /login + AuthContext 동일 패턴
17. 환경변수 교체

### Phase 5: 전환 실행
18. 텔레그램 점검 공지
19. Supabase Admin API로 유저 생성 실행
20. 가계부 + 책장 배포
21. "비밀번호 재설정" 이메일 발송
22. podo-auth 서버 shutdown
23. auth.podonest.com DNS 정리

## 관련 이슈
- #337 (이 이슈)
- #5 podo-budget (계정 관리) → Supabase 내장 기능으로 해결
- #4 podo-auth (소셜 로그인) → Supabase OAuth로 구현
- #5 podo-auth (계정 관리) → Supabase 내장 기능
- #310 (타임스탬프) → #336 DB 마이그레이션과 함께
- #336 (DB → Supabase PostgreSQL) → 선행 작업

## 리스크

| 리스크 | 대응 |
|--------|------|
| 기존 유저 인증 끊김 | 이메일 기준 매핑 + 비밀번호 재설정 메일 |
| JWT claim 구조 차이 | BE auth.py에서 Supabase claim 매핑 |
| 봇 유저 영향 | 없음 (Supabase Auth 안 거침) |
| 소셜 로그인 기존 이메일 충돌 | Supabase 자동 계정 연결 설정 |
