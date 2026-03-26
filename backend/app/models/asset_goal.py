"""순자산 목표 모델

사용자(또는 가구)의 순자산 목표를 저장합니다.
사용자/가구 당 하나의 활성 목표만 유지합니다.
"""

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Numeric
from sqlalchemy.sql import func

from app.core.database import Base


class AssetGoal(Base):  # type: ignore[misc]
    __tablename__ = "asset_goals"

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    target_net_worth = Column(Numeric(18, 2), nullable=False)
    target_date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=func.now(), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), server_default=func.now(), nullable=False)
