from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models.timetable import ScheduleRun, TimetableEntry
from app.schemas.timetable import (
    TimetableDetailResponse,
    TimetableEntryResponse,
    TimetableAnalyticsResponse,
)

router = APIRouter(tags=["Timetable"])


@router.get("/schedules", response_model=List[Dict[str, Any]])
def list_schedules(db: Session = Depends(get_db)):
    runs = db.query(ScheduleRun).order_by(ScheduleRun.id.desc()).limit(20).all()
    return [
        {
            "id": r.id,
            "generated_at": r.generated_at,
            "status": r.status,
            "total_courses_scheduled": r.total_courses_scheduled,
            "solver_time_ms": r.solver_time_ms,
        }
        for r in runs
    ]


@router.get("/schedule/{schedule_id}", response_model=TimetableDetailResponse)
def get_schedule(schedule_id: int, db: Session = Depends(get_db)):
    run = (
        db.query(ScheduleRun)
        .options(
            joinedload(ScheduleRun.entries).joinedload(TimetableEntry.course),
            joinedload(ScheduleRun.entries).joinedload(TimetableEntry.faculty),
            joinedload(ScheduleRun.entries).joinedload(TimetableEntry.venue),
            joinedload(ScheduleRun.entries).joinedload(TimetableEntry.slot),
        )
        .filter(ScheduleRun.id == schedule_id)
        .first()
    )

    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Timetable run with ID {schedule_id} not found",
        )

    formatted_entries = []
    for e in run.entries:
        formatted_entries.append(
            TimetableEntryResponse(
                id=e.id,
                course_id=e.course_id,
                course_name=e.course.name if e.course else f"Course {e.course_id}",
                course_code=e.course.code if e.course else f"C{e.course_id}",
                faculty_id=e.faculty_id,
                faculty_name=e.faculty.name if e.faculty else f"Faculty {e.faculty_id}",
                venue_id=e.venue_id,
                venue_name=e.venue.name if e.venue else f"Venue {e.venue_id}",
                slot_id=e.slot_id,
                day_of_week=e.slot.day_of_week if e.slot else "Monday",
                start_time=e.slot.start_time if e.slot else "09:00",
                end_time=e.slot.end_time if e.slot else "10:00",
            )
        )

    return TimetableDetailResponse(
        id=run.id,
        generated_at=run.generated_at,
        status=run.status,
        solver_status=run.solver_status,
        solver_time_ms=run.solver_time_ms,
        total_time_ms=run.total_time_ms,
        total_courses_scheduled=run.total_courses_scheduled,
        conflict_count=run.conflict_count,
        conflicts_resolved=run.conflicts_resolved,
        metrics=run.metrics or {},
        entries=formatted_entries,
    )


@router.get("/analytics/schedule/{schedule_id}", response_model=TimetableAnalyticsResponse)
def get_schedule_analytics(schedule_id: int, db: Session = Depends(get_db)):
    run = db.query(ScheduleRun).filter(ScheduleRun.id == schedule_id).first()
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Timetable run with ID {schedule_id} not found",
        )

    metrics = run.metrics or {}
    return TimetableAnalyticsResponse(
        schedule_id=run.id,
        faculty_workload=metrics.get("faculty_workload", {}),
        venue_utilization=metrics.get("venue_utilization", {}),
        preference_satisfaction_percentage=metrics.get("preference_satisfaction_percentage", 100.0),
        time_slot_fill_rate_percentage=metrics.get("time_slot_fill_rate_percentage", 0.0),
        conflicts_resolved_count=run.conflicts_resolved,
        solver_efficiency=metrics.get(
            "solver_efficiency",
            {"solver_time_ms": run.solver_time_ms, "courses_scheduled_per_second": 0},
        ),
    )
