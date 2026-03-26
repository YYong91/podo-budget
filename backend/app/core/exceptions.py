"""전역 에러 핸들링 - 구조화된 에러 응답"""

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, SQLAlchemyError


def register_exception_handlers(app: FastAPI) -> None:
    """FastAPI 앱에 전역 예외 핸들러 등록"""

    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
        # str(exc) 전달 금지 — SQLAlchemy 쿼리, 파일 경로, 모델 구조 등 내부 정보 노출 위험
        # Sentry에 전체 스택트레이스를 기록하고 사용자에게는 일반 메시지만 반환
        sentry_sdk.capture_exception(exc)
        return JSONResponse(
            status_code=400,
            content={"error": {"code": "VALIDATION_ERROR", "message": "잘못된 요청입니다"}},
        )

    @app.exception_handler(IntegrityError)
    async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
        return JSONResponse(
            status_code=409,
            content={"error": {"code": "CONFLICT", "message": "데이터 무결성 오류가 발생했습니다"}},
        )

    @app.exception_handler(SQLAlchemyError)
    async def sqlalchemy_error_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
        # 500 에러만 Sentry에 보고 (DB 레벨 서버 오류)
        sentry_sdk.capture_exception(exc)
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "DATABASE_ERROR", "message": "데이터베이스 오류가 발생했습니다"}},
        )

    @app.exception_handler(Exception)
    async def general_error_handler(request: Request, exc: Exception) -> JSONResponse:
        # 500 에러만 Sentry에 보고 (예상치 못한 서버 오류)
        sentry_sdk.capture_exception(exc)
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "INTERNAL_ERROR", "message": "서버 내부 오류가 발생했습니다"}},
        )
