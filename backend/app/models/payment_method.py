"""결제수단 엔티티 모델

사용자별 결제수단(카드, 현금 등)을 관리하는 PaymentMethod 엔티티입니다.
household_id를 통해 가구 단위로 관리되며, created_by로 생성자를 추적합니다.
is_default는 사용자별(created_by) 1개만 활성화됩니다.
"""

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.sql import func

from app.core.database import Base


class PaymentMethod(Base):  # type: ignore[misc]
    """결제수단 엔티티

    Attributes:
        id: 결제수단 고유 식별자 (Primary Key)
        household_id: 소속 가구 ID (Foreign Key, NOT NULL)
        created_by: 결제수단을 생성한 사용자 ID (Foreign Key, NOT NULL)
        name: 결제수단 이름 (예: "삼성카드", "현금")
        type: 결제수단 유형 (credit_card, debit_card, cash, transfer)
        monthly_target: 월 실적 목표 금액 (null = 추적 안 함)
        billing_day: 결제일 (v2용, 현재 미사용)
        is_default: 기본 결제수단 여부 (사용자별 1개)
        is_active: 활성 상태 (soft delete용)
        created_at: 레코드 생성 시각
        updated_at: 레코드 수정 시각
    """

    __tablename__ = "payment_methods"
    __table_args__ = (Index("ix_payment_methods_household_user", "household_id", "created_by"),)

    id = Column(Integer, primary_key=True, index=True)
    household_id = Column(Integer, ForeignKey("households.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    type = Column(String(20), nullable=False)  # credit_card, debit_card, cash, transfer
    monthly_target = Column(Numeric(12, 2), nullable=True)  # 월 실적 목표 (null = 추적 안 함)
    billing_day = Column(Integer, nullable=True)  # 결제일 (v2용, 현재 미사용)
    is_default = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    display_order = Column(Integer, nullable=False, default=0, server_default="0")  # 목록 표시 순서 (낮을수록 앞)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
