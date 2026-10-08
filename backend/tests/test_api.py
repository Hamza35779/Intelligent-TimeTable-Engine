import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, engine

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("healthy", "degraded")
    assert "solver" in data
    assert data["solver"]["ready"] is True


def test_constraint_crud():
    # 1. Create constraint
    payload = {
        "type": "soft",
        "name": "Maximize Morning Slots",
        "description": "Prefers scheduling before 12pm",
        "weight": 2.5,
        "constraint_data": {"prefer_morning": True},
    }
    create_resp = client.post("/constraints", json=payload)
    assert create_resp.status_code == 201
    created_data = create_resp.json()
    constraint_id = created_data["id"]
    assert created_data["name"] == payload["name"]

    # 2. List constraints
    list_resp = client.get("/constraints")
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert any(c["id"] == constraint_id for c in items)

    # 3. Delete constraint
    del_resp = client.delete(f"/constraints/{constraint_id}")
    assert del_resp.status_code == 204

    # Verify deleted
    list_again = client.get("/constraints")
    assert not any(c["id"] == constraint_id for c in list_again.json())


def test_schedule_generation_and_analytics_flow():
    generate_payload = {
        "faculty": [
            {
                "name": "Dr. Claude Shannon",
                "department": "Information Theory",
                "max_hours_per_day": 4,
                "max_days_per_week": 4,
                "email": "shannon@univ.edu",
                "preferences": {"prefer_morning": True},
                "unavailable_slots": [],
            },
            {
                "name": "Dr. Ada Lovelace",
                "department": "Computer Science",
                "max_hours_per_day": 4,
                "max_days_per_week": 4,
                "email": "ada@univ.edu",
                "preferences": {"prefer_morning": False},
                "unavailable_slots": [],
            },
        ],
        "venues": [
            {
                "name": "Main Auditorium",
                "capacity": 100,
                "equipment": ["projector", "mic"],
                "available_slots": [0, 1, 2, 3],
            },
            {
                "name": "Lab 1",
                "capacity": 40,
                "equipment": ["computers"],
                "available_slots": [0, 1, 2, 3],
            },
        ],
        "slots": [
            {"day_of_week": "Monday", "start_time": "09:00", "end_time": "10:00", "duration_minutes": 60},
            {"day_of_week": "Monday", "start_time": "10:00", "end_time": "11:00", "duration_minutes": 60},
            {"day_of_week": "Tuesday", "start_time": "09:00", "end_time": "10:00", "duration_minutes": 60},
            {"day_of_week": "Tuesday", "start_time": "10:00", "end_time": "11:00", "duration_minutes": 60},
        ],
        "courses": [
            {
                "name": "Info Theory 101",
                "code": "IT101",
                "faculty_id": 0,
                "capacity_required": 50,
                "duration_minutes": 60,
            },
            {
                "name": "Programming Principles",
                "code": "CS101",
                "faculty_id": 1,
                "capacity_required": 30,
                "duration_minutes": 60,
            },
        ],
        "timeout_seconds": 5,
    }

    # Generate timetable
    gen_resp = client.post("/schedule/generate", json=generate_payload)
    assert gen_resp.status_code == 201
    gen_data = gen_resp.json()
    schedule_id = gen_data["schedule_id"]
    assert gen_data["status"] == "completed"
    assert len(gen_data["schedule"]) == 2
    assert gen_data["stats"]["solver_time_ms"] > 0

    # Retrieve schedule by ID
    get_resp = client.get(f"/schedule/{schedule_id}")
    assert get_resp.status_code == 200
    detail_data = get_resp.json()
    assert detail_data["id"] == schedule_id
    assert len(detail_data["entries"]) == 2

    # Retrieve analytics by schedule ID
    analytics_resp = client.get(f"/analytics/schedule/{schedule_id}")
    assert analytics_resp.status_code == 200
    analytics_data = analytics_resp.json()
    assert analytics_data["schedule_id"] == schedule_id
    assert "faculty_workload" in analytics_data
    assert "venue_utilization" in analytics_data
