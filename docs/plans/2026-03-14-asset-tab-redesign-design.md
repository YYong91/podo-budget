# 자산 탭 고도화 디자인

## 배경

현재 자산 탭은 카드 3개 + 파이차트 + 라인차트 + 목록이 한 화면에 나열되어 있어 정보 과부하. 토스/Empower 등 레퍼런스 앱들은 **순자산 한 숫자를 최상단에 크게** 놓고, 나머지는 프로그레시브 디스클로저로 제공.

포도가계부는 마이데이터 API 연동이 없으므로 "실시간 잔액 조회" 대신 **월 1회 자산 기록 + 목표 기반 코칭**을 핵심 가치로 삼는다.

## 핵심 가치

> "매달 자산을 기록하고, 목표까지 얼마나 왔는지 한눈에 보는 도구"

## 화면 구조 (위→아래)

### 1. 순자산 히어로 섹션
- 순자산 금액 (큰 숫자, 최상단)
- 전월 대비 변화량 (↑↓ 색상: leaf-600 / rose-600)
- 이번 달 순저축액 한 줄 요약 (가계부 수입-지출 연동): "이번 달 +45만원 저축 중"

### 2. 목표 프로그레스 바
- 사용자가 설정한 순자산 목표: 목표 금액 + 목표 날짜
- 프로그레스 바 + 퍼센트 표시
- 페이스 기반 인사이트 메시지:
  - 목표보다 빠르면: "목표보다 N개월 빠른 페이스!"
  - 목표대로면: "순항 중! 이 페이스면 YYYY년 M월 도달 예상"
  - 목표보다 느리면: "조금 더 힘내볼까요? 현재 페이스로는 YYYY년 M월 예상"
- 목표 미설정 시: "순자산 목표를 설정해보세요" CTA 카드

### 3. 순자산 추이 차트
- 6~12개월 라인차트 (기존 AssetSnapshot 활용)
- 목표선을 점선으로 함께 표시 (현재→목표까지 선형 보간)
- Chart.js Line 차트 유지

### 4. 자산 목록 (유형별 그룹핑)
기존 종목별/계좌별 토글을 **유형별 그룹핑**으로 단순화:

| 그룹 | 포함 유형 | 특이사항 |
|------|----------|---------|
| 투자 | stock_kr, stock_us, crypto | 시세 자동 갱신, 수익률 표시 |
| 예적금 | deposit | 이자율, 만기일 표시 |
| 부동산/기타 | real_estate, other | 수동 입력 금액 |
| 부채 | loan (is_liability) | 이자율, 월 상환액 표시, 분리 색상 |

각 그룹은 접기/펼치기 (기본 펼침)

### 5. 월간 업데이트 넛지
- 마지막 자산 업데이트가 30일 이상이면 "자산 현황을 업데이트해보세요" 카드 표시
- 최근 업데이트 날짜 표시

## 제거/간소화

- **파이차트 제거** — 정보 과부하 줄이기
- **계좌별 뷰 모드 제거** — 유형별 그룹핑으로 통합
- **총자산/총부채 별도 카드 제거** — 순자산 히어로에 통합 (작은 글씨로 자산/부채 금액 표시)

## 데이터 모델

### 새 모델: AssetGoal
```python
class AssetGoal(Base):
    __tablename__ = "asset_goals"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    target_net_worth = Column(Numeric(18, 2), nullable=False)
    target_date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
```

- 사용자(또는 가구) 당 활성 목표 1개
- 목표 달성 시 축하 → 새 목표 설정 유도

### 기존 모델 활용
- `AssetSnapshot`: 월별 순자산 추이 (변경 없음)
- `Asset`: 자산/부채 목록 (변경 없음)

## API 추가

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/assets/goal | 현재 활성 목표 조회 |
| POST | /api/assets/goal | 목표 설정/업데이트 (upsert) |
| DELETE | /api/assets/goal | 목표 삭제 |
| GET | /api/assets/monthly-savings | 이번 달 순저축액 (수입-지출) |

## 가계부 연동

`/api/assets/monthly-savings` 엔드포인트:
- 이번 달 수입 합계 - 지출 합계 = 순저축액
- 기존 Income, Expense 모델에서 쿼리
- 자산 탭 상단에 "이번 달 +N만원 저축 중" 표시

## 페이스 계산 로직

```
목표까지 남은 금액 = target_net_worth - current_net_worth
목표까지 남은 개월 = (target_date - today) / 30
필요 월 저축액 = 남은 금액 / 남은 개월

최근 3개월 평균 순자산 증가율 = (snapshots 기반)
예상 도달일 = today + (남은 금액 / 월평균 증가율) 개월
```

## 디자인 참고

- 토스: 순자산 최상단 큰 숫자, 심플, 프로그레시브 디스클로저
- Empower: 위젯 기반, 순자산 + 90일 변화 + 1일 변화
- Monarch: 목표선과 실제선 함께 표시하는 차트
- 공통: 변화량 색상 강조 (초록/빨강), 정보 과부하 최소화
