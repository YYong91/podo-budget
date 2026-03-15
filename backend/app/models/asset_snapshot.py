from sqlalchemy import Column, Date, DateTime, ForeignKey, Index, Integer, Numeric, Text
from sqlalchemy.sql import func

from app.core.database import Base


class AssetSnapshot(Base):
    __tablename__ = "asset_snapshots"
    __table_args__ = (Index("ix_asset_snapshots_household_date", "household_id", "snapshot_date"),)

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    snapshot_date = Column(Date, nullable=False)
    total_assets = Column(Numeric(18, 2), nullable=False, default=0)
    total_liabilities = Column(Numeric(18, 2), nullable=False, default=0)
    net_worth = Column(Numeric(18, 2), nullable=False, default=0)
    breakdown = Column(Text, nullable=True)  # JSON string: 유형별 합산
    created_at = Column(DateTime, default=func.now())
