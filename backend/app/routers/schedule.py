import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from app.database import get_db, SessionLocal
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
    GenerateFromTableRequest,
    TableValidationResult,
    TableRowValidationError,
    JobStatusResponse,
)
from app.services.validator import ConstraintValidator
from app.services.solver import TimetableSolver
from app.services.analytics import TimetableAnalytics
from app.services.job_queue import job_queue, JobStatus
from ml.predictor import PreferencePredictor
from solver.fairness import calculate_fairness_score, calculate_preference_satisfaction
from utils.csv_parser import parse_schedule_csv, parse_schedule_table, validate_table_rows

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
    config_dict = payload.config.model_dump() if getattr(payload, "config", None) else {}

    ml_preferences_map: Dict[str, Dict[str, float]] = {}
    for idx, f in enumerate(faculty_payload):
        f["id"] = db_faculty_map[idx].id
        ml_prefs = predictor.predict_for_teacher(f)
        f_prefs = dict(f.get("preferences") or {})
        for k, v in ml_prefs.items():
            f_prefs.setdefault(k, v)
        f["preferences"] = f_prefs
        ml_preferences_map[f["name"]] = f_prefs

    course_metadata: Dict[str, Dict[str, Any]] = {}
    for idx, c in enumerate(courses_payload):
        c["id"] = db_courses_map[idx].id
        course_metadata[str(c["id"])] = {
            "credit_hours": c.get("credit_hours") or max(1, round((c.get("duration_minutes") or 60) / 60)),
            "student_group": c.get("student_group") or c.get("code") or c.get("name"),
            "room_type": c.get("room_type"),
        }
    for idx, v in enumerate(venues_payload):
        v["id"] = db_venues_map[idx].id
    for idx, s in enumerate(slots_payload):
        s["id"] = db_slots_map[idx].id

    solver = TimetableSolver(
        time_limit_seconds=payload.timeout_seconds or 5,
        random_seed=getattr(payload, "random_seed", None),
        config=config_dict,
    )
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
        explanation = (
            solver.infeasibility_explanation
            or f"Solver could not find a feasible conflict-free timetable ({solver_status})."
        )
        now_utc = datetime.now(timezone.utc)
        term = getattr(payload, "academic_term", "General") or "General"
        dept = getattr(payload, "department", "All") or "All"
        author = getattr(payload, "created_by", "System") or "System"

        failed_run = ScheduleRun(
            generated_at=now_utc,
            started_at=now_utc,
            completed_at=now_utc,
            status=solver_status.lower(),
            solver_status=solver_status,
            academic_term=term,
            department=dept,
            created_by=author,
            solver_time_ms=solver.solver_time_ms,
            total_time_ms=total_time_ms,
            total_courses_scheduled=0,
            conflict_count=len(payload.courses),
            conflicts_resolved=0,
            metrics={
                "error": explanation,
                "explanation": explanation,
            },
        )
        db.add(failed_run)
        db.commit()

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": explanation,
                "explanation": explanation,
                "status": solver_status,
                "solver_time_ms": solver.solver_time_ms,
                "solve_time_ms": solver.solver_time_ms,
                "objective_value": solver.objective_value,
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
    analytics["preference_source"] = predictor.model_source
    analytics["course_metadata"] = course_metadata
    analytics["config"] = config_dict
    analytics["objective_value"] = solver.objective_value
    analytics["run_scope"] = {
        "faculty_ids": [f["id"] for f in faculty_payload],
        "venue_ids": [v["id"] for v in venues_payload],
        "slot_ids": [s["id"] for s in slots_payload],
        "course_ids": [c["id"] for c in courses_payload],
    }

    # 5. Persist ScheduleRun & TimetableEntries
    now_utc = datetime.now(timezone.utc)
    term = getattr(payload, "academic_term", "General") or "General"
    dept = getattr(payload, "department", "All") or "All"
    author = getattr(payload, "created_by", "System") or "System"

    run = ScheduleRun(
        generated_at=now_utc,
        started_at=now_utc,
        completed_at=now_utc,
        status="completed",
        solver_status=solver_status,
        academic_term=term,
        department=dept,
        created_by=author,
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
            solve_time_ms=solver.solver_time_ms,
            total_time_ms=total_time_ms,
            objective_value=solver.objective_value,
            total_courses_scheduled=len(solution_entries),
            total_courses_requested=len(payload.courses),
            conflict_count=0,
            conflicts_resolved=len(solution_entries),
            gap_from_optimum=0.0,
        ),
        schedule=formatted_entries,
        analytics=analytics,
    )


@router.post("/generate-simple", response_model=TimetableResponse, status_code=status.HTTP_201_CREATED)
def generate_schedule_simple(payload: GenerateScheduleRequest, db: Session = Depends(get_db)):
    return generate_schedule(payload=payload, db=db)


@router.post("/upload-csv", response_model=TimetableResponse, status_code=status.HTTP_201_CREATED)
async def upload_csv_and_generate(
    file: UploadFile = File(...),
    day_start: str = "09:00",
    day_end: str = "17:00",
    lunch_start: str = "12:00",
    lunch_end: str = "14:00",
    slot_minutes: int = 60,
    break_minutes: int = 15,
    min_gap_minutes: int = 30,
    max_teaching_hours_per_day: int = 6,
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
        cfg = {
            "day_start": day_start,
            "day_end": day_end,
            "lunch_start": lunch_start,
            "lunch_end": lunch_end,
            "slot_minutes": slot_minutes,
            "break_minutes": break_minutes,
            "min_gap_minutes": min_gap_minutes,
            "max_teaching_hours_per_day": max_teaching_hours_per_day,
        }
        parsed_dict = parse_schedule_csv(csv_text, config=cfg)
        req = GenerateScheduleRequest(**parsed_dict)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse uploaded CSV: {str(exc)}",
        )
    return generate_schedule(payload=req, db=db)


@router.post("/validate-table", response_model=TableValidationResult)
def validate_table_endpoint(payload: GenerateFromTableRequest):
    row_dicts = [r.model_dump() for r in payload.rows]
    cfg_dict = payload.config.model_dump() if payload.config else None
    errors = validate_table_rows(row_dicts, config=cfg_dict)
    error_indices = {e["row_index"] for e in errors}
    valid_count = len(row_dicts) - len(error_indices)
    return TableValidationResult(
        is_valid=len(errors) == 0,
        errors=[TableRowValidationError(**e) for e in errors],
        total_rows=len(row_dicts),
        valid_rows=max(0, valid_count),
    )


@router.post("/generate-from-table", response_model=TimetableResponse, status_code=status.HTTP_201_CREATED)
def generate_from_table(payload: GenerateFromTableRequest, db: Session = Depends(get_db)):
    row_dicts = [r.model_dump() for r in payload.rows]
    cfg_dict = payload.config.model_dump() if payload.config else None
    errors = validate_table_rows(row_dicts, config=cfg_dict)
    if errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Table validation failed", "errors": errors},
        )
    parsed_dict = parse_schedule_table(row_dicts, config=cfg_dict)
    if payload.timeout_seconds:
        parsed_dict["timeout_seconds"] = payload.timeout_seconds
    if payload.random_seed is not None:
        parsed_dict["random_seed"] = payload.random_seed
    req = GenerateScheduleRequest(**parsed_dict)
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

    prior_course_meta = dict((prior_run.metrics or {}).get("course_metadata") or {})
    courses_payload = []
    for c in all_courses:
        c_meta = prior_course_meta.get(str(c.id)) or {}
        credit_hrs = c_meta.get("credit_hours") or max(1, round((c.duration_minutes or 60) / 60))
        courses_payload.append(
            {
                "id": c.id,
                "name": c.name,
                "code": c.code,
                "faculty_id": faculty_to_idx.get(c.faculty_id, 0),
                "capacity_required": c.capacity_required,
                "duration_minutes": c.duration_minutes,
                "credit_hours": credit_hrs,
                "student_group": c_meta.get("student_group") or c.code,
                "room_type": c_meta.get("room_type"),
            }
        )

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

    prior_config = dict((prior_run.metrics or {}).get("config") or {})
    solver = TimetableSolver(
        time_limit_seconds=payload.timeout_seconds or 5,
        config=prior_config,
    )
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
        explanation = (
            solver.infeasibility_explanation
            or f"Unable to reschedule given new conflict constraints ({solver_status})."
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "message": explanation,
                "explanation": explanation,
                "status": solver_status,
                "solver_time_ms": solver.solver_time_ms,
                "solve_time_ms": solver.solver_time_ms,
            },
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
    analytics["course_metadata"] = prior_course_meta
    analytics["config"] = prior_config
    analytics["objective_value"] = solver.objective_value
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
            solve_time_ms=solver.solver_time_ms,
            total_time_ms=total_time_ms,
            objective_value=solver.objective_value,
            total_courses_scheduled=len(solution_entries),
            total_courses_requested=len(courses_payload),
            conflict_count=0,
            conflicts_resolved=new_run.conflicts_resolved,
            gap_from_optimum=0.0,
        ),
        schedule=formatted_entries,
        analytics=analytics,
    )


def _run_background_generation_task(payload_dict: Dict[str, Any], progress_callback=None) -> Dict[str, Any]:
    db = SessionLocal()
    try:
        if progress_callback:
            progress_callback(20, "Validating institutional constraints")
        req = GenerateScheduleRequest(**payload_dict)
        if progress_callback:
            progress_callback(40, "Solving conflict-free timetable with CP-SAT")
        result = generate_schedule(payload=req, db=db)
        if progress_callback:
            progress_callback(95, "Finalizing metrics and persisting schedule")
        return result.model_dump()
    finally:
        db.close()


@router.post("/jobs/generate", response_model=JobStatusResponse, status_code=status.HTTP_202_ACCEPTED)
def submit_async_generation_job(payload: GenerateScheduleRequest):
    """
    Submits a schedule generation job to the background worker pool.
    Returns 202 Accepted immediately with a job_id for non-blocking polling.
    """
    payload_dict = payload.model_dump()
    metadata = {
        "term": getattr(payload, "academic_term", "General"),
        "department": getattr(payload, "department", "All"),
        "total_courses": len(payload.courses),
    }
    job_id = job_queue.submit_job(
        _run_background_generation_task,
        payload_dict=payload_dict,
        metadata=metadata,
    )
    job = job_queue.get_job(job_id)
    return JobStatusResponse(**job.to_dict())


@router.post("/jobs/upload-csv", response_model=JobStatusResponse, status_code=status.HTTP_202_ACCEPTED)
def submit_async_csv_generation_job(
    file: UploadFile = File(...),
    academic_term: Optional[str] = Form(default="General"),
    department: Optional[str] = Form(default="All"),
    created_by: Optional[str] = Form(default="System"),
):
    """
    Submits an uploaded CSV dataset to the background solver queue.
    Returns 202 Accepted immediately with a job_id for polling.
    """
    try:
        content = file.file.read()
        csv_text = content.decode("utf-8")
        parsed = parse_schedule_csv(csv_text)
        req = GenerateScheduleRequest(**parsed)
        req.academic_term = academic_term or "General"
        req.department = department or "All"
        req.created_by = created_by or "System"
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse uploaded CSV: {str(exc)}",
        )
    return submit_async_generation_job(req)


@router.get("/jobs", response_model=List[JobStatusResponse])
def list_async_jobs(limit: int = 20):
    """
    List recent solver background jobs and their execution states.
    """
    jobs = job_queue.list_recent_jobs(limit=limit)
    return [JobStatusResponse(**j) for j in jobs]


@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
def get_async_job_status(job_id: str):
    """
    Check status, progress, and result of an asynchronous schedule generation job.
    """
    job = job_queue.get_job(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found.",
        )
    return JobStatusResponse(**job.to_dict())


demo_router = APIRouter(prefix="/demo", tags=["Demo"])


def _load_demo_csv_text() -> str:
    import os
    candidates = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "data", "demo_courses.csv"),
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "demo_courses.csv"),
    ]
    for path in candidates:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return f.read()
    # Built-in fallback if file is moved
    return (
        "teacher_name,course_name,credit_hours,student_group,room_type\n"
        "Dr. Sarah Ahmed,Artificial Intelligence,3,BS-AI-4A,Lecture\n"
        "Dr. Sarah Ahmed,Deep Learning,3,BS-AI-6A,Lab\n"
        "Prof. Kamran Siddiqui,Operating Systems,4,BS-CS-4A,Lecture\n"
        "Prof. Kamran Siddiqui,Computer Networks,3,BS-CS-6A,Lecture\n"
        "Dr. Ayesha Tariq,Database Systems,4,BS-SE-4A,Lecture\n"
        "Dr. Ayesha Tariq,Data Mining,2,BS-AI-6A,Lecture\n"
        "Mr. Bilal Raza,Software Engineering,3,BS-SE-4A,Lecture\n"
        "Mr. Bilal Raza,Agile Development,2,BS-SE-6A,Lecture\n"
        "Dr. Usman Farooq,Linear Algebra,3,BS-AI-4A,Lecture\n"
        "Dr. Usman Farooq,Probability & Statistics,3,BS-CS-4A,Lecture\n"
        "Ms. Hina Noor,Technical Writing,2,BS-CS-6A,Lecture\n"
        "Ms. Hina Noor,Professional Ethics,2,BS-SE-6A,Lecture\n"
    )


@demo_router.post("/run", response_model=TimetableResponse, status_code=status.HTTP_201_CREATED)
def run_demo_pipeline(db: Session = Depends(get_db)):
    csv_text = _load_demo_csv_text()
    parsed_dict = parse_schedule_csv(csv_text)
    parsed_dict["random_seed"] = 42
    parsed_dict["timeout_seconds"] = 5
    req = GenerateScheduleRequest(**parsed_dict)
    return generate_schedule(payload=req, db=db)


@demo_router.get("/courses")
def get_demo_courses():
    csv_text = _load_demo_csv_text()
    parsed_dict = parse_schedule_csv(csv_text)
    return {
        "csv_text": csv_text,
        "parsed": parsed_dict,
    }


@demo_router.post("/seed", status_code=status.HTTP_200_OK)
def seed_demo_database_fixtures(force: bool = False, db: Session = Depends(get_db)):
    from app.fixtures import seed_demo_fixtures

    return seed_demo_fixtures(db, force=force)

