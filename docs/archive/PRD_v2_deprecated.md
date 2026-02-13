# HomeNRich PRD (Product Requirements Document)

**버전**: 2.0
**작성일**: 2026-02-12
**프로젝트**: HomeNRich - AI 기반 부부/가족 공유 가계부

---

## 📋 목차

1. [제품 개요](#1-제품-개요)
2. [핵심 가치 제안](#2-핵심-가치-제안)
3. [타겟 사용자](#3-타겟-사용자)
4. [전체 기능 맵](#4-전체-기능-맵)
5. [기능별 상세 명세](#5-기능별-상세-명세)
6. [단계별 로드맵](#6-단계별-로드맵)
7. [아키텍처 변경 사항](#7-아키텍처-변경-사항)
8. [성공 지표](#8-성공-지표)
9. [리스크 및 대응 방안](#9-리스크-및-대응-방안)

---

## 1. 제품 개요

### 1.1 서비스 개요
HomeNRich는 **부부/커플이 함께 사용하는 AI 기반 공유 가계부**입니다.
"메신저에서 채팅하듯 입력하면 끝" — 사용자는 카카오톡이나 텔레그램으로 "오늘 점심에 김치찌개 8000원 먹었어"라고 보내기만 하면, AI가 자동으로 분류하고 파트너와 실시간 공유됩니다.

### 1.2 탄생 배경
- 기존 가계부 앱은 입력 단계가 많고 부부가 함께 쓰기 불편함
- 엑셀 정리는 귀찮고 실시간 동기화 안 됨
- 토스/카카오뱅크 결제 내역을 일일이 옮기는 것도 번거로움
- **핵심 인사이트**: 가계부 실패 이유는 "입력 허들"과 "공유 불편"

### 1.3 핵심 차별점
1. **메신저 입력**: 앱 실행 없이 메신저로 바로 입력 (카카오톡 최우선)
2. **AI 자동 분류**: 사용자 과거 패턴 학습 기반 정확한 카테고리 자동 배정
3. **부부 공유 최적화**: 공유 예산, 지출 분담, 정산 기능 내장
4. **OCR 자동화**: 영수증/뱅킹앱 스크린샷 → 자동 입력
5. **사용자 API 키 설정**: 퍼블릭 서비스지만 각 사용자가 자기 AI API 키 사용 (비용 투명성)

---

## 2. 핵심 가치 제안

### 2.1 사용자에게 제공하는 가치
- **시간 절약**: 메신저 입력으로 5초 내 완료 (기존 앱 대비 1/10 시간)
- **투명성**: 부부간 지출 실시간 공유로 금전 갈등 감소
- **자동화**: 뱅킹앱 스크린샷만 찍으면 알아서 입력
- **학습 효과**: AI가 과거 패턴 학습해서 점점 정확해짐
- **비용 제어**: 사용자 자신의 API 키로 비용 통제 가능

### 2.2 비즈니스 가치
- **낮은 진입 장벽**: 메신저 입력으로 첫 사용 성공률 극대화
- **높은 리텐션**: 공유 기능으로 두 명이 함께 잠김 (Lock-in)
- **바이럴 잠재력**: "우리 부부는 이거 써" 추천 유도
- **SaaS 전환 가능성**: 프리미엄 기능(고급 인사이트, 무제한 공유 멤버) 유료화

---

## 3. 타겟 사용자

### 3.1 Primary Persona (최우선)
**[공유형 커플/부부]**
- **나이**: 25-40세
- **상황**: 결혼 예정/신혼/맞벌이 부부
- **페인 포인트**:
  - 카드 여러 개 써서 지출 추적 어려움
  - 배우자가 뭐에 돈 썼는지 물어보는 게 불편
  - 생활비 정산할 때 누가 얼마 냈는지 헷갈림
- **니즈**: 실시간 공유 + 간편 입력 + 자동 정산
- **사용 시나리오**:
  - 아내가 마트에서 장보고 "마트 15만원" 메신저 전송
  - 남편이 회사에서 퇴근길 "치킨 2만원" 입력
  - 집에서 함께 앱 열어보면 오늘 지출 한눈에 보임

### 3.2 Secondary Persona
**[셰어하우스/룸메이트]**
- 공과금, 생필품 공동 구매 비용 정산 필요
- 월말 정산 시 "누가 냈지?" 분쟁 방지

**[알뜰형 1인 사용자]**
- 혼자서도 간편하게 가계부 작성하고 싶은 사람
- 엑셀보다 편하고, 뱅크샐러드보다 프라이버시 안전한 도구 원함

---

## 4. 전체 기능 맵

### 4.1 기능 우선순위 매트릭스

| 우선순위 | 기능 | Impact | Effort | 단계 |
|---------|------|--------|--------|------|
| **P0 (필수)** | 텔레그램 봇 입력 | High | Low | MVP ✅ (구현됨) |
| **P0** | 카카오톡 채널/챗봇 입력 | Very High | Medium | MVP |
| **P0** | AI 지출 파싱 (자연어) | High | Low | MVP ✅ (구현됨) |
| **P0** | 공유 가계부 (부부/커플) | Very High | Medium | MVP |
| **P0** | 멀티 유저 권한 관리 | High | Medium | MVP |
| **P1 (중요)** | 영수증/스크린샷 OCR | Very High | High | v1.0 |
| **P1** | 과거 데이터 마이그레이션 (CSV/Excel) | High | Medium | v1.0 |
| **P1** | 사용자별 AI API 키 설정 | Medium | Low | v1.0 |
| **P1** | 카테고리 자동 학습/제안 | High | Medium | v1.0 |
| **P2 (개선)** | LINE/WhatsApp 메신저 확장 | Medium | Medium | v2.0 |
| **P2** | AI 모델 선택 최적화 (비용/성능) | Medium | Low | v2.0 |
| **P2** | 고급 인사이트 (지출 예측, 절약 제안) | Medium | High | v2.0 |
| **P2** | 뱅크샐러드/편한가계부 포맷 지원 | Low | High | v2.0 |

### 4.2 기능 그룹핑

```
📱 입력 채널
  ├── 텔레그램 봇 (구현됨)
  ├── 카카오톡 채널/챗봇 (P0)
  ├── 웹/앱 UI (구현됨)
  └── 메신저 확장 (LINE, WhatsApp) (P2)

🤖 AI 엔진
  ├── 자연어 지출 파싱 (구현됨)
  ├── 카테고리 자동 학습 (P1)
  ├── OCR 엔진 (영수증, 뱅킹앱 스크린샷) (P1)
  └── AI 모델 선택 최적화 (P2)

👥 공유 기능
  ├── 다중 사용자 초대/권한 (P0)
  ├── 실시간 동기화 (P0)
  ├── 지출 분담/정산 (P0)
  └── 공유 예산 관리 (P1)

📊 데이터 관리
  ├── CSV/Excel 임포트 (P1)
  ├── 다른 가계부 앱 마이그레이션 (P2)
  └── 사용자 API 키 설정 (P1)

💡 인사이트
  ├── 예산 초과 알림 (구현됨)
  ├── 카테고리별 분석 (구현됨)
  └── AI 절약 제안 (P2)
```

---

## 5. 기능별 상세 명세

### 5.1 [P0] 카카오톡 채널/챗봇 입력

#### 5.1.1 기능 개요
한국 사용자의 95%가 사용하는 카카오톡으로 지출 입력. 텔레그램과 동일한 자연어 파싱.

#### 5.1.2 사용자 스토리
- **US-1**: 사용자는 카카오톡 채널을 친구 추가하여 HomeNRich 봇에게 메시지를 보낼 수 있다.
- **US-2**: 사용자는 "오늘 점심 12000원"이라고 보내면 자동으로 파싱되어 가계부에 저장된다.
- **US-3**: 사용자는 봇으로부터 "✅ 식비 > 외식 12,000원 저장했어요" 확인 메시지를 받는다.
- **US-4**: 사용자는 "이번 달 식비 얼마?"라고 물으면 집계된 금액을 받는다.
- **US-5**: 사용자는 사진(영수증)을 보내면 OCR 처리 후 자동 입력된다. (v1.0 연동)

#### 5.1.3 수용 기준 (Acceptance Criteria)
- [ ] 카카오톡 채널 개설 및 메시징 API 연동
- [ ] 웹훅 엔드포인트 `/api/webhook/kakao` 구현
- [ ] 사용자 최초 메시지 시 계정 자동 연동 (User 테이블과 kakao_user_id 매핑)
- [ ] 자연어 파싱 후 Expense 저장
- [ ] 확인 메시지 즉시 응답 (3초 이내)
- [ ] 에러 시 "다시 입력해주세요 (예: 커피 5000원)" 가이드 메시지

#### 5.1.4 기술 요구사항
- **카카오 비즈니스 계정** 필요 (채널 개설)
- **카카오 메시징 API** (REST API v2)
- 웹훅 수신: FastAPI endpoint
- 메시지 유형: 텍스트, 이미지(OCR 연동)
- 인증: 카카오 사용자 ID → User 테이블 외래키

#### 5.1.5 UI/UX 가이드라인
- 카카오톡 봇 프로필 이미지: HomeNRich 로고
- 봇 이름: "홈앤리치 가계부"
- 자동응답 예시:
  ```
  ✅ 외식 12,000원 저장 완료!
  📊 이번 달 외식비: 145,000원 / 200,000원 (72%)
  ```
- 명령어 도움말: "도움말" 입력 시 사용법 안내

#### 5.1.6 엣지 케이스
- 파싱 실패 시: "금액을 찾을 수 없어요. '커피 5000원' 형식으로 다시 입력해주세요"
- 카테고리 모호 시: "식비인가요, 카페인가요?" 버튼 선택 UI 제공
- 카카오 서버 장애 시: 재시도 로직 (3회, exponential backoff)

#### 5.1.7 의존성
- 텔레그램 봇 구현 코드 재사용 가능
- OCR 기능 구현 후 이미지 처리 연동

#### 5.1.8 예상 공수
- **M (Medium)**: 2-3주
  - 카카오 API 연동: 3일
  - 웹훅 구현: 2일
  - 자연어 파싱 재사용: 1일
  - 사용자 인증/매핑: 3일
  - 테스트: 3일

---

### 5.2 [P0] 공유 가계부 (부부/커플/가족)

#### 5.2.1 기능 개요
복수 사용자가 하나의 가계부를 공유. 각자 입력한 지출이 실시간 동기화되며, 공동 예산 관리 가능.

#### 5.2.2 사용자 스토리
- **US-6**: 사용자는 파트너의 이메일/전화번호를 입력하여 가계부 공유 초대를 보낼 수 있다.
- **US-7**: 초대받은 사용자는 초대 링크를 클릭하여 가계부에 참여할 수 있다.
- **US-8**: 공유 멤버는 누가 언제 어떤 지출을 입력했는지 볼 수 있다.
- **US-9**: 사용자는 "공유 예산"을 설정하여 전체 멤버의 지출 합계를 추적할 수 있다.
- **US-10**: 사용자는 특정 지출을 "정산 대상"으로 표시하여 월말 정산에 활용할 수 있다.
- **US-11**: 관리자는 멤버를 삭제하거나 권한을 변경할 수 있다.

#### 5.2.3 수용 기준
- [ ] Household(가계부 그룹) 모델 생성
- [ ] User ↔ Household 다대다 관계 (중간 테이블: HouseholdMember, 권한 필드 포함)
- [ ] 초대 링크 생성/발송 API (이메일 또는 카카오톡)
- [ ] Expense 모델에 household_id, created_by(user_id) 추가
- [ ] 공유 예산(SharedBudget) 모델: household_id, category_id, amount
- [ ] 실시간 동기화: WebSocket 또는 폴링 방식
- [ ] 권한 레벨: Owner(관리자), Member(일반), Viewer(보기만)

#### 5.2.4 기술 요구사항
**데이터 모델**
```python
# models/household.py
class Household(Base):
    id: UUID
    name: str  # "우리집 가계부"
    created_at: datetime
    members: relationship("HouseholdMember")

class HouseholdMember(Base):
    id: UUID
    household_id: UUID  # FK
    user_id: UUID  # FK
    role: Enum("owner", "member", "viewer")
    joined_at: datetime

# models/expense.py (수정)
class Expense(Base):
    # 기존 필드 +
    household_id: UUID  # FK (nullable: 개인 가계부 허용)
    created_by: UUID  # FK → User

# models/budget.py (수정)
class SharedBudget(Base):
    household_id: UUID  # FK
    category_id: UUID  # FK
    amount: Decimal
    period: Enum("monthly", "yearly")
```

**API 엔드포인트**
```
POST   /api/households/                # 가계부 생성
GET    /api/households/                # 내가 속한 가계부 목록
POST   /api/households/{id}/invite     # 멤버 초대
DELETE /api/households/{id}/members/{user_id}  # 멤버 삭제
GET    /api/households/{id}/expenses   # 공유 가계부 지출 목록
```

#### 5.2.5 UI/UX 가이드라인
**Dashboard 화면**
```
┌────────────────────────────────────┐
│ 🏠 우리집 가계부                    │
│ 멤버: 👤 나 | 👤 배우자              │
├────────────────────────────────────┤
│ 📊 이번 달 지출                     │
│ ━━━━━━━━━━━━━━━━━━━━━ 1,250,000원 │
│                                    │
│ [내가 입력] 750,000원 (60%)        │
│ [배우자]   500,000원 (40%)         │
├────────────────────────────────────┤
│ 📝 최근 지출                        │
│ • 오늘 14:32 | 나 | 점심 12,000원  │
│ • 오늘 09:15 | 배우자 | 커피 5,500원│
└────────────────────────────────────┘
```

**초대 플로우**
1. "멤버 초대" 버튼 클릭
2. 이메일/전화번호 입력 또는 초대 링크 복사
3. 초대 링크: `https://homenrich.app/invite/{token}`
4. 상대방이 링크 클릭 → 로그인/회원가입 → 자동 가계부 참여

#### 5.2.6 엣지 케이스
- 이미 가계부에 속한 사용자 재초대 시: "이미 멤버입니다" 안내
- 멤버 삭제 시 작성한 지출 처리: 지출은 유지, created_by만 표시
- Owner가 나갈 경우: 다른 멤버에게 Owner 권한 이전 필수
- 개인 지출 vs 공유 지출: 사용자가 선택 (기본값: 공유)

#### 5.2.7 의존성
- User 인증 시스템 (JWT)
- 이메일 발송 시스템 (초대 링크)
- WebSocket (실시간 동기화, 선택적)

#### 5.2.8 예상 공수
- **L (Large)**: 3-4주
  - 데이터 모델 설계/마이그레이션: 3일
  - Household CRUD API: 4일
  - 초대 시스템: 3일
  - 권한 제어 로직: 3일
  - 프론트엔드 UI: 7일
  - 테스트: 5일

---

### 5.3 [P1] 영수증/스크린샷 OCR

#### 5.3.1 기능 개요
사용자가 영수증 사진 또는 뱅킹앱(토스, 카카오뱅크) 결제 내역 스크린샷을 업로드하면 AI OCR로 자동 파싱하여 지출 입력.

#### 5.3.2 사용자 스토리
- **US-12**: 사용자는 영수증 사진을 메신저로 보내거나 앱에 업로드할 수 있다.
- **US-13**: 시스템은 OCR로 날짜, 금액, 가맹점명을 추출한다.
- **US-14**: 사용자는 추출된 정보를 확인하고 수정 후 저장할 수 있다.
- **US-15**: 토스/카카오뱅크 스크린샷에서 결제 내역을 자동 인식한다.
- **US-16**: 여러 항목이 있는 영수증(마트 영수증)은 각 항목별로 분리 저장할 수 있다. (v2.0)

#### 5.3.3 수용 기준
- [ ] 이미지 업로드 API `/api/expenses/ocr` (multipart/form-data)
- [ ] OCR 엔진 통합 (Anthropic Vision API 또는 Google Cloud Vision API)
- [ ] 추출 필드: 날짜, 금액, 가맹점명, 항목명
- [ ] 신뢰도(confidence) 낮은 경우 사용자 확인 UI 표시
- [ ] 뱅킹앱 스크린샷 템플릿 매칭 (토스, 카카오뱅크 우선 지원)
- [ ] 처리 시간 10초 이내

#### 5.3.4 기술 요구사항
**OCR 엔진 선택**
1. **Anthropic Claude Vision API** (추천)
   - 장점: 한글 인식 우수, 컨텍스트 이해 가능 (예: "토스 화면"이라고 알려주면 구조 파악)
   - 단점: 비용 (이미지당 약 $0.01)
   - 구현: `services/ocr_service.py` → Claude에 이미지 + 프롬프트 전달

2. **Google Cloud Vision API**
   - 장점: 정확도 높음, 한글 지원
   - 단점: 별도 GCP 계정 필요

3. **Tesseract OCR (오픈소스)**
   - 장점: 무료
   - 단점: 한글 정확도 낮음, 전처리 필요

**추천 아키텍처**: Anthropic Claude Vision API 우선, 실패 시 Google Cloud Vision 폴백

**데이터 모델**
```python
# models/ocr_log.py
class OCRLog(Base):
    id: UUID
    user_id: UUID  # FK
    image_url: str  # S3 저장 경로
    extracted_data: JSON  # {"date": "2026-02-12", "amount": 12000, ...}
    confidence: float  # 0.0 ~ 1.0
    status: Enum("pending", "confirmed", "rejected")
    expense_id: UUID  # FK (nullable)
```

**API 플로우**
```
1. POST /api/expenses/ocr (이미지 업로드)
   → S3 저장
   → Claude Vision API 호출
   → 결과 파싱
   → OCRLog 생성
   → 응답: {extracted_data, confidence, ocr_log_id}

2. 프론트엔드: 추출 정보 표시 (수정 가능)

3. POST /api/expenses/ (사용자 확인 후)
   → Expense 생성
   → OCRLog.expense_id 업데이트
```

#### 5.3.5 UI/UX 가이드라인
**메신저 입력 (카카오톡)**
```
사용자: [영수증 사진 업로드]
봇:     📸 영수증을 분석하고 있어요...
        ✅ 인식 완료!

        날짜: 2026-02-12
        가맹점: 스타벅스 강남점
        금액: 12,000원
        항목: 카페

        맞으면 '확인', 수정하려면 '수정'을 눌러주세요.

        [확인] [수정]
```

**웹/앱 UI**
```
┌────────────────────────────────────┐
│ 📷 영수증 등록                      │
├────────────────────────────────────┤
│ [이미지 프리뷰]                     │
│                                    │
│ 📝 추출된 정보                      │
│ 날짜:     [2026-02-12]             │
│ 금액:     [12,000원]   ⚠️ 신뢰도 85%│
│ 가맹점:   [스타벅스 강남점]         │
│ 카테고리: [카페] ▼                 │
│                                    │
│ [저장] [취소]                       │
└────────────────────────────────────┘
```

#### 5.3.6 엣지 케이스
- 사진이 흐릿하거나 글씨 안 보임: "영수증이 잘 보이지 않아요. 다시 찍어주세요"
- 영수증이 아닌 이미지: "영수증이 아닌 것 같아요"
- 금액이 여러 개 (합계, 부가세 등): 합계 금액만 추출
- 외국어 영수증: 일단 숫자만 추출, 가맹점명은 원문 그대로

#### 5.3.7 의존성
- S3 또는 Cloudinary (이미지 저장)
- Anthropic API (Vision)
- 카카오톡 봇 (이미지 수신)

#### 5.3.8 예상 공수
- **L (Large)**: 3-4주
  - OCR 엔진 선정/테스트: 3일
  - 이미지 업로드/저장: 2일
  - OCR API 통합: 5일
  - 추출 데이터 파싱/검증 로직: 3일
  - 프론트엔드 확인 UI: 5일
  - 메신저 연동: 3일
  - 테스트 (다양한 영수증): 5일

---

### 5.4 [P1] 과거 데이터 마이그레이션 (CSV/Excel 임포트)

#### 5.4.1 기능 개요
사용자가 엑셀 또는 다른 가계부 앱에서 내보낸 CSV 파일을 업로드하여 기존 데이터를 한 번에 임포트.

#### 5.4.2 사용자 스토리
- **US-17**: 사용자는 "데이터 가져오기" 메뉴에서 CSV/Excel 파일을 업로드할 수 있다.
- **US-18**: 시스템은 파일의 컬럼을 분석하여 자동 매핑을 제안한다.
- **US-19**: 사용자는 컬럼 매핑을 확인/수정하고 임포트를 실행한다.
- **US-20**: 임포트 실패 항목은 별도 리포트로 제공되어 수동 수정 가능하다.
- **US-21**: 대량 데이터(1000건+) 임포트는 백그라운드 작업으로 처리되고 완료 알림을 받는다.

#### 5.4.3 수용 기준
- [ ] 파일 업로드 API `/api/import/upload` (지원 포맷: CSV, XLSX)
- [ ] 컬럼 자동 감지 (날짜, 금액, 카테고리, 메모)
- [ ] 컬럼 매핑 UI (드래그 앤 드롭 또는 드롭다운)
- [ ] 카테고리 자동 매핑: 기존 카테고리와 유사도 기반 매칭
- [ ] 중복 방지: 날짜+금액+메모 해시로 중복 체크
- [ ] 벌크 인서트 (batch insert)로 성능 최적화
- [ ] 실패 항목 CSV 다운로드

#### 5.4.4 기술 요구사항
**데이터 모델**
```python
# models/import_job.py
class ImportJob(Base):
    id: UUID
    user_id: UUID  # FK
    household_id: UUID  # FK (nullable)
    file_name: str
    file_url: str  # S3
    status: Enum("pending", "processing", "completed", "failed")
    total_rows: int
    success_count: int
    fail_count: int
    error_report_url: str  # 실패 항목 CSV
    created_at: datetime
```

**처리 플로우**
```python
# services/import_service.py
async def import_expenses_from_csv(
    file: UploadFile,
    user_id: UUID,
    household_id: UUID | None,
    column_mapping: dict  # {"날짜": "date", "금액": "amount", ...}
):
    1. CSV 파싱 (pandas 사용)
    2. 각 행마다:
       - 날짜 파싱 (다양한 포맷 지원)
       - 금액 파싱 (쉼표 제거, 음수 처리)
       - 카테고리 매핑 (fuzzy matching)
       - Expense 객체 생성
    3. 벌크 인서트 (SQLAlchemy bulk_insert_mappings)
    4. 실패 항목은 error_report CSV 생성
    5. ImportJob 업데이트
```

**API 엔드포인트**
```
POST   /api/import/upload          # 파일 업로드 + 컬럼 감지
POST   /api/import/preview         # 매핑 미리보기 (10행)
POST   /api/import/execute         # 실제 임포트 실행
GET    /api/import/jobs            # 임포트 작업 목록
GET    /api/import/jobs/{id}       # 작업 상태 조회
```

#### 5.4.5 UI/UX 가이드라인
**3단계 마법사 (Wizard)**

**Step 1: 파일 업로드**
```
┌────────────────────────────────────┐
│ 📂 데이터 가져오기                  │
├────────────────────────────────────┤
│ 파일 선택                           │
│ ┌──────────────────────────────┐  │
│ │  Drag & Drop or Click        │  │
│ │  지원 포맷: CSV, Excel       │  │
│ └──────────────────────────────┘  │
│                                    │
│ [다음]                             │
└────────────────────────────────────┘
```

**Step 2: 컬럼 매핑**
```
┌────────────────────────────────────┐
│ 📊 컬럼 매핑                        │
├────────────────────────────────────┤
│ 파일 컬럼         → 필드            │
│ ┌─────────────┐  ┌─────────────┐ │
│ │ 날짜        │→ │ 날짜 *      │ │
│ │ 금액        │→ │ 금액 *      │ │
│ │ 항목        │→ │ 메모        │ │
│ │ 분류        │→ │ 카테고리    │ │
│ └─────────────┘  └─────────────┘ │
│                                    │
│ 📝 미리보기 (처음 10행)             │
│ 2026-01-01 | 12000 | 점심 | 식비  │
│ ...                                │
│                                    │
│ [이전] [다음]                       │
└────────────────────────────────────┘
```

**Step 3: 실행 및 결과**
```
┌────────────────────────────────────┐
│ ⏳ 임포트 진행 중...                │
├────────────────────────────────────┤
│ ▓▓▓▓▓▓▓▓░░░░░░░░░░░░ 45%          │
│ 450 / 1000건 처리 중               │
└────────────────────────────────────┘

↓ 완료 후

┌────────────────────────────────────┐
│ ✅ 임포트 완료!                     │
├────────────────────────────────────┤
│ 총 1000건                          │
│ ✅ 성공: 980건                     │
│ ❌ 실패: 20건                      │
│                                    │
│ [실패 항목 다운로드]                │
│ [가계부 보기]                       │
└────────────────────────────────────┘
```

#### 5.4.6 엣지 케이스
- 날짜 포맷 다양: "2026-02-12", "2026/02/12", "26.02.12" 모두 지원
- 금액에 통화 기호: "₩12,000", "$10.5" → 숫자만 추출
- 카테고리 없는 경우: "미분류"로 자동 배정 후 사용자가 수동 분류
- 중복 데이터: "이미 동일한 지출이 있습니다. 건너뛰기/덮어쓰기?" 옵션 제공

#### 5.4.7 의존성
- pandas (CSV/Excel 파싱)
- fuzzy-wuzzy (카테고리 유사도 매칭)
- Celery 또는 RQ (백그라운드 작업, 선택적)

#### 5.4.8 예상 공수
- **M (Medium)**: 2-3주
  - 파일 파싱 로직: 3일
  - 컬럼 자동 감지: 2일
  - 카테고리 매핑: 3일
  - 벌크 인서트 최적화: 2일
  - 프론트엔드 마법사 UI: 5일
  - 테스트 (다양한 포맷): 3일

---

### 5.5 [P1] 사용자별 AI API 키 설정

#### 5.5.1 기능 개요
퍼블릭 서비스로 배포 시, 각 사용자가 자신의 Anthropic/OpenAI API 키를 입력하여 LLM 비용을 직접 부담.

#### 5.5.2 사용자 스토리
- **US-22**: 사용자는 설정 메뉴에서 "AI 설정" 페이지에 접근할 수 있다.
- **US-23**: 사용자는 LLM 프로바이더를 선택(Anthropic, OpenAI, Google)하고 API 키를 입력할 수 있다.
- **US-24**: 시스템은 입력한 API 키의 유효성을 즉시 검증한다.
- **US-25**: 사용자는 예상 월 비용을 확인할 수 있다 (사용량 기반 추정).
- **US-26**: API 키 미설정 시 제한된 무료 사용량(월 100회) 제공.

#### 5.5.3 수용 기준
- [ ] User 모델에 암호화된 API 키 필드 추가
- [ ] API 키 암호화/복호화 (Fernet 또는 AWS KMS)
- [ ] LLM 프로바이더 선택 (Anthropic/OpenAI/Google)
- [ ] API 키 검증 엔드포인트 (실제 API 호출 테스트)
- [ ] 사용량 로깅 (LLMUsageLog 테이블)
- [ ] 무료 사용량 쿼터 관리 (Redis counter)

#### 5.5.4 기술 요구사항
**데이터 모델**
```python
# models/user.py (수정)
class User(Base):
    # 기존 필드 +
    llm_provider: Enum("anthropic", "openai", "google", None)
    encrypted_api_key: bytes  # Fernet 암호화
    free_quota_used: int  # 무료 사용량 (월별 리셋)
    free_quota_limit: int = 100

# models/llm_usage_log.py
class LLMUsageLog(Base):
    id: UUID
    user_id: UUID  # FK
    provider: str
    model: str  # "claude-3-sonnet", "gpt-4", ...
    input_tokens: int
    output_tokens: int
    cost_usd: Decimal  # 예상 비용
    created_at: datetime
```

**API 키 암호화**
```python
# core/security.py
from cryptography.fernet import Fernet

def encrypt_api_key(api_key: str, master_key: bytes) -> bytes:
    f = Fernet(master_key)
    return f.encrypt(api_key.encode())

def decrypt_api_key(encrypted: bytes, master_key: bytes) -> str:
    f = Fernet(master_key)
    return f.decrypt(encrypted).decode()
```

**LLM 서비스 수정**
```python
# services/llm_service.py
async def get_llm_provider(user: User) -> LLMProvider:
    if user.llm_provider and user.encrypted_api_key:
        api_key = decrypt_api_key(user.encrypted_api_key, settings.MASTER_KEY)
        if user.llm_provider == "anthropic":
            return AnthropicProvider(api_key)
        elif user.llm_provider == "openai":
            return OpenAIProvider(api_key)
    else:
        # 무료 사용량 체크
        if user.free_quota_used >= user.free_quota_limit:
            raise QuotaExceededError("무료 사용량 초과")
        return DefaultProvider(settings.DEFAULT_API_KEY)
```

#### 5.5.5 UI/UX 가이드라인
**설정 페이지**
```
┌────────────────────────────────────┐
│ ⚙️ AI 설정                          │
├────────────────────────────────────┤
│ 🤖 LLM 프로바이더                   │
│ ○ Anthropic Claude (추천)         │
│ ○ OpenAI GPT                       │
│ ○ Google Gemini                    │
│                                    │
│ 🔑 API 키                           │
│ ┌──────────────────────────────┐  │
│ │ sk-ant-api03-...             │  │
│ └──────────────────────────────┘  │
│ [키 검증] ✅ 유효한 키입니다        │
│                                    │
│ 💰 예상 월 비용                     │
│ 약 $2.50 (지난 달 사용량 기준)     │
│                                    │
│ ℹ️ API 키는 암호화되어 안전하게     │
│    저장됩니다.                      │
│                                    │
│ [저장]                             │
└────────────────────────────────────┘
```

**무료 사용량 안내**
```
┌────────────────────────────────────┐
│ 🆓 무료 체험 중                     │
├────────────────────────────────────┤
│ 이번 달 사용량: 45 / 100회          │
│ ▓▓▓▓▓▓▓▓░░░░░░░░░░░░ 45%          │
│                                    │
│ 무제한 사용을 원하시면              │
│ 자신의 API 키를 등록하세요.         │
│                                    │
│ [API 키 등록하기]                   │
└────────────────────────────────────┘
```

#### 5.5.6 엣지 케이스
- 잘못된 API 키 입력: "유효하지 않은 키입니다" + API 키 발급 가이드 링크
- API 키 만료: "API 키가 만료되었습니다. 새 키를 등록하세요" 알림
- 사용량 초과(무료): "무료 사용량 초과. API 키를 등록하거나 다음 달까지 대기" 안내
- 프로바이더 변경 시: 기존 API 키 삭제 확인

#### 5.5.7 의존성
- cryptography (Fernet 암호화)
- Redis (무료 쿼터 카운터)

#### 5.5.8 예상 공수
- **S (Small)**: 1주
  - 암호화 로직: 1일
  - User 모델 수정: 1일
  - LLM 서비스 수정: 2일
  - 프론트엔드 설정 페이지: 2일
  - 테스트: 1일

---

### 5.6 [P1] 카테고리 자동 학습 및 제안

#### 5.6.1 기능 개요
사용자의 과거 지출 데이터를 학습하여 새 지출 입력 시 카테고리를 자동으로 정확하게 예측. 새로운 패턴 발견 시 카테고리 생성 제안.

#### 5.6.2 사용자 스토리
- **US-27**: 사용자가 "스타벅스 5000원" 입력 시, 과거 "스타벅스"를 "카페"로 분류한 이력 기반으로 자동 "카페" 배정.
- **US-28**: 사용자가 처음 보는 가맹점 입력 시, 유사한 가맹점의 카테고리 추론.
- **US-29**: 시스템은 "OO을 자주 입력하시네요. '카페' 카테고리를 '스타벅스'와 '투썸플레이스'로 세분화하시겠어요?" 제안.
- **US-30**: 사용자는 제안을 수락/거부할 수 있다.

#### 5.6.3 수용 기준
- [ ] 가맹점명 → 카테고리 매핑 테이블 (MerchantCategoryMapping)
- [ ] 사용자별 학습 데이터 저장
- [ ] LLM 프롬프트에 과거 패턴 컨텍스트 추가
- [ ] 신규 카테고리 제안 로직 (빈도 기반)
- [ ] 제안 수락/거부 API

#### 5.6.4 기술 요구사항
**데이터 모델**
```python
# models/merchant_mapping.py
class MerchantCategoryMapping(Base):
    id: UUID
    user_id: UUID  # FK (또는 household_id)
    merchant_name: str  # "스타벅스"
    category_id: UUID  # FK
    confidence: float  # 0.0 ~ 1.0
    usage_count: int  # 사용 빈도
    last_used_at: datetime

# models/category_suggestion.py
class CategorySuggestion(Base):
    id: UUID
    user_id: UUID  # FK
    suggestion_type: Enum("split", "new")
    parent_category_id: UUID  # FK (nullable)
    suggested_name: str
    reason: str  # "스타벅스, 투썸플레이스 등을 자주 입력하시네요"
    status: Enum("pending", "accepted", "rejected")
    created_at: datetime
```

**LLM 프롬프트 개선**
```python
# services/llm_service.py
async def parse_expense_with_context(
    text: str,
    user: User,
    recent_expenses: List[Expense]
):
    # 사용자의 최근 지출 패턴 추출
    mappings = await get_merchant_mappings(user.id)

    prompt = f"""
    사용자 입력: "{text}"

    사용자의 과거 패턴:
    - "스타벅스" → 카페 (15회)
    - "GS25" → 편의점 (32회)
    - "쿠팡" → 온라인쇼핑 (8회)

    위 패턴을 참고하여 날짜, 금액, 카테고리를 추출하세요.
    """
```

**자동 제안 로직**
```python
# services/category_suggestion_service.py
async def analyze_and_suggest_categories(user_id: UUID):
    """
    월 1회 실행: 사용자의 지출 패턴 분석 후 카테고리 세분화 제안
    """
    expenses = await get_user_expenses(user_id, last_30_days=True)

    # 예: "카페" 카테고리 하위에 "스타벅스" 10회, "투썸" 8회
    # → 제안: "카페를 '프랜차이즈 카페', '개인카페'로 나누시겠어요?"

    if should_suggest_split(expenses, category="카페"):
        await create_suggestion(
            user_id=user_id,
            type="split",
            parent_category="카페",
            suggested_names=["프랜차이즈 카페", "개인카페"],
            reason="스타벅스, 투썸플레이스 등 프랜차이즈와 동네 카페를 자주 이용하시네요."
        )
```

#### 5.6.5 UI/UX 가이드라인
**인라인 제안**
```
사용자 입력: "스타벅스 5000원"

┌────────────────────────────────────┐
│ ✅ 자동 분류됨                      │
│ 카페 | 5,000원                     │
│                                    │
│ 💡 스타벅스는 항상 '카페'로         │
│    분류할까요? [예] [아니오]        │
└────────────────────────────────────┘
```

**월간 제안 알림**
```
┌────────────────────────────────────┐
│ 💡 카테고리 개선 제안                │
├────────────────────────────────────┤
│ 카페 카테고리를 세분화하시겠어요?   │
│                                    │
│ • 프랜차이즈 카페 (스타벅스, 투썸) │
│ • 개인카페                          │
│                                    │
│ 더 정확한 분석이 가능해져요.        │
│                                    │
│ [적용하기] [다음에]                 │
└────────────────────────────────────┘
```

#### 5.6.6 엣지 케이스
- 동명이인 가맹점: "스타벅스" (카페) vs "스타벅스" (선물) → 메모 추가로 구분
- 카테고리 변경: 사용자가 "스타벅스 → 간식"으로 수동 변경 시 → 매핑 업데이트
- 가족 공유 시: household 단위 학습 vs 개인 단위 학습 → 옵션 제공

#### 5.6.7 의존성
- LLM 서비스 (컨텍스트 주입)
- 백그라운드 작업 (월간 분석)

#### 5.6.8 예상 공수
- **M (Medium)**: 2주
  - 매핑 테이블 설계: 1일
  - LLM 프롬프트 개선: 2일
  - 자동 제안 로직: 3일
  - 프론트엔드 제안 UI: 3일
  - 테스트: 2일

---

## 6. 단계별 로드맵

### 6.1 MVP (Minimum Viable Product) - 2개월

**목표**: 부부/커플이 메신저로 편하게 쓸 수 있는 기본 공유 가계부

**핵심 기능 (P0)**
- ✅ 텔레그램 봇 입력 (구현 완료)
- [ ] 카카오톡 채널/챗봇 입력 (🔥 최우선)
- ✅ AI 자연어 지출 파싱 (구현 완료)
- [ ] 공유 가계부 (Household, 멀티 유저)
- [ ] 실시간 동기화 (WebSocket 또는 폴링)
- [ ] 공유 예산 관리 기본
- ✅ 웹 UI (Dashboard, ExpenseList, CategoryManager) (구현 완료)

**출시 기준**
- 부부 2명이 카카오톡으로 지출 입력 → 실시간 공유
- 월간 예산 설정 및 초과 알림
- 모바일 웹 반응형 UI

**예상 일정**
- Week 1-2: 카카오톡 봇 연동
- Week 3-5: 공유 가계부 백엔드/프론트엔드
- Week 6-7: 실시간 동기화 및 공유 예산
- Week 8: 통합 테스트 및 버그 픽스

---

### 6.2 v1.0 (Public Beta) - MVP + 3개월

**목표**: 퍼블릭 오픈 준비 — OCR, 데이터 마이그레이션, API 키 설정

**추가 기능 (P1)**
- [ ] 영수증/뱅킹앱 스크린샷 OCR (🔥 핵심 차별점)
- [ ] 과거 데이터 마이그레이션 (CSV/Excel)
- [ ] 사용자별 AI API 키 설정
- [ ] 카테고리 자동 학습 및 제안
- [ ] 지출 분담/정산 기능
- [ ] 회원가입/로그인 (OAuth: 카카오, 구글)
- [ ] 온보딩 튜토리얼

**개선 사항**
- 성능 최적화 (대량 데이터 처리)
- 보안 강화 (API 키 암호화, HTTPS)
- 모니터링 (Sentry, 로그)

**출시 기준**
- 퍼블릭 베타 론칭
- 100명 얼리어답터 테스트
- OCR 정확도 90% 이상
- 카카오톡 메시지 응답 속도 3초 이내

**예상 일정**
- Month 1: OCR 구현 및 테스트
- Month 2: 데이터 마이그레이션 + API 키 설정
- Month 3: 카테고리 학습 + 정산 기능 + 온보딩

---

### 6.3 v2.0 (Growth) - v1.0 + 6개월

**목표**: 확장 — 다양한 메신저, 고급 기능, 수익화

**추가 기능 (P2)**
- [ ] LINE, WhatsApp 메신저 지원
- [ ] AI 모델 최적화 (비용/성능 분석 → 기능별 모델 분리)
  - 간단한 파싱: Claude Haiku (저렴)
  - 복잡한 인사이트: Claude Opus (고성능)
- [ ] 뱅크샐러드/편한가계부 포맷 지원
- [ ] 고급 인사이트:
  - 지출 예측 ("이번 달 식비 20만원 초과 예상")
  - 절약 제안 ("지난 달 대비 카페비 30% 증가")
  - 커스텀 리포트 ("월간/분기별 리포트 생성")
- [ ] 프리미엄 플랜:
  - 무제한 공유 멤버 (무료는 2명까지)
  - 고급 인사이트 무제한
  - 데이터 무제한 (무료는 1년치)

**수익화 전략**
- Freemium 모델:
  - 무료: 2명 공유, 월 100회 AI 호출 (또는 자기 API 키)
  - 프리미엄: ₩9,900/월 (무제한 공유, 고급 기능)
- 제휴: 카드사/은행 제휴 (자동 연동 API)

**예상 일정**
- Month 1-2: 메신저 확장 (LINE, WhatsApp)
- Month 3-4: AI 모델 최적화 및 고급 인사이트
- Month 5-6: 프리미엄 기능 개발 및 결제 연동

---

## 7. 아키텍처 변경 사항

### 7.1 현재 아키텍처 (Private Use)
```
사용자 (1명 또는 가족)
   ↓
FastAPI Backend
   ↓
PostgreSQL
   ↓
Anthropic API (단일 API 키)
```

### 7.2 퍼블릭 배포 아키텍처 (Multi-tenant)

#### 7.2.1 인프라 변경
```
사용자들 (N명)
   ↓
Nginx (Load Balancer)
   ↓
FastAPI Backend (Auto-scaling)
   ↓
PostgreSQL (RDS, Read Replica)
   ↓
Redis (Session, Cache, Queue)
   ↓
S3 (이미지 저장)
   ↓
Anthropic/OpenAI API (사용자별 API 키)
```

**주요 변경점**
1. **멀티테넌시 (Multi-tenancy)**
   - User, Household 단위 데이터 격리
   - Row-level Security (RLS) 적용 또는 application-level 필터링

2. **확장성 (Scalability)**
   - FastAPI 수평 확장 (Kubernetes 또는 AWS ECS)
   - PostgreSQL Read Replica (읽기 부하 분산)
   - Redis 캐싱 (카테고리, 예산 등 자주 조회되는 데이터)

3. **비동기 처리**
   - OCR, 데이터 마이그레이션 → Celery + Redis Queue
   - 메신저 웹훅 → 즉시 응답 + 백그라운드 처리

4. **보안**
   - HTTPS 필수 (Let's Encrypt)
   - API 키 암호화 (Fernet 또는 AWS KMS)
   - Rate Limiting (DDoS 방어)
   - CORS 설정 (프론트엔드 도메인만 허용)

#### 7.2.2 데이터베이스 스키마 변경

**현재**
```
User (1)
  ↓
Expense (N)
  ↓
Category (N)
```

**변경 후**
```
User (N) ←→ Household (N)  [다대다, HouseholdMember 중간 테이블]
  ↓
Expense (N)
  household_id (FK)
  created_by (FK → User)
  ↓
Category (N)
  household_id (FK, nullable: 전역 카테고리)
```

**신규 테이블**
- `households`: 공유 가계부 그룹
- `household_members`: 사용자-가계부 매핑 (권한 포함)
- `shared_budgets`: 공유 예산
- `merchant_category_mappings`: 가맹점-카테고리 학습 데이터
- `category_suggestions`: 카테고리 제안
- `ocr_logs`: OCR 처리 로그
- `import_jobs`: 데이터 마이그레이션 작업
- `llm_usage_logs`: LLM 사용량 추적

#### 7.2.3 API 변경

**현재 (단일 사용자)**
```
GET  /api/expenses/         # 내 지출 목록
POST /api/expenses/         # 지출 생성
```

**변경 후 (멀티 사용자)**
```
GET  /api/expenses/?household_id={id}  # 특정 가계부 지출
POST /api/expenses/                     # 지출 생성 (household_id body에)
GET  /api/households/{id}/expenses      # 대안: RESTful nested route
```

**신규 엔드포인트**
```
# 가계부 관리
POST   /api/households/
GET    /api/households/
POST   /api/households/{id}/invite
DELETE /api/households/{id}/members/{user_id}

# 메신저 웹훅
POST   /api/webhook/telegram
POST   /api/webhook/kakao

# OCR
POST   /api/expenses/ocr

# 데이터 마이그레이션
POST   /api/import/upload
POST   /api/import/execute

# 사용자 설정
GET    /api/users/me/settings
PUT    /api/users/me/settings
POST   /api/users/me/api-key
```

#### 7.2.4 프론트엔드 변경

**현재**
- React 19 + TypeScript + Vite
- 5개 페이지 (Dashboard, ExpenseList, ExpenseDetail, CategoryManager, InsightsPage)

**추가 필요 페이지**
- `HouseholdSelector`: 여러 가계부 중 선택
- `HouseholdSettings`: 멤버 관리, 초대
- `SettlementPage`: 정산 기능
- `DataImportPage`: 마이그레이션 마법사
- `AISettingsPage`: API 키 설정
- `OnboardingPage`: 최초 사용자 가이드

**상태 관리**
- Context API → Zustand 또는 Redux Toolkit (복잡도 증가)
- 현재 선택된 Household ID 전역 상태 관리

#### 7.2.5 배포 환경

**개발 환경**
```
Docker Compose (로컬)
  ├── db (PostgreSQL)
  ├── redis
  ├── backend (FastAPI)
  └── frontend (Vite dev server)
```

**프로덕션 환경 (AWS 기준)**
```
Route 53 (DNS)
  ↓
CloudFront (CDN) → S3 (프론트엔드 정적 파일)
  ↓
ALB (Application Load Balancer)
  ↓
ECS Fargate (FastAPI 컨테이너)
  ↓
RDS PostgreSQL (Multi-AZ)
  ↓
ElastiCache Redis
  ↓
S3 (이미지 저장)
```

**CI/CD**
```
GitHub Actions
  ├── Backend: pytest → Docker build → ECR push → ECS deploy
  ├── Frontend: npm build → S3 sync → CloudFront invalidate
  └── DB Migration: Alembic upgrade head
```

---

## 8. 성공 지표 (Success Metrics)

### 8.1 MVP 단계 (출시 후 3개월)
- **가입자 수**: 500명 (목표: 1,000명)
- **활성 사용자 (MAU)**: 300명
- **공유 가계부 생성률**: 60% (부부/커플 타겟)
- **메신저 입력 비율**: 70% 이상 (웹 입력 30% 이하)
- **일 평균 지출 입력**: 사용자당 3건
- **리텐션 (D7)**: 40%
- **리텐션 (D30)**: 25%

### 8.2 v1.0 단계 (퍼블릭 베타)
- **가입자 수**: 5,000명
- **MAU**: 3,000명
- **OCR 사용률**: 30%
- **데이터 마이그레이션 사용률**: 20%
- **자기 API 키 설정률**: 10%
- **NPS (Net Promoter Score)**: 40+

### 8.3 v2.0 단계 (Growth)
- **가입자 수**: 50,000명
- **MAU**: 25,000명
- **프리미엄 전환율**: 5% (1,250명)
- **MRR (Monthly Recurring Revenue)**: ₩12,375,000 (1,250명 × ₩9,900)
- **카카오톡 vs 텔레그램 비율**: 90% : 10%
- **평균 가계부당 멤버 수**: 2.3명

### 8.4 핵심 품질 지표 (KPI)
- **AI 파싱 정확도**: 95% 이상
- **OCR 정확도**: 90% 이상
- **메신저 응답 속도**: 3초 이내 (P95)
- **API 응답 속도**: 500ms 이내 (P95)
- **서버 가동률 (Uptime)**: 99.9%

---

## 9. 리스크 및 대응 방안

### 9.1 기술적 리스크

#### Risk 1: LLM API 비용 폭증
- **가능성**: High (사용자 증가 시 API 호출 급증)
- **영향도**: High (수익 없이 비용만 증가)
- **대응**:
  - 사용자별 API 키 사용 (P1)
  - 무료 사용자 쿼터 제한 (월 100회)
  - 캐싱: 동일 입력 30분 내 재사용
  - 모델 최적화: 간단한 파싱은 Haiku, 복잡한 건 Sonnet

#### Risk 2: OCR 정확도 낮음
- **가능성**: Medium (흐릿한 사진, 다양한 영수증 포맷)
- **영향도**: High (사용자 불만)
- **대응**:
  - 사용자 확인 UI (추출 정보 수정 가능)
  - 신뢰도 낮으면 경고 표시
  - 피드백 수집 → 프롬프트 개선

#### Risk 3: 카카오톡 API 제약
- **가능성**: Medium (카카오 정책 변경, 비용)
- **영향도**: High (한국 사용자 주요 채널)
- **대응**:
  - 텔레그램 동시 지원 (폴백)
  - 웹 UI도 충분히 편리하게 개선
  - 카카오 대체: 네이버 톡톡 등 검토

#### Risk 4: 실시간 동기화 성능 이슈
- **가능성**: Medium (대규모 사용자 시)
- **영향도**: Medium
- **대응**:
  - WebSocket 대신 Long Polling으로 시작
  - Redis Pub/Sub 활용
  - 필요 시 WebSocket (Socket.IO)로 전환

### 9.2 비즈니스 리스크

#### Risk 5: 사용자 획득 실패
- **가능성**: Medium (경쟁 심화)
- **영향도**: High (사업 지속 불가)
- **대응**:
  - 바이럴 마케팅: 초대 시 양쪽 보상 (프리미엄 1개월)
  - 인플루언서 협업 (재테크 유튜버)
  - 무료 오픈소스 → 커뮤니티 기반 성장

#### Risk 6: 개인정보 유출 우려
- **가능성**: Low (보안 강화 시)
- **영향도**: Critical (신뢰 상실)
- **대응**:
  - API 키 암호화 저장
  - HTTPS 필수
  - 정기 보안 감사
  - 개인정보 처리방침 명시

#### Risk 7: 수익화 실패
- **가능성**: Medium (무료 사용자만 증가)
- **영향도**: High
- **대응**:
  - 프리미엄 가치 명확화 (고급 인사이트, 무제한 멤버)
  - B2B 전환 (기업 복리후생)
  - 제휴 수익 (카드사 리워드 제휴)

### 9.3 운영 리스크

#### Risk 8: 서버 다운타임
- **가능성**: Low (적절한 인프라 시)
- **영향도**: High (사용자 이탈)
- **대응**:
  - Auto-scaling 설정
  - Health check + 모니터링 (Datadog, Sentry)
  - 장애 대응 매뉴얼

#### Risk 9: 법적 규제 (금융 데이터)
- **가능성**: Low (현재 가계부는 비규제)
- **영향도**: Medium
- **대응**:
  - 금융 정보는 저장하지 않음 (카드 번호 등)
  - 개인정보보호법 준수
  - 필요 시 법률 자문

---

## 10. 부록

### 10.1 기술 스택 최종 정리

**Backend**
- Python 3.12+
- FastAPI (async)
- SQLAlchemy 2.0 (asyncpg)
- PostgreSQL 16
- Redis (cache, queue)
- Alembic (migrations)
- Celery (background jobs, 선택적)
- Anthropic/OpenAI SDK
- python-telegram-bot
- kakao-messaging-api (custom)

**Frontend**
- React 19
- TypeScript
- Vite
- Zustand (상태 관리)
- React Router
- Axios
- TailwindCSS (또는 Material-UI)

**Infrastructure**
- Docker + Docker Compose (local)
- AWS (ECS, RDS, ElastiCache, S3, CloudFront)
- GitHub Actions (CI/CD)
- Sentry (에러 추적)
- Datadog (모니터링, 선택적)

**Testing**
- Backend: pytest, pytest-asyncio, httpx
- Frontend: Vitest, React Testing Library

### 10.2 예상 개발 공수 종합

| 단계 | 기간 | 핵심 기능 |
|-----|------|----------|
| **MVP** | 2개월 | 카카오톡 봇, 공유 가계부, 실시간 동기화 |
| **v1.0** | +3개월 | OCR, 데이터 마이그레이션, API 키 설정, 카테고리 학습 |
| **v2.0** | +6개월 | 메신저 확장, AI 최적화, 프리미엄 기능 |
| **Total** | 11개월 | Full production-ready 서비스 |

**개발 인력 (풀타임 기준)**
- 백엔드 개발자 1명
- 프론트엔드 개발자 1명
- (선택) 디자이너 0.5명 (UI/UX)
- (선택) PM/기획자 0.5명

### 10.3 오픈소스 vs SaaS 전략

**Option 1: 오픈소스 (Self-hosted)**
- GitHub 공개
- Docker Compose로 쉽게 설치
- 사용자가 자기 서버/API 키로 운영
- 수익: 기부, 스폰서십, 유료 지원

**Option 2: SaaS (Hosted)**
- 클라우드 호스팅 제공
- 프리미엄 플랜 판매
- 사용자는 설치 없이 바로 사용
- 수익: 구독료

**추천: 하이브리드**
- 오픈소스로 공개 (커뮤니티 성장)
- 공식 호스팅 서비스 제공 (편의성)
- 프리미엄 기능은 SaaS만 제공

### 10.4 경쟁사 분석

| 서비스 | 강점 | 약점 | HomeNRich 차별점 |
|--------|------|------|------------------|
| **뱅크샐러드** | 자동 연동, 자산 관리 | 수동 입력 불편, 공유 기능 약함 | 메신저 입력, 부부 공유 최적화 |
| **편한가계부** | 간편한 UI | AI 없음, 공유 제한적 | AI 자동 분류, OCR |
| **Toshl** | 글로벌, 다양한 기능 | 한국어 지원 부족 | 한국어 최적화, 카카오톡 |
| **Splitwise** | 정산 특화 | 가계부 기능 약함 | 통합 (가계부 + 정산) |

---

## 11. 다음 단계 (Action Items)

### 즉시 착수 (1주 내)
- [ ] PRD 검토 및 피드백 수렴
- [ ] 카카오 비즈니스 계정 개설
- [ ] Household 데이터 모델 설계 및 마이그레이션 작성
- [ ] 프론트엔드 HouseholdSelector 와이어프레임 작성

### MVP 개발 시작 (2-4주)
- [ ] 카카오톡 웹훅 엔드포인트 구현
- [ ] Household CRUD API 구현
- [ ] 공유 가계부 프론트엔드 개발
- [ ] 실시간 동기화 프로토타입

### v1.0 준비 (2-3개월)
- [ ] OCR 엔진 선정 및 POC
- [ ] 데이터 마이그레이션 기능 설계
- [ ] 사용자 API 키 암호화 구현
- [ ] 퍼블릭 베타 테스터 모집

---

**작성자**: Claude (Senior Service Planner Agent)
**문의**: 추가 기능 제안, 우선순위 변경, 기술 스택 질문 등은 언제든지 요청해주세요.

---

## 변경 이력

| 버전 | 날짜 | 변경 내역 |
|-----|------|----------|
| 1.0 | 2026-02-12 | 초안 작성 (MVP 범위) |
| 2.0 | 2026-02-12 | 확장 버전 작성 (공유 가계부, OCR, 데이터 마이그레이션, API 키 설정 등 7가지 핵심 아이디어 반영) |
