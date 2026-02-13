# User Isolation Fix - Summary

## Problem (문제)

Telegram과 Kakao 봇 웹훅에서 생성된 지출이 사용자와 연결되지 않아, 모든 봇 사용자의 데이터가 섞이는 심각한 보안 문제가 있었습니다.

### 기존 코드의 문제점
```python
# 기존: user_id 없이 지출 생성
expense = Expense(
    amount=parsed["amount"],
    description=parsed.get("description", user_text),
    category_id=category.id,
    raw_input=user_text,
    date=expense_date,
    # user_id가 없음! ⚠️
)
```

이로 인해:
- 텔레그램 사용자 A가 생성한 지출을 사용자 B도 볼 수 있음
- 카카오 사용자 간에도 동일한 데이터 유출 발생
- `/report`, `/budget` 명령어가 모든 사용자의 데이터를 집계

## Solution (해결책)

### 1. 봇 사용자 관리 서비스 생성

**파일**: `/Users/yyong/Developer/homenrich/backend/app/services/bot_user_service.py`

```python
async def get_or_create_bot_user(db: AsyncSession, platform: str, platform_user_id: str) -> User:
    """봇 플랫폼 사용자를 찾거나 생성한다

    WHY: 봇 사용자 간 데이터 격리를 위해 각 플랫폼 사용자마다 고유한 User를 생성합니다.

    username 규칙: {platform}_{platform_user_id}
    예: "telegram_12345", "kakao_user_abc123"
    """
```

**주요 기능**:
- 플랫폼과 사용자 ID 조합으로 고유한 username 생성
- 기존 사용자가 있으면 재사용, 없으면 자동 생성
- 봇 사용자는 랜덤 비밀번호 해시로 User 모델 제약 충족
- 이메일 없이 is_active=True로 생성

### 2. Telegram 봇 웹훅 수정

**파일**: `/Users/yyong/Developer/homenrich/backend/app/api/telegram.py`

**변경사항**:
1. 모든 메시지에서 봇 사용자 조회/생성
   ```python
   bot_user = await get_or_create_bot_user(db, platform="telegram", platform_user_id=str(chat_id))
   ```

2. 지출 생성 시 user_id 연결
   ```python
   expense = Expense(
       user_id=bot_user.id,  # ✅ 사용자 연결
       amount=parsed["amount"],
       ...
   )
   ```

3. 카테고리 생성 시 user_id 전달
   ```python
   category = await get_or_create_category(db, category_name, user_id=bot_user.id)
   ```

4. `/report`, `/budget` 명령어에 user_id 필터 추가
   ```python
   .where(Expense.user_id == user_id)
   .where(Budget.user_id == user_id)
   ```

### 3. Kakao 봇 웹훅 수정

**파일**: `/Users/yyong/Developer/homenrich/backend/app/api/kakao.py`

Telegram과 동일한 패턴으로 수정:
- `kakao_{user_id}` 형식의 username으로 봇 사용자 생성
- 모든 Expense에 user_id 연결
- 모든 조회 쿼리에 user_id 필터 적용

### 4. 테스트 추가

#### 단위 테스트
**파일**: `/Users/yyong/Developer/homenrich/backend/tests/unit/test_bot_user_service.py`

- 새 사용자 자동 생성 검증
- 기존 사용자 재사용 검증
- 플랫폼별 격리 검증
- username 형식 검증
- 중복 생성 방지 검증

#### 통합 테스트
**파일**: `/Users/yyong/Developer/homenrich/backend/tests/integration/test_api_telegram.py`
**파일**: `/Users/yyong/Developer/homenrich/backend/tests/integration/test_api_kakao.py`

추가된 테스트:
1. `test_webhook_user_isolation` - 서로 다른 봇 사용자의 데이터 격리 검증
2. `test_webhook_same_user_reuses_account` - 동일 사용자의 계정 재사용 검증

기존 테스트 수정:
- 모든 expense 생성 테스트에 `user_id is not None` 검증 추가

## Results (결과)

### 테스트 통과 현황
```
194 passed, 2 skipped in 33.03s
```

### 추가된 테스트
- 봇 사용자 서비스 단위 테스트: 8개
- Telegram 봇 격리 통합 테스트: 2개
- Kakao 봇 격리 통합 테스트: 2개

### 데이터 격리 보장
- ✅ 각 봇 사용자는 고유한 User 계정을 가짐
- ✅ 모든 Expense는 user_id와 연결됨
- ✅ 조회 시 user_id 필터로 자신의 데이터만 표시
- ✅ User 테이블에서 봇 사용자 추적 가능

## Architecture (아키텍처)

### 데이터 흐름

```
Telegram/Kakao 메시지
    ↓
Webhook 수신 (chat_id 또는 user.id 추출)
    ↓
get_or_create_bot_user() 호출
    ↓
User 조회/생성 (username: platform_chatid)
    ↓
Expense 생성 (user_id 연결)
    ↓
사용자별 격리된 데이터 저장
```

### 레이어 구조

```
[Presentation Layer]
- telegram.py, kakao.py (webhook handlers)

[Application Layer]
- bot_user_service.py (봇 사용자 관리)
- category_service.py (카테고리 관리)

[Domain Layer]
- User, Expense, Category models
```

### DDD 패턴 적용

1. **Application Service** (`bot_user_service`)
   - 봇 사용자 생성/조회 로직 캡슐화
   - 여러 봇 플랫폼에서 재사용 가능

2. **Value Object 패턴**
   - username을 "{platform}_{platform_user_id}" 형식으로 표준화

3. **Repository 패턴**
   - AsyncSession을 통한 User 조회/저장

## Migration Guide (마이그레이션 가이드)

### 기존 데이터 처리

⚠️ **중요**: 이 수정으로 기존에 user_id=None으로 생성된 지출은 조회되지 않습니다.

운영 환경에 배포 시:

1. 기존 데이터를 마이그레이션하거나
2. Expense.user_id를 nullable=True로 유지하되, 조회 시 `or Expense.user_id.is_(None)` 조건 추가

현재 상태:
- Expense.user_id는 nullable=True (점진적 마이그레이션 지원)
- 새로 생성되는 모든 지출은 user_id 보장

### 배포 체크리스트

- [ ] 테스트 환경에서 봇 동작 확인
- [ ] Telegram 봇: 서로 다른 사용자가 데이터 격리 확인
- [ ] Kakao 봇: 서로 다른 사용자가 데이터 격리 확인
- [ ] `/report`, `/budget` 명령어가 자신의 데이터만 표시하는지 확인
- [ ] 기존 데이터 마이그레이션 계획 수립

## Korean Comments (한글 주석)

모든 새 코드는 프로젝트 규칙에 따라 한글 주석을 포함합니다:

```python
# WHY를 중심으로 작성
"""봇 플랫폼 사용자 관리 서비스

WHY: 봇 사용자 간 데이터 격리를 위해 각 플랫폼 사용자마다 고유한 User를 생성합니다.
"""

# 비즈니스 로직의 이유 설명
# 봇 사용자 생성 또는 조회 (데이터 격리를 위함)
bot_user = await get_or_create_bot_user(db, platform="telegram", platform_user_id=str(chat_id))

# 도메인 규칙 명시
# Expense 생성 (user_id 연결로 데이터 격리)
expense = Expense(user_id=bot_user.id, ...)
```

## Files Changed (변경된 파일)

### 새로 생성된 파일
1. `/Users/yyong/Developer/homenrich/backend/app/services/bot_user_service.py`
2. `/Users/yyong/Developer/homenrich/backend/tests/unit/test_bot_user_service.py`

### 수정된 파일
1. `/Users/yyong/Developer/homenrich/backend/app/api/telegram.py`
2. `/Users/yyong/Developer/homenrich/backend/app/api/kakao.py`
3. `/Users/yyong/Developer/homenrich/backend/tests/integration/test_api_telegram.py`
4. `/Users/yyong/Developer/homenrich/backend/tests/integration/test_api_kakao.py`

## Conclusion (결론)

✅ **User Isolation 문제 완전히 해결**
- 모든 봇 지출이 사용자와 연결됨
- 테스트로 격리 보장 검증
- 194개 테스트 모두 통과
- Clean Architecture 원칙 준수
- 한글 주석으로 유지보수성 확보

---

작성일: 2026-02-13
테스트: 194 passed, 2 skipped
