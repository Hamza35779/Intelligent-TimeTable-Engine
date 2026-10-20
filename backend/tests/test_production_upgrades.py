"""
Tests for Production Hardening Upgrades:
1. Asynchronous Job Queue (Non-blocking background solves)
2. Deterministic Explicit Preferences vs ML Guesswork
3. Specialized Room Equipment & Type Constraints
4. Institutional Scoping (Academic Term & Department)
"""

import time
import pytest
from fastapi.testclient import TestClient
from app.services.job_queue import job_queue, JobStatus
from ml.predictor import PreferencePredictor
from app.services.solver import TimetableSolver
from utils.csv_parser import parse_schedule_csv


def test_async_job_queue_lifecycle(client: TestClient, demo_csv_path: str):
    """Verify that jobs can be submitted asynchronously, polled, and completed without blocking."""
    with open(demo_csv_path, "r", encoding="utf-8") as f:
        csv_text = f.read()

    payload = parse_schedule_csv(csv_text)
    payload["timeout_seconds"] = 3
    payload["academic_term"] = "Fall 2025"
    payload["department"] = "Computer Science"

    # 1. Submit Job -> 202 Accepted
    resp = client.post("/schedule/jobs/generate", json=payload)
    assert resp.status_code == 202
    data = resp.json()
    job_id = data["job_id"]
    assert job_id is not None
    assert data["status"] in ("QUEUED", "RUNNING", "COMPLETED")

    # 2. Poll until completed (timeout safety of 15 seconds)
    max_wait = 15
    start = time.time()
    final_data = None
    while time.time() - start < max_wait:
        poll_resp = client.get(f"/schedule/jobs/{job_id}")
        assert poll_resp.status_code == 200
        job_info = poll_resp.json()
        if job_info["status"] in ("COMPLETED", "FAILED"):
            final_data = job_info
            break
        time.sleep(0.5)

    assert final_data is not None, "Async job did not finish within timeout"
    assert final_data["status"] == "COMPLETED"
    assert final_data["result"] is not None
    assert final_data["result"]["schedule_id"] is not None
    assert len(final_data["result"]["schedule"]) > 0

    # 3. Verify listing recent jobs
    list_resp = client.get("/schedule/jobs")
    assert list_resp.status_code == 200
    jobs = list_resp.json()
    assert any(j["job_id"] == job_id for j in jobs)


def test_deterministic_preferences_overrides_random_forest():
    """Verify that explicit teacher preferences are treated as ground truth with 100% fidelity."""
    predictor = PreferencePredictor()

    # Teacher with explicit Afternoon preference
    afternoon_teacher = {
        "name": "Dr. Afternoon",
        "preferences": {"preferred_time": "Afternoon"},
    }
    p_afternoon = predictor.predict_for_teacher(afternoon_teacher)
    assert p_afternoon["Afternoon"] >= 0.80
    assert predictor.model_source == "explicit_declaration"

    # Teacher with explicit Morning preference
    morning_teacher = {
        "name": "Dr. Morning",
        "preferences": {"preferred_time": "Morning"},
    }
    p_morning = predictor.predict_for_teacher(morning_teacher)
    assert p_morning["Morning"] >= 0.80
    assert predictor.model_source == "explicit_declaration"


def test_room_equipment_and_type_matching():
    """Verify that specialized courses (e.g. Lab) are matched strictly to compatible venues."""
    courses = [
        {"id": 1, "name": "AI Lab", "code": "AILAB", "faculty_id": 1, "credit_hours": 2, "room_type": "Lab", "capacity_required": 25},
    ]
    faculty = [
        {"id": 1, "name": "Dr. Lab", "department": "CS", "max_hours_per_day": 6, "preferences": {}, "unavailable_slots": []}
    ]
    # Only Room 2 is a Lab
    venues = [
        {"id": 1, "name": "Standard Hall 1", "capacity": 50, "room_type": "Lecture"},
        {"id": 2, "name": "Computing Lab 1", "capacity": 30, "room_type": "Lab"},
    ]
    slots = [
        {"id": 1, "day_of_week": "Monday", "start_time": "09:00", "end_time": "10:00", "duration_minutes": 60},
        {"id": 2, "day_of_week": "Monday", "start_time": "10:00", "end_time": "11:00", "duration_minutes": 60},
    ]

    solver = TimetableSolver(time_limit_seconds=5)
    solver.add_variables(courses=courses, faculty=faculty, venues=venues, slots=slots)
    solver.add_constraints([])
    is_solved, status, _ = solver.solve(timeout_seconds=5)

    assert is_solved is True
    sol = solver.get_solution()
    assert len(sol) > 0
    # Every session of the lab course must be in Venue 2 (Computing Lab 1)
    for entry in sol:
        assert entry["venue_id"] == 2
        assert "Lab" in entry["venue_name"]


def test_schedule_filtering_by_academic_term(client: TestClient):
    """Verify that schedule listings can be filtered by academic term and department."""
    resp = client.get("/schedules?term=Fall%202025")
    assert resp.status_code == 200
    schedules = resp.json()
    assert isinstance(schedules, list)
    for s in schedules:
        assert s["academic_term"] == "Fall 2025"
