from typing import Dict, Any
from sqlalchemy.orm import Session

from app.models.constraint import CustomConstraint
from app.models.feedback import Feedback
from app.models.timetable import ScheduleRun
from app.routers.schedule import _load_demo_csv_text, generate_schedule
from app.schemas.timetable import GenerateScheduleRequest
from utils.csv_parser import parse_schedule_csv


DEFAULT_CONSTRAINTS_FIXTURE = [
    {
        "type": "soft",
        "name": "Balance Teacher Daily Load",
        "description": "Distribute faculty contact hours evenly across active teaching days.",
        "weight": 2.0,
        "constraint_data": {"balance_daily_load": True},
    },
    {
        "type": "soft",
        "name": "Prioritize Morning Core Lectures",
        "description": "Prefer morning slots (09:00-12:00) for multi-credit core courses.",
        "weight": 1.5,
        "constraint_data": {"prefer_morning": True},
    },
]

DEFAULT_FEEDBACK_FIXTURE = [
    {
        "teacher_id": 1,
        "teacher_name": "Dr. Tariq Mehmood",
        "satisfaction_score": 5,
        "preferred_time": "Morning",
        "avoid_time": "Evening",
        "workload_satisfaction": 5,
        "teaching_hours": 7,
        "num_gaps": 1,
        "department": "Computer Science",
        "experience_years": 10,
        "comments": "Morning AI and ML sessions are well spaced with a protected lunch window.",
    },
    {
        "teacher_id": 2,
        "teacher_name": "Lec. Faria Sajjad",
        "satisfaction_score": 4,
        "preferred_time": "Morning",
        "avoid_time": "Evening",
        "workload_satisfaction": 4,
        "teaching_hours": 5,
        "num_gaps": 1,
        "department": "Artificial Intelligence",
        "experience_years": 5,
        "comments": "Computer Vision and DIP sessions fit well across non-overlapping days.",
    },
    {
        "teacher_id": 3,
        "teacher_name": "Dr. Ayesha Siddiqui",
        "satisfaction_score": 5,
        "preferred_time": "Afternoon",
        "avoid_time": "Morning",
        "workload_satisfaction": 4,
        "teaching_hours": 6,
        "num_gaps": 1,
        "department": "Computer Science",
        "experience_years": 8,
        "comments": "Afternoon Operating Systems blocks match lab availability.",
    },
]


def seed_demo_fixtures(db: Session, force: bool = False) -> Dict[str, Any]:
    """
    Ensure the database has baseline demo fixtures (solved schedule run, default constraints,
    and sample teacher feedback rows) so all views, analytics, and exports work immediately
    on a fresh database.
    """
    existing_run = (
        db.query(ScheduleRun)
        .filter(ScheduleRun.status == "completed")
        .order_by(ScheduleRun.id.asc())
        .first()
    )

    seeded_schedule = False
    if existing_run is None or force:
        csv_text = _load_demo_csv_text()
        parsed = parse_schedule_csv(csv_text)
        parsed["random_seed"] = 42
        parsed["timeout_seconds"] = 5
        req = GenerateScheduleRequest(**parsed)
        res = generate_schedule(payload=req, db=db)
        schedule_id = res.schedule_id
        seeded_schedule = True
    else:
        schedule_id = existing_run.id

    constraints_added = 0
    if db.query(CustomConstraint).count() == 0 or force:
        for item in DEFAULT_CONSTRAINTS_FIXTURE:
            exists = (
                db.query(CustomConstraint)
                .filter(CustomConstraint.name == item["name"])
                .first()
            )
            if not exists:
                db.add(CustomConstraint(**item))
                constraints_added += 1
        db.commit()

    feedback_added = 0
    if db.query(Feedback).count() == 0 or force:
        for fb in DEFAULT_FEEDBACK_FIXTURE:
            db.add(Feedback(schedule_id=schedule_id, **fb))
            feedback_added += 1
        db.commit()

    return {
        "schedule_id": schedule_id,
        "seeded_schedule": seeded_schedule,
        "constraints_added": constraints_added,
        "feedback_added": feedback_added,
    }
