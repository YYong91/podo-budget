from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Budget(Base):
    __tablename__ = "budgets"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    amount = Column(Float, nullable=False)
    period = Column(String, nullable=False)  # monthly, weekly, daily
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=True)
    alert_threshold = Column(Float, default=0.8)  # 80% 도달시 경고
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    category = relationship("Category", back_populates="budgets")
