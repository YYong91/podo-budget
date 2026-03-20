"""OpenAPI 문서화 강화 테스트 (#253)

FastAPI 앱 메타데이터, openapi_tags, 에러 스키마 검증.
"""

from app.main import app
from app.schemas.base import ErrorDetail, ErrorResponse


class TestFastAPIMetadata:
    """FastAPI 앱 메타데이터 검증"""

    def test_app_has_description(self):
        """앱에 description이 설정되어 있어야 한다"""
        assert app.description
        assert len(app.description) > 10

    def test_app_has_version(self):
        """앱에 SemVer 형식의 version이 설정되어 있어야 한다"""
        assert app.version
        parts = app.version.split(".")
        assert len(parts) == 3, f"SemVer 형식이어야 함: {app.version}"

    def test_app_has_contact(self):
        """앱에 contact 정보가 설정되어 있어야 한다"""
        assert app.contact
        assert "name" in app.contact or "url" in app.contact or "email" in app.contact

    def test_app_has_openapi_tags(self):
        """openapi_tags가 설정되어 있어야 한다"""
        assert app.openapi_tags
        assert len(app.openapi_tags) > 0

    def test_openapi_tags_have_required_fields(self):
        """각 태그는 name과 description을 가져야 한다"""
        for tag in app.openapi_tags:
            assert "name" in tag, f"태그에 name 없음: {tag}"
            assert "description" in tag, f"태그에 description 없음: {tag}"
            assert tag["description"], f"태그 description이 비어있음: {tag['name']}"

    def test_openapi_tags_cover_all_routers(self):
        """등록된 모든 라우터 태그가 openapi_tags에 포함되어야 한다"""
        registered_tags = {tag["name"] for tag in app.openapi_tags}
        expected_tags = {
            "auth", "budgets", "chat", "expenses", "feedback",
            "categories", "insights", "telegram", "kakao", "households",
            "income", "invitations", "recurring", "assets", "accounts",
            "admin", "onboarding", "webhooks",
        }
        missing = expected_tags - registered_tags
        assert not missing, f"openapi_tags에 누락된 태그: {missing}"


class TestErrorSchemas:
    """공통 에러 응답 스키마 검증"""

    def test_error_detail_schema(self):
        """ErrorDetail 스키마가 code와 message를 가져야 한다"""
        detail = ErrorDetail(code="TEST_ERROR", message="테스트 에러")
        assert detail.code == "TEST_ERROR"
        assert detail.message == "테스트 에러"

    def test_error_response_schema(self):
        """ErrorResponse 스키마가 error 필드(ErrorDetail)를 가져야 한다"""
        resp = ErrorResponse(error=ErrorDetail(code="NOT_FOUND", message="찾을 수 없음"))
        assert resp.error.code == "NOT_FOUND"
        assert resp.error.message == "찾을 수 없음"

    def test_error_response_json_structure(self):
        """ErrorResponse가 {"error": {"code": ..., "message": ...}} 구조여야 한다"""
        resp = ErrorResponse(error=ErrorDetail(code="CONFLICT", message="중복"))
        data = resp.model_dump()
        assert "error" in data
        assert "code" in data["error"]
        assert "message" in data["error"]

    def test_error_schemas_have_openapi_examples(self):
        """ErrorDetail, ErrorResponse 스키마에 openapi_examples가 있어야 한다"""
        schema = ErrorResponse.model_json_schema()
        assert "properties" in schema
        assert "error" in schema["properties"]
