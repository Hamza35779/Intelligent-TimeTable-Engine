import json
import os
from typing import Dict, Any, List, Tuple
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import Base, SessionLocal, engine
from app.services.solver import TimetableSolver
from ml.feature_engineer import FeatureEngineer
from utils.csv_parser import parse_schedule_csv


REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FIXTURES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")


@pytest.fixture(autouse=True)
def setup_database():
    """Ensure all database tables exist and have up-to-date columns before each test run."""
    import sqlalchemy as sa
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        inspector = sa.inspect(conn)
        if "schedule_runs" in inspector.get_table_names():
            cols = {c["name"] for c in inspector.get_columns("schedule_runs")}
            if "academic_term" not in cols:
                conn.execute(sa.text("ALTER TABLE schedule_runs ADD COLUMN academic_term VARCHAR(50) DEFAULT 'General'"))
            if "department" not in cols:
                conn.execute(sa.text("ALTER TABLE schedule_runs ADD COLUMN department VARCHAR(100) DEFAULT 'All'"))
            if "created_by" not in cols:
                conn.execute(sa.text("ALTER TABLE schedule_runs ADD COLUMN created_by VARCHAR(100) DEFAULT 'System'"))
            conn.commit()
    yield


@pytest.fixture
def db_session() -> Session:
    """Provide a transactional SQLAlchemy database session for tests."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client() -> TestClient:
    """Provide a FastAPI TestClient instance."""
    return TestClient(app)


@pytest.fixture
def demo_csv_path() -> str:
    """Return the path to the 6-teacher, 12-course supervisor demo CSV fixture."""
    path = os.path.join(REPO_ROOT, "data", "demo_courses.csv")
    if not os.path.exists(path):
        path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "demo_courses.csv")
    return path


@pytest.fixture
def demo_csv_bytes(demo_csv_path: str) -> bytes:
    """Return raw bytes of data/demo_courses.csv."""
    with open(demo_csv_path, "rb") as f:
        return f.read()


@pytest.fixture
def demo_csv_text(demo_csv_bytes: bytes) -> str:
    """Return UTF-8 text of data/demo_courses.csv."""
    return demo_csv_bytes.decode("utf-8")


@pytest.fixture
def parsed_demo_schedule(demo_csv_text: str) -> Dict[str, Any]:
    """Parse data/demo_courses.csv into faculty, venues, slots, courses, and config."""
    return parse_schedule_csv(demo_csv_text)


@pytest.fixture
def solved_demo_entries(parsed_demo_schedule: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Return a deterministically solved (seed=42) schedule from data/demo_courses.csv."""
    solver = TimetableSolver(
        time_limit_seconds=5,
        random_seed=42,
        config=parsed_demo_schedule["config"],
    )
    solver.add_variables(
        courses=parsed_demo_schedule["courses"],
        faculty=parsed_demo_schedule["faculty"],
        venues=parsed_demo_schedule["venues"],
        slots=parsed_demo_schedule["slots"],
    )
    solver.add_constraints([])
    is_solved, status, _ = solver.solve(timeout_seconds=5)
    assert is_solved is True, f"Demo fixture failed to solve: {status}"
    return solver.get_solution()


@pytest.fixture
def impossible_50h_csv_text() -> str:
    """Return an infeasible CSV fixture where 1 teacher is assigned 50 credit hours in a 40-hour week."""
    return (
        "teacher_name,course_name,credit_hours\n"
        + "\n".join(f"Dr. Overloaded,Course {i},5" for i in range(1, 11))
    )


@pytest.fixture
def sample_schedule_payload() -> Dict[str, Any]:
    """Load the standard JSON schedule generation payload fixture."""
    fixture_file = os.path.join(FIXTURES_DIR, "sample_schedule_payload.json")
    if os.path.exists(fixture_file):
        with open(fixture_file, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "faculty": [
            {
                "name": "Ahmad Ali",
                "department": "Computer Science",
                "max_hours_per_day": 4,
                "max_days_per_week": 5,
                "email": "ahmad@univ.edu",
                "preferences": {"prefer_morning": True},
                "unavailable_slots": [],
            },
            {
                "name": "Fatima Khan",
                "department": "Information Theory",
                "max_hours_per_day": 4,
                "max_days_per_week": 5,
                "email": "fatima@univ.edu",
                "preferences": {"prefer_morning": False},
                "unavailable_slots": [],
            },
        ],
        "venues": [
            {"name": "Room 101", "capacity": 100, "equipment": ["projector"], "available_slots": [0, 1, 2, 3]},
            {"name": "Room 102", "capacity": 60, "equipment": ["computers"], "available_slots": [0, 1, 2, 3]},
        ],
        "slots": [
            {"day_of_week": "Monday", "start_time": "09:00", "end_time": "10:00", "duration_minutes": 60},
            {"day_of_week": "Monday", "start_time": "10:00", "end_time": "11:00", "duration_minutes": 60},
            {"day_of_week": "Tuesday", "start_time": "09:00", "end_time": "10:00", "duration_minutes": 60},
            {"day_of_week": "Tuesday", "start_time": "10:00", "end_time": "11:00", "duration_minutes": 60},
        ],
        "courses": [
            {"name": "Data Structures", "code": "CS201", "faculty_id": 0, "capacity_required": 50, "duration_minutes": 60},
            {"name": "Database Systems", "code": "CS202", "faculty_id": 1, "capacity_required": 40, "duration_minutes": 60},
        ],
        "timeout_seconds": 5,
    }


@pytest.fixture
def synthetic_feedback_dataset() -> Tuple[List[Dict[str, Any]], Dict[int, Dict[str, Any]]]:
    """Provide deterministic synthetic teacher feedback rows and history for ML tests."""
    fe = FeatureEngineer()
    return fe.generate_synthetic_training_data(n_samples=80)


@pytest.fixture
def seeded_demo_schedule_id(client: TestClient) -> int:
    """Run POST /demo/run and return the persisted schedule_id."""
    resp = client.post("/demo/run")
    assert resp.status_code in (200, 201)
    return resp.json()["schedule_id"]
