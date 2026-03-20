"""
이미지 OCR 지출 파싱 API 통합 테스트

- POST /api/expenses/ocr - 이미지 업로드 → 지출 파싱
"""

import io
from unittest.mock import AsyncMock, patch

import pytest


@pytest.mark.asyncio
async def test_ocr_invalid_file_type(authenticated_client):
    """이미지가 아닌 파일 업로드 시 400 반환"""
    fake_file = io.BytesIO(b"not an image")
    response = await authenticated_client.post(
        "/api/expenses/ocr",
        files={"file": ("test.txt", fake_file, "text/plain")},
    )
    assert response.status_code == 400
    assert "이미지 파일" in response.json()["detail"]


@pytest.mark.asyncio
async def test_ocr_file_too_large(authenticated_client):
    """10MB 초과 파일 업로드 시 400 반환"""
    large_file = io.BytesIO(b"x" * (10 * 1024 * 1024 + 1))
    response = await authenticated_client.post(
        "/api/expenses/ocr",
        files={"file": ("big.jpg", large_file, "image/jpeg")},
    )
    assert response.status_code == 400
    assert "10MB" in response.json()["detail"]


@pytest.mark.asyncio
async def test_ocr_success_single_expense(authenticated_client):
    """이미지 OCR 성공 — 단건 지출 파싱"""
    mock_parsed = {
        "amount": 8000,
        "description": "스타벅스",
        "category": "식비",
        "date": "2026-02-26",
        "memo": "",
    }

    fake_image = io.BytesIO(b"\xff\xd8\xff" + b"\x00" * 100)  # 최소 JPEG 헤더

    with patch("app.api.expenses.get_llm_provider") as mock_get_provider:
        mock_provider = AsyncMock()
        mock_provider.parse_image = AsyncMock(return_value=mock_parsed)
        mock_get_provider.return_value = mock_provider

        response = await authenticated_client.post(
            "/api/expenses/ocr",
            files={"file": ("receipt.jpg", fake_image, "image/jpeg")},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["parsed_expenses"] is not None
    assert len(data["parsed_expenses"]) == 1
    item = data["parsed_expenses"][0]
    assert item["amount"] == 8000
    assert item["description"] == "스타벅스"
    assert item["category"] == "식비"


@pytest.mark.asyncio
async def test_ocr_success_multiple_expenses(authenticated_client):
    """이미지 OCR 성공 — 다건 지출 파싱 (거래내역 화면)"""
    mock_parsed = [
        {"amount": 8000, "description": "스타벅스", "category": "식비", "date": "2026-02-26", "memo": ""},
        {"amount": 15000, "description": "쿠팡", "category": "쇼핑", "date": "2026-02-26", "memo": ""},
    ]

    fake_image = io.BytesIO(b"\xff\xd8\xff" + b"\x00" * 100)

    with patch("app.api.expenses.get_llm_provider") as mock_get_provider:
        mock_provider = AsyncMock()
        mock_provider.parse_image = AsyncMock(return_value=mock_parsed)
        mock_get_provider.return_value = mock_provider

        response = await authenticated_client.post(
            "/api/expenses/ocr",
            files={"file": ("history.jpg", fake_image, "image/jpeg")},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["parsed_expenses"] is not None
    assert len(data["parsed_expenses"]) == 2
    assert "2건" in data["message"]
    assert "₩23,000" in data["message"]


@pytest.mark.asyncio
async def test_ocr_no_payment_found(authenticated_client):
    """이미지에서 결제 정보 인식 실패 — 에러 메시지 반환"""
    mock_parsed = {"error": "결제 정보를 찾을 수 없습니다"}

    fake_image = io.BytesIO(b"\xff\xd8\xff" + b"\x00" * 100)

    with patch("app.api.expenses.get_llm_provider") as mock_get_provider:
        mock_provider = AsyncMock()
        mock_provider.parse_image = AsyncMock(return_value=mock_parsed)
        mock_get_provider.return_value = mock_provider

        response = await authenticated_client.post(
            "/api/expenses/ocr",
            files={"file": ("unclear.jpg", fake_image, "image/jpeg")},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["parsed_expenses"] is None
    assert "결제 정보를 찾을 수 없습니다" in data["message"]


@pytest.mark.asyncio
async def test_ocr_png_format(authenticated_client):
    """PNG 이미지도 정상 처리"""
    mock_parsed = {"amount": 5000, "description": "GS25", "category": "식비", "date": "2026-02-26", "memo": ""}

    fake_image = io.BytesIO(b"\x89PNG\r\n" + b"\x00" * 100)

    with patch("app.api.expenses.get_llm_provider") as mock_get_provider:
        mock_provider = AsyncMock()
        mock_provider.parse_image = AsyncMock(return_value=mock_parsed)
        mock_get_provider.return_value = mock_provider

        response = await authenticated_client.post(
            "/api/expenses/ocr",
            files={"file": ("screenshot.png", fake_image, "image/png")},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["parsed_expenses"] is not None
    assert data["parsed_expenses"][0]["amount"] == 5000


@pytest.mark.asyncio
async def test_ocr_requires_auth(client):
    """인증 없이 OCR 요청 시 401 반환"""
    fake_image = io.BytesIO(b"\xff\xd8\xff" + b"\x00" * 100)
    response = await client.post(
        "/api/expenses/ocr",
        files={"file": ("receipt.jpg", fake_image, "image/jpeg")},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_ocr_magic_bytes_mismatch_jpeg(authenticated_client):
    """Content-Type은 image/jpeg인데 실제 내용이 다른 경우 400 반환 (#237)"""
    # JPEG 헤더(FF D8 FF)가 아닌 임의 데이터 전송
    fake_file = io.BytesIO(b"PK\x03\x04" + b"\x00" * 100)  # ZIP 파일 헤더
    response = await authenticated_client.post(
        "/api/expenses/ocr",
        files={"file": ("evil.jpg", fake_file, "image/jpeg")},
    )
    assert response.status_code == 400
    assert "이미지" in response.json()["detail"]


@pytest.mark.asyncio
async def test_ocr_magic_bytes_mismatch_png(authenticated_client):
    """Content-Type은 image/png인데 실제 내용이 다른 경우 400 반환 (#237)"""
    fake_file = io.BytesIO(b"\xff\xd8\xff" + b"\x00" * 100)  # JPEG를 PNG로 위장
    response = await authenticated_client.post(
        "/api/expenses/ocr",
        files={"file": ("evil.png", fake_file, "image/png")},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_ocr_magic_bytes_valid_jpeg(authenticated_client):
    """올바른 JPEG 매직 바이트(FF D8 FF) + image/jpeg → 통과 (#237)"""
    from unittest.mock import AsyncMock, patch

    mock_parsed = {"amount": 8000, "description": "스타벅스", "category": "식비", "date": "2026-02-26", "memo": ""}
    valid_jpeg = io.BytesIO(b"\xff\xd8\xff\xe0" + b"\x00" * 100)

    with patch("app.api.expenses.get_llm_provider") as mock_get_provider:
        mock_provider = AsyncMock()
        mock_provider.parse_image = AsyncMock(return_value=mock_parsed)
        mock_get_provider.return_value = mock_provider

        response = await authenticated_client.post(
            "/api/expenses/ocr",
            files={"file": ("valid.jpg", valid_jpeg, "image/jpeg")},
        )

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_ocr_magic_bytes_valid_png(authenticated_client):
    """올바른 PNG 매직 바이트(89 50 4E 47) + image/png → 통과 (#237)"""
    from unittest.mock import AsyncMock, patch

    mock_parsed = {"amount": 5000, "description": "GS25", "category": "식비", "date": "2026-02-26", "memo": ""}
    valid_png = io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)

    with patch("app.api.expenses.get_llm_provider") as mock_get_provider:
        mock_provider = AsyncMock()
        mock_provider.parse_image = AsyncMock(return_value=mock_parsed)
        mock_get_provider.return_value = mock_provider

        response = await authenticated_client.post(
            "/api/expenses/ocr",
            files={"file": ("valid.png", valid_png, "image/png")},
        )

    assert response.status_code == 200
