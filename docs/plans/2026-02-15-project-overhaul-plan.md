# HomeNRich 프로젝트 전체 정비 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 기존 코드베이스를 유지하면서 UI 일관성, 백엔드 품질, 미완성 기능, 배포를 순차적으로 정비

**Architecture:** 레이어별 순차 정비 — UI/UX 완성 → 백엔드 품질 → 미완성 기능 → 배포 준비. feature/ui-redesign 브랜치에서 작업.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, React 19, TypeScript, Tailwind CSS v4, Vite 7, lucide-react, Resend (이메일)

---

## Layer 1: UI/UX 일관성 완성

분석 결과 대부분의 페이지가 이미 Amber/Stone 테마로 전환됨. 남은 작업은 일관성 수정과 미세 조정.

### Task 1: ExpenseForm sky 컬러 제거 및 일관성 수정

**Files:**
- Modify: `frontend/src/pages/ExpenseForm.tsx`

**Step 1: sky-* 컬러를 stone-* 으로 교체**

ExpenseForm.tsx에서 `sky-50`, `sky-200`, `sky-800` 클래스를 찾아 stone 계열로 교체:
- `bg-sky-50` → `bg-amber-50`
- `border-sky-200` → `border-amber-200`
- `text-sky-800` → `text-amber-800`

**Step 2: focus ring 일관성 통일**

모든 input의 focus ring을 `focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500` 패턴으로 통일

**Step 3: rounded 크기 통일**

- 카드/컨테이너: `rounded-2xl`
- 인풋: `rounded-xl`
- 버튼: `rounded-xl`
- 배지/태그: `rounded-full`

**Step 4: 테스트 확인**

Run: `cd frontend && npx vitest run src/pages/__tests__/ExpenseForm.test.tsx`
Expected: PASS

**Step 5: 커밋**

```bash
git add frontend/src/pages/ExpenseForm.tsx
git commit -m "style: ExpenseForm 컬러/라운딩 일관성 통일"
```

---

### Task 2: InsightsPage 스타일 일관성 확인 및 테스트 수정

**Files:**
- Modify: `frontend/src/pages/InsightsPage.tsx`
- Modify: `frontend/src/pages/__tests__/InsightsPage.test.tsx`

**Step 1: InsightsPage focus ring 통일**

`focus:ring-amber-500` → `focus:ring-amber-500/30` (opacity modifier 추가)

**Step 2: 테스트 셀렉터 확인**

`InsightsPage.test.tsx` Line 288: `.bg-amber-600.h-2` 셀렉터가 현재 컴포넌트와 일치하는지 확인. 불일치 시 수정.

**Step 3: 전체 FE 테스트 실행**

Run: `cd frontend && npx vitest run`
Expected: 157 tests PASS

**Step 4: 커밋**

```bash
git add frontend/src/pages/InsightsPage.tsx frontend/src/pages/__tests__/InsightsPage.test.tsx
git commit -m "style: InsightsPage 스타일 일관성 + 테스트 수정"
```

---

### Task 3: 모바일 반응형 점검 및 개선

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`
- Modify: `frontend/src/pages/ExpenseList.tsx`
- Modify: `frontend/src/pages/ExpenseForm.tsx`

**Step 1: Dashboard 모바일 반응형 확인**

- 그리드 레이아웃에 `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` 패턴 적용 확인
- 카드 내부 텍스트 크기 반응형 확인

**Step 2: ExpenseList 테이블 → 카드 전환 (모바일)**

모바일에서 테이블 대신 카드 리스트로 표시되는지 확인. `hidden sm:table-cell` 패턴 확인.

**Step 3: ExpenseForm 모바일 최적화**

- 모드 탭 터치 영역 확보 (min-h-[44px])
- 프리뷰 카드 모바일 스택 레이아웃

**Step 4: 테스트 실행**

Run: `cd frontend && npx vitest run`
Expected: ALL PASS

**Step 5: 커밋**

```bash
git add frontend/src/pages/Dashboard.tsx frontend/src/pages/ExpenseList.tsx frontend/src/pages/ExpenseForm.tsx
git commit -m "style: 핵심 페이지 모바일 반응형 개선"
```

---

## Layer 2: 백엔드 코드 품질

### Task 4: 빈 pyproject.toml 정리 및 의존성 통합

**Files:**
- Delete: `backend/pyproject.toml` (0 bytes, 빈 파일)
- Verify: `pyproject.toml` (루트, 실제 의존성)
- Verify: `backend/requirements.txt` (루트 pyproject.toml과 동기화)

**Step 1: 빈 파일 삭제**

```bash
rm backend/pyproject.toml
```

**Step 2: 루트 pyproject.toml과 requirements.txt 비교**

두 파일의 의존성 목록이 동기화되어 있는지 확인. 불일치 시 pyproject.toml을 기준으로 requirements.txt 업데이트.

**Step 3: 커밋**

```bash
git add -A backend/pyproject.toml backend/requirements.txt pyproject.toml
git commit -m "chore: 빈 backend/pyproject.toml 삭제 + 의존성 동기화"
```

---

### Task 5: Pydantic Settings v2 스타일 마이그레이션

**Files:**
- Modify: `backend/app/core/config.py:48-50`
- Modify: `backend/tests/unit/test_config.py` (있으면)

**Step 1: 기존 테스트 실행**

Run: `cd backend && python -m pytest tests/ -v -k config`
Expected: PASS (현재 상태 확인)

**Step 2: Config class → model_config 전환**

`backend/app/core/config.py` 수정:

```python
# Before (Line 48-50):
class Config:
    env_file = ".env"
    case_sensitive = True

# After:
model_config = SettingsConfigDict(
    env_file=".env",
    case_sensitive=True,
)
```

Import 추가: `from pydantic_settings import BaseSettings, SettingsConfigDict`

**Step 3: 테스트 실행**

Run: `cd backend && python -m pytest tests/ -v`
Expected: ALL PASS (249 pass, 5 skip)

**Step 4: 커밋**

```bash
git add backend/app/core/config.py
git commit -m "refactor: Pydantic Settings v2 model_config 스타일로 전환"
```

---

### Task 6: Float → Numeric 타입 변경 + Alembic 마이그레이션

**Files:**
- Modify: `backend/app/models/expense.py:42` (amount: Float → Numeric)
- Modify: `backend/app/models/budget.py:37` (amount: Float → Numeric)
- Create: Alembic migration
- Modify: `backend/app/schemas/expense.py` (float → Decimal 검토)
- Modify: `backend/app/schemas/budget.py` (float → Decimal 검토)

**Step 1: 기존 테스트 실행 (baseline)**

Run: `cd backend && python -m pytest tests/ -v`
Expected: PASS

**Step 2: 모델 타입 변경**

`backend/app/models/expense.py`:
```python
from sqlalchemy import Numeric
amount = Column(Numeric(12, 2), nullable=False)
```

`backend/app/models/budget.py`:
```python
from sqlalchemy import Numeric
amount = Column(Numeric(12, 2), nullable=False)
# alert_threshold는 Float 유지 (0.0~1.0 비율값)
```

**Step 3: Alembic 마이그레이션 생성**

Run: `cd backend && alembic revision --autogenerate -m "Float to Numeric for monetary fields"`

**Step 4: 스키마 검토**

Pydantic 스키마에서 `float` 타입을 유지 (Numeric은 자동으로 float로 변환됨). JSON 직렬화 호환성 확인.

**Step 5: 테스트 실행**

Run: `cd backend && python -m pytest tests/ -v`
Expected: ALL PASS

**Step 6: 커밋**

```bash
git add backend/app/models/expense.py backend/app/models/budget.py backend/alembic/versions/
git commit -m "refactor: Expense/Budget amount Float → Numeric(12,2) 변경"
```

---

### Task 7: LLM TODO 스텁 정리

**Files:**
- Modify: `backend/app/services/llm_service.py:255-280`

**Step 1: Google/Local Provider 스텁을 명시적 NotImplementedError로 교체**

```python
class GoogleProvider(LLMProvider):
    async def parse_expense(self, text, categories=None, context=None):
        raise NotImplementedError("Google Gemini 프로바이더는 아직 구현되지 않았습니다")

    async def generate_insights(self, expenses, period):
        raise NotImplementedError("Google Gemini 프로바이더는 아직 구현되지 않았습니다")

class LocalLLMProvider(LLMProvider):
    async def parse_expense(self, text, categories=None, context=None):
        raise NotImplementedError("로컬 LLM 프로바이더는 아직 구현되지 않았습니다")

    async def generate_insights(self, expenses, period):
        raise NotImplementedError("로컬 LLM 프로바이더는 아직 구현되지 않았습니다")
```

TODO 주석 제거.

**Step 2: 테스트 실행**

Run: `cd backend && python -m pytest tests/ -v`
Expected: ALL PASS

**Step 3: 커밋**

```bash
git add backend/app/services/llm_service.py
git commit -m "refactor: LLM 미구현 프로바이더 TODO → NotImplementedError 전환"
```

---

### Task 8: 테스트 커버리지 측정 및 보강

**Files:**
- Verify: `backend/tests/`

**Step 1: 커버리지 측정**

Run: `cd backend && python -m pytest --cov=app tests/ --cov-report=term-missing`

**Step 2: 미커버 영역 분석**

커버리지 리포트에서 50% 미만인 모듈 파악. 핵심 서비스(llm_service, expense_context_detector, auth)의 미커버 경로 확인.

**Step 3: 필요시 테스트 추가**

커버리지가 낮은 핵심 경로에 대해 테스트 추가. 80% 이상 목표.

**Step 4: 커밋**

```bash
git add backend/tests/
git commit -m "test: 백엔드 테스트 커버리지 보강"
```

---

## Layer 3: 미완성 기능 구현

### Task 9: 이메일 발송 서비스 (Resend)

**Files:**
- Create: `backend/app/services/email_service.py`
- Modify: `backend/app/core/config.py` (RESEND_API_KEY 추가)
- Modify: `backend/app/api/households.py:515-620` (초대 생성 시 이메일 발송)
- Create: `backend/tests/unit/test_email_service.py`
- Modify: `pyproject.toml` (resend 의존성 추가)

**Step 1: 의존성 추가**

`pyproject.toml`에 `resend>=2.0,<3.0` 추가
Run: `cd /Users/yyong/Developer/homenrich && uv sync --all-extras`

**Step 2: Config에 환경변수 추가**

`backend/app/core/config.py`:
```python
# Email (Resend)
RESEND_API_KEY: str = ""  # 빈 문자열이면 이메일 발송 비활성화
```

**Step 3: 이메일 서비스 작성**

`backend/app/services/email_service.py`:
```python
import resend
from app.core.config import settings

async def send_invitation_email(
    to_email: str,
    household_name: str,
    inviter_name: str,
    invite_token: str,
) -> bool:
    """초대 이메일 발송. API 키 미설정 시 건너뜀."""
    if not settings.RESEND_API_KEY:
        return False  # 이메일 발송 비활성화

    resend.api_key = settings.RESEND_API_KEY
    frontend_url = settings.CORS_ORIGINS.split(",")[0]
    accept_url = f"{frontend_url}/invitations/accept?token={invite_token}"

    resend.Emails.send({
        "from": "HomeNRich <noreply@homenrich.app>",
        "to": [to_email],
        "subject": f"{inviter_name}님이 '{household_name}' 가구에 초대했습니다",
        "html": f"""
        <h2>{inviter_name}님이 HomeNRich 가구에 초대했습니다</h2>
        <p><strong>{household_name}</strong> 가구에 참여하세요.</p>
        <a href="{accept_url}" style="...">초대 수락하기</a>
        <p>이 링크는 7일 후 만료됩니다.</p>
        """,
    })
    return True
```

**Step 4: 초대 생성 API에 이메일 발송 연동**

`backend/app/api/households.py` create_invitation 함수 끝에:
```python
from app.services.email_service import send_invitation_email
# ... (기존 코드 후)
await send_invitation_email(
    to_email=invitation_data.email,
    household_name=household.name,
    inviter_name=inviter.username,
    invite_token=token,
)
```

**Step 5: 테스트 작성**

Mock으로 resend.Emails.send 호출 검증.

**Step 6: 테스트 실행**

Run: `cd backend && python -m pytest tests/ -v`
Expected: ALL PASS

**Step 7: 커밋**

```bash
git add backend/app/services/email_service.py backend/app/core/config.py backend/app/api/households.py backend/tests/unit/test_email_service.py pyproject.toml
git commit -m "feat: Resend 기반 초대 이메일 발송 기능 추가"
```

---

### Task 10: 비밀번호 재설정 API

**Files:**
- Modify: `backend/app/api/auth.py` (forgot-password, reset-password 엔드포인트 추가)
- Modify: `backend/app/core/auth.py` (리셋 토큰 생성/검증)
- Create: `backend/app/schemas/auth.py` (또는 기존 스키마에 추가)
- Create: `backend/tests/integration/test_password_reset.py`

**Step 1: 리셋 토큰 생성 함수 추가**

`backend/app/core/auth.py`:
```python
def create_password_reset_token(email: str) -> str:
    expire = datetime.now(UTC) + timedelta(hours=1)
    return jwt.encode(
        {"sub": email, "type": "password_reset", "exp": expire},
        settings.SECRET_KEY,
        algorithm=ALGORITHM,
    )

def verify_password_reset_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "password_reset":
            return None
        return payload.get("sub")
    except JWTError:
        return None
```

**Step 2: 스키마 추가**

```python
class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)
```

**Step 3: API 엔드포인트 추가**

`POST /api/auth/forgot-password`: 이메일로 리셋 토큰 발송
`POST /api/auth/reset-password`: 토큰 검증 + 비밀번호 변경

**Step 4: 테스트 작성**

- 유효한 이메일로 리셋 요청 → 200
- 존재하지 않는 이메일 → 200 (정보 노출 방지)
- 유효한 토큰으로 비밀번호 변경 → 200
- 만료된 토큰 → 400
- 잘못된 토큰 → 400

**Step 5: 테스트 실행**

Run: `cd backend && python -m pytest tests/ -v`
Expected: ALL PASS

**Step 6: 커밋**

```bash
git add backend/app/api/auth.py backend/app/core/auth.py backend/app/schemas/ backend/tests/integration/test_password_reset.py
git commit -m "feat: 비밀번호 재설정 API (forgot-password, reset-password)"
```

---

### Task 11: 비밀번호 재설정 FE 페이지

**Files:**
- Create: `frontend/src/pages/ForgotPasswordPage.tsx`
- Create: `frontend/src/pages/ResetPasswordPage.tsx`
- Modify: `frontend/src/App.tsx` (라우트 추가)
- Modify: `frontend/src/pages/LoginPage.tsx` ("비밀번호 찾기" 링크 추가)
- Modify: `frontend/src/api/auth.ts` (API 함수 추가)

**Step 1: API 함수 추가**

`frontend/src/api/auth.ts`:
```typescript
export const forgotPassword = (email: string) =>
  api.post('/api/auth/forgot-password', { email })

export const resetPassword = (token: string, new_password: string) =>
  api.post('/api/auth/reset-password', { token, new_password })
```

**Step 2: ForgotPasswordPage 작성**

이메일 입력 → "재설정 링크 전송" 버튼. Amber/Stone 테마.

**Step 3: ResetPasswordPage 작성**

URL 쿼리 파라미터에서 token 추출 → 새 비밀번호 입력 → 변경. Amber/Stone 테마.

**Step 4: 라우트 추가**

`App.tsx`에 public 라우트로 추가:
```tsx
<Route path="/forgot-password" element={<ForgotPasswordPage />} />
<Route path="/reset-password" element={<ResetPasswordPage />} />
```

**Step 5: LoginPage에 링크 추가**

로그인 폼 하단에 "비밀번호를 잊으셨나요?" 링크

**Step 6: 테스트 실행**

Run: `cd frontend && npx vitest run`
Expected: ALL PASS

**Step 7: 커밋**

```bash
git add frontend/src/pages/ForgotPasswordPage.tsx frontend/src/pages/ResetPasswordPage.tsx frontend/src/App.tsx frontend/src/pages/LoginPage.tsx frontend/src/api/auth.ts
git commit -m "feat: 비밀번호 재설정 페이지 (ForgotPassword, ResetPassword)"
```

---

### Task 12: 대시보드 통합 뷰 (공유/개인 분리)

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`
- Modify: `frontend/src/api/expenses.ts` (household별 통계 API 호출)

**Step 1: 현재 Dashboard 구조 확인**

Dashboard가 현재 개인 지출만 표시하는지, household 지출도 포함하는지 확인.

**Step 2: 통합 뷰 구현**

PRODUCT.md D3 결정: "공유 우선 + 개인 접기"
- 상단: 공유 가구 지출 요약 (있으면)
- 하단: 개인 지출 요약 (접기 가능 섹션)

**Step 3: 접기/펼치기 UI**

`useState`로 개인 지출 섹션 토글. 로컬 스토리지에 상태 저장.

**Step 4: 테스트 수정**

Dashboard 테스트가 새 구조와 맞는지 확인.

**Step 5: 테스트 실행**

Run: `cd frontend && npx vitest run`
Expected: ALL PASS

**Step 6: 커밋**

```bash
git add frontend/src/pages/Dashboard.tsx frontend/src/api/expenses.ts
git commit -m "feat: 대시보드 통합 뷰 (공유 우선 + 개인 접기)"
```

---

## Layer 4: 배포 준비

### Task 13: 환경변수 정리 및 .env.example 최신화

**Files:**
- Modify: `backend/.env.example`
- Modify: `frontend/.env.development`

**Step 1: .env.example에 새 변수 추가**

```
RESEND_API_KEY=          # Resend 이메일 API 키 (빈 문자열이면 비활성화)
```

**Step 2: 전체 환경변수 목록 정리**

config.py의 모든 필드가 .env.example에 존재하는지 확인.

**Step 3: 커밋**

```bash
git add backend/.env.example
git commit -m "chore: .env.example 최신화 (RESEND_API_KEY 추가)"
```

---

### Task 14: detect-secrets baseline 업데이트

**Files:**
- Modify: `.secrets.baseline`

**Step 1: baseline 업데이트**

Run: `detect-secrets scan > .secrets.baseline`

**Step 2: 커밋**

```bash
git add .secrets.baseline
git commit -m "chore: detect-secrets baseline 업데이트"
```

---

### Task 15: 최종 QA + 빌드 검증

**Step 1: 백엔드 테스트**

Run: `cd backend && python -m pytest tests/ -v`
Expected: ALL PASS (기존 249 + 새로 추가된 테스트)

**Step 2: ruff 린트/포맷**

Run: `ruff check --fix backend/ && ruff format backend/`
Expected: Clean

**Step 3: 프론트엔드 테스트**

Run: `cd frontend && npx vitest run`
Expected: ALL PASS

**Step 4: 프론트엔드 빌드**

Run: `cd frontend && npm run build`
Expected: 0 errors, 0 warnings

**Step 5: TypeScript 타입 체크**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors

**Step 6: 최종 커밋**

모든 것이 통과하면 final cleanup 커밋 (필요시).

---

### Task 16: IMPLEMENTATION_STATUS.md 및 CLAUDE.md 업데이트

**Files:**
- Modify: `docs/IMPLEMENTATION_STATUS.md`
- Modify: `CLAUDE.md`

**Step 1: 구현 현황 업데이트**

- 이메일 발송: 완료
- 비밀번호 재설정: 완료
- 대시보드 통합 뷰: 완료
- Float → Numeric 전환: 완료
- Pydantic v2 마이그레이션: 완료
- 테스트 수 업데이트

**Step 2: CLAUDE.md 업데이트**

- 새 환경변수 (RESEND_API_KEY)
- 의존성 변경 사항
- 현재 상태 업데이트

**Step 3: 커밋**

```bash
git add docs/IMPLEMENTATION_STATUS.md CLAUDE.md
git commit -m "docs: 구현 현황 및 프로젝트 가이드 업데이트"
```

---

## 요약

| Layer | Tasks | 예상 작업 |
|-------|-------|----------|
| 1. UI/UX | Task 1-3 | 스타일 일관성 수정, 모바일 반응형 |
| 2. BE 품질 | Task 4-8 | 정리, Pydantic v2, Numeric 전환, 커버리지 |
| 3. 미완성 기능 | Task 9-12 | 이메일, 비번 재설정, 대시보드 통합 |
| 4. 배포 | Task 13-16 | 환경변수, QA, 문서 업데이트 |
