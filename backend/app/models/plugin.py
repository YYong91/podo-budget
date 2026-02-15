"""플러그인 상태 모델

각 플러그인의 활성화/비활성화 상태와 사용자별 설정을 저장합니다.
"""

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from app.core.database import Base


class PluginState(Base):
    """사용자별 플러그인 활성 상태 및 설정

    Attributes:
        id: 고유 식별자
        user_id: 플러그인을 사용하는 사용자 ID
        plugin_id: 플러그인 식별자 (예: "csv_export", "budget_alert")
        enabled: 활성화 여부
        config_json: 플러그인별 설정 (JSON 문자열)
        created_at: 레코드 생성 시각
        updated_at: 레코드 수정 시각
    """

    __tablename__ = "plugin_states"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    plugin_id = Column(String(100), nullable=False, index=True)
    enabled = Column(Boolean, default=False, nullable=False)
    config_json = Column(Text, nullable=True)  # JSON 문자열로 저장
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
