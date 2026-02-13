"""자연어 지출 컨텍스트 탐지 서비스 단위 테스트

detect_expense_context()와 resolve_household_id()의 동작을 검증합니다.

테스트 시나리오:
- 공유 키워드 감지: "우리", "같이", "함께" 등
- 개인 키워드 감지: "내", "나만", "혼자" 등
- 키워드 충돌/미감지 시 None 반환
- resolve_household_id() 우선순위 검증
"""

import pytest

from app.services.expense_context_detector import (
    PERSONAL_KEYWORDS,
    detect_expense_context,
    resolve_household_id,
)

# ──────────────────────────────────────────────
# detect_expense_context() 테스트
# ──────────────────────────────────────────────


class TestDetectExpenseContext:
    """자연어 컨텍스트 탐지 함수 테스트"""

    # --- 공유 키워드 감지 ---

    def test_shared_keyword_우리(self):
        assert detect_expense_context("우리 저녁 5만원") == "shared"

    def test_shared_keyword_같이(self):
        assert detect_expense_context("같이 먹은 점심 15000원") == "shared"

    def test_shared_keyword_함께(self):
        assert detect_expense_context("함께 장본 거 8만원") == "shared"

    def test_shared_keyword_공동(self):
        assert detect_expense_context("공동 구매 3만원") == "shared"

    def test_shared_keyword_가족(self):
        assert detect_expense_context("가족 외식 12만원") == "shared"

    def test_shared_keyword_공유(self):
        assert detect_expense_context("공유 차량 주유 5만원") == "shared"

    def test_shared_keyword_조사_포함(self):
        """'우리가', '우리는' 등 조사 포함 시에도 감지"""
        assert detect_expense_context("우리가 먹은 점심") == "shared"
        assert detect_expense_context("우리는 저녁") == "shared"

    # --- 개인 키워드 감지 ---

    def test_personal_keyword_내(self):
        assert detect_expense_context("내 점심 8000원") == "personal"

    def test_personal_keyword_나만(self):
        assert detect_expense_context("나만 먹은 간식 3000원") == "personal"

    def test_personal_keyword_혼자(self):
        assert detect_expense_context("혼자 커피 5000원") == "personal"

    def test_personal_keyword_개인(self):
        assert detect_expense_context("개인 용품 구매 2만원") == "personal"

    def test_personal_keyword_개인적(self):
        assert detect_expense_context("개인적으로 산 책 15000원") == "personal"

    # --- 키워드 미감지 → None ---

    def test_no_keywords_returns_none(self):
        """키워드가 없으면 None 반환 (기본값 적용)"""
        assert detect_expense_context("점심 8000원") is None

    def test_empty_string_returns_none(self):
        assert detect_expense_context("") is None

    def test_whitespace_only_returns_none(self):
        assert detect_expense_context("   ") is None

    # --- 키워드 충돌 → None ---

    def test_both_shared_and_personal_returns_none(self):
        """공유+개인 키워드 동시 존재 시 판단 불가"""
        assert detect_expense_context("우리 중 내 몫 2만원") is None

    # --- 모호한 키워드 제외 확인 ---

    def test_가구_furniture_not_detected_as_shared(self):
        """'가구 구입'은 공유 키워드로 잡히면 안 됨 (v2에서 제거됨)"""
        assert detect_expense_context("가구 구입 10만원") is None

    def test_집_not_detected_as_shared(self):
        """'집'은 모호하므로 공유 키워드에서 제거됨"""
        assert detect_expense_context("집 근처 카페 5000원") is None

    # --- 단독 '나'는 개인 키워드 목록에서 제거 확인 ---

    def test_나_alone_not_in_personal_keywords(self):
        """단독 '나'는 너무 포괄적이라 키워드 목록에서 제거됨"""
        assert "나" not in PERSONAL_KEYWORDS

    # --- 일반적인 문장에서 오탐 방지 ---

    def test_no_false_positive_general_text(self):
        """일반적인 지출 문장에서 오탐 없음"""
        assert detect_expense_context("커피 4500원") is None
        assert detect_expense_context("택시비 12000원") is None
        assert detect_expense_context("마트에서 장보기 5만원") is None


# ──────────────────────────────────────────────
# resolve_household_id() 테스트
# ──────────────────────────────────────────────


class TestResolveHouseholdId:
    """household_id 결정 우선순위 테스트"""

    @pytest.mark.asyncio
    async def test_explicit_id_takes_priority(self):
        """명시적 household_id가 최우선"""
        result = await resolve_household_id(
            message="우리 점심 8000원",
            explicit_household_id=42,
            user_active_household_id=1,
        )
        assert result == 42

    @pytest.mark.asyncio
    async def test_shared_context_uses_active_household(self):
        """공유 키워드 → 활성 가구 ID 반환"""
        result = await resolve_household_id(
            message="우리 저녁 5만원",
            explicit_household_id=None,
            user_active_household_id=10,
        )
        assert result == 10

    @pytest.mark.asyncio
    async def test_personal_context_returns_none(self):
        """개인 키워드 → None (개인 지출)"""
        result = await resolve_household_id(
            message="내 점심 8000원",
            explicit_household_id=None,
            user_active_household_id=10,
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_no_context_defaults_to_active(self):
        """키워드 없음 → 활성 가구 기본값 (PRODUCT.md D2: 가구 있으면 공유)"""
        result = await resolve_household_id(
            message="점심 8000원",
            explicit_household_id=None,
            user_active_household_id=10,
        )
        assert result == 10

    @pytest.mark.asyncio
    async def test_no_context_no_household_returns_none(self):
        """키워드 없음 + 활성 가구 없음 → None (개인 지출)"""
        result = await resolve_household_id(
            message="점심 8000원",
            explicit_household_id=None,
            user_active_household_id=None,
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_shared_context_but_no_household_returns_none(self):
        """공유 키워드 있지만 활성 가구 없음 → None"""
        result = await resolve_household_id(
            message="우리 저녁 5만원",
            explicit_household_id=None,
            user_active_household_id=None,
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_explicit_none_still_checks_context(self):
        """explicit_household_id=None 일 때 컨텍스트 탐지 수행"""
        result = await resolve_household_id(
            message="혼자 커피 5000원",
            explicit_household_id=None,
            user_active_household_id=5,
        )
        assert result is None
