#!/bin/bash
# R1 코드 리뷰 이슈 일괄 생성 스크립트
set -e

PROJECT_NUM=1
OWNER="yyong-brs"
ISSUES_CREATED=()

create_issue() {
  local title="$1"
  local labels="$2"
  local body="$3"

  url=$(gh issue create --title "$title" --label "$labels" --body "$body" 2>&1)
  echo "Created: $url"
  ISSUES_CREATED+=("$url")

  # 프로젝트에 추가
  gh project item-add "$PROJECT_NUM" --owner "$OWNER" --url "$url" 2>/dev/null || true
  sleep 0.5
}

echo "=== R1 Critical 이슈 생성 ==="

create_issue "[코드리뷰] 보안: Webhook 시크릿 미설정 시 무인증 접근" \
  "code-review,P0: critical,bug" \
  "$(cat <<'BODY'
## 문제
Telegram, Kakao, Sentry webhook 엔드포인트에서 시크릿이 빈 문자열이면 서명 검증이 완전히 스킵됨.

## 위치
- `backend/app/api/telegram.py:192-195`
- `backend/app/api/kakao.py:131-134`
- `backend/app/api/webhooks.py:69-72`

## 영향
- 누구나 webhook으로 LLM 무제한 호출 (비용 발생)
- 임의 지출/수입 레코드 생성
- Sentry webhook으로 관리자 텔레그램에 스팸/피싱 메시지 주입

## 제안
- 운영 환경에서 봇 토큰 설정 시 시크릿도 필수 강제 (Settings model_validator)
- 미설정 시 RuntimeError로 서버 시작 차단

---
📋 종합 코드 리뷰 R1 (보안+버그) — B1[1,2], B6[1,4]
BODY
)"

create_issue "[코드리뷰] 보안: X-Forwarded-For 스푸핑으로 rate limit 우회" \
  "code-review,P0: critical,bug" \
  "$(cat <<'BODY'
## 문제
rate_limit.py에서 X-Forwarded-For 헤더를 그대로 신뢰. 매 요청마다 다른 IP 설정으로 rate limit 완전 우회 가능.

## 위치
- `backend/app/core/rate_limit.py:63-64`

## 영향
인증 불필요한 엔드포인트에서 rate limit 무력화

## 제안
Fly.io 환경이면 Fly-Client-IP 헤더 사용 또는 신뢰할 프록시 IP 범위 명시

---
📋 종합 코드 리뷰 R1 — B1[3]
BODY
)"

create_issue "[코드리뷰] 보안: ADMIN_USER_ID 기본값 1 하드코딩" \
  "code-review,P0: critical,bug" \
  "$(cat <<'BODY'
## 문제
ADMIN_USER_ID의 기본값이 1. .env 미설정 시 DB에서 ID=1인 사용자가 자동으로 admin 권한 획득.

## 위치
- `backend/app/core/config.py:56`
- `backend/app/api/dependencies.py:189`

## 영향
임의 사용자가 전체 사용자 데이터 열람 및 계정 비활성화 가능

## 제안
기본값을 -1로 변경, 환경변수 미설정 시 admin 기능 비활성화

---
📋 종합 코드 리뷰 R1 — B3[1]
BODY
)"

create_issue "[코드리뷰] 보안: 초대 수락 시 레이스 컨디션" \
  "code-review,P0: critical,bug" \
  "$(cat <<'BODY'
## 문제
accept_invitation에서 활성 멤버 확인 → 멤버 추가 → 초대 상태 변경 사이에 DB 레벨 잠금 없음. 동일 토큰 동시 요청 시 중복 처리 가능.

## 위치
- `backend/app/api/invitations.py:124-199`

## 영향
한 사용자가 같은 가구에 두 번 수락되거나 만료된 초대 처리

## 제안
SELECT ... FOR UPDATE 또는 초대 status 업데이트를 조건부 UPDATE로 원자화

---
📋 종합 코드 리뷰 R1 — B3[2]
BODY
)"

create_issue "[코드리뷰] 보안: 자산 API household_id 권한 검증 누락" \
  "code-review,P0: critical,bug" \
  "$(cat <<'BODY'
## 문제
1. /assets/snapshots 엔드포인트에서 get_household_member() 검증 누락
2. asset_service.get_assets에서 household_id=None 시 created_by 기반 폴백
3. PUT/DELETE에서 탈퇴 멤버가 이전 가구 자산 수정/삭제 가능

## 위치
- `backend/app/api/assets.py:68-91` (snapshots)
- `backend/app/services/asset_service.py:35-42` (get_assets)
- `backend/app/api/assets.py:225-260` (PUT/DELETE)

## 영향
다른 가구의 자산 데이터 비인가 접근, 탈퇴 멤버의 잠재적 권한 유지

## 제안
- snapshots에 get_household_member() 추가
- household_id=None 폴백 제거
- PUT/DELETE에 household 멤버십 검증 추가

---
📋 종합 코드 리뷰 R1 — B4[2,4,8]
BODY
)"

create_issue "[코드리뷰] 버그: 정기거래 중복 실행 방어 없음" \
  "code-review,P0: critical,bug" \
  "$(cat <<'BODY'
## 문제
execute_recurring에서 해당 기간에 이미 지출/수입이 생성되어 있는지 확인하지 않음. 더블 클릭이나 네트워크 재시도로 두 건 생성 가능.

## 위치
- `backend/app/services/recurring_service.py:90-141`
- `backend/app/api/recurring.py:163-185`

## 영향
동일 항목(월세, 보험료)이 두 건 등록, 잔액/예산 통계 오염

## 제안
(recurring_transaction_id, due_date) 유니크 제약 추가 또는 실행 전 중복 체크

---
📋 종합 코드 리뷰 R1 — B4[1]
BODY
)"

create_issue "[코드리뷰] 보안: 계좌 조회 IDOR 취약점" \
  "code-review,P0: critical,bug" \
  "$(cat <<'BODY'
## 문제
get_account_by_id에서 household_id가 있으면 created_by 검사를 건너뛰고 바로 반환. household 멤버십 검증 없음.

## 위치
- `backend/app/services/account_service.py:38-48`

## 영향
인증된 임의 사용자가 account_id 순차 대입으로 타 가구 계좌 정보 열람

## 제안
GET /{account_id} 엔드포인트에서 get_household_member() 검증 추가

---
📋 종합 코드 리뷰 R1 — B6[3]
BODY
)"

create_issue "[코드리뷰] 보안: LLM 프롬프트 인젝션 방어 부재" \
  "code-review,P0: critical,bug" \
  "$(cat <<'BODY'
## 문제
1. chat API에서 사용자 입력이 LLM 프롬프트에 직접 삽입 (sanitization 없음)
2. 히스토리 힌트 description이 프롬프트에 비검증 삽입
3. AssetParseRequest.text에 길이 제한 없음

## 위치
- `backend/app/api/chat.py:178`
- `backend/app/services/prompts.py:197-198`
- `backend/app/services/asset_parse_service.py:35-54`

## 영향
프롬프트 인젝션으로 LLM 동작 조작, 잘못된 분류 유도, LLM API 비용 과다

## 제안
- 입력 길이 제한 + 개행/특수문자 sanitize
- 시스템/유저 프롬프트 분리
- 출력 검증 강화

---
📋 종합 코드 리뷰 R1 — B2[1,6], B4[5]
BODY
)"

create_issue "[코드리뷰] 보안: CI/CD 공급망 보안 취약" \
  "code-review,P0: critical,bug" \
  "$(cat <<'BODY'
## 문제
1. Dockerfile에서 uv를 :latest 태그로 사용 (태그 고정 없음)
2. cd.yml에서 superfly/flyctl-actions@master 브랜치 참조
3. ci-test.yml에서 uv version: latest

## 위치
- `backend/Dockerfile:6`
- `.github/workflows/cd.yml:39`
- `.github/workflows/ci-test.yml:30`

## 영향
공급망 공격 시 CI/CD를 통해 운영 서버에 악성 코드 배포

## 제안
- 모든 외부 의존성을 특정 버전/SHA로 고정
- uv:0.5.20, flyctl-actions@v1 등

---
📋 종합 코드 리뷰 R1 — B7[1,2,7]
BODY
)"

create_issue "[코드리뷰] 버그: fly.toml에 SQLite DATABASE_URL 설정" \
  "code-review,P0: critical,bug" \
  "$(cat <<'BODY'
## 문제
프로덕션 fly.toml에 DATABASE_URL = "sqlite+aiosqlite:///..." 명시. Fly.io secrets로 오버라이드하지 않으면 SQLite 사용.

## 위치
- `backend/fly.toml:21`

## 영향
재배포 시 데이터 유실, 다중 인스턴스 동시성 문제

## 제안
fly.toml에서 DATABASE_URL 제거, Fly.io secrets로만 관리

---
📋 종합 코드 리뷰 R1 — B7[3]
BODY
)"

echo "=== R1 High 이슈 생성 ==="

create_issue "[코드리뷰] 보안: Shadow User email 매칭 계정 탈취 벡터" \
  "code-review,P1: high,bug" \
  "$(cat <<'BODY'
## 문제
auth_user_id로 조회 실패 시 email로 기존 유저를 찾아 자동 연결. podo-auth의 이메일 검증 강도에 전적으로 의존.

## 위치
- `backend/app/core/auth.py:83-94`

## 영향
podo-auth에서 이메일 인증 없이 계정 생성이 가능하다면 타인의 가계부 데이터 전체 탈취

## 제안
시간 제한 또는 플래그로 통제, email 매칭 시 감사 로그 기록

---
📋 종합 코드 리뷰 R1 — B1[4]
BODY
)"

create_issue "[코드리뷰] 보안: CORS 기본값에 localhost 포함" \
  "code-review,P1: high,bug" \
  "$(cat <<'BODY'
## 문제
CORS_ORIGINS 기본값에 http://localhost:5173 포함. 환경변수 미설정 시 프로덕션에서도 허용.

## 위치
- `backend/app/core/config.py:59`

## 영향
로컬 웹 페이지가 프로덕션 API에 인증된 요청 가능

## 제안
기본값을 프로덕션 도메인만으로 설정

---
📋 종합 코드 리뷰 R1 — B1[6]
BODY
)"

create_issue "[코드리뷰] 보안: ValueError 핸들러가 내부 정보 노출" \
  "code-review,P1: high,bug" \
  "$(cat <<'BODY'
## 문제
ValueError 발생 시 str(exc) 전체를 클라이언트에 그대로 반환.

## 위치
- `backend/app/core/exceptions.py:13-17`

## 영향
SQLAlchemy 쿼리 오류, 파일 경로, 모델 구조 등 서버 내부 정보 노출

## 제안
Sentry에 기록 + 사용자에게는 일반 메시지 반환, 커스텀 예외로 구분

---
📋 종합 코드 리뷰 R1 — B1[8]
BODY
)"

create_issue "[코드리뷰] 보안: 이메일 HTML 인젝션" \
  "code-review,P1: high,bug" \
  "$(cat <<'BODY'
## 문제
inviter_name/household_name이 f-string으로 HTML에 직접 삽입. 이스케이프 없음.

## 위치
- `backend/app/services/email_service.py:51-61`

## 영향
초대 이메일에 피싱 링크 또는 스크립트 주입 가능

## 제안
html.escape()로 모든 사용자 입력 이스케이프

---
📋 종합 코드 리뷰 R1 — B3[4]
BODY
)"

create_issue "[코드리뷰] 보안: 카카오 인증 헤더 timing attack + 형식 불일치" \
  "code-review,P1: high,bug" \
  "$(cat <<'BODY'
## 문제
1. != 비교로 timing attack 노출
2. 카카오 오픈빌더가 Bearer TOKEN 형식으로 보내면 검증 항상 실패

## 위치
- `backend/app/api/kakao.py:131-134`

## 영향
정상 카카오 요청 거절 또는 시크릿을 빈 문자열로 유지하게 됨

## 제안
hmac.compare_digest 사용, 카카오 실제 헤더 형식 확인 후 파싱

---
📋 종합 코드 리뷰 R1 — B6[2]
BODY
)"

create_issue "[코드리뷰] 버그: Expense date 기본값 고정 + amount float 타입" \
  "code-review,P1: high,bug" \
  "$(cat <<'BODY'
## 문제
1. Expense.date의 default=date.today() — 서버 시작 시 평가되어 고정 (callable이어야 함)
2. Pydantic 스키마에서 amount가 float — DB는 Numeric(12,2)인데 정밀도 손실

## 위치
- `backend/app/models/expense.py:44`
- `backend/app/schemas/expense.py:11`

## 영향
1. 서버 재시작 없이 날짜가 지나면 이전 날짜로 기록
2. 큰 금액에서 소수점 오차

## 제안
1. default=date.today (괄호 제거)
2. Decimal 타입 사용

---
📋 종합 코드 리뷰 R1 — B2[3,4]
BODY
)"

create_issue "[코드리뷰] 버그: 레거시 데이터(household_id=None) 수정/삭제 불가" \
  "code-review,P1: high,bug" \
  "$(cat <<'BODY'
## 문제
get_household_member(expense.household_id) 호출 시 household_id가 None이면 404 반환.

## 위치
- `backend/app/api/expenses.py:607`
- `backend/app/api/income.py:251`

## 영향
마이그레이션 이전 생성된 데이터 수정/삭제 불가

## 제안
household_id=None인 레거시 데이터는 본인 확인만으로 수정/삭제 허용

---
📋 종합 코드 리뷰 R1 — B2[5]
BODY
)"

create_issue "[코드리뷰] 버그: ExpenseForm에서 수입 항목을 지출로 저장" \
  "code-review,P1: high,bug" \
  "$(cat <<'BODY'
## 문제
handleConfirmSave가 previewItems 전체를 expenseApi.create()로 저장. LLM이 type:income으로 파싱한 항목도 지출로 기록.

## 위치
- `frontend/src/pages/ExpenseForm.tsx:111-139`

## 영향
"월급 350만원과 점심 8000원" 입력 시 월급도 지출로 기록

## 제안
item.type에 따라 expenseApi/incomeApi 분기 처리

---
📋 종합 코드 리뷰 R1 — B2[7]
BODY
)"

create_issue "[코드리뷰] 버그: activeHouseholdId non-null assertion 패턴" \
  "code-review,P1: high,bug" \
  "$(cat <<'BODY'
## 문제
여러 페이지에서 activeHouseholdId!로 non-null assertion 사용. 가구 로딩 전 API 호출 시 null 전송.

## 위치
- `frontend/src/pages/TransactionList.tsx:118`
- `frontend/src/pages/AccountManager.tsx:28`
- 기타 유사 패턴 존재 가능

## 영향
초기 렌더링 시 API 호출 실패 또는 의도하지 않은 데이터 조회

## 제안
if (!activeHouseholdId) return null guard 추가

---
📋 종합 코드 리뷰 R1 — B2[8], B6[7]
BODY
)"

create_issue "[코드리뷰] 버그: updateMemberRole PUT→PATCH 메서드 불일치" \
  "code-review,P1: high,bug" \
  "$(cat <<'BODY'
## 문제
백엔드는 PATCH로 정의, 프론트엔드는 PUT으로 호출 → 405 Method Not Allowed.

## 위치
- `frontend/src/api/households.ts:72-73`
- `backend/app/api/households.py:320`

## 영향
**역할 변경 기능 전체가 동작하지 않음**

## 제안
apiClient.put → apiClient.patch 변경

---
📋 종합 코드 리뷰 R1 — B3[8]
BODY
)"

create_issue "[코드리뷰] 버그: Telegram 계정 연동 후 소유권 검증 불일치" \
  "code-review,P1: high,bug" \
  "$(cat <<'BODY'
## 문제
봇으로 입력한 지출의 user_id는 봇 유저 ID인데, 계정 연동 후 get_or_create_bot_user는 SSO 유저를 반환 → 소유권 검증 실패.

## 위치
- `backend/app/api/telegram.py:479-489`

## 영향
계정 연동 후 텔레그램으로 입력한 기존 지출 수정/삭제 불가

## 제안
연동 시 봇 유저 데이터를 SSO 유저로 마이그레이션

---
📋 종합 코드 리뷰 R1 — B1[7]
BODY
)"

create_issue "[코드리뷰] 버그: 온보딩 중복 가구 생성 + Owner 탈퇴 UI 없음" \
  "code-review,P1: high,bug" \
  "$(cat <<'BODY'
## 문제
1. 이미 가구에 소속된 사용자도 온보딩으로 추가 가구 생성 가능
2. Owner는 탈퇴 버튼이 안 보임 (백엔드는 허용하지만 FE에서 차단)

## 위치
- `backend/app/api/onboarding.py:53-79`
- `frontend/src/pages/HouseholdDetailPage.tsx:447-454`

## 영향
빈 가구 중복 생성, Owner 탈퇴 UX 막힘

## 제안
1. 활성 가구 있으면 생성 거부
2. 멤버 2명 이상일 때 Owner 탈퇴 옵션 추가

---
📋 종합 코드 리뷰 R1 — B3[5,7]
BODY
)"

create_issue "[코드리뷰] 버그: JWT base64url 디코딩 + 토큰 만료 5분 인터벌" \
  "code-review,P1: high,bug" \
  "$(cat <<'BODY'
## 문제
1. atob()은 base64만 처리. JWT base64url(패딩 없음, -/_) 미지원. 한국어 username 시 예외
2. 토큰 만료 체크가 5분 인터벌. 만료 후 최대 5분간 isAuthenticated=true

## 위치
- `frontend/src/contexts/AuthContext.tsx:49` (디코딩)
- `frontend/src/contexts/AuthContext.tsx:177-189` (인터벌)

## 영향
1. 한국어 사용자명이면 유효한 토큰이 만료로 오인, 로그인 루프
2. 진행 중 작업이 401로 실패

## 제안
1. base64url → base64 변환 패턴 적용
2. 토큰 exp 기반 proactive refresh 또는 인터벌 1분 축소

---
📋 종합 코드 리뷰 R1 — B1[5], B5[2]
BODY
)"

create_issue "[코드리뷰] 보안: Admin 권한 관련 문제 (FE guard + admin 추방)" \
  "code-review,P1: high,bug" \
  "$(cat <<'BODY'
## 문제
1. AdminPage 권한 검사가 FE 클라이언트 측에서만 수행 (user 로딩 전 차단)
2. admin이 다른 admin을 추방할 수 있음 (owner만 가능해야 할 수도)
3. 초대 토큰이 list_invitations 응답에 포함 (최소 권한 위반)

## 위치
- `frontend/src/pages/AdminPage.tsx:49`
- `backend/app/api/households.py:390-441`
- `backend/app/api/households.py:634-690`

## 영향
1. 비관리자가 FE 검사 우회 시 admin API 호출 가능 (백엔드 검증 확인 필요)
2. admin 간 권한 남용
3. 토큰 노출

## 제안
1. loading 상태 스피너 + 백엔드 admin 권한 검증 확인
2. 추방 대상이 admin이면 owner 권한 요구
3. list_invitations에서 토큰 제거

---
📋 종합 코드 리뷰 R1 — B3[3,6], B5[1]
BODY
)"

create_issue "[코드리뷰] 버그: Sentry 서명 검증 + console.warn 프로덕션 노출" \
  "code-review,P1: high,bug" \
  "$(cat <<'BODY'
## 문제
1. Sentry는 sha256=<hex> 형식으로 서명 전송하는데 prefix 파싱 없이 비교 → 항상 실패
2. AuthContext에서 console.warn으로 인증 상태 정보를 프로덕션에서도 출력

## 위치
- `backend/app/api/webhooks.py:20`
- `frontend/src/contexts/AuthContext.tsx:117-122`

## 영향
1. SENTRY_WEBHOOK_SECRET 설정 시 모든 합법적 알림 401 거절
2. XSS/악성 확장이 콘솔에서 인증 진단 정보 수집 가능

## 제안
1. signature.startswith("sha256=") 파싱 추가
2. import.meta.env.DEV 조건부 출력

---
📋 종합 코드 리뷰 R1 — B5[3], B6[5]
BODY
)"

create_issue "[코드리뷰] 버그: ThemeProvider FOUC + Budget datetime/date 혼용" \
  "code-review,P1: high,bug" \
  "$(cat <<'BODY'
## 문제
1. ThemeProvider 초기 마운트 시 applyTheme() 미호출 → FOUC
2. BudgetCreate.start_date가 datetime인데 Expense.date(Date)와 비교 → 타입 혼용

## 위치
- `frontend/src/contexts/ThemeContext.tsx:47-88`
- `backend/app/schemas/budget.py:29`

## 영향
1. 저장된 dark/light 모드가 첫 로드 시 잠깐 잘못된 테마 표시
2. 특정 환경에서 예산 알림 오류, 인덱스 미활용

## 제안
1. useEffect(() => applyTheme(...), []) 마운트 시 실행
2. start_date/end_date를 date 타입으로 통일

---
📋 종합 코드 리뷰 R1 — B4[6], B5[4]
BODY
)"

create_issue "[코드리뷰] 보안: docker-compose + Fly.io 설정 보안" \
  "code-review,P1: high,bug" \
  "$(cat <<'BODY'
## 문제
1. docker-compose.yml에 JWT_SECRET 기본값 하드코딩 (공개 저장소 노출)
2. docker-compose.yml에 --reload 플래그 (셀프호스팅 시 문제)
3. fly.dev.toml에 DEBUG=True (인터넷 공개 서버에서 스택 트레이스 노출)

## 위치
- `docker-compose.yml:21,23`
- `backend/fly.dev.toml:14`

## 영향
1. 알려진 시크릿으로 JWT 위조
2. 성능 저하, 예기치 않은 재시작
3. 에러 시 내부 코드 구조 노출

## 제안
1. JWT_SECRET 기본값 제거
2. production docker-compose 분리 또는 개발 전용 명시
3. DEBUG를 Fly.io secrets로 관리

---
📋 종합 코드 리뷰 R1 — B7[4,6,8]
BODY
)"

create_issue "[코드리뷰] 버그: OnboardingPage + LLM 입력 검증 부재" \
  "code-review,P1: high,bug" \
  "$(cat <<'BODY'
## 문제
1. OnboardingPage에서 inv.token! non-null assertion 사용
2. /insights/generate-comprehensive에서 FE가 보낸 재무 데이터를 DB 검증 없이 LLM 전달
3. conftest.py의 LLM mock이 AnthropicProvider를 직접 패치

## 위치
- `frontend/src/pages/OnboardingPage.tsx:93`
- `backend/app/api/insights.py:125-148`
- `backend/tests/conftest.py:339,358`

## 영향
1. token null 시 런타임 크래시
2. 조작된 데이터로 rate limit 소모
3. LLM_PROVIDER 변경 시 테스트 무효화

## 제안
1. token null 체크 후 버튼 비활성화
2. ComprehensiveInsightsRequest에 Field(ge=0) 범위 검증
3. get_llm_provider 팩토리 함수를 패치

---
📋 종합 코드 리뷰 R1 — B3[9], B4[3], B7[5]
BODY
)"

echo "=== R1 Medium 이슈 생성 ==="

create_issue "[코드리뷰] 버그: 외부 API negative cache 없음 + 통계 API household_id" \
  "code-review,P2: medium,bug" \
  "$(cat <<'BODY'
## 문제
1. price_service/exchange_rate 외부 API 실패 시 캐시에 None 미저장 → 실패마다 재호출
2. 지출 통계 쿼리에서 household_id 필터 일관성 확인 필요

## 위치
- `backend/app/services/price_service.py:19-20`
- `backend/app/services/exchange_rate.py:15-16`
- `backend/app/api/expenses.py:485-498`

## 영향
1. 외부 API 장애 시 모든 자산 조회 느려짐, rate limit 도달
2. 타 가구 통계 데이터 노출 가능성

## 제안
1. 실패 시 짧은 TTL(30초)로 negative cache 추가
2. 모든 통계 쿼리에 household_id 필터 확인

---
📋 종합 코드 리뷰 R1 — B2[2], B4[7]
BODY
)"

create_issue "[코드리뷰] 버그: FE 유틸리티 엣지 케이스 (금액 표시, 건강 점수, Toast)" \
  "code-review,P2: medium,bug" \
  "$(cat <<'BODY'
## 문제
1. formatCompactAmount: 999,999원이 반올림으로 "100.0만" 표시
2. calculateHealthScore: 수입=0, 지출=0인 신규 사용자가 C+ 등급
3. Toast stale closure: 새 토스트 추가 시 기존 타이머 리셋

## 위치
- `frontend/src/utils/format.ts:22-24`
- `frontend/src/utils/healthScore.ts:33-39`
- `frontend/src/components/Toast.tsx:76-83`

## 영향
1. 캘린더에서 혼란스러운 금액 표시
2. 신규 사용자에게 부정확한 건강 점수
3. 여러 토스트 동시 표시 시 자동 소멸 지연

## 제안
1. Math.floor 사용
2. 수입/지출 모두 0이면 "데이터 없음" 처리
3. removeToast를 useCallback으로 감싸기

---
📋 종합 코드 리뷰 R1 — B5[5,6,7]
BODY
)"

create_issue "[코드리뷰] 보안: GitHub Actions shell injection + 카카오 연동 UI 불일치" \
  "code-review,P2: medium,bug" \
  "$(cat <<'BODY'
## 문제
1. notify.yml에서 inputs.message를 shell에 직접 삽입 (PR 제목에 특수문자 시 명령 실행)
2. 카카오 연동 복사 명령어(/link)와 봇 도움말(연동) 형식 불일치
3. Telegram set_category에서 콜백 데이터로 임의 카테고리 생성 가능

## 위치
- `.github/workflows/notify.yml:30`
- `frontend/src/pages/SettingsPage.tsx:290,506`
- `backend/app/api/telegram.py:621`

## 영향
1. PR 제목으로 CI 환경에서 명령 실행
2. 사용자 혼란
3. 임의 카테고리 생성 (자기 스코프만)

## 제안
1. 환경변수로 전달 후 $ENV_VAR 참조
2. "연동 코드" 형식으로 통일
3. 카테고리 생성을 ID 기반으로 제한

---
📋 종합 코드 리뷰 R1 — B6[6,8], B7[9]
BODY
)"

echo ""
echo "=== 완료: ${#ISSUES_CREATED[@]}개 이슈 생성됨 ==="
for url in "${ISSUES_CREATED[@]}"; do
  echo "  $url"
done
