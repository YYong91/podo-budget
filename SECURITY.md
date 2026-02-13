# 보안 가이드

HomeNRich 프로젝트의 보안 설정 및 베스트 프랙티스입니다.

---

## 1. 환경 변수 및 시크릿 관리

### 원칙
- **절대 코드에 하드코딩 금지**: API 키, DB 패스워드 등
- **`.env` 파일 커밋 금지**: `.gitignore`에 포함됨
- **시크릿 로테이션**: 주기적으로 API 키 교체 (3~6개월)

### Fly.io 시크릿 관리

```bash
# 시크릿 설정
flyctl secrets set KEY=value --app homenrich-backend

# 시크릿 목록 (값은 보이지 않음)
flyctl secrets list --app homenrich-backend

# 시크릿 삭제
flyctl secrets unset KEY --app homenrich-backend
```

### 로컬 개발

```bash
# .env 파일 생성
cp backend/.env.example backend/.env

# 강력한 SECRET_KEY 생성
openssl rand -hex 32

# .env 파일 권한 설정 (Unix/Linux)
chmod 600 backend/.env
```

---

## 2. 데이터베이스 보안

### 네트워크 격리

Fly.io에서 DB는 자동으로 private network에만 노출됩니다:
- Public IP 없음
- Backend 앱만 6PN (Fly private network)를 통해 접근 가능
- 외부에서 직접 접근 불가

### 로컬 접속 (개발용)

```bash
# Proxy를 통한 안전한 접속
flyctl proxy 5432 --app homenrich-db

# 다른 터미널에서:
psql postgresql://username:password@localhost:5432/homenrich  # pragma: allowlist secret
```

### 백업 전략

```bash
# 자동 백업: Fly.io가 매일 자동 스냅샷 생성 (7일 보관)

# 수동 백업:
flyctl volumes snapshots create vol_xyz --app homenrich-db

# 로컬로 다운로드:
flyctl ssh console --app homenrich-db
pg_dump -U username dbname > backup.sql
# scp로 로컬로 복사
```

### DB 접근 로깅

```bash
# PostgreSQL 로그 확인
flyctl logs --app homenrich-db | grep "connection"
```

---

## 3. API 보안

### Rate Limiting

현재 Cloudflare 무료 플랜의 기본 DDoS 방어를 사용 중입니다.

추가 보호가 필요하면 Backend에 직접 구현:

```python
# backend/app/middleware/rate_limit.py (예시)
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

# app/main.py에서:
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# 라우터에서:
@router.post("/chat")
@limiter.limit("10/minute")  # 1분에 10번까지
async def chat(request: Request, ...):
    ...
```

### CORS 설정

프로덕션에서는 반드시 명시적인 도메인만 허용:

```bash
# ❌ 절대 와일드카드 사용 금지
CORS_ORIGINS=*

# ✅ 명시적 도메인
CORS_ORIGINS=https://homenrich.yourdomain.com,https://www.homenrich.yourdomain.com
```

### 인증 토큰 (향후 구현 시)

JWT 사용 시:
- `SECRET_KEY`는 최소 32바이트 이상
- 토큰 만료 시간 설정 (access: 15분, refresh: 7일)
- HTTPS에서만 토큰 전송
- `httpOnly` 쿠키 사용 권장

---

## 4. HTTPS 및 인증서

### Fly.io 자동 HTTPS

Fly.io는 자동으로 Let's Encrypt 인증서를 발급합니다:
- `*.fly.dev` 도메인은 자동 적용
- 커스텀 도메인도 자동 갱신

### 커스텀 도메인 인증서

```bash
# 인증서 생성
flyctl certs create yourdomain.com --app homenrich-frontend

# 상태 확인
flyctl certs show yourdomain.com --app homenrich-frontend

# 인증서는 자동 갱신됨 (90일 전 갱신)
```

### HTTP → HTTPS 강제 리다이렉트

`fly.toml`에 이미 설정됨:
```toml
[http_service]
  force_https = true
```

---

## 5. 의존성 취약점 관리

### 자동 스캔

GitHub에서 Dependabot 활성화:
1. Repository > Settings > Security > Code security and analysis
2. Dependabot alerts: Enable
3. Dependabot security updates: Enable

### 수동 스캔

```bash
# Python 의존성 스캔
cd backend
pip install safety
safety check

# Node.js 의존성 스캔
cd frontend
npm audit
npm audit fix  # 자동 수정
```

### 정기 업데이트

월 1회 의존성 업데이트 권장:
```bash
# Backend
cd backend
uv lock --upgrade

# Frontend
cd frontend
npm update
```

---

## 6. 로그 및 모니터링

### 민감 정보 로깅 방지

```python
# ❌ 절대 로깅하지 말 것
logger.info(f"User API key: {api_key}")
logger.debug(f"Password: {password}")

# ✅ 마스킹 또는 일부만 로깅
logger.info(f"API key: {api_key[:8]}***")
logger.info("User authenticated successfully")
```

### 로그 보안

```bash
# Fly.io 로그는 7일간 보관 후 자동 삭제
# 장기 보관 필요 시 외부 로그 수집기 연동 (Papertrail, Datadog 등)
```

---

## 7. 에러 처리

### 프로덕션 에러 메시지

```python
# ❌ 상세 정보 노출
raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

# ✅ 일반적인 메시지
raise HTTPException(status_code=500, detail="Internal server error")

# 실제 에러는 로그로만:
logger.error(f"Database error: {str(e)}", exc_info=True)
```

### Sentry 통합 (선택)

```bash
# Sentry 계정 생성 (무료: 월 5000 이벤트)
pip install sentry-sdk[fastapi]
```

```python
# app/main.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

if not settings.DEBUG:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        integrations=[FastApiIntegration()],
        traces_sample_rate=0.1,  # 10% 트래픽 샘플링
    )
```

---

## 8. 보안 헤더

Frontend nginx 설정에 이미 포함됨:
```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
```

추가 권장 헤더:
```nginx
# nginx.conf에 추가
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
```

---

## 9. 침투 테스트 체크리스트

프로덕션 오픈 전:
- [ ] SQL Injection 테스트 (SQLAlchemy ORM 사용으로 기본 방어됨)
- [ ] XSS 테스트 (React는 기본적으로 이스케이프 처리)
- [ ] CSRF 테스트 (SameSite 쿠키 설정)
- [ ] Rate limiting 동작 확인
- [ ] CORS 설정 확인
- [ ] 환경 변수 노출 여부 확인 (`/env`, `/debug` 엔드포인트 없는지)
- [ ] 에러 메시지에 민감 정보 노출 여부
- [ ] HTTPS 강제 리다이렉트 확인
- [ ] 보안 헤더 확인 (https://securityheaders.com)

---

## 10. 사고 대응 절차

### 의심스러운 활동 발견 시

1. **즉시 시크릿 로테이션**:
   ```bash
   # API 키 교체
   flyctl secrets set ANTHROPIC_API_KEY=new_key --app homenrich-backend

   # SECRET_KEY 교체 (모든 세션 무효화됨)
   flyctl secrets set SECRET_KEY=$(openssl rand -hex 32) --app homenrich-backend
   ```

2. **로그 분석**:
   ```bash
   # 의심스러운 IP 확인
   flyctl logs --app homenrich-backend | grep "unauthorized"

   # 대량 요청 패턴 확인
   flyctl logs --app homenrich-backend | grep "429"  # Rate limit
   ```

3. **임시 차단** (Cloudflare):
   - Cloudflare Dashboard > Security > WAF
   - 의심스러운 IP 차단

4. **DB 백업**:
   ```bash
   flyctl volumes snapshots create vol_xyz --app homenrich-db
   ```

### 데이터 유출 의심 시

1. 즉시 서비스 중단:
   ```bash
   flyctl scale count 0 --app homenrich-backend
   ```

2. DB 스냅샷 생성 (증거 보존)
3. 로그 분석 및 영향 범위 파악
4. 법적 자문 (필요 시)
5. 사용자 공지 (GDPR 72시간 내)

---

## 11. 정기 보안 점검 (월 1회)

```bash
# 1. 의존성 취약점 스캔
cd backend && safety check
cd frontend && npm audit

# 2. 로그 리뷰
flyctl logs --app homenrich-backend --lines 1000 | grep -i "error\|unauthorized\|failed"

# 3. DB 백업 확인
flyctl volumes snapshots list vol_xyz --app homenrich-db

# 4. 시크릿 유효성 확인
flyctl secrets list --app homenrich-backend

# 5. 보안 헤더 검증
curl -I https://homenrich.fly.dev
```

---

## 12. 규정 준수 (GDPR/CCPA)

개인정보 보호:
- [ ] 개인정보 수집 최소화 (필수 정보만)
- [ ] 데이터 암호화 (전송: HTTPS, 저장: DB 암호화)
- [ ] 사용자 데이터 삭제 기능 구현
- [ ] 개인정보 처리방침 작성
- [ ] 쿠키 동의 배너 (EU 사용자 대상 시)

한국 개인정보보호법:
- [ ] 개인정보 처리방침 게시
- [ ] 만 14세 미만 법정대리인 동의
- [ ] 민감정보 별도 동의

---

## 연락처

보안 이슈 발견 시: security@yourdomain.com (설정 필요)
