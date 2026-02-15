"""플러그인 스키마"""

from datetime import datetime

from pydantic import BaseModel, Field


class PluginInfo(BaseModel):
    """플러그인 메타데이터 (레지스트리에서 반환)"""

    id: str = Field(..., description="플러그인 고유 식별자")
    name: str = Field(..., description="플러그인 표시 이름")
    description: str = Field(..., description="플러그인 설명")
    version: str = Field(..., description="플러그인 버전")
    category: str = Field(..., description="플러그인 카테고리 (export, notification, analysis)")
    enabled: bool = Field(False, description="현재 사용자의 활성화 상태")
    config_schema: dict | None = Field(None, description="플러그인 설정 JSON Schema")
    config: dict | None = Field(None, description="현재 사용자의 설정값")


class PluginToggleRequest(BaseModel):
    """플러그인 활성화/비활성화 요청"""

    enabled: bool


class PluginConfigUpdate(BaseModel):
    """플러그인 설정 업데이트 요청"""

    config: dict


class PluginStateResponse(BaseModel):
    """플러그인 상태 응답"""

    plugin_id: str
    enabled: bool
    config: dict | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class PluginExecuteRequest(BaseModel):
    """플러그인 실행 요청 (액션 플러그인용)"""

    params: dict = Field(default_factory=dict, description="실행 파라미터")


class PluginExecuteResponse(BaseModel):
    """플러그인 실행 응답"""

    success: bool
    message: str
    data: dict | None = None
