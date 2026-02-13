# HomeNRich 프로덕션 오픈 체크리스트

서비스를 실제 사용자에게 공개하기 전 반드시 확인해야 할 항목들입니다.

---

## Phase 1: 배포 전 준비 (Pre-Deployment)

### 1. 인프라 설정

- [ ] Fly.io 계정 생성 및 결제 정보 등록
- [ ] PostgreSQL 생성 (3GB 무료 티어)
- [ ] Backend 앱 생성 및 DB 연결
- [ ] Frontend 앱 생성
- [ ] 도메인 구매 (선택)
- [ ] Cloudflare DNS 설정 (선택)

### 2. 환경 변수 설정

#### Backend (필수)

- [ ] `DATABASE_URL` (자동 설정됨, 확인만)
- [ ] `SECRET_KEY` (강력한 랜덤 문자열, 최소 32바이트)
- [ ] `LLM_PROVIDER` (anthropic/openai/google)
- [ ] `ANTHROPIC_API_KEY` (또는 OPENAI_API_KEY)
- [ ] `TELEGRAM_BOT_TOKEN`
- [ ] `KAKAO_BOT_API_KEY`
- [ ] `CORS_ORIGINS` (프론트엔드 도메인, 와일드카드 금지)
- [ ] `DEBUG=False` (프로덕션 필수)

#### Frontend

- [ ] `BACKEND_URL` (Backend Fly 앱 URL)
- [ ] `VITE_API_URL=/api` (빌드 시 설정)

### 3. 코드 품질

- [ ] Backend 테스트 통과 (`pytest`)
- [ ] Frontend 린트 통과 (`npm run lint`)
- [ ] Frontend 빌드 성공 (`npm run build`)
- [ ] Docker 이미지 빌드 성공 (로컬 테스트)
- [ ] `.env` 파일이 `.gitignore`에 포함됨 확인
- [ ] 하드코딩된 시크릿 없음 (코드 검색: `api_key`, `password`, `secret`)

### 4. 데이터베이스

- [ ] Alembic 마이그레이션 최신화 (`alembic upgrade head`)
- [ ] 초기 데이터 시드 (카테고리 등, 필요 시)
- [ ] DB 인덱스 확인 (주요 쿼리 최적화)
- [ ] DB 백업 자동화 확인 (Fly.io 기본 제공)

---

## Phase 2: 배포 (Deployment)

### 1. Backend 배포

- [ ] Fly.io Backend 앱 배포 성공
- [ ] 헬스체크 통과 (`/health`)
- [ ] DB 연결 확인 (`/health/db`)
- [ ] API 문서 접근 가능 (`/docs`)
- [ ] 로그에 에러 없음 (`flyctl logs`)

### 2. Frontend 배포

- [ ] Fly.io Frontend 앱 배포 성공
- [ ] 메인 페이지 로드 확인
- [ ] API 프록시 동작 확인 (`/api/*`)
- [ ] 정적 파일 캐싱 확인 (`Cache-Control` 헤더)
- [ ] 로그에 에러 없음

### 3. CI/CD 설정

- [ ] GitHub Actions workflow 파일 생성
- [ ] GitHub Secrets에 `FLY_API_TOKEN` 추가
- [ ] `main` 브랜치 push 시 자동 배포 테스트
- [ ] PR 생성 시 테스트 실행 확인

---

## Phase 3: 기능 검증 (Functional Testing)

### 1. 핵심 기능 테스트

- [ ] 사용자 회원가입/로그인 (구현 시)
- [ ] 지출 입력 (자연어)
- [ ] LLM 파싱 및 카테고리 자동 분류
- [ ] 지출 목록 조회
- [ ] 지출 수정/삭제
- [ ] 카테고리 관리
- [ ] 예산 설정
- [ ] 예산 초과 알림
- [ ] 인사이트 생성

### 2. 통합 테스트

- [ ] Telegram Bot 웹훅 동작
- [ ] Kakao OpenBuilder 웹훅 동작
- [ ] LLM API 호출 성공 (실제 API 키로)
- [ ] DB 트랜잭션 롤백 테스트
- [ ] 에러 핸들링 확인 (잘못된 입력, API 실패 등)

### 3. 프론트엔드 테스트

- [ ] 모든 페이지 로드 확인
- [ ] 폼 제출 (지출 입력)
- [ ] API 에러 시 사용자 친화적 메시지
- [ ] 로딩 상태 표시
- [ ] 모바일 반응형 확인
- [ ] 브라우저 호환성 (Chrome, Safari, Firefox)

---

## Phase 4: 성능 및 보안 (Performance & Security)

### 1. 성능 테스트

- [ ] 응답 시간: p95 < 500ms
- [ ] 동시 접속 100명 테스트 (Apache Bench 또는 k6)
- [ ] DB 쿼리 최적화 (N+1 문제 없음)
- [ ] 정적 파일 CDN 캐싱 확인
- [ ] gzip 압축 활성화 확인

### 2. 보안 점검

- [ ] HTTPS 강제 (`force_https = true`)
- [ ] 보안 헤더 확인 (https://securityheaders.com)
  - `X-Frame-Options`
  - `X-Content-Type-Options`
  - `X-XSS-Protection`
  - `Strict-Transport-Security` (HSTS)
- [ ] CORS 설정 (와일드카드 사용 안 함)
- [ ] SQL Injection 방어 (ORM 사용으로 기본 방어됨)
- [ ] XSS 방어 (React 기본 이스케이프)
- [ ] Rate limiting 활성화 (Cloudflare 또는 FastAPI)
- [ ] 환경 변수 노출 여부 (`/env` 엔드포인트 없는지)
- [ ] 에러 메시지에 민감 정보 없음 (스택 트레이스 숨김)

### 3. 의존성 보안

- [ ] Python 의존성 스캔 (`safety check`)
- [ ] Node.js 의존성 스캔 (`npm audit`)
- [ ] Dependabot 활성화 (GitHub)
- [ ] 취약점 수정 (Critical/High 우선)

---

## Phase 5: 모니터링 및 알림 (Monitoring & Alerting)

### 1. 기본 모니터링

- [ ] Fly Metrics 확인 (CPU, 메모리, 네트워크)
- [ ] Fly Logs 동작 확인 (실시간 로그)
- [ ] UptimeRobot 설정 (5분 간격 핑)
- [ ] 알림 채널 설정 (이메일/Slack)

### 2. 에러 트래킹 (선택)

- [ ] Sentry 계정 생성 (무료 플랜)
- [ ] Sentry SDK 설치 (Backend)
- [ ] 테스트 에러 전송 확인
- [ ] 알림 규칙 설정 (Critical 에러만)

### 3. 로깅

- [ ] 구조화된 로깅 (JSON 포맷)
- [ ] 민감 정보 로깅 안 함 (API 키, 비밀번호)
- [ ] 로그 레벨 설정 (프로덕션: INFO)
- [ ] 로그 보관 기간 확인 (Fly.io: 7일)

---

## Phase 6: 백업 및 재해 복구 (Backup & DR)

### 1. 백업

- [ ] 자동 백업 활성화 (Fly Postgres 기본 제공)
- [ ] 수동 백업 테스트 (`flyctl volumes snapshots create`)
- [ ] 백업 보관 기간 확인 (7일)
- [ ] 백업 위치 확인 (Fly.io 내부)

### 2. 복구 테스트

- [ ] 스냅샷에서 DB 복원 테스트
- [ ] RTO (복구 시간 목표): < 1시간
- [ ] RPO (복구 시점 목표): < 24시간
- [ ] 재해 복구 매뉴얼 작성 (DEPLOYMENT.md 참고)

---

## Phase 7: 문서화 (Documentation)

### 1. 사용자 문서

- [ ] README.md 업데이트
- [ ] 사용 가이드 작성 (Telegram/Kakao 사용법)
- [ ] FAQ 작성 (예정)
- [ ] 개인정보 처리방침 (필요 시)
- [ ] 이용약관 (필요 시)

### 2. 운영 문서

- [ ] DEPLOYMENT.md (배포 가이드)
- [ ] QUICKSTART.md (빠른 시작)
- [ ] SECURITY.md (보안 설정)
- [ ] INFRASTRUCTURE.md (인프라 아키텍처)
- [ ] 온콜 매뉴얼 (장애 대응 절차)

### 3. API 문서

- [ ] Swagger UI 접근 가능 (`/docs`)
- [ ] 모든 엔드포인트 설명 추가
- [ ] 요청/응답 예시
- [ ] 에러 코드 설명

---

## Phase 8: 사용자 준비 (User Readiness)

### 1. Webhook 설정

- [ ] Telegram Bot Webhook URL 설정
  ```
  https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://yourdomain.com/api/telegram/webhook
  ```
- [ ] Telegram Bot 명령어 등록 (`/start`, `/help` 등)
- [ ] Kakao OpenBuilder 스킬 URL 설정
- [ ] Kakao OpenBuilder 시나리오 테스트

### 2. 초기 데이터

- [ ] 기본 카테고리 생성 (식비, 교통비, 문화생활 등)
- [ ] 예산 템플릿 생성 (선택)
- [ ] 샘플 데이터 (데모용, 선택)

### 3. 베타 테스트

- [ ] 내부 테스트 (개발자 + 지인 5~10명)
- [ ] 피드백 수집 (Google Forms 등)
- [ ] 주요 버그 수정
- [ ] 사용성 개선

---

## Phase 9: 비용 및 규정 준수 (Cost & Compliance)

### 1. 비용 관리

- [ ] Fly.io 무료 티어 제약 확인 (3개 앱, 3GB DB, 160GB 트래픽)
- [ ] LLM API 예산 설정 (Anthropic/OpenAI 대시보드)
- [ ] 비용 알림 설정 (월 $10 초과 시 알림)
- [ ] 비용 모니터링 대시보드 설정

### 2. 규정 준수 (한국)

- [ ] 개인정보 처리방침 게시 (필수)
- [ ] 만 14세 미만 법정대리인 동의 (해당 시)
- [ ] 개인정보 수집 동의 (회원가입 시)
- [ ] 데이터 보관 기간 명시
- [ ] 탈퇴 시 데이터 삭제 기능

### 3. GDPR (EU 사용자 대상 시)

- [ ] 쿠키 동의 배너
- [ ] 데이터 이동권 (Export)
- [ ] 삭제권 (Right to be forgotten)
- [ ] 72시간 내 데이터 유출 공지 절차

---

## Phase 10: 런칭 (Launch)

### 1. 소프트 런칭 (Soft Launch)

- [ ] 베타 테스터에게 공개 (10~50명)
- [ ] 2주간 안정성 모니터링
- [ ] 피드백 반영 및 버그 수정
- [ ] 성능 최적화

### 2. 공식 런칭 (Public Launch)

- [ ] 공식 도메인 오픈 (yourdomain.com)
- [ ] 소셜 미디어 공지 (선택)
- [ ] Product Hunt 등록 (선택)
- [ ] 런칭 이벤트 (선택)

### 3. 런칭 후 모니터링 (48시간)

- [ ] 실시간 로그 모니터링
- [ ] 에러율 확인 (< 1% 목표)
- [ ] 응답 시간 확인 (< 500ms 목표)
- [ ] 사용자 피드백 수집
- [ ] 긴급 버그 핫픽스 준비

---

## Phase 11: 사후 관리 (Post-Launch)

### 1. 주간 점검 (Weekly)

- [ ] 에러 로그 리뷰 (Sentry 또는 Fly Logs)
- [ ] 성능 지표 확인 (Fly Metrics)
- [ ] DB 크기 확인 (3GB 제한)
- [ ] LLM API 비용 확인
- [ ] 사용자 피드백 정리

### 2. 월간 점검 (Monthly)

- [ ] 의존성 업데이트 (`uv lock --upgrade`, `npm update`)
- [ ] 보안 스캔 (`safety check`, `npm audit`)
- [ ] DB 백업 테스트 (복원 실습)
- [ ] 비용 리포트 (실제 vs 예상)
- [ ] 성능 최적화 (느린 쿼리 개선)

### 3. 분기별 점검 (Quarterly)

- [ ] 인프라 리뷰 (스케일 업 필요성)
- [ ] 보안 감사 (외부 도구: OWASP ZAP)
- [ ] DR 훈련 (재해 복구 시뮬레이션)
- [ ] 사용자 설문 (만족도, 개선사항)
- [ ] 로드맵 업데이트

---

## 비상 연락 체계

### 긴급 상황 (Critical)

- [ ] 서비스 완전 다운
- [ ] 데이터 유출 의심
- [ ] 대규모 API 비용 폭증

**대응**:
1. Slack/이메일 즉시 알림
2. 롤백 또는 긴급 핫픽스
3. 사용자 공지 (1시간 내)
4. 사후 부검 (Post-mortem) 작성

### 높은 우선순위 (High)

- [ ] 주요 기능 장애 (LLM 파싱 실패)
- [ ] 에러율 1% 초과
- [ ] 응답 시간 1초 초과

**대응**:
1. 4시간 내 조사 시작
2. 24시간 내 수정
3. 릴리스 노트 작성

### 일반 (Medium/Low)

- [ ] UI 버그
- [ ] 사용성 개선
- [ ] 기능 요청

**대응**:
1. 백로그에 추가
2. 다음 스프린트에서 검토

---

## 최종 체크

### 배포 직전 (T-1시간)

- [ ] 모든 체크리스트 완료 확인
- [ ] 팀원 최종 리뷰 (1인 개발자: 스스로 재검토)
- [ ] 롤백 절차 숙지
- [ ] 긴급 연락망 확인
- [ ] 커피 준비 ☕

### 배포 직후 (T+0)

- [ ] 헬스체크 통과 확인 (5분)
- [ ] 주요 기능 수동 테스트 (10분)
- [ ] 로그 모니터링 (30분)
- [ ] 첫 사용자 피드백 대기

---

## 성공 기준

### 기술 지표

- ✅ 가용성 > 99.9%
- ✅ 응답 시간 p95 < 500ms
- ✅ 에러율 < 0.1%
- ✅ 배포 빈도 > 주 1회

### 비즈니스 지표

- ✅ 첫 주 사용자 > 10명
- ✅ 첫 달 사용자 > 100명
- ✅ 월 비용 < $10

---

## 문서 버전

- **작성일**: 2025-02-13
- **버전**: 1.0
- **검토자**: Senior DevOps Architect (Claude)
- **다음 리뷰**: 첫 배포 후 1주일
