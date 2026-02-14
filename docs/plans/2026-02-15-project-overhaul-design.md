# HomeNRich 프로젝트 전체 정비 설계서

**작성일**: 2026-02-15
**브랜치**: feature/ui-redesign (계속 사용)
**접근법**: 레이어별 순차 정비 (A)

---

## 개요

기존 코드베이스를 유지하면서 4개 레이어를 순차적으로 정비한다:
1. UI/UX 완성
2. 백엔드 코드 품질
3. 미완성 기능 구현
4. 배포 준비

---

## 레이어 1: UI/UX 완성

### 1-1. 미완성 리디자인 페이지 마무리

미변환 페이지 목록:
- CategoryManager — 옛 색상 클래스 + 이모지 아이콘
- BudgetManager — 옛 색상 클래스 + 이모지 아이콘
- InsightsPage — bg-primary-600 등 구 클래스
- HouseholdListPage — 미변환
- HouseholdDetailPage — 미변환
- InvitationListPage — 미변환
- ExpenseForm — 일부 섹션(프리뷰/폼) 미완성
- CreateHouseholdModal, InviteMemberModal — 색상 미변환

변환 규칙:
- `bg-primary-*` → `bg-amber-*` / `bg-stone-*`
- `text-primary-*` → `text-amber-*` / `text-stone-*`
- 이모지 아이콘 → lucide-react 아이콘
- 일관된 rounded, shadow, hover 효과

### 1-2. 테스트 수정

리디자인으로 깨진 테스트 수정:
- InsightsPage 테스트 (progress bar 클래스 셀렉터)
- 기타 UI 변경으로 인한 셀렉터/텍스트 불일치

### 1-3. 모바일 반응형

핵심 페이지 모바일 최적화: Dashboard, ExpenseForm, ExpenseList

---

## 레이어 2: 백엔드 코드 품질

### 2-1. 프로젝트 구조 정리
- backend/pyproject.toml 빈 파일 삭제
- backend/requirements.txt ↔ 루트 pyproject.toml 동기화 확인

### 2-2. 타입 안전성 강화
- Expense.amount: Float → Numeric(12,2) + Alembic 마이그레이션
- Budget 모델 동일 적용

### 2-3. TODO 해결
- llm_service.py Google Gemini / Local LLM 스텁 정리

### 2-4. 테스트 커버리지
- pytest --cov=app tests/ 실행
- 핵심 서비스 커버리지 80% 이상 목표

### 2-5. 코드 정리
- Pydantic Settings Config class → model_config 전환 확인
- ruff 린트 규칙 재점검

---

## 레이어 3: 미완성 기능 구현

### 3-1. 이메일 발송 (초대)
- Resend API 연동 (무료 100통/일)
- 초대 시 이메일 발송 (가구명, 초대자명, 수락 링크)
- 환경변수: RESEND_API_KEY

### 3-2. 비밀번호 재설정
- POST /api/auth/forgot-password — 이메일로 리셋 토큰 발송
- POST /api/auth/reset-password — 토큰 + 새 비밀번호
- FE: 비밀번호 찾기 + 재설정 페이지

### 3-3. 초대 승인 페이지 (FE)
- /invite/{token} 라우트
- 로그인 여부에 따른 분기 처리

### 3-4. 대시보드 통합 뷰
- 공유 지출 요약 상단, 개인 지출 접기 가능 레이아웃

---

## 레이어 4: 배포 준비

### 4-1. Fly.io 재정비
- fly.toml 재점검 (리소스, 헬스체크)
- 환경변수 정리

### 4-2. 환경변수 / 시크릿 정리
- .env.example 최신화
- detect-secrets baseline 업데이트

### 4-3. 최종 QA
- 전체 테스트 통과
- ruff lint/format 클린
- Docker Compose 전체 스택 테스트
- npm run build 확인

---

## 의사결정 기록

- 접근법: 레이어별 순차 정비 (안정성 우선)
- 브랜치: feature/ui-redesign에서 계속 진행
- 이메일: Resend 사용 (개발자 친화적, 무료 티어 충분)
- 비밀번호 리셋: JWT 토큰 방식 (DB 추가 테이블 불필요)
