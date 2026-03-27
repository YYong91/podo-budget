from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Asset(Base):  # type: ignore[misc]
    __tablename__ = "assets"
    __table_args__ = (
        Index("ix_assets_household_id", "household_id"),
        Index("ix_assets_user_type", "created_by", "type"),
    )

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)  # stock_kr, stock_us, crypto, deposit, real_estate, other, loan
    is_liability = Column(Boolean, nullable=False, default=False)

    # 투자형 (stock/crypto)
    ticker = Column(String, nullable=True)
    quantity = Column(Numeric(18, 8), nullable=True)  # 코인 소수점 대응
    avg_buy_price = Column(Numeric(18, 2), nullable=True)

    # 수동형 (deposit/real_estate/other/loan)
    manual_value = Column(Numeric(18, 2), nullable=True)
    interest_rate = Column(Numeric(5, 2), nullable=True)
    maturity_date = Column(Date, nullable=True)

    # 대출 전용
    repayment_type = Column(String, nullable=True)  # equal_principal_interest, equal_principal, bullet
    monthly_payment = Column(Numeric(18, 2), nullable=True)

    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    memo = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now(), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", backref="assets")
    household = relationship("Household", backref="assets")
    account = relationship("Account", back_populates="assets")
