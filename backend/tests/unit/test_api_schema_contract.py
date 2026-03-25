"""API 스키마 계약 테스트 (#364)

app.openapi()를 호출하여 현재 스키마를 추출하고,
엔드포인트/스키마 기준선을 assertion으로 검증한다.
스냅샷 파일 대신 assertion 기반으로 유지보수 부담을 최소화.

검증 항목:
- 엔드포인트 수 기준선 (의도치 않은 삭제 방지)
- 필수 엔드포인트 존재 (핵심 API 보호)
- 필수 스키마 모델 존재 (응답 모델 보호)
- response_model 설정 여부
"""

from app.main import app

# --- 필수 엔드포인트 목록 (삭제되면 안 되는 핵심 API) ---
REQUIRED_ENDPOINTS = [
    # 인증
    "/api/auth/me",
    # 지출 CRUD
    "/api/expenses",
    "/api/expenses/{expense_id}",
    # 수입 CRUD
    "/api/income",
    "/api/income/{income_id}",
    # 카테고리
    "/api/categories",
    # 예산
    "/api/budgets",
    # 인사이트
    "/api/insights/generate",
    # 채팅 (자연어 입력)
    "/api/chat",
    # 가구
    "/api/households",
    # 정기 거래
    "/api/recurring",
    # 자산
    "/api/assets",
    # 계좌
    "/api/accounts",
]

# --- 필수 스키마 모델 목록 (삭제되면 안 되는 응답 모델) ---
REQUIRED_SCHEMAS = [
    "ExpenseResponse",
    "IncomeResponse",
    "CategoryResponse",
    "BudgetResponse",
    "HouseholdResponse",
    "RecurringTransactionResponse",
    "UserResponse",
]

# --- 기준선 (현재 70 엔드포인트, 94 스키마 기준 — 여유 있게 하한 설정) ---
MIN_ENDPOINT_COUNT = 50
MIN_SCHEMA_COUNT = 60


def _get_openapi_schema() -> dict:
    """앱의 OpenAPI 스키마를 추출한다"""
    return app.openapi()


class TestEndpointContract:
    """엔드포인트 계약 검증"""

    def test_minimum_endpoint_count(self):
        """엔드포인트 수가 기준선 이상이어야 한다 (의도치 않은 삭제 방지)"""
        schema = _get_openapi_schema()
        paths = schema.get("paths", {})
        assert (
            len(paths) >= MIN_ENDPOINT_COUNT
        ), f"엔드포인트가 {MIN_ENDPOINT_COUNT}개 이상이어야 하지만 {len(paths)}개만 존재. 의도치 않은 라우터 삭제 확인 필요."

    def test_required_endpoints_exist(self):
        """핵심 API 엔드포인트가 모두 존재해야 한다"""
        schema = _get_openapi_schema()
        paths = set(schema.get("paths", {}).keys())
        missing = [ep for ep in REQUIRED_ENDPOINTS if ep not in paths]
        assert not missing, f"필수 엔드포인트가 누락되었습니다: {missing}\n현재 등록된 경로 수: {len(paths)}"

    def test_all_endpoints_have_methods(self):
        """모든 엔드포인트에 최소 1개의 HTTP 메서드가 정의되어 있어야 한다"""
        schema = _get_openapi_schema()
        empty_paths = []
        for path, methods in schema.get("paths", {}).items():
            # OpenAPI의 path item에서 HTTP 메서드만 필터링
            http_methods = {m for m in methods if m in {"get", "post", "put", "patch", "delete"}}
            if not http_methods:
                empty_paths.append(path)
        assert not empty_paths, f"HTTP 메서드가 없는 엔드포인트: {empty_paths}"

    def test_crud_endpoints_have_expected_methods(self):
        """CRUD 엔드포인트에 기대하는 HTTP 메서드가 있어야 한다"""
        schema = _get_openapi_schema()
        paths = schema.get("paths", {})

        # 지출 목록: GET + POST
        if "/api/expenses" in paths:
            methods = set(paths["/api/expenses"].keys())
            assert "get" in methods, "/api/expenses에 GET 메서드가 없습니다"
            assert "post" in methods, "/api/expenses에 POST 메서드가 없습니다"

        # 지출 상세: GET + PUT + DELETE
        if "/api/expenses/{expense_id}" in paths:
            methods = set(paths["/api/expenses/{expense_id}"].keys())
            assert "get" in methods, "/api/expenses/{expense_id}에 GET이 없습니다"
            assert "delete" in methods, "/api/expenses/{expense_id}에 DELETE가 없습니다"


class TestSchemaContract:
    """스키마 모델 계약 검증"""

    def test_minimum_schema_count(self):
        """스키마 모델 수가 기준선 이상이어야 한다"""
        schema = _get_openapi_schema()
        schemas = schema.get("components", {}).get("schemas", {})
        assert len(schemas) >= MIN_SCHEMA_COUNT, f"스키마가 {MIN_SCHEMA_COUNT}개 이상이어야 하지만 {len(schemas)}개만 존재. 의도치 않은 스키마 삭제 확인 필요."

    def test_required_schemas_exist(self):
        """핵심 응답 스키마 모델이 모두 존재해야 한다"""
        schema = _get_openapi_schema()
        schemas = set(schema.get("components", {}).get("schemas", {}).keys())
        missing = [s for s in REQUIRED_SCHEMAS if s not in schemas]
        assert not missing, f"필수 스키마가 누락되었습니다: {missing}\n현재 등록된 스키마 수: {len(schemas)}"

    def test_response_schemas_have_properties(self):
        """필수 응답 스키마에 properties가 정의되어 있어야 한다"""
        schema = _get_openapi_schema()
        schemas = schema.get("components", {}).get("schemas", {})
        empty_schemas = []
        for name in REQUIRED_SCHEMAS:
            if name in schemas:
                schema_def = schemas[name]
                # properties가 직접 있거나 allOf/anyOf 등으로 정의될 수 있음
                has_props = "properties" in schema_def or "allOf" in schema_def or "anyOf" in schema_def or "$ref" in schema_def
                if not has_props:
                    empty_schemas.append(name)
        assert not empty_schemas, f"properties가 없는 응답 스키마: {empty_schemas}"


class TestResponseModelCoverage:
    """response_model 설정 검증"""

    def test_endpoints_with_response_models(self):
        """response_model이 설정된 엔드포인트가 충분해야 한다

        FastAPI에서 response_model을 설정하면 OpenAPI 스키마의
        responses에 $ref가 포함된다.
        """
        schema = _get_openapi_schema()
        paths = schema.get("paths", {})

        total_operations = 0
        operations_with_schema = 0

        for _path, methods in paths.items():
            for method, operation in methods.items():
                if method not in {"get", "post", "put", "patch", "delete"}:
                    continue
                total_operations += 1

                # 200/201 응답에 스키마가 있는지 확인
                responses = operation.get("responses", {})
                for status_code in ("200", "201"):
                    if status_code in responses:
                        content = responses[status_code].get("content", {})
                        if "application/json" in content:
                            json_schema = content["application/json"].get("schema", {})
                            if json_schema:
                                operations_with_schema += 1
                                break

        # 최소 50% 이상의 엔드포인트에 response_model이 설정되어야 함
        assert total_operations > 0, "엔드포인트가 하나도 없습니다"
        coverage = operations_with_schema / total_operations
        assert coverage >= 0.5, f"response_model 커버리지가 50% 미만입니다: {operations_with_schema}/{total_operations} ({coverage:.0%})"

    def test_openapi_info_fields(self):
        """OpenAPI info 필드가 올바르게 설정되어 있어야 한다"""
        schema = _get_openapi_schema()
        info = schema.get("info", {})
        assert info.get("title"), "OpenAPI title이 없습니다"
        assert info.get("version"), "OpenAPI version이 없습니다"
