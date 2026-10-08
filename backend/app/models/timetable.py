from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class ScheduleRun(Base):
    __tablename__ = "schedule_runs"

    id = Column(Integer, primary_key=True, index=True)
    generated_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    status = Column(String(50), default="completed", nullable=False)  # completed, optimal, feasible, infeasible, timeout
    solver_status = Column(String(50), nullable=True)
    solver_time_ms = Column(Float, default=0.0)
    total_time_ms = Column(Float, default=0.0)
    total_courses_scheduled = Column(Integer, default=0)
    conflict_count = Column(Integer, default=0)
    conflicts_resolved = Column(Integer, default=0)
    metrics = Column(JSON, default=dict)

    entries = relationship("TimetableEntry", back_populates="schedule_run", cascade="all, delete-orphan")


class TimetableEntry(Base):
    __tablename__ = "timetable_entries"

    id = Column(Integer, primary_key=True, index=True)
    schedule_run_id = Column(Integer, ForeignKey("schedule_runs.id"), nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False, index=True)
    faculty_id = Column(Integer, ForeignKey("faculty.id"), nullable=False, index=True)
    venue_id = Column(Integer, ForeignKey("venues.id"), nullable=False, index=True)
    slot_id = Column(Integer, ForeignKey("time_slots.id"), nullable=False, index=True)

    schedule_run = relationship("ScheduleRun", back_populates="entries")
    course = relationship("Course", back_populates="timetable_entries")
    faculty = relationship("Faculty", back_populates="timetable_entries")
    venue = relationship("Venue", back_populates="timetable_entries")
    slot = relationship("TimeSlot", back_populates="timetable_entries")
