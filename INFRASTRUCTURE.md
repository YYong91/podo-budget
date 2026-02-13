# 인프라 아키텍처 및 비용 분석

HomeNRich의 인프라 전략과 사용자 규모별 비용 분석입니다.

---

## 현재 아키텍처 (Phase 1: MVP)

### 시스템 다이어그램

```
사용자 (한국)
    ↓
┌───────────────────────────────────────────────────────┐
│ Cloudflare (무료)                                      │
│ - DNS 관리                                             │
│ - CDN (정적 파일 캐싱)                                 │
│ - DDoS 방어                                            │
│ - 자동 HTTPS (Universal SSL)                           │
└──────────────────┬────────────────────────────────────┘
                   ↓ HTTPS
┌───────────────────────────────────────────────────────┐
│ Fly.io (도쿄 리전, nrt)                               │
│                                                        │
│ ┌────────────────────────────────────────────┐        │
│ │ homenrich-frontend                         │        │
│ │ - nginx:alpine                             │        │
│ │ - React 19 빌드 결과물                     │        │
│ │ - 256MB RAM, shared-cpu-1x                 │        │
│ │ - /api/* → backend 프록시                  │        │
│ └──────────┬─────────────────────────────────┘        │
│            │ HTTP (Fly 내부 네트워크)                 │
│            ↓                                           │
│ ┌────────────────────────────────────────────┐        │
│ │ homenrich-backend                          │        │
│ │ - FastAPI (Python 3.12)                    │        │
│ │ - uvicorn (ASGI)                           │        │
│ │ - 512MB RAM, shared-cpu-1x                 │        │
│ │ - LLM API 호출 (Anthropic/OpenAI)          │        │
│ └──────────┬─────────────────────────────────┘        │
│            │ asyncpg                                   │
│            ↓                                           │
│ ┌────────────────────────────────────────────┐        │
│ │ homenrich-db                               │        │
│ │ - PostgreSQL 16                            │        │
│ │ - 3GB 스토리지                             │        │
│ │ - 256MB RAM, shared-cpu-1x                 │        │
│ │ - 자동 일일 백업 (7일 보관)                │        │
│ └────────────────────────────────────────────┘        │
│                                                        │
│ 모니터링: Fly Metrics (기본 제공)                     │
└────────────────────────────────────────────────────────┘

외부 API (종량제):
  - Anthropic Claude API
  - Telegram Bot API (무료)
  - Kakao OpenBuilder (무료)
```

### 기술 스택

| 계층 | 기술 | 버전 | 비고 |
|------|------|------|------|
| Frontend | React | 19 | Vite 7 빌드 |
| Frontend Server | Nginx | alpine | 정적 파일 서빙 + 프록시 |
| Backend | FastAPI | latest | async-first |
| Language | Python | 3.12 | uv 패키지 매니저 |
| Database | PostgreSQL | 16 | asyncpg 드라이버 |
| Migration | Alembic | latest | |
| Container | Docker | latest | 멀티 스테이지 빌드 |
| Hosting | Fly.io | - | Tokyo 리전 |
| CDN/DNS | Cloudflare | 무료 | |
| CI/CD | GitHub Actions | - | |

---

## 비용 분석

### 1. 사용자 규모별 예상 비용 (월간)

#### Phase 1: MVP (10~100명)

| 항목 | 사양 | 비용 |
|------|------|------|
| **Fly.io** | | |
| Frontend | 256MB, shared-cpu-1x | $0 (무료 티어) |
| Backend | 512MB, shared-cpu-1x | $0 (무료 티어) |
| Database | 3GB, 256MB RAM | $0 (무료 티어) |
| 트래픽 | < 100GB/월 | $0 (무료 티어) |
| **Cloudflare** | | |
| DNS + CDN | 무료 플랜 | $0 |
| **외부 API** | | |
| Anthropic Claude | ~1000 요청/월 | ~$5 |
| Telegram API | 무제한 | $0 |
| Kakao OpenBuilder | 무제한 | $0 |
| **도메인** | | |
| .com 도메인 | 1년 | ~$12/년 (~$1/월) |
| **총계** | | **$5~6/월** |

**무료 티어 제약**:
- Fly.io: 3개 앱까지 무료, 160GB 아웃바운드/월
- 비활성 시 자동 중지 (콜드 스타트 1~2초)
- DB 스토리지 3GB 제한

#### Phase 2: 초기 성장 (100~1000명)

| 항목 | 사양 | 비용 |
|------|------|------|
| **Fly.io** | | |
| Frontend | 512MB, shared-cpu-1x, 2 instances | $5 |
| Backend | 1GB, shared-cpu-1x, 2 instances | $10 |
| Database | 10GB, 1GB RAM, dedicated CPU | $15 |
| 트래픽 | ~500GB/월 | $5 |
| **Cloudflare** | | |
| CDN + DNS | Pro 플랜 (선택) | $20 (또는 $0 무료 지속) |
| **외부 API** | | |
| Anthropic Claude | ~10,000 요청/월 | ~$30 |
| Redis (Upstash) | 무료 티어 | $0 |
| **모니터링** | | |
| Sentry | 무료 플랜 | $0 |
| **도메인** | | $1 |
| **총계** | | **$66/월** (Cloudflare 무료 시: $46/월) |

**변경 사항**:
- Backend 스케일 아웃 (2 instances, auto-scale)
- DB 전용 CPU + 메모리 증가
- Redis 캐싱 추가 (API 응답 캐시)

#### Phase 3: 확장 (1000~10,000명)

| 항목 | 사양 | 비용 |
|------|------|------|
| **Fly.io** | | |
| Frontend | 1GB, dedicated CPU, 3 instances | $30 |
| Backend | 2GB, dedicated CPU, 4 instances | $80 |
| Database | 50GB, 4GB RAM, dedicated CPU | $50 |
| 트래픽 | ~2TB/월 | $30 |
| **Cloudflare** | | |
| Pro 플랜 | 보안 + 성능 | $20 |
| **외부 API** | | |
| Anthropic Claude | ~100,000 요청/월 | ~$200 |
| Upstash Redis | Pro 플랜 | $10 |
| **모니터링** | | |
| Sentry | Team 플랜 | $29 |
| Datadog (선택) | 로그 + APM | $31 |
| **도메인 + SSL** | | $1 |
| **총계** | | **$481/월** |

**추가 고려사항**:
- AWS/GCP 이전 검토 (서울 리전 필요 시)
- CDN 강화 (이미지/동영상 많을 경우)
- 전문 DBA 컨설팅 (DB 최적화)

---

### 2. LLM API 비용 상세 분석

#### Anthropic Claude Sonnet 3.5 (2025년 2월 기준)

| 모델 | Input 비용 | Output 비용 |
|------|-----------|------------|
| Claude 3.5 Sonnet | $3 / 1M tokens | $15 / 1M tokens |

#### 사용자 행동 가정

- 사용자당 일평균 3건 입력
- 평균 입력: 50 토큰 (한국어 ~30자)
- 평균 출력: 150 토큰 (카테고리 분류 + 메모)

#### 월간 비용 계산

**100명 사용자**:
- 총 요청: 100명 × 3건/일 × 30일 = 9,000 요청
- Input 토큰: 9,000 × 50 = 450,000 tokens = $1.35
- Output 토큰: 9,000 × 150 = 1,350,000 tokens = $20.25
- **합계: ~$22/월**

**1,000명 사용자**:
- 총 요청: 90,000 요청/월
- Input: $13.5
- Output: $202.5
- **합계: ~$216/월**

**비용 절감 전략**:
1. **캐싱**: 유사한 입력은 캐시된 결과 반환 (Redis)
2. **배치 처리**: 여러 요청을 묶어서 처리
3. **모델 선택**: 간단한 요청은 Haiku (저렴한 모델) 사용
4. **프롬프트 최적화**: 토큰 수 최소화

---

### 3. 클라우드 플랫폼 비교 (1000명 기준)

| 플랫폼 | 월 비용 | 장점 | 단점 | 권장 |
|--------|--------|------|------|------|
| **Fly.io** | **$46** | 간단한 배포, 무료 티어, Docker 기반 | 서울 리전 없음 | ⭐⭐⭐⭐⭐ |
| Railway | $50 | GUI 우수, GitHub 연동 쉬움 | 무료 티어 제한적 | ⭐⭐⭐⭐ |
| Render | $70 | 관리형 DB 좋음, 문서 우수 | 비용 높음 | ⭐⭐⭐ |
| AWS Lightsail | $30 (서버) + $15 (RDS) = **$45** | 서울 리전, AWS 생태계 | 수동 설정 많음 | ⭐⭐⭐ |
| GCP Cloud Run | $80 (추정) | 서울 리전, 서버리스 | 비용 예측 어려움 | ⭐⭐⭐ |
| Vercel + PlanetScale | $60 | Frontend 최고, Serverless | Backend 제약 | ⭐⭐ |
| DigitalOcean | $48 (droplet + DB) | 단순함, 예측 가능 | 수동 관리 필요 | ⭐⭐⭐ |

**결론**: MVP는 Fly.io, 성장기에 AWS 서울 이전 고려

---

## 스케일링 전략

### 수평 스케일링 (Horizontal Scaling)

#### Frontend
```bash
# 인스턴스 수 증가 (트래픽 증가 시)
flyctl scale count 3 --app homenrich-frontend

# Auto-scaling 설정 (유료 플랜)
flyctl autoscale set min=2 max=5 --app homenrich-frontend
```

#### Backend
```bash
# 인스턴스 수 증가
flyctl scale count 4 --app homenrich-backend

# Auto-scaling
flyctl autoscale set min=2 max=10 --app homenrich-backend
```

**트리거 조건**:
- CPU 사용률 > 70% 지속 5분
- 메모리 사용률 > 80%
- 응답 시간 p95 > 1초

### 수직 스케일링 (Vertical Scaling)

#### Backend
```bash
# 메모리 증가
flyctl scale memory 2048 --app homenrich-backend

# CPU 증가 (dedicated)
flyctl scale vm dedicated-cpu-2x --app homenrich-backend
```

#### Database
```bash
# 스토리지 증가
flyctl volumes extend vol_xyz --size 50 --app homenrich-db

# 메모리 + CPU 증가 (새 VM 생성 필요)
flyctl scale vm dedicated-cpu-4x memory 8192 --app homenrich-db
```

### 캐싱 전략

#### 1단계: Application-level 캐싱

```python
# backend/app/services/cache.py
from functools import lru_cache

@lru_cache(maxsize=1000)
def get_category_by_name(name: str):
    # DB 조회 결과 캐시
    ...
```

#### 2단계: Redis 캐싱 (Upstash 무료 티어)

```bash
# Upstash Redis 연동
flyctl secrets set REDIS_URL=upstash_url --app homenrich-backend
```

```python
# backend/app/core/cache.py
import redis.asyncio as redis

cache = redis.from_url(settings.REDIS_URL)

# 캐시 사용 예시
async def get_cached_categories():
    cached = await cache.get("categories:all")
    if cached:
        return json.loads(cached)

    categories = await db_query()
    await cache.setex("categories:all", 3600, json.dumps(categories))
    return categories
```

**캐시 적용 대상**:
- 카테고리 목록 (TTL: 1시간)
- 월별 통계 (TTL: 5분)
- LLM 응답 (동일 입력, TTL: 24시간)

---

## 성능 최적화

### Database 최적화

#### 1. 인덱스 추가

```sql
-- 자주 조회되는 컬럼에 인덱스
CREATE INDEX idx_expenses_user_date ON expenses(user_id, expense_date DESC);
CREATE INDEX idx_expenses_category ON expenses(category_id);
CREATE INDEX idx_expenses_household_date ON expenses(household_id, expense_date DESC);
```

#### 2. 쿼리 최적화

```python
# ❌ N+1 쿼리
expenses = await session.execute(select(Expense))
for expense in expenses:
    category = await session.get(Category, expense.category_id)  # 반복 쿼리

# ✅ Eager loading
expenses = await session.execute(
    select(Expense).options(joinedload(Expense.category))
)
```

#### 3. 커넥션 풀 튜닝

```python
# backend/app/core/database.py
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=20,          # 동시 연결 수 (기본 5)
    max_overflow=10,       # 초과 연결 허용 (기본 10)
    pool_pre_ping=True,    # 연결 유효성 체크
    pool_recycle=3600,     # 1시간마다 연결 재생성
)
```

### Backend 최적화

#### 1. 비동기 처리

```python
# LLM 호출을 백그라운드 작업으로
from fastapi import BackgroundTasks

@router.post("/expenses")
async def create_expense(
    expense: ExpenseCreate,
    background_tasks: BackgroundTasks,
):
    # 즉시 저장 (LLM 없이)
    db_expense = Expense(**expense.dict())
    session.add(db_expense)
    await session.commit()

    # LLM 분석은 백그라운드에서
    background_tasks.add_task(analyze_expense, db_expense.id)

    return db_expense
```

#### 2. 응답 압축

```python
# main.py
from fastapi.middleware.gzip import GZipMiddleware

app.add_middleware(GZipMiddleware, minimum_size=1000)
```

### Frontend 최적화

#### 1. Code Splitting

```typescript
// React lazy loading
const ExpenseList = lazy(() => import('./components/ExpenseList'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <ExpenseList />
    </Suspense>
  );
}
```

#### 2. 이미지 최적화

```nginx
# nginx.conf
location ~* \.(jpg|jpeg|png|gif|webp)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    access_log off;

    # 이미지 압축 (ngx_http_image_filter_module 필요)
    image_filter resize 800 -;
}
```

---

## 모니터링 및 알림

### 1. Fly.io 기본 메트릭

```bash
# 대시보드 열기
flyctl dashboard --app homenrich-backend

# 메트릭 확인
flyctl metrics --app homenrich-backend
```

**제공 메트릭**:
- CPU 사용률
- 메모리 사용률
- 네트워크 트래픽
- HTTP 응답 시간
- 에러 비율

### 2. 커스텀 알림 (Prometheus + Grafana)

향후 구축 시:
```yaml
# fly.toml
[metrics]
  port = 9090
  path = "/metrics"
```

### 3. Uptime 모니터링 (무료)

- **UptimeRobot**: 무료 플랜 (50 모니터, 5분 간격)
- **StatusCake**: 무료 플랜 (무제한 모니터, 5분 간격)

설정:
- URL: `https://homenrich.fly.dev/health`
- 간격: 5분
- 알림: 이메일/Slack

---

## 재해 복구 (Disaster Recovery)

### RTO/RPO 목표

- **RTO** (Recovery Time Objective): 1시간
- **RPO** (Recovery Point Objective): 24시간

### 백업 전략

#### 자동 백업 (Fly.io)
- 일일 스냅샷 자동 생성 (7일 보관)
- 위치: Fly.io 내부 스토리지

#### 수동 백업 (주간)

```bash
# DB 백업
flyctl ssh console --app homenrich-db
pg_dump -U username homenrich | gzip > backup_$(date +%Y%m%d).sql.gz

# S3로 업로드 (선택)
aws s3 cp backup_*.sql.gz s3://homenrich-backups/
```

#### 복구 절차

```bash
# 1. 새 DB 생성
flyctl postgres create --name homenrich-db-restore

# 2. 백업 복원
flyctl ssh console --app homenrich-db-restore
gunzip -c backup.sql.gz | psql -U username dbname

# 3. Backend 재연결
flyctl postgres attach homenrich-db-restore --app homenrich-backend
```

---

## 비용 최적화 체크리스트

MVP 단계:
- [x] Fly.io 무료 티어 활용 (3개 앱)
- [x] Cloudflare 무료 CDN 사용
- [x] 자동 중지 설정 (`auto_stop_machines = true`)
- [x] 최소 인스턴스 0 (비활성 시 비용 0)
- [ ] LLM 응답 캐싱 구현 (중복 요청 방지)
- [ ] DB 쿼리 최적화 (인덱스 추가)

성장 단계:
- [ ] Reserved Instance 검토 (AWS 이전 시)
- [ ] CDN 히트율 모니터링 (Cloudflare Analytics)
- [ ] LLM 모델 티어 전략 (Haiku/Sonnet 혼용)
- [ ] 이미지 최적화 (WebP, lazy loading)
- [ ] 불필요한 로그 제거 (스토리지 절약)

---

## 마이그레이션 체크리스트

### Fly.io → AWS (서울 리전) 이전 시

**언제?**
- 레이턴시가 critical (금융 거래 등)
- 한국 규제 준수 필요 (데이터 주권)
- 월 비용 $500+ (대규모 시)

**절차**:
1. **준비** (2주):
   - [ ] AWS 계정 생성, 결제 설정
   - [ ] Terraform으로 IaC 구성
   - [ ] CI/CD 수정 (AWS ECR, ECS)

2. **이전** (1일):
   - [ ] RDS PostgreSQL 생성 (서울)
   - [ ] DB 마이그레이션 (pg_dump/restore)
   - [ ] ECS 서비스 배포
   - [ ] DNS 전환 (TTL 단축 → CNAME 변경)

3. **검증** (1주):
   - [ ] 레이턴시 개선 확인
   - [ ] 모니터링 설정
   - [ ] 비용 추적

---

## 요약

### 핵심 결정

1. **MVP**: Fly.io 무료 티어 → $5~10/월
2. **성장기**: Fly.io 유료 → $50~100/월
3. **확장기**: AWS 서울 검토 → $300+/월

### 트리거 포인트

| 지표 | 현재 → 다음 단계 | 행동 |
|------|----------------|------|
| DAU | 100 → 1,000 | Fly.io 유료 전환 |
| 레이턴시 | 100ms → 200ms+ | 수평 스케일링 |
| DB 크기 | 2GB → 3GB | DB 업그레이드 |
| 월 비용 | $100 → $300 | AWS 이전 검토 |
| 에러율 | 0.1% → 1% | 모니터링 강화 |

### 다음 단계

1. Fly.io 계정 생성 및 첫 배포
2. GitHub Actions 설정
3. 도메인 구매 및 Cloudflare 설정
4. Sentry 무료 플랜 연동
5. LLM 캐싱 구현
