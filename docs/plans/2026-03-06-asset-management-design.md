# 포도가계부 2.0 — 자산관리 & 저축 목표 설계

## 개요

가족 단위 자산관리 기능 추가. 보유 자산/부채 현황 파악, 저축 목표 설정, AI 기반 재무 인사이트 제공.

- **사용 단위**: Household (가족 공유)
- **점진적 확장**: Phase 1 → 2 → 3 순서로 배포

---

## Phase 1: 자산/부채 현황 대시보드

### 데이터 모델

```
Asset (자산/부채 항목)
├── id, household_id (FK), created_by (user_id FK)
├── name ("삼성전자", "신한은행 적금", "아파트 대출")
├── type: stock_kr | stock_us | crypto | deposit | real_estate | other | loan
├── is_liability: boolean (true = 부채)
│
├── # 투자형 (stock/crypto)
├── ticker: string? ("005930", "AAPL", "BTC")
├── quantity: decimal?
├── avg_buy_price: decimal?
│
├── # 수동형 (deposit/real_estate/other/loan)
├── manual_value: decimal?
├── interest_rate: decimal? (이율 %)
├── maturity_date: date? (만기일)
│
├── # 대출 전용
├── repayment_type: string? (원리금균등/원금균등/만기일시)
├── monthly_payment: decimal? (월 상환액)
│
├── memo: string?
├── created_at, updated_at

AssetSnapshot (월별 스냅샷 - 순자산 추이용)
├── id, household_id, snapshot_date (월초)
├── total_assets, total_liabilities, net_worth
├── breakdown: JSON (유형별 합산)
```

### 시세 API 연동

| 대상 | API | 비용 | 방식 |
|------|-----|------|------|
| 한국 주식/ETF | KIS (한국투자증권 OpenAPI) | 무료 | 종목코드 → 현재가 |
| 미국 주식/ETF | Yahoo Finance 또는 Finnhub | 무료 tier | 티커 → 현재가 (USD) |
| 코인 | 업비트 공개 API | 무료 | 마켓코드 → 현재가 (KRW) |
| 환율 (USD→KRW) | 한국은행 ECOS 또는 exchangerate-api | 무료 | 미국 주식 원화 환산용 |

**시세 갱신 전략:**
- 페이지 진입 시 실시간 조회 (캐시 5분)
- 월 1회 자동 스냅샷 저장 (크론 또는 첫 접속 시 트리거)
- 장 마감 후 / 주말은 마지막 종가 사용

### API 엔드포인트

```
# 자산 CRUD
POST   /api/assets                    → 자산/부채 등록
GET    /api/assets                    → 목록 (household 범위)
GET    /api/assets/{id}               → 상세
PUT    /api/assets/{id}               → 수정
DELETE /api/assets/{id}               → 삭제

# 자연어 입력
POST   /api/assets/parse              → 자연어 → 자산 정보 파싱

# 시세 조회
GET    /api/assets/prices             → 보유 투자형 자산 일괄 시세 조회
GET    /api/assets/prices/{ticker}    → 개별 종목 시세

# 현황
GET    /api/assets/summary            → 순자산, 유형별 합산, 총 수익률
GET    /api/assets/snapshots          → 월별 스냅샷 (추이 그래프용)

# 종목 검색 (등록 시 자동완성)
GET    /api/assets/search?q=삼성      → 종목/코인 검색
```

### 자연어 입력 예시

- "삼성전자 10주 7만원에 샀어" → 종목 매칭, 수량 10, 매입가 70,000
- "비트코인 0.5개 보유중 평균 5천만원" → 코인, 수량 0.5, 매입가 50,000,000
- "신한은행 적금 500만원 3.5% 내년 12월 만기" → 예금, 금액, 이율, 만기일
- "주담대 2억 3.8% 원리금균등 월 90만원" → 대출, 잔액, 이율, 상환방식, 월상환액

플로우: 자연어 입력 → LLM 파싱 → 프리뷰 → 수정 → 확인

### 프론트엔드 화면

**자산 대시보드** (사이드바 "자산관리" 메뉴)
- 상단: 순자산 큰 숫자 (총자산 - 총부채)
- 자산/부채 비중 파이차트
- 자산 목록 카드: 종목명, 현재 평가액, 수익률(%), 손익 금액
- 부채 목록 카드: 대출명, 잔액, 이율, 월 상환액
- 하단: 순자산 추이 라인 그래프 (최근 12개월)

**자산 등록 폼**
- type 선택 → 해당 필드만 표시
- 주식/코인: 종목 검색 → 자동완성 → 수량, 매입가 입력
- 수동형: 이름, 금액, 이율, 만기일 등
- 또는 자연어로 한 줄 입력

---

## Phase 2: 저축 목표

### 데이터 모델

```
SavingsGoal (저축 목표)
├── id, household_id (FK), created_by (user_id FK)
├── name ("내 집 마련", "노후 연금", "자녀 교육비")
├── target_amount: decimal (목표 금액)
├── target_date: date (목표 달성일)
├── priority: integer (목표 간 우선순위)
├── linked_assets: M2M → Asset (이 목표에 배정된 자산들)
├── memo: string?
├── created_at, updated_at

GoalContribution (월별 저축 기록)
├── id, goal_id (FK), user_id (FK)
├── amount: decimal (이번 달 저축액)
├── month: date (2026-03 등)
├── created_at
```

### 자동 계산 항목

- 현재 배정 자산 합계 (linked_assets 평가액 합산)
- 달성률 (%) = 배정 자산 / 목표 금액
- 남은 금액 = 목표 금액 - 배정 자산
- 필요 월 저축액 = 남은 금액 / 남은 개월 수
- 필요 연 수익률 = 목표 도달에 필요한 투자 수익률 (복리 계산)

### API

```
POST   /api/goals              → 목표 생성
GET    /api/goals              → 목표 목록 (household)
GET    /api/goals/{id}         → 상세 + 계산 결과
PUT    /api/goals/{id}         → 수정
DELETE /api/goals/{id}         → 삭제
POST   /api/goals/{id}/link    → 자산 연결/해제
GET    /api/goals/summary      → 전체 목표 요약 (총 필요 월 저축액 등)
```

### 프론트엔드

- 목표 목록: 카드형, 각 카드에 프로그레스 바 + 달성률 + 필요 월 저축액
- 목표 상세: 연결된 자산 목록, 월별 저축 추이, 예상 달성일
- 상단 요약: 모든 목표의 월 필요 저축액 합산 vs 현재 월 저축 여력 (수입 - 지출 - 고정비)

---

## Phase 3: 인사이트/조언

### 규칙 기반 인사이트 (자동 계산)

| 인사이트 | 데이터 소스 | 예시 |
|---------|-----------|------|
| 저축 속도 진단 | 목표 vs 실제 월 저축 추이 | "현재 속도면 내 집 마련 2030년 9월 예상 (목표보다 1년 늦음)" |
| 필요 수익률 | 목표 금액, 기한, 현재 자산 | "연 7.2% 수익률이 필요합니다" |
| 자산 배분 현황 | 자산 유형별 비중 | "주식 72%, 예금 18%, 부동산 10%" |
| 부채 비율 | 총 부채 / 총 자산 | "부채 비율 35% — 안정적 수준" |
| 저축 여력 | 월 수입 - 월 지출 - 월 대출상환 | "월 저축 가능액 120만원, 목표 필요액 180만원 (부족 60만원)" |

### LLM 기반 조언 (월 1회 또는 요청 시 생성)

**입력 데이터:**
- 자산/부채 현황, 수익률
- 최근 3개월 지출/수입 패턴 (1.0 데이터)
- 저축 목표 및 진행 상황
- 예산 대비 실제 지출

**출력 예시:**
- "외식비가 월 평균 45만원입니다. 30만원으로 줄이면 내 집 마련 8개월 앞당길 수 있어요"
- "고금리 대출(4.5%)을 먼저 상환하면 연 54만원 이자 절감됩니다"
- "주식 비중이 높습니다. 목표 기한(3년)을 고려하면 안전자산 비중을 늘려보세요"

### API

```
GET  /api/insights/financial-summary   → 규칙 기반 수치 요약
POST /api/insights/financial-advice    → LLM 조언 생성
```

### 프론트엔드

- 기존 인사이트 페이지에 "자산/저축" 탭 추가
- 상단: 규칙 기반 핵심 수치 카드들
- 하단: LLM 조언 (마크다운 렌더링)
