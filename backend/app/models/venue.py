from sqlalchemy import Column, Integer, String, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class Venue(Base):
    __tablename__ = "venues"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    capacity = Column(Integer, nullable=False)
    equipment = Column(JSON, default=list)
    available_slots = Column(JSON, default=list)

    timetable_entries = relationship("TimetableEntry", back_populates="venue")
