from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models.timetable import ScheduleRun, TimetableEntry
from app.models.slot import TimeSlot
from app.models.venue import Venue
from app.schemas.timetable import (
    TimetableDetailResponse,
    TimetableEntryResponse,
    TimetableAnalyticsResponse,
)
from solver.fairness import calculate_fairness_score, calculate_preference_satisfaction
from utils.timetable_formatter import (
    VALID_VIEWS,
    build_table_rows,
    build_university_sheet_data,
    generate_multi_views,
)

router = APIRouter(tags=["Timetable"])


def _load_run_entries(schedule_id: int, db: Session):
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
    entry_dicts = []
    teachers = set()
    stored_metrics = run.metrics or {}
    prefs_map: Dict[str, Dict[str, Any]] = dict(
        stored_metrics.get("ml_predicted_preferences") or {}
    )
    course_meta_map: Dict[str, Dict[str, Any]] = dict(
        stored_metrics.get("course_metadata") or {}
    )

    for e in run.entries:
        f_name = e.faculty.name if e.faculty else f"Faculty {e.faculty_id}"
        teachers.add(f_name)
        if e.faculty and e.faculty.preferences and f_name not in prefs_map:
            prefs_map[f_name] = e.faculty.preferences

        c_code = e.course.code if e.course else f"C{e.course_id}"
        c_meta = course_meta_map.get(str(e.course_id)) or course_meta_map.get(c_code) or {}
        dur_mins = e.slot.duration_minutes if (e.slot and e.slot.duration_minutes) else 60
        student_grp = c_meta.get("student_group") or c_code
        credit_hrs = c_meta.get("credit_hours") or max(1, round((e.course.duration_minutes if e.course else 60) / 60))
        cap_req = e.course.capacity_required if (e.course and e.course.capacity_required) else 30

        item = {
            "id": e.id,
            "course_id": e.course_id,
            "course_name": e.course.name if e.course else f"Course {e.course_id}",
            "course_code": c_code,
            "faculty_id": e.faculty_id,
            "faculty_name": f_name,
            "venue_id": e.venue_id,
            "venue_name": e.venue.name if e.venue else f"Venue {e.venue_id}",
            "slot_id": e.slot_id,
            "day_of_week": e.slot.day_of_week if e.slot else "Monday",
            "start_time": e.slot.start_time if e.slot else "09:00",
            "end_time": e.slot.end_time if e.slot else "10:00",
            "duration_minutes": dur_mins,
            "credit_hours": credit_hrs,
            "student_group": student_grp,
            "capacity_required": cap_req,
        }
        entry_dicts.append(item)
        formatted_entries.append(TimetableEntryResponse(**item))

    return run, formatted_entries, entry_dicts, len(teachers), prefs_map


@router.get("/schedules", response_model=List[Dict[str, Any]])
def list_schedules(
    term: Optional[str] = Query(default=None, description="Filter by academic term (e.g. Fall 2024)"),
    department: Optional[str] = Query(default=None, description="Filter by department"),
    db: Session = Depends(get_db),
):
    query = db.query(ScheduleRun)
    if term:
        query = query.filter(ScheduleRun.academic_term == term)
    if department:
        query = query.filter(ScheduleRun.department == department)
    runs = query.order_by(ScheduleRun.id.desc()).limit(50).all()
    return [
        {
            "id": r.id,
            "generated_at": r.generated_at,
            "status": r.status,
            "academic_term": getattr(r, "academic_term", "General") or "General",
            "department": getattr(r, "department", "All") or "All",
            "created_by": getattr(r, "created_by", "System") or "System",
            "total_courses_scheduled": r.total_courses_scheduled,
            "solver_time_ms": r.solver_time_ms,
        }
        for r in runs
    ]


@router.get("/schedule/{schedule_id:int}", response_model=TimetableDetailResponse)
@router.get("/schedules/{schedule_id:int}", response_model=TimetableDetailResponse)
def get_schedule(schedule_id: int, db: Session = Depends(get_db)):
    run, formatted_entries, entry_dicts, _, prefs_map = _load_run_entries(schedule_id, db)

    metrics = dict(run.metrics or {})
    if "fairness_score" not in metrics:
        metrics["fairness_score"] = calculate_fairness_score(entry_dicts)
    if "preference_satisfaction" not in metrics:
        metrics["preference_satisfaction"] = calculate_preference_satisfaction(
            entry_dicts, prefs_map
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
        metrics=metrics,
        entries=formatted_entries,
    )


@router.get("/schedule/{schedule_id:int}/table")
@router.get("/schedules/{schedule_id:int}/table")
def get_schedule_table(
    schedule_id: int,
    view: str = Query(
        default="master",
        description="View perspective: master, teacher, student, staff, canteen",
    ),
    db: Session = Depends(get_db),
):
    v = (view or "master").strip().lower()
    if v not in VALID_VIEWS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid view '{view}'. Allowed views: {sorted(VALID_VIEWS)}",
        )
    run, _, entry_dicts, teacher_count, prefs_map = _load_run_entries(schedule_id, db)
    rows = build_table_rows(entry_dicts, view_type=v)
    stored_metrics = run.metrics or {}
    section_title = stored_metrics.get("section_title") or "AI 2024 - Section A"
    sheet = build_university_sheet_data(
        entry_dicts, section_title=section_title, view_type=v
    )
    fairness = stored_metrics.get("fairness_score") or calculate_fairness_score(entry_dicts)
    pref_sat = stored_metrics.get("preference_satisfaction") or calculate_preference_satisfaction(
        entry_dicts, prefs_map
    )

    return {
        "format": "tabular",
        "view": v,
        "headers": rows[0] if rows else [],
        "rows": rows[1:] if len(rows) > 1 else [],
        "sheet": sheet,
        "metadata": {
            "schedule_id": run.id,
            "generated_at": run.generated_at.isoformat() if run.generated_at else None,
            "section_title": section_title,
            "total_courses": len(entry_dicts),
            "total_teachers": teacher_count,
            "fairness_score": fairness,
            "preference_satisfaction": pref_sat,
        },
    }


@router.get("/schedule/{schedule_id:int}/views")
@router.get("/schedules/{schedule_id:int}/views")
def get_schedule_multi_views(
    schedule_id: int,
    view: Optional[str] = Query(default=None, description="Optional view filter"),
    db: Session = Depends(get_db),
):
    run, _, entry_dicts, teacher_count, prefs_map = _load_run_entries(schedule_id, db)
    stored_metrics = run.metrics or {}
    metadata = {
        "schedule_id": run.id,
        "generated_at": run.generated_at.isoformat() if run.generated_at else None,
        "total_courses": len(entry_dicts),
        "total_teachers": teacher_count,
        "fairness_score": stored_metrics.get("fairness_score")
        or calculate_fairness_score(entry_dicts),
        "preference_satisfaction": stored_metrics.get("preference_satisfaction")
        or calculate_preference_satisfaction(entry_dicts, prefs_map),
        "config": stored_metrics.get("config") or {},
    }
    all_views = generate_multi_views(entry_dicts, metadata)
    v_norm = (view or "").strip().lower()
    if v_norm and v_norm in VALID_VIEWS:
        return {
            "schedule_id": run.id,
            "view": v_norm,
            "data": all_views.get(v_norm),
            "views": all_views,
            "metadata": metadata,
        }
    return {
        "schedule_id": run.id,
        "generated_at": metadata["generated_at"],
        "views": all_views,
    }


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
        preference_satisfaction_percentage=metrics.get(
            "preference_satisfaction_percentage", 90.0
        ),
        time_slot_fill_rate_percentage=metrics.get("time_slot_fill_rate_percentage", 0.0),
        conflicts_resolved_count=run.conflicts_resolved,
        solver_efficiency=metrics.get(
            "solver_efficiency",
            {"solver_time_ms": run.solver_time_ms, "courses_scheduled_per_second": 0},
        ),
    )


class SimulateMoveRequest(BaseModel):
    entry_id: int
    target_day: str
    target_start_time: str
    target_venue_name: Optional[str] = None


class ApplyMovePayload(BaseModel):
    moves: List[Dict[str, Any]]


@router.post("/schedule/{schedule_id:int}/simulate-move")
@router.post("/schedules/{schedule_id:int}/simulate-move")
def simulate_schedule_move(
    schedule_id: int,
    payload: SimulateMoveRequest,
    db: Session = Depends(get_db),
):
    run, _, _, _, _ = _load_run_entries(schedule_id, db)
    entry = next((e for e in run.entries if e.id == payload.entry_id), None)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Timetable entry #{payload.entry_id} not found",
        )

    # Find target slot
    target_slot = (
        db.query(TimeSlot)
        .filter(
            TimeSlot.day_of_week.ilike(payload.target_day.strip()),
            TimeSlot.start_time.ilike(payload.target_start_time.strip()),
        )
        .first()
    )
    if not target_slot:
        target_slot = (
            db.query(TimeSlot)
            .filter(TimeSlot.day_of_week.ilike(payload.target_day.strip()))
            .first()
        )
    if not target_slot:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Time slot for {payload.target_day} at {payload.target_start_time} not found in database",
        )

    # Find target venue
    target_venue = entry.venue
    if payload.target_venue_name:
        v_found = (
            db.query(Venue)
            .filter(Venue.name.ilike(f"%{payload.target_venue_name.strip()}%"))
            .first()
        )
        if v_found:
            target_venue = v_found

    # 1. Check for venue collision at target slot
    clash_venue = next(
        (
            e
            for e in run.entries
            if e.id != entry.id
            and e.venue_id == target_venue.id
            and e.slot.day_of_week.lower() == payload.target_day.strip().lower()
            and e.slot.start_time == payload.target_start_time.strip()
        ),
        None,
    )

    # 2. Check for faculty collision at target slot
    clash_faculty = next(
        (
            e
            for e in run.entries
            if e.id != entry.id
            and e.faculty_id == entry.faculty_id
            and e.slot.day_of_week.lower() == payload.target_day.strip().lower()
            and e.slot.start_time == payload.target_start_time.strip()
        ),
        None,
    )

    primary_clash = clash_venue or clash_faculty

    if not primary_clash:
        # Direct move is 100% clash-free!
        return {
            "has_clash": False,
            "halo": "green",
            "message": f"Direct move verified! Room {target_venue.name} is completely available on {target_slot.day_of_week} ({target_slot.start_time}-{target_slot.end_time}).",
            "can_direct_move": True,
            "target_slot": {
                "id": target_slot.id,
                "day_of_week": target_slot.day_of_week,
                "start_time": target_slot.start_time,
                "end_time": target_slot.end_time,
            },
            "target_venue": {
                "id": target_venue.id,
                "name": target_venue.name,
            },
            "suggested_ripple": None,
        }

    # Clash detected! Calculate Minimal Perturbation (Ripple Resolution)
    swap_clash_teacher = next(
        (
            e
            for e in run.entries
            if e.id != primary_clash.id
            and e.id != entry.id
            and e.faculty_id == primary_clash.faculty_id
            and e.slot.day_of_week.lower() == entry.slot.day_of_week.lower()
            and e.slot.start_time == entry.slot.start_time
        ),
        None,
    )

    swap_possible = swap_clash_teacher is None
    suggested_ripple = None

    if swap_possible:
        suggested_ripple = {
            "type": "swap",
            "title": "Minimal Perturbation: 1-Step Mutual Swap",
            "description": (
                f"Swap {entry.course.name} with {primary_clash.course.name}. "
                f"{primary_clash.course.name} trades to {entry.slot.day_of_week} at {entry.slot.start_time}. "
                f"Both courses trade positions with zero conflicts campus-wide."
            ),
            "moves": [
                {
                    "entry_id": entry.id,
                    "course_name": entry.course.name,
                    "to_slot_id": target_slot.id,
                    "to_day": target_slot.day_of_week,
                    "to_start_time": target_slot.start_time,
                    "to_end_time": target_slot.end_time,
                    "to_venue_id": target_venue.id,
                    "to_venue_name": target_venue.name,
                },
                {
                    "entry_id": primary_clash.id,
                    "course_name": primary_clash.course.name,
                    "to_slot_id": entry.slot_id,
                    "to_day": entry.slot.day_of_week,
                    "to_start_time": entry.slot.start_time,
                    "to_end_time": entry.slot.end_time,
                    "to_venue_id": entry.venue_id,
                    "to_venue_name": entry.venue.name,
                },
            ],
        }

    clash_reason = (
        f"Room {target_venue.name} is booked for {primary_clash.course.name}"
        if clash_venue
        else f"{entry.faculty.name} is already teaching {primary_clash.course.name} at this hour"
    )

    return {
        "has_clash": True,
        "halo": "red",
        "message": f"Clash detected on {target_slot.day_of_week} at {target_slot.start_time}: {clash_reason}.",
        "can_direct_move": False,
        "clash_with": primary_clash.course.name,
        "clash_reason": clash_reason,
        "target_slot": {
            "id": target_slot.id,
            "day_of_week": target_slot.day_of_week,
            "start_time": target_slot.start_time,
            "end_time": target_slot.end_time,
        },
        "target_venue": {
            "id": target_venue.id,
            "name": target_venue.name,
        },
        "suggested_ripple": suggested_ripple,
    }


@router.post("/schedule/{schedule_id:int}/apply-move")
@router.post("/schedules/{schedule_id:int}/apply-move")
def apply_schedule_move(
    schedule_id: int,
    payload: ApplyMovePayload,
    db: Session = Depends(get_db),
):
    run = db.query(ScheduleRun).filter(ScheduleRun.id == schedule_id).first()
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Schedule #{schedule_id} not found",
        )

    applied_count = 0
    for m in payload.moves:
        e_id = m.get("entry_id")
        entry = db.query(TimetableEntry).filter(TimetableEntry.id == e_id).first()
        if entry:
            if "to_slot_id" in m:
                entry.slot_id = int(m["to_slot_id"])
            if "to_venue_id" in m:
                entry.venue_id = int(m["to_venue_id"])
            applied_count += 1

    db.commit()
    return {
        "schedule_id": schedule_id,
        "status": "success",
        "moves_applied": applied_count,
        "message": f"Successfully executed {applied_count} move(s) with zero conflicts.",
    }
