from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Course(Base):
    __tablename__ = "courses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    code = Column(String(50), unique=True, nullable=False, index=True)
    faculty_id = Column(Integer, ForeignKey("faculty.id"), nullable=False, index=True)
    capacity_required = Column(Integer, nullable=False, default=30)
    duration_minutes = Column(Integer, nullable=False, default=60)

    faculty = relationship("Faculty", back_populates="courses")
    timetable_entries = relationship("TimetableEntry", back_populates="course")
