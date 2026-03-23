# 결제수단 & 카드 실적 추적 설계

## 목표
지출에 결제수단을 태깅하고, 카드 실적 달성 여부를 추적한다.
카드사 연동 없이 결제수단 태깅 + 목표 금액으로 실적 추적.

## 결정 사항

| 항목 | 결정 |
|------|------|
| 범위 | 결제수단 전체 태깅 (카드/현금/이체) + 카드 실적 추적 |
| 소속 | 가구 단위 관리 + 개인별 기본 결제수단 |
| LLM 연동 | 텍스트 매칭만 ("삼성카드" → 등록된 결제수단 매칭). 미지정 시 기본값 |
| 실적 기산일 | 1일~말일 (단순) |
| 봇 명령어 | `/card`, 한글 "실적", "카드" |
| 관리 UI | 설정 하위 (/settings/payment-methods) |
| 실적 현황 | 리포트 페이지에 섹션 추가 |

## 모델

### PaymentMethod (신규)
```python
class PaymentMethod(Base):
    __tablename__ = "payment_methods"

    id = Column(Integer, primary_key=True, autoincrement=True)
    household_id = Column(Integer, ForeignKey("households.id"), nullable=False)
    name = Column(String, nullable=False)  # "삼성카드", "현금" 등
    type = Column(String, nullable=False)  # credit_card, debit_card, cash, transfer
    monthly_target = Column(Integer, nullable=True)  # 월 실적 목표 (원). NULL이면 실적 추적 안 함
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now(), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), server_default=func.now(), nullable=False)
```

### User 변경
```python
# 기존 필드에 추가
default_payment_method_id = Column(Integer, ForeignKey("payment_methods.id"), nullable=True)
```

### Expense 변경
```python
# 기존 필드에 추가
payment_method_id = Column(Integer, ForeignKey("payment_methods.id"), nullable=True)
```

## API

### PaymentMethod CRUD
- `GET /api/payment-methods` — 목록 (가구 단위)
- `POST /api/payment-methods` — 생성
- `PUT /api/payment-methods/{id}` — 수정
- `DELETE /api/payment-methods/{id}` — 삭제

### 실적 조회
- `GET /api/payment-methods/stats` — 카드별 월간 사용액/목표 (monthly_target이 설정된 것만)

### 기본 결제수단 설정
- `PUT /api/auth/me/default-payment` — 개인 기본 결제수단 설정

## 결제수단 매칭 로직 (지출 저장 시)

```
1. 입력 텍스트에서 결제수단 이름 추출 ("점심 8000원 삼성카드" → "삼성카드")
2. 가구의 등록된 결제수단 목록에서 텍스트 매칭
3. 매칭 실패 → 사용자의 기본 결제수단 (default_payment_method_id)
4. 기본값도 없음 → payment_method_id = NULL
```

## UI

### 설정 > 결제수단 관리 (/settings/payment-methods)
- 결제수단 목록 (이름, 타입, 월 목표)
- 추가/수정/삭제
- 기본 결제수단 토글 (개인별)
- 프로그레스 바 표시 (목표 설정된 카드)

### 리포트 > 카드 실적 섹션
- 목표 설정된 카드만 표시
- 프로그레스 바 + 잔여 금액
- "N만원 더 쓰면 달성!" 안내

### 지출 입력 시
- 직접 입력 모드: 결제수단 드롭다운 (선택)
- 자연어 모드: LLM 텍스트 매칭 → 미지정 시 기본값

## 봇 명령어

### `/card` (한글: "실적", "카드")
```
💳 카드 실적 현황

삼성카드: ████████░░ 82% (41만/50만)
  → 9만원 더 쓰면 달성!

신한카드: ███░░░░░░░ 30% (9만/30만)
  → 21만원 남음
```

목표 미설정 결제수단은 표시 안 함.

## 작업 순서

### Phase 1: 모델 + API
1. PaymentMethod 모델 + Alembic 마이그레이션
2. Expense에 payment_method_id FK 추가
3. User에 default_payment_method_id 추가
4. PaymentMethod CRUD API + 실적 조회 API
5. 테스트

### Phase 2: 결제수단 매칭
6. 지출 저장 시 텍스트 매칭 로직
7. 기본 결제수단 fallback
8. 테스트

### Phase 3: FE
9. 설정 > 결제수단 관리 페이지
10. 지출 입력 시 결제수단 선택 UI
11. 리포트 > 카드 실적 섹션

### Phase 4: 봇
12. `/card` 명령어 + "실적" 한글 명령어
13. 테스트
