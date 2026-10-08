from sqlalchemy import Column, Integer, String, Float, JSON
from app.database import Base


class CustomConstraint(Base):
    __tablename__ = "constraints"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(20), nullable=False, default="hard")  # "hard" or "soft"
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    weight = Column(Float, nullable=False, default=1.0)
    constraint_data = Column(JSON, default=dict)
