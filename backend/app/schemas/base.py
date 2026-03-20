"""공통 스키마 베이스

여러 스키마에서 재사용되는 공통 validator와 mixin (#179)
공통 에러 응답 스키마 추가 (#253)
"""

from typing import Any

from pydantic import BaseModel, field_validator


class ErrorDetail(BaseModel):
    """에러 상세 정보 — {"code": "...", "message": "..."}"""

    code: str
    message: str

    model_config = {
        "json_schema_extra": {
            "examples": [
                {"code": "VALIDATION_ERROR", "message": "잘못된 요청입니다"},
                {"code": "NOT_FOUND", "message": "리소스를 찾을 수 없습니다"},
                {"code": "CONFLICT", "message": "데이터 무결성 오류가 발생했습니다"},
                {"code": "INTERNAL_ERROR", "message": "서버 내부 오류가 발생했습니다"},
            ]
        }
    }


class ErrorResponse(BaseModel):
    """공통 에러 응답 — 모든 4xx/5xx 응답의 표준 형식 (#253)

    예시:
        {"error": {"code": "NOT_FOUND", "message": "리소스를 찾을 수 없습니다"}}
    """

    error: ErrorDetail

    model_config = {"json_schema_extra": {"example": {"error": {"code": "NOT_FOUND", "message": "리소스를 찾을 수 없습니다"}}}}


class DateTimeCoerceMixin(BaseModel):
    """YYYY-MM-DD 문자열 → datetime 자동 변환 mixin

    Pydantic v2는 기본적으로 날짜만 있는 문자열을 datetime으로 파싱하지 못함.
    프론트엔드 date input (YYYY-MM-DD) 및 LLM이 반환하는 날짜 형식과 호환되도록
    T00:00:00을 자동으로 추가한다.
    """

    @field_validator("date", mode="before", check_fields=False)
    @classmethod
    def coerce_date_to_datetime(cls, v: Any) -> Any:
        if isinstance(v, str) and len(v) == 10 and "T" not in v and " " not in v:
            return f"{v}T00:00:00"
        return v
