"""피드백 모델

사용자가 기능 요청이나 버그 신고를 제출할 수 있는 Feedback 엔티티입니다.
관리자만 전체 피드백을 조회하고 상태를 변경할 수 있습니다.
"""

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Feedback(Base):  # type: ignore[misc]
    """피드백 엔티티

    Attributes:
        id: 피드백 고유 식별자 (Primary Key)
        user_id: 제출한 사용자 ID (Foreign Key)
        type: 피드백 유형 ("feature" | "bug")
        title: 피드백 제목
        content: 피드백 내용
        status: 처리 상태 ("new" | "read" | "done")
        source: 제출 경로 ("web" | "telegram" | "kakao")
        created_at: 생성 시각
        updated_at: 수정 시각
    """

    __tablename__ = "feedbacks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(String, nullable=False)  # "feature" | "bug"
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    status = Column(String, nullable=False, default="new")  # "new" | "read" | "done"
    source = Column(String, nullable=False, default="web")  # "web" | "telegram" | "kakao"
    created_at = Column(DateTime, default=func.now(), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User")
