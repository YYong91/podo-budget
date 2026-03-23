from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Account(Base):
    """계좌/증권계좌/거래소 계정"""

    __tablename__ = "accounts"
    __table_args__ = (Index("ix_accounts_household_id", "household_id"),)

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)  # 예: "키움증권", "KB국민은행", "업비트"
    type = Column(String, nullable=False)  # brokerage, bank, crypto_exchange, other
    institution = Column(String, nullable=True)  # 기관명 (선택)
    memo = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now(), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", backref="accounts")
    household = relationship("Household", backref="accounts")
    assets = relationship("Asset", back_populates="account")
