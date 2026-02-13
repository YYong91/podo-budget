"""자연어 지출 입력의 공유/개인 컨텍스트 탐지

사용자의 자연어 입력에서 공유 키워드와 개인 키워드를 감지하여
해당 지출이 가구 공유인지 개인인지 판단한다.

사용 예:
- "우리 저녁 5만원" → 공유 (household_id 설정)
- "나 혼자 점심 8000원" → 개인 (household_id 없음)
- "점심 8000원" → 기본값 적용 (가구 1개면 공유, 없으면 개인)
"""

import re

# 공유 키워드: 가구 전체에 해당하는 지출
# 주의: "집", "가구"는 가구(furniture) 구입과 혼동되어 제거됨
SHARED_KEYWORDS = [
    "우리",
    "같이",
    "함께",
    "공동",
    "가족",
    "공유",
]

# 개인 키워드: 본인만의 지출
# 주의: "나"는 너무 포괄적이므로 제외, "나만", "나 혼자" 등 명확한 표현만 사용
PERSONAL_KEYWORDS = [
    "내",
    "나만",
    "개인",
    "혼자",
    "개인적",
]

# 한국어 조사 패턴: 키워드 뒤에 올 수 있는 일반적인 조사들
_PARTICLES = r"[을를이가은는의도와과에서로으로]"

# 정규식 패턴: 단어 경계를 고려한 매칭
_shared_pattern = re.compile("|".join(rf"(?:^|\s){re.escape(kw)}(?:\s|$|{_PARTICLES})" for kw in SHARED_KEYWORDS))
_personal_pattern = re.compile("|".join(rf"(?:^|\s){re.escape(kw)}(?:\s|$|{_PARTICLES})" for kw in PERSONAL_KEYWORDS))


def detect_expense_context(message: str) -> str | None:
    """자연어 메시지에서 공유/개인 컨텍스트를 감지

    Returns:
        "shared" - 공유 지출 (household_id 필요)
        "personal" - 개인 지출 (household_id 없음)
        None - 판단 불가 (기본값 사용)
    """
    text = message.strip()
    if not text:
        return None

    has_shared = bool(_shared_pattern.search(text))
    has_personal = bool(_personal_pattern.search(text))

    # 둘 다 있거나 둘 다 없으면 판단 불가
    if has_shared == has_personal:
        return None

    return "shared" if has_shared else "personal"


async def resolve_household_id(
    message: str,
    explicit_household_id: int | None,
    user_active_household_id: int | None,
) -> int | None:
    """메시지 컨텍스트 + 명시적 ID + 활성 가구를 종합하여 household_id 결정

    우선순위:
    1. 요청에서 명시적으로 지정한 household_id
    2. 자연어 컨텍스트 탐지 결과
    3. 사용자의 활성 가구 (기본값)
    """
    # 1) 명시적 지정이 있으면 그대로 사용
    if explicit_household_id is not None:
        return explicit_household_id

    # 2) 자연어 컨텍스트 분석
    context = detect_expense_context(message)
    if context == "personal":
        return None
    if context == "shared" and user_active_household_id is not None:
        return user_active_household_id

    # 3) 기본값: 활성 가구 사용
    return user_active_household_id
