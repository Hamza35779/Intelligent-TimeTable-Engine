from sqlalchemy import Column, Integer, String, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class Faculty(Base):
    __tablename__ = "faculty"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False, index=True)
    department = Column(String(100), nullable=False, index=True)
    max_hours_per_day = Column(Integer, default=6)
    max_days_per_week = Column(Integer, default=5)
    email = Column(String(150), unique=True, index=True, nullable=False)
    preferences = Column(JSON, default=dict)
    unavailable_slots = Column(JSON, default=list)

    courses = relationship("Course", back_populates="faculty")
    timetable_entries = relationship("TimetableEntry", back_populates="faculty")
