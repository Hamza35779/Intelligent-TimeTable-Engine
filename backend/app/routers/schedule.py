import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.faculty import Faculty
from app.models.venue import Venue
from app.models.slot import TimeSlot
from app.models.course import Course
from app.models.timetable import ScheduleRun, TimetableEntry
from app.schemas.timetable import (
    GenerateScheduleRequest,
    RescheduleRequest,
    TimetableResponse,
    TimetableEntryResponse,
    SolverStats,
)
from app.services.validator import ConstraintValidator
from app.services.solver import TimetableSolver
from app.services.analytics import TimetableAnalytics

router = APIRouter(prefix="/schedule", tags=["Schedule"])


@router.post("/generate", response_model=TimetableResponse, status_code=status.HTTP_201_CREATED)
def generate_schedule(payload: GenerateScheduleRequest, db: Session = Depends(get_db)):
    wall_start_time = time.perf_counter()

    # 1. Validation
    is_valid, validation_errors = ConstraintValidator.validate_inputs(
        faculty=payload.faculty,
        venues=payload.venues,
        slots=payload.slots,
        courses=payload.courses,
    )
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Input validation failed", "errors": validation_errors},
        )

    # 2. Database Synchronization (Faculty, Venues, Slots, Courses)
    # Clear or sync references for this run
    db_faculty_map: Dict[int, Faculty] = {}
    for idx, f in enumerate(payload.faculty):
        existing_f = db.query(Faculty).filter(Faculty.email == f.email).first()
        if not existing_f:
            existing_f = Faculty(
                name=f.name,
                department=f.department,
                max_hours_per_day=f.max_hours_per_day,
                max_days_per_week=f.max_days_per_week,
                email=f.email,
                preferences=f.preferences,
                unavailable_slots=f.unavailable_slots,
            )
            db.add(existing_f)
            db.flush()
        db_faculty_map[idx] = existing_f

    db_venues_map: Dict[int, Venue] = {}
    for idx, v in enumerate(payload.venues):
        existing_v = db.query(Venue).filter(Venue.name == v.name).first()
        if not existing_v:
            existing_v = Venue(
                name=v.name,
                capacity=v.capacity,
                equipment=v.equipment,
                available_slots=v.available_slots,
            )
            db.add(existing_v)
            db.flush()
        db_venues_map[idx] = existing_v

    db_slots_map: Dict[int, TimeSlot] = {}
    for idx, s in enumerate(payload.slots):
        existing_s = (
            db.query(TimeSlot)
            .filter(
                TimeSlot.day_of_week == s.day_of_week,
                TimeSlot.start_time == s.start_time,
                TimeSlot.end_time == s.end_time,
            )
            .first()
        )
        if not existing_s:
            existing_s = TimeSlot(
                day_of_week=s.day_of_week,
                start_time=s.start_time,
                end_time=s.end_time,
                duration_minutes=s.duration_minutes,
            )
            db.add(existing_s)
            db.flush()
        db_slots_map[idx] = existing_s

    db_courses_map: Dict[int, Course] = {}
    for idx, c in enumerate(payload.courses):
        db_fac = db_faculty_map[c.faculty_id]
        existing_c = db.query(Course).filter(Course.code == c.code).first()
        if not existing_c:
            existing_c = Course(
                name=c.name,
                code=c.code,
                faculty_id=db_fac.id,
                capacity_required=c.capacity_required,
                duration_minutes=c.duration_minutes,
            )
            db.add(existing_c)
            db.flush()
        db_courses_map[idx] = existing_c

    # 3. Solver execution
    courses_payload = [c.model_dump() for c in payload.courses]
    faculty_payload = [f.model_dump() for f in payload.faculty]
    venues_payload = [v.model_dump() for v in payload.venues]
    slots_payload = [s.model_dump() for s in payload.slots]

    # Map solver entities
    for idx, c in enumerate(courses_payload):
        c["id"] = db_courses_map[idx].id
    for idx, f in enumerate(faculty_payload):
        f["id"] = db_faculty_map[idx].id
    for idx, v in enumerate(venues_payload):
        v["id"] = db_venues_map[idx].id
    for idx, s in enumerate(slots_payload):
        s["id"] = db_slots_map[idx].id

    solver = TimetableSolver(time_limit_seconds=payload.timeout_seconds or 5)
    solver.add_variables(
        courses=courses_payload,
        faculty=faculty_payload,
        venues=venues_payload,
        slots=slots_payload,
    )
    constraints_dicts = [c.model_dump() for c in (payload.constraints or [])]
    solver.add_constraints(constraints_dicts)

    is_solved, solver_status, solver_stats = solver.solve(timeout_seconds=payload.timeout_seconds or 5)
    total_time_ms = round((time.perf_counter() - wall_start_time) * 1000.0, 2)

    if not is_solved:
        # Create record of failed run
        failed_run = ScheduleRun(
            generated_at=datetime.utcnow(),
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
            status=solver_status.lower(),
            solver_status=solver_status,
            solver_time_ms=solver.solver_time_ms,
            total_time_ms=total_time_ms,
            total_courses_scheduled=0,
            conflict_count=len(payload.courses),
            conflicts_resolved=0,
            metrics={"error": "Constraint solver could not find a feasible schedule."},
        )
        db.add(failed_run)
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": f"Solver could not find a feasible conflict-free timetable: {solver_status}",
                "status": solver_status,
                "solver_time_ms": solver.solver_time_ms,
            },
        )

    solution_entries = solver.get_solution()

    # 4. Compute Analytics
    analytics = TimetableAnalytics.compute_metrics(
        schedule_entries=solution_entries,
        faculty_list=faculty_payload,
        venue_list=venues_payload,
        slot_list=slots_payload,
        solver_time_ms=solver.solver_time_ms,
    )

    now_utc = datetime.now(timezone.utc)
    run = ScheduleRun(
        generated_at=now_utc,
        started_at=now_utc,
        completed_at=now_utc,
        status="completed",
        solver_status=solver_status,
        solver_time_ms=solver.solver_time_ms,
        total_time_ms=total_time_ms,
        total_courses_scheduled=len(solution_entries),
        conflict_count=0,
        conflicts_resolved=len(solution_entries),
        metrics=analytics,
    )
    db.add(run)
    db.flush()

    for item in solution_entries:
        entry = TimetableEntry(
            schedule_run_id=run.id,
            course_id=item["course_id"],
            faculty_id=item["faculty_id"],
            venue_id=item["venue_id"],
            slot_id=item["slot_id"],
        )
        db.add(entry)

    db.commit()

    # 6. Format response
    formatted_entries = [TimetableEntryResponse(**item) for item in solution_entries]

    return TimetableResponse(
        schedule_id=run.id,
        status="completed",
        generated_at=run.generated_at,
        stats=SolverStats(
            status=solver_status,
            solver_time_ms=solver.solver_time_ms,
            total_time_ms=total_time_ms,
            total_courses_scheduled=len(solution_entries),
            total_courses_requested=len(payload.courses),
            conflict_count=0,
            conflicts_resolved=len(solution_entries),
            gap_from_optimum=0.0,
        ),
        schedule=formatted_entries,
        analytics=analytics,
    )


@router.post("/reschedule", response_model=TimetableResponse)
def reschedule_conflicts(payload: RescheduleRequest, db: Session = Depends(get_db)):
    wall_start_time = time.perf_counter()

    # Retrieve prior schedule run
    prior_run = db.query(ScheduleRun).filter(ScheduleRun.id == payload.timetable_id).first()
    if not prior_run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Original timetable run with ID {payload.timetable_id} not found",
        )

    # Retrieve all courses, faculty, venues, slots involved in original run
    prior_entries = (
        db.query(TimetableEntry)
        .filter(TimetableEntry.schedule_run_id == payload.timetable_id)
        .all()
    )

    all_courses = db.query(Course).all()
    all_faculty = db.query(Faculty).all()
    all_venues = db.query(Venue).all()
    all_slots = db.query(TimeSlot).all()

    course_to_idx = {c.id: idx for idx, c in enumerate(all_courses)}
    venue_to_idx = {v.id: idx for idx, v in enumerate(all_venues)}
    slot_to_idx = {s.id: idx for idx, s in enumerate(all_slots)}
    faculty_to_idx = {f.id: idx for idx, f in enumerate(all_faculty)}

    courses_payload = [
        {
            "id": c.id,
            "name": c.name,
            "code": c.code,
            "faculty_id": faculty_to_idx.get(c.faculty_id, 0),
            "capacity_required": c.capacity_required,
            "duration_minutes": c.duration_minutes,
        }
        for c in all_courses
    ]

    faculty_payload = []
    for f in all_faculty:
        unavail = list(f.unavailable_slots or [])
        # Apply faculty unavailability delta
        if f.id in payload.unavailable_faculty_slots:
            unavail.extend(payload.unavailable_faculty_slots[f.id])
        faculty_payload.append(
            {
                "id": f.id,
                "name": f.name,
                "department": f.department,
                "max_hours_per_day": f.max_hours_per_day,
                "max_days_per_week": f.max_days_per_week,
                "email": f.email,
                "preferences": f.preferences or {},
                "unavailable_slots": [slot_to_idx.get(s, s) for s in unavail],
            }
        )

    venues_payload = []
    for v in all_venues:
        avail = list(v.available_slots or [])
        if v.id in payload.unavailable_venue_ids:
            # venue offline
            avail = []
        venues_payload.append(
            {
                "id": v.id,
                "name": v.name,
                "capacity": v.capacity,
                "equipment": v.equipment or [],
                "available_slots": [slot_to_idx.get(s, s) for s in avail],
            }
        )

    slots_payload = []
    for s in all_slots:
        if s.id in payload.unseated_slot_ids:
            continue  # Slot is no longer usable
        slots_payload.append(
            {
                "id": s.id,
                "day_of_week": s.day_of_week,
                "start_time": s.start_time,
                "end_time": s.end_time,
                "duration_minutes": s.duration_minutes,
            }
        )

    # Convert prior assignments into tuples (c_idx, v_idx, s_idx)
    previous_assignments: List[Tuple[int, int, int]] = []
    for entry in prior_entries:
        if (
            entry.course_id in course_to_idx
            and entry.venue_id in venue_to_idx
            and entry.slot_id in slot_to_idx
        ):
            previous_assignments.append(
                (
                    course_to_idx[entry.course_id],
                    venue_to_idx[entry.venue_id],
                    slot_to_idx[entry.slot_id],
                )
            )

    # Solve with minimal disruption objective
    solver = TimetableSolver(time_limit_seconds=payload.timeout_seconds or 5)
    solver.add_variables(
        courses=courses_payload,
        faculty=faculty_payload,
        venues=venues_payload,
        slots=slots_payload,
        previous_assignments=previous_assignments,
    )
    solver.add_constraints([])

    is_solved, solver_status, stats = solver.solve(timeout_seconds=payload.timeout_seconds or 5)
    total_time_ms = round((time.perf_counter() - wall_start_time) * 1000.0, 2)

    if not is_solved:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unable to reschedule given new conflict constraints: {solver_status}",
        )

    solution_entries = solver.get_solution()

    analytics = TimetableAnalytics.compute_metrics(
        schedule_entries=solution_entries,
        faculty_list=faculty_payload,
        venue_list=venues_payload,
        slot_list=slots_payload,
        solver_time_ms=solver.solver_time_ms,
    )

    new_run = ScheduleRun(
        generated_at=datetime.now(timezone.utc),
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
        status="completed",
        solver_status=solver_status,
        solver_time_ms=solver.solver_time_ms,
        total_time_ms=total_time_ms,
        total_courses_scheduled=len(solution_entries),
        conflict_count=len(payload.unseated_slot_ids) + len(payload.unavailable_venue_ids),
        conflicts_resolved=len(solution_entries),
        metrics=analytics,
    )
    db.add(new_run)
    db.flush()

    for item in solution_entries:
        entry = TimetableEntry(
            schedule_run_id=new_run.id,
            course_id=item["course_id"],
            faculty_id=item["faculty_id"],
            venue_id=item["venue_id"],
            slot_id=item["slot_id"],
        )
        db.add(entry)

    db.commit()

    formatted_entries = [TimetableEntryResponse(**item) for item in solution_entries]

    return TimetableResponse(
        schedule_id=new_run.id,
        status="completed",
        generated_at=new_run.generated_at,
        stats=SolverStats(
            status=solver_status,
            solver_time_ms=solver.solver_time_ms,
            total_time_ms=total_time_ms,
            total_courses_scheduled=len(solution_entries),
            total_courses_requested=len(courses_payload),
            conflict_count=new_run.conflict_count,
            conflicts_resolved=len(solution_entries),
            gap_from_optimum=0.0,
        ),
        schedule=formatted_entries,
        analytics=analytics,
    )
