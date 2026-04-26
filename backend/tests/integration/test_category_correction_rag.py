"""카테고리 정정 RAG 전체 플로우 통합 테스트

정정 신호 저장 → 임베딩 생성 → RAG 검색 → 프롬프트 주입의 엔드-투-엔드 플로우를 검증한다.
"""

from unittest.mock import AsyncMock, patch

import pytest

# 1536차원 단위 벡터 (OpenAI text-embedding-3-small 출력 차원)
MOCK_VECTOR = [1.0] + [0.0] * 1535


@pytest.mark.asyncio
async def test_correction_captured_and_used_in_next_parse(
    authenticated_client,
    test_household,
    test_user,
    db_session,
):
    """정정 저장 → 다음 파싱 시 RAG로 활용되는 전체 플로우

    1. 지출 생성
    2. 카테고리 수정 → 정정 신호 + 임베딩 저장
    3. 다음 채팅 파싱 시 correction_hints가 LLM에 전달되는지 확인
    """
    from sqlalchemy import select

    from app.models.category import Category
    from app.models.category_correction import CategoryCorrection

    # 식비 카테고리 생성
    food_cat = Category(name="식비", household_id=None, user_id=None)
    db_session.add(food_cat)
    await db_session.flush()

    # Step 1: 지출 생성 (카테고리 없이)
    create_resp = await authenticated_client.post(
        "/api/expenses",
        json={
            "description": "쿠팡 우유",
            "amount": 2800,
            "date": "2026-04-26",
            "household_id": test_household.id,
        },
    )
    assert create_resp.status_code == 201
    expense_id = create_resp.json()["id"]

    # Step 2: 카테고리 수정 → 정정 신호 + 임베딩 저장
    with patch(
        "app.services.correction_service.get_embedding",
        new=AsyncMock(return_value=MOCK_VECTOR),
    ):
        update_resp = await authenticated_client.put(
            f"/api/expenses/{expense_id}",
            json={"category_id": food_cat.id},
        )
    assert update_resp.status_code == 200

    # 정정 레코드 + 임베딩 저장 확인
    result = await db_session.execute(select(CategoryCorrection).where(CategoryCorrection.household_id == test_household.id))
    correction = result.scalar_one()
    assert correction.input_text == "쿠팡 우유"
    assert correction.category_id == food_cat.id
    assert correction.embedding == MOCK_VECTOR

    # Step 3: 다음 채팅 파싱 시 correction_hints가 LLM에 전달되는지 확인
    captured_kwargs: dict = {}

    async def mock_parse(self, text, **kwargs):  # noqa: ANN001
        captured_kwargs.update(kwargs)
        return {
            "amount": 3000,
            "description": "쿠팡 두부",
            "category": "식비",
            "date": "2026-04-26",
        }

    with (
        patch(
            "app.services.correction_service.get_embedding",
            new=AsyncMock(return_value=MOCK_VECTOR),
        ),
        patch(
            "app.services.llm_service.AnthropicProvider.parse_expense",
            mock_parse,
        ),
    ):
        chat_resp = await authenticated_client.post(
            "/api/chat",
            json={"message": "쿠팡 두부 3000원", "household_id": test_household.id},
        )

    # 채팅 응답 성공 여부 확인 (201 Created 또는 200 OK)
    assert chat_resp.status_code in (200, 201)
    # correction_hints가 LLM 파싱 함수에 전달되었는지 확인
    assert captured_kwargs.get("correction_hints") is not None


@pytest.mark.asyncio
async def test_rag_graceful_degradation_when_no_openai_key(
    authenticated_client,
    test_household,
    db_session,
):
    """OPENAI_API_KEY 없어도 채팅 파싱은 정상 동작한다

    임베딩 API 호출 실패 시 RAG를 건너뛰고 기존 LLM 분류로 폴백한다.
    """
    with (
        patch(
            "app.services.correction_service.get_embedding",
            new=AsyncMock(side_effect=Exception("API key not set")),
        ),
        patch(
            "app.services.llm_service.AnthropicProvider.parse_expense",
            new=AsyncMock(
                return_value={
                    "amount": 5000,
                    "description": "편의점",
                    "category": "식비",
                    "date": "2026-04-26",
                }
            ),
        ),
    ):
        resp = await authenticated_client.post(
            "/api/chat",
            json={"message": "편의점 5000원", "household_id": test_household.id},
        )

    # 임베딩 실패와 무관하게 채팅 응답이 성공해야 한다
    assert resp.status_code in (200, 201)
