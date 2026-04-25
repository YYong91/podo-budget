"""카테고리 정정 신호 모델

사용자가 거래 카테고리를 수정할 때 자동 저장됩니다.
Phase 2에서 임베딩을 추가하여 RAG 기반 유사 사례 검색에 활용합니다.
"""

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.core.database import Base


class CategoryCorrection(Base):  # type: ignore[misc]
    """카테고리 정정 신호

    Attributes:
        id: 고유 식별자
        household_id: 가구 ID (스코프 분리 — 다른 가구 정정과 섞이지 않음)
        user_id: 정정한 사용자 ID (NULL 허용 — 봇 등 비인증 경로 대비)
        input_text: 거래 설명 (예: "쿠팡 우유") — 임베딩 대상 텍스트
        category_id: 사용자가 선택한 카테고리 ID (정답 레이블)
        source: 정정 경로 ("edit" = 거래 수정)
        created_at: 정정 시각
    """

    __tablename__ = "category_corrections"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(
        Integer,
        ForeignKey("households.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    input_text = Column(String, nullable=False)
    category_id = Column(
        Integer,
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
    )
    source = Column(String, nullable=False, default="edit")
    created_at = Column(DateTime, default=func.now(), server_default=func.now(), nullable=False)
