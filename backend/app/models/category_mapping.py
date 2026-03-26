"""카테고리 매핑 모델

LLM이 제안한 카테고리 이름을 사용자의 기존 카테고리로 매핑합니다.
예: "식비" → "외식비" (사용자가 한 번 선택하면 다음부터 자동 적용)

스코프: 가구(household_id) 또는 개인(user_id) 단위로 매핑 관리
"""

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.sql import func

from app.core.database import Base


class CategoryMapping(Base):  # type: ignore[misc]
    """카테고리 별칭 매핑

    Attributes:
        id: 매핑 고유 식별자
        user_id: 매핑 소유자 (개인 스코프)
        household_id: 가구 스코프 (가구 멤버 공유)
        source_name: LLM이 제안한 카테고리 이름 (예: "식비")
        target_category_id: 매핑 대상 카테고리 ID (예: "외식비"의 ID)
        created_at: 매핑 생성 시각
    """

    __tablename__ = "category_mappings"
    __table_args__ = (UniqueConstraint("source_name", "household_id", "user_id", name="uq_category_mapping_scope"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    source_name = Column(String, nullable=False)  # LLM이 제안한 이름
    target_category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=func.now(), server_default=func.now(), nullable=False)
