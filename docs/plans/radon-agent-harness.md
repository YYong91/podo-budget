# Radon 코드 품질 유지보수 에이전트 하네스 설계

## 배경

podo-budget 백엔드에 Python Radon으로 코드 품질 현황을 분석한 결과:

- 391개 함수/메서드 중 83%가 A등급(단순)으로 전체적으로 양호
- 하지만 C등급 이상 20개, D/E등급 4개가 리팩토링 필요
- 가장 심각: `api/chat.py:chat()` CC=38 (E등급)
- 봇 웹훅 3개: telegram_webhook(22), kakao_webhook(23), handle_callback_query(25)

### 현재 복잡도 TOP 20

```
E (38) api/chat.py:79 chat
D (25) api/telegram.py:430 handle_callback_query
D (23) api/kakao.py:120 kakao_webhook
D (22) api/telegram.py:182 telegram_webhook
C (20) api/expenses.py:243 get_stats_comparison
C (18) services/price_service.py:247 get_asset_current_value
C (16) services/budget_service.py:18 get_budget_alerts
C (16) services/llm_service.py:102 parse_expense (Anthropic)
C (16) services/llm_service.py:320 parse_expense (OpenAI)
C (14) core/auth.py:38 get_current_user
C (14) api/budget.py:172 get_monthly_stats
C (13) api/income.py:101 get_income_stats
C (13) api/expenses.py:132 get_stats
C (13) api/expenses.py:461 parse_expense_image
C (13) services/asset_goal_service.py:60 get_goal_with_insight
C (12) services/recurring_service.py:51 calculate_initial_due_date
C (11) schemas/recurring_transaction.py:8 RecurringTransactionBase
C (11) services/budget_service.py:110 get_category_overview
C (11) services/llm_service.py:175 parse_image
C (11) services/admin_service.py:27 get_dashboard_stats
```

### Halstead 난이도 TOP 5

```
difficulty=14.6  bugs=0.77  api/expenses.py
difficulty=12.5  bugs=0.44  api/telegram.py
difficulty=11.3  bugs=0.27  api/budget.py
difficulty=10.8  bugs=0.28  api/kakao.py
difficulty=10.4  bugs=0.22  services/asset_goal_service.py
```

### 규모

- 83개 파일, 7,474 SLOC
- 가장 큰 파일: api/telegram.py (510), api/expenses.py (494), services/llm_service.py (382)

## 목표

Radon 메트릭을 활용한 코드 품질 유지보수 에이전트 하네스를 설계하고 구현한다.

### 핵심 컨셉: 2단계 구조

```
Radon 스캔 (정량 필터링)
  → 고복잡도 후보 추출
  → LLM이 맥락 판단 ("진짜 문제인지, 리팩토링 가치 있는지")
  → GitHub Issue 자동 생성 또는 기존 이슈에 코멘트
```

Radon이 **후보를 줄여주고**, LLM이 **판단**하는 구조.

## 설계 요구사항

### 1. 스캔 & 분석
- `radon cc`, `radon mi`, `radon hal` 실행하여 메트릭 수집
- 이전 실행 결과와 비교하여 **변화량** 감지 (새로 복잡해진 함수, 개선된 함수)
- 결과를 구조화된 JSON으로 저장 (트렌드 추적용)

### 2. LLM 판단
- CC C등급 이상 함수의 소스코드를 읽어서 Claude에게 판단 요청
- 판단 기준: 리팩토링 필요성, 우선순위, 제안하는 분리 방법
- "높은 CC지만 정당한 이유가 있는" 경우를 걸러냄 (예: 웹훅 dispatch는 어쩔 수 없는 분기)

### 3. 액션
- GitHub Issue 자동 생성 (라벨: code-quality, 우선순위 포함)
- 또는 기존 이슈에 복잡도 변화 코멘트
- 주간/월간 품질 리포트 생성

### 4. CI 연동 (선택)
- PR에서 새 코드의 복잡도 체크
- CC 임계값 초과 시 PR 코멘트로 경고

## 구현 시 고려사항

- podo-budget은 `uv`로 의존성 관리 (pyproject.toml)
- radon은 dev dependency로 추가
- 에이전트 스크립트는 `scripts/` 또는 `tools/` 디렉토리에 배치
- 결과 저장소: `.radon/` 또는 `docs/quality/`에 JSON 기록
- GitHub API 연동: `gh` CLI 또는 PyGithub
