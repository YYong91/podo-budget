# 자산 — 주식 실시간 가격 연동 설계

## 목표
자산 탭에서 주식 현재가를 실시간으로 표시한다.
Yahoo Finance 단일 소스 + DB 한글 종목명.

## 현황
- Yahoo Finance: 미국 주식 가격 조회 동작 중 (`price_service.py`)
- 네이버 API: Fly.io 해외 IP 차단으로 불안정
- 한투 API: 미등록
- 한글 종목명: `frontend/public/stocks_kr.json` (KOSPI/KOSDAQ 전 종목)

## 설계

### 가격 조회 통일: Yahoo Finance
- 한국 주식: `{ticker}.KS` (코스피), `{ticker}.KQ` (코스닥)
- 미국 주식: ticker 그대로
- 기존 `price_service.py`의 Yahoo 로직 재활용
- 네이버/한투 의존 제거

### 한글 종목명: DB stocks 테이블
기존 JSON → Supabase DB로 이관

```sql
CREATE TABLE stocks (
  id SERIAL PRIMARY KEY,
  ticker VARCHAR NOT NULL UNIQUE,  -- "005930"
  name VARCHAR NOT NULL,           -- "삼성전자"
  market VARCHAR NOT NULL,         -- "KOSPI" | "KOSDAQ"
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 종목 목록 자동 갱신: pg_cron
- Supabase pg_cron으로 매일 18:00 KST 실행
- KRX 공공 API → stocks 테이블 UPSERT
- 상장폐지 → is_active = false
- 신규 상장 → INSERT

### 조회 흐름
```
FE: 종목 검색 → GET /api/stocks/search?q=삼성 → DB 한글명 매칭 → ticker 반환
FE: 가격 요청 → GET /api/assets/prices → Yahoo Finance → 현재가 반환
FE: 화면에 한글명 + 현재가 표시
```

### 가격 캐싱
- 기존 `price_service.py`의 TTL 캐시 유지 (5분)
- singleflight 락으로 중복 호출 방지 (이미 구현됨)

## 선행 작업
- #336 Supabase PostgreSQL 전환 (pg_cron 사용)

## 작업 순서
1. stocks 테이블 생성 (Alembic)
2. 기존 JSON 데이터 → stocks 테이블 시드
3. BE: 종목 검색 API (`/api/stocks/search`)
4. BE: 한국 주식 가격 조회를 Yahoo로 통일 (네이버 fallback 제거)
5. FE: 종목 검색 시 JSON → BE API로 전환
6. pg_cron: KRX 공공 API 매일 자동 갱신 함수
7. 테스트

## 기존 코드 활용
- `price_service.py`: `get_stock_us_price()` Yahoo 로직
- `price_service.py`: `_search_stock_kr_yahoo()` fallback
- `frontend/public/stocks_kr.json`: 초기 시드 데이터
