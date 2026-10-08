from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.faculty import FacultyCreate, FacultyResponse
from app.schemas.venue import VenueCreate, VenueResponse
from app.schemas.slot import TimeSlotCreate, TimeSlotResponse
from app.schemas.course import CourseCreate, CourseResponse
from app.schemas.constraint import ConstraintCreate, ConstraintResponse


class GenerateScheduleRequest(BaseModel):
    faculty: List[FacultyCreate]
    venues: List[VenueCreate]
    slots: List[TimeSlotCreate]
    courses: List[CourseCreate]
    constraints: Optional[List[ConstraintCreate]] = Field(default_factory=list)
    timeout_seconds: Optional[int] = Field(default=5, ge=1, le=30)


class RescheduleRequest(BaseModel):
    timetable_id: int
    unseated_slot_ids: Optional[List[int]] = Field(default_factory=list, description="Slots that became invalid")
    unavailable_venue_ids: Optional[List[int]] = Field(default_factory=list, description="Venues temporarily offline")
    unavailable_faculty_slots: Optional[Dict[int, List[int]]] = Field(
        default_factory=dict,
        description="Faculty ID mapped to slot IDs they can no longer attend",
    )
    timeout_seconds: Optional[int] = Field(default=5, ge=1, le=30)


class TimetableEntryResponse(BaseModel):
    id: Optional[int] = None
    course_id: int
    course_name: str
    course_code: str
    faculty_id: int
    faculty_name: str
    venue_id: int
    venue_name: str
    slot_id: int
    day_of_week: str
    start_time: str
    end_time: str

    model_config = ConfigDict(from_attributes=True)


class SolverStats(BaseModel):
    status: str
    solver_time_ms: float
    total_time_ms: float
    total_courses_scheduled: int
    total_courses_requested: int
    conflict_count: int
    conflicts_resolved: int
    gap_from_optimum: Optional[float] = 0.0


class TimetableResponse(BaseModel):
    schedule_id: int
    status: str
    generated_at: datetime
    stats: SolverStats
    schedule: List[TimetableEntryResponse]
    analytics: Optional[Dict[str, Any]] = None


class TimetableDetailResponse(BaseModel):
    id: int
    generated_at: datetime
    status: str
    solver_status: Optional[str] = None
    solver_time_ms: float
    total_time_ms: float
    total_courses_scheduled: int
    conflict_count: int
    conflicts_resolved: int
    metrics: Dict[str, Any] = Field(default_factory=dict)
    entries: List[TimetableEntryResponse]

    model_config = ConfigDict(from_attributes=True)


class TimetableAnalyticsResponse(BaseModel):
    schedule_id: int
    faculty_workload: Dict[str, Dict[str, Any]]
    venue_utilization: Dict[str, Dict[str, Any]]
    preference_satisfaction_percentage: float
    time_slot_fill_rate_percentage: float
    conflicts_resolved_count: int
    solver_efficiency: Dict[str, Any]
