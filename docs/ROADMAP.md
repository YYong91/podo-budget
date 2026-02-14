# HomeNRich 로드맵 (Roadmap)

**최종 업데이트**: 2026-02-14
**기준 문서**: `PRODUCT.md`

이 문서는 HomeNRich의 단계별 구현 계획을 정의합니다.

---

## Phase 1: Core MVP (개인 가계부)

**목표**: 1인 사용자가 자연어로 지출을 입력하고 자동 분류
**우선순위**: P0 (필수)

| 기능 | 상태 | 완료 조건 |
|------|------|----------|
| LLM 자연어 파싱 구현 | **완료** | "점심 8000원" -> 정확한 JSON 파싱 |
| 프롬프트 엔지니어링 | **완료** | Few-shot 프롬프트 + 카테고리 규칙 |
| Alembic 마이그레이션 초기화 | **완료** | `alembic upgrade head` 동작 |
| 프론트엔드 자연어 입력 UI | **완료** | 자연어/폼 2모드 제공 |
| 파싱 결과 확인/수정 UI | **완료** | 프리뷰 → 수정 → 확인 플로우 |

### 상세 작업

**1.1 LLM 파싱 구현**
- `services/llm_service.py`의 `OpenAIProvider.parse_expense()` 구현
- `AnthropicProvider.parse_expense()` 구현
- Few-shot 프롬프트 작성 (CATEGORY_RULES.md 참조)
- 날짜 표현 처리 ("오늘", "어제", "2월 10일")
- API 에러 핸들링 (timeout, rate limit)

**1.2 Alembic 초기화**
- `alembic init alembic` 실행
- `env.py`에 Base.metadata 연결
- 초기 마이그레이션 생성
- CLAUDE.md에 마이그레이션 가이드 추가

**1.3 프론트엔드 자연어 입력**
- ChatInput 컴포넌트 (텍스트 입력 + 전송)
- 파싱 결과 프리뷰 카드 (금액, 카테고리, 날짜)
- 각 필드 수정 가능 (드롭다운/날짜 선택기)
- 로딩 상태 표시

---

## Phase 2: Household Sharing (공유 가계부)

**목표**: 2명 이상이 같은 가구에서 지출을 실시간 공유
**우선순위**: P1 (중요)
**선행 조건**: Phase 1 완료

| 기능 | 상태 | 완료 조건 |
|------|------|----------|
| Expense 스키마 확장 | **완료** | ExpenseCreate에 household_id 추가 |
| chat.py household 지원 | **완료** | household_id 자동감지 + 멤버 검증 |
| expenses.py household 필터링 | **완료** | household_id로 공유 지출 조회 |
| 자연어 컨텍스트 탐지 서비스 | **완료** | "우리" -> 공유, "내" -> 개인 |
| Household 권한 검증 | **완료** | 멤버만 지출 조회/수정 가능 |
| 초대 이메일 발송 | 예정 | SendGrid/SES 연동 |
| Household 전환 UI | **완료** | 사이드바 드롭다운으로 가구 전환 |
| 멤버별 지출 필터링 UI | **완료** | 멤버 드롭다운 필터링 |

### 상세 작업

**2.1 Backend: Expense <-> Household 연결**
- `ExpenseCreate` 스키마에 `household_id: int | None` 추가
- `ExpenseResponse`에 `household_name`, `user_id` 추가
- `chat.py`에서 사용자 가구 조회 -> 자연어 힌트 추출 -> household_id 결정
- `expenses.py`에 `household_id` 필터 쿼리 파라미터 추가
- 권한 체크: 해당 가구 멤버만 조회 가능

**2.2 Backend: 자연어 컨텍스트 탐지**
- `services/expense_context_detector.py` 신규 생성
- 공유 키워드: "우리", "같이", "함께", "공동", "가족"
- 개인 키워드: "내", "나만", "개인적으로", "혼자"
- 기본값: 가구 1개면 공유, 없으면 개인

**2.3 Frontend: 멀티 Household 지원**
- 지출 입력 폼에 household 선택 드롭다운
- 대시보드 뷰 전환 (공유/개인)
- 멤버별 지출 통계 표시
- Context API로 현재 Household 상태 관리

### Phase 2에서 제외 (Phase 3 이후)
- 정산 기능 ("이번 달 A가 B에게 5만원 더 냈음")
- 지출 승인 시스템
- 고급 권한 관리 (viewer 역할)

---

## Phase 3: Bot Integration (메신저 봇)

**목표**: Telegram/KakaoTalk 봇으로 지출 입력 가능
**우선순위**: P1 (중요)
**선행 조건**: Phase 1 완료 (LLM 파싱)

| 기능 | 상태 | 완료 조건 |
|------|------|----------|
| Telegram Webhook 설정 | **완료** | /start, /help, /report, /budget 명령어 동작 |
| Telegram 자연어 입력 | **완료** | "점심 8000원" → LLM 파싱 → 자동 등록 |
| Telegram 카테고리 변경 | **완료** | 인라인 키보드로 카테고리 선택/변경 |
| Telegram Household 연동 | **완료** | 컨텍스트 탐지 → household_id 자동 설정 |
| Kakao OpenBuilder 연동 | **완료** | LLM 파싱 + Household 연동 |
| 봇 실제 배포 (토큰 설정) | 예정 | 실서버에서 Webhook URL 등록 |

---

## Phase 4: 배포 및 Beta

**목표**: Fly.io 배포 + 베타 테스터 모집
**선행 조건**: Phase 1-3 완료

- ~~Fly.io 배포 (Backend + Frontend + DB)~~ **설정 완료** — fly.toml + Dockerfile + 시크릿 설정, 트라이얼 만료로 결제 활성화 필요
- ~~CI/CD 설정 (GitHub Actions)~~ **완료** — Production (main push → test → deploy) + PR Test
- ~~Sentry 에러 트래킹~~ **완료** — Backend(sentry-sdk) + Frontend(@sentry/react), DSN 없으면 비활성화
- 베타 테스터 10쌍 (20명) 모집
- 2주간 피드백 수집

---

## 장기 로드맵 (Phase 5+)

- 영수증 OCR (Google Vision API)
- CSV/Excel 임포트
- AI 기반 지출 패턴 분석 및 절약 제안
- 프리미엄 기능 (무제한 멤버, 고급 리포트, 유료 플랜 $5/월)

---

## 참조 문서

- **프로젝트 기준**: `PRODUCT.md`
- **구현 현황**: `IMPLEMENTATION_STATUS.md`
