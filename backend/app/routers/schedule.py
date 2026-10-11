import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.faculty import Faculty
from app.models.venue import Venue
from app.models.slot import TimeSlot
from app.models.course import Course
from app.models.constraint import CustomConstraint
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
from ml.predictor import PreferencePredictor
from solver.fairness import calculate_fairness_score, calculate_preference_satisfaction
from utils.csv_parser import parse_schedule_csv

router = APIRouter(prefix="/schedule", tags=["Schedule"])

MAX_CSV_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB safety limit


def _load_merged_constraints(db: Session, inline_constraints: List[Any]) -> List[Dict[str, Any]]:
    merged = [c.model_dump() if hasattr(c, "model_dump") else dict(c) for c in (inline_constraints or [])]
    db_constraints = db.query(CustomConstraint).all()
    for dbc in db_constraints:
        merged.append(
            {
                "id": dbc.id,
                "type": dbc.type,
                "name": dbc.name,
                "description": dbc.description,
                "weight": dbc.weight,
                "constraint_data": dbc.constraint_data or {},
            }
        )
    return merged


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

    # 2. Database Synchronization (Upsert Faculty, Venues, Slots, Courses)
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
        else:
            existing_f.name = f.name
            existing_f.department = f.department
            existing_f.max_hours_per_day = f.max_hours_per_day
            existing_f.max_days_per_week = f.max_days_per_week
            existing_f.preferences = f.preferences
            existing_f.unavailable_slots = f.unavailable_slots
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
        else:
            existing_v.capacity = v.capacity
            existing_v.equipment = v.equipment
            existing_v.available_slots = v.available_slots
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
        else:
            existing_s.duration_minutes = s.duration_minutes
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
        else:
            existing_c.name = c.name
            existing_c.faculty_id = db_fac.id
            existing_c.capacity_required = c.capacity_required
            existing_c.duration_minutes = c.duration_minutes
            db.flush()
        db_courses_map[idx] = existing_c

    # 3. ML Preference Enrichment + Solver Execution
    predictor = PreferencePredictor()
    courses_payload = [c.model_dump() for c in payload.courses]
    faculty_payload = [f.model_dump() for f in payload.faculty]
    venues_payload = [v.model_dump() for v in payload.venues]
    slots_payload = [s.model_dump() for s in payload.slots]

    ml_preferences_map: Dict[str, Dict[str, float]] = {}
    for idx, f in enumerate(faculty_payload):
        f["id"] = db_faculty_map[idx].id
        ml_prefs = predictor.predict_for_teacher(f)
        f_prefs = dict(f.get("preferences") or {})
        for k, v in ml_prefs.items():
            f_prefs.setdefault(k, v)
        f["preferences"] = f_prefs
        ml_preferences_map[f["name"]] = f_prefs

    for idx, c in enumerate(courses_payload):
        c["id"] = db_courses_map[idx].id
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
    constraints_dicts = _load_merged_constraints(db, payload.constraints or [])
    solver.add_constraints(constraints_dicts)

    is_solved, solver_status, _ = solver.solve(timeout_seconds=payload.timeout_seconds or 5)
    total_time_ms = round((time.perf_counter() - wall_start_time) * 1000.0, 2)

    if not is_solved:
        now_utc = datetime.now(timezone.utc)
        failed_run = ScheduleRun(
            generated_at=now_utc,
            started_at=now_utc,
            completed_at=now_utc,
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

    # 4. Compute Analytics + Fairness & ML Satisfaction Metrics
    analytics = TimetableAnalytics.compute_metrics(
        schedule_entries=solution_entries,
        faculty_list=faculty_payload,
        venue_list=venues_payload,
        slot_list=slots_payload,
        solver_time_ms=solver.solver_time_ms,
    )
    analytics["fairness_score"] = calculate_fairness_score(solution_entries, faculty_payload)
    analytics["preference_satisfaction"] = calculate_preference_satisfaction(
        solution_entries, ml_preferences_map
    )
    analytics["ml_predicted_preferences"] = ml_preferences_map
    analytics["run_scope"] = {
        "faculty_ids": [f["id"] for f in faculty_payload],
        "venue_ids": [v["id"] for v in venues_payload],
        "slot_ids": [s["id"] for s in slots_payload],
        "course_ids": [c["id"] for c in courses_payload],
    }

    # 5. Persist ScheduleRun & TimetableEntries
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


@router.post("/upload-csv", response_model=TimetableResponse, status_code=status.HTTP_201_CREATED)
async def upload_csv_and_generate(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    raw_bytes = await file.read(MAX_CSV_UPLOAD_BYTES + 1)
    if len(raw_bytes) > MAX_CSV_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Uploaded CSV exceeds maximum allowed size of 5 MB.",
        )
    if not raw_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded CSV file is empty.",
        )
    try:
        csv_text = raw_bytes.decode("utf-8-sig")
        parsed_dict = parse_schedule_csv(csv_text)
        req = GenerateScheduleRequest(**parsed_dict)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse uploaded CSV: {str(exc)}",
        )
    return generate_schedule(payload=req, db=db)


@router.post("/reschedule", response_model=TimetableResponse)
def reschedule_conflicts(payload: RescheduleRequest, db: Session = Depends(get_db)):
    wall_start_time = time.perf_counter()

    prior_run = db.query(ScheduleRun).filter(ScheduleRun.id == payload.timetable_id).first()
    if not prior_run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Original timetable run with ID {payload.timetable_id} not found",
        )

    prior_entries = (
        db.query(TimetableEntry)
        .filter(TimetableEntry.schedule_run_id == payload.timetable_id)
        .all()
    )

    run_scope = (prior_run.metrics or {}).get("run_scope", {})
    scoped_course_ids = run_scope.get("course_ids") or [e.course_id for e in prior_entries]
    scoped_faculty_ids = run_scope.get("faculty_ids") or list({e.faculty_id for e in prior_entries})
    scoped_venue_ids = run_scope.get("venue_ids")
    scoped_slot_ids = run_scope.get("slot_ids")

    all_courses = (
        db.query(Course).filter(Course.id.in_(scoped_course_ids)).all()
        if scoped_course_ids
        else db.query(Course).all()
    )
    all_faculty = (
        db.query(Faculty).filter(Faculty.id.in_(scoped_faculty_ids)).all()
        if scoped_faculty_ids
        else db.query(Faculty).all()
    )
    all_venues = (
        db.query(Venue).filter(Venue.id.in_(scoped_venue_ids)).all()
        if scoped_venue_ids
        else db.query(Venue).all()
    )
    all_slots = (
        db.query(TimeSlot).filter(TimeSlot.id.in_(scoped_slot_ids)).all()
        if scoped_slot_ids
        else db.query(TimeSlot).all()
    )

    # Preserve deterministic ordering matching run_scope
    if scoped_course_ids:
        order_c = {cid: i for i, cid in enumerate(scoped_course_ids)}
        all_courses.sort(key=lambda x: order_c.get(x.id, 9999))
    if scoped_faculty_ids:
        order_f = {fid: i for i, fid in enumerate(scoped_faculty_ids)}
        all_faculty.sort(key=lambda x: order_f.get(x.id, 9999))
    if scoped_venue_ids:
        order_v = {vid: i for i, vid in enumerate(scoped_venue_ids)}
        all_venues.sort(key=lambda x: order_v.get(x.id, 9999))
    if scoped_slot_ids:
        order_s = {sid: i for i, sid in enumerate(scoped_slot_ids)}
        all_slots.sort(key=lambda x: order_s.get(x.id, 9999))

    course_to_idx = {c.id: idx for idx, c in enumerate(all_courses)}
    venue_to_idx = {v.id: idx for idx, v in enumerate(all_venues)}
    slot_to_idx = {s.id: idx for idx, s in enumerate(all_slots)}
    faculty_to_idx = {f.id: idx for idx, f in enumerate(all_faculty)}

    # Resolve unseated_slot_ids (accepts either 0-based slot index OR DB TimeSlot.id)
    unseated_indices = set()
    for raw_sid in payload.unseated_slot_ids:
        if raw_sid in slot_to_idx:
            unseated_indices.add(slot_to_idx[raw_sid])
        elif 0 <= raw_sid < len(all_slots):
            unseated_indices.add(raw_sid)

    # Resolve unavailable_venue_ids (accepts either 0-based venue index OR DB Venue.id)
    unavail_venue_indices = set()
    for raw_vid in payload.unavailable_venue_ids:
        if raw_vid in venue_to_idx:
            unavail_venue_indices.add(venue_to_idx[raw_vid])
        elif 0 <= raw_vid < len(all_venues):
            unavail_venue_indices.add(raw_vid)

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

    ml_preferences_map = dict((prior_run.metrics or {}).get("ml_predicted_preferences") or {})
    faculty_payload = []
    for f_idx, f in enumerate(all_faculty):
        unavail = [slot_to_idx.get(s, s) for s in (f.unavailable_slots or []) if 0 <= slot_to_idx.get(s, s) < len(all_slots)]
        extra_f_slots = payload.unavailable_faculty_slots.get(f.id) or payload.unavailable_faculty_slots.get(f_idx) or []
        for s in extra_f_slots:
            mapped_s = slot_to_idx.get(s, s)
            if 0 <= mapped_s < len(all_slots):
                unavail.append(mapped_s)
        f_prefs = dict(f.preferences or {})
        if f.name in ml_preferences_map:
            for k, v in ml_preferences_map[f.name].items():
                f_prefs.setdefault(k, v)
        else:
            ml_preferences_map[f.name] = f_prefs
        faculty_payload.append(
            {
                "id": f.id,
                "name": f.name,
                "department": f.department,
                "max_hours_per_day": f.max_hours_per_day,
                "max_days_per_week": f.max_days_per_week,
                "email": f.email,
                "preferences": f_prefs,
                "unavailable_slots": list(set(unavail)),
            }
        )

    venues_payload = []
    for v_idx, v in enumerate(all_venues):
        avail = [
            slot_to_idx.get(s, s)
            for s in (v.available_slots or [])
            if 0 <= slot_to_idx.get(s, s) < len(all_slots)
        ]
        venues_payload.append(
            {
                "id": v.id,
                "name": v.name,
                "capacity": v.capacity,
                "equipment": v.equipment or [],
                "available_slots": avail,
                "is_unavailable": v_idx in unavail_venue_indices,
            }
        )

    # Keep all slots in place so indices do not shift, and flag unseated slots
    slots_payload = []
    for s_idx, s in enumerate(all_slots):
        slots_payload.append(
            {
                "id": s.id,
                "day_of_week": s.day_of_week,
                "start_time": s.start_time,
                "end_time": s.end_time,
                "duration_minutes": s.duration_minutes,
                "is_unseated": s_idx in unseated_indices,
            }
        )

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

    solver = TimetableSolver(time_limit_seconds=payload.timeout_seconds or 5)
    solver.add_variables(
        courses=courses_payload,
        faculty=faculty_payload,
        venues=venues_payload,
        slots=slots_payload,
        previous_assignments=previous_assignments,
    )
    solver.add_constraints(_load_merged_constraints(db, []))

    is_solved, solver_status, _ = solver.solve(timeout_seconds=payload.timeout_seconds or 5)
    total_time_ms = round((time.perf_counter() - wall_start_time) * 1000.0, 2)

    if not is_solved:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unable to reschedule given new conflict constraints: {solver_status}",
        )

    solution_entries = solver.get_solution()

    active_slots_payload = [s for s in slots_payload if not s.get("is_unseated")]
    analytics = TimetableAnalytics.compute_metrics(
        schedule_entries=solution_entries,
        faculty_list=faculty_payload,
        venue_list=[v for v in venues_payload if not v.get("is_unavailable")],
        slot_list=active_slots_payload or slots_payload,
        solver_time_ms=solver.solver_time_ms,
    )
    analytics["fairness_score"] = calculate_fairness_score(solution_entries, faculty_payload)
    analytics["preference_satisfaction"] = calculate_preference_satisfaction(
        solution_entries, ml_preferences_map
    )
    analytics["ml_predicted_preferences"] = ml_preferences_map
    analytics["run_scope"] = {
        "faculty_ids": [f["id"] for f in faculty_payload],
        "venue_ids": [v["id"] for v in venues_payload],
        "slot_ids": [s["id"] for s in slots_payload],
        "course_ids": [c["id"] for c in courses_payload],
    }

    now_utc = datetime.now(timezone.utc)
    new_run = ScheduleRun(
        generated_at=now_utc,
        started_at=now_utc,
        completed_at=now_utc,
        status="completed",
        solver_status=solver_status,
        solver_time_ms=solver.solver_time_ms,
        total_time_ms=total_time_ms,
        total_courses_scheduled=len(solution_entries),
        conflict_count=0,
        conflicts_resolved=len(unseated_indices) + len(unavail_venue_indices),
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
            conflict_count=0,
            conflicts_resolved=new_run.conflicts_resolved,
            gap_from_optimum=0.0,
        ),
        schedule=formatted_entries,
        analytics=analytics,
    )
