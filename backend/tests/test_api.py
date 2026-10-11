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

    list_resp = client.get("/constraints")
    assert list_resp.status_code == 200
    assert any(c["id"] == constraint_id for c in list_resp.json())

    del_resp = client.delete(f"/constraints/{constraint_id}")
    assert del_resp.status_code == 204


def test_schedule_generation_views_exports_feedback_and_chat():
    generate_payload = {
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

    gen_resp = client.post("/schedule/generate", json=generate_payload)
    assert gen_resp.status_code == 201
    gen_data = gen_resp.json()
    schedule_id = gen_data["schedule_id"]
    assert gen_data["analytics"]["fairness_score"] >= 0.80

    # Tabular endpoint
    table_resp = client.get(f"/schedule/{schedule_id}/table?view=master")
    assert table_resp.status_code == 200
    assert table_resp.json()["format"] == "tabular"

    # Multi-view endpoint (all 5 perspectives)
    views_resp = client.get(f"/schedule/{schedule_id}/views")
    assert views_resp.status_code == 200
    views_data = views_resp.json()["views"]
    assert set(views_data.keys()) == {"master", "teacher", "student", "staff", "canteen"}

    # Export in all 7 formats
    for fmt in ("csv", "xlsx", "pdf", "png", "jpg", "json", "html"):
        exp_resp = client.get(f"/export/{schedule_id}?format={fmt}&view=canteen")
        assert exp_resp.status_code == 200
        assert len(exp_resp.content) > 0

    # Submit Feedback -> Triggers ML Retraining
    fb_resp = client.post(
        f"/feedback/{schedule_id}",
        json={
            "teacher_id": 1,
            "teacher_name": "Ahmad Ali",
            "satisfaction_score": 5,
            "preferred_time": "Morning",
            "workload_satisfaction": 4,
            "comments": "Great morning allocation!",
        },
    )
    assert fb_resp.status_code == 201
    assert fb_resp.json()["received"] is True

    # ML stats & retrain endpoints
    ml_stats = client.get("/ml/model-stats")
    assert ml_stats.status_code == 200
    assert ml_stats.json()["training_samples"] >= 80

    ml_retrain = client.post("/ml/retrain")
    assert ml_retrain.status_code == 200

    # Conversational AI Chatbot workflow
    chat_start = client.post("/chat/start", json={"schedule_id": schedule_id})
    assert chat_start.status_code == 200
    conv_id = chat_start.json()["conversation_id"]

    chat_msg = client.post(
        f"/chat/{conv_id}/message",
        json={"message": "I need schedules for teachers, students, and canteen staff in PDF and Excel"},
    )
    assert chat_msg.status_code == 200
    msg_data = chat_msg.json()
    assert "teacher" in msg_data["detected_views"]
    assert "canteen" in msg_data["detected_views"]
    assert msg_data["status"] == "ready_to_generate"

    chat_gen = client.post(
        f"/chat/{conv_id}/generate",
        json={"views": ["master", "teacher", "student", "staff", "canteen"], "formats": ["pdf", "xlsx", "png"]},
    )
    assert chat_gen.status_code == 200
    assert chat_gen.json()["schedules_generated"] == 5


def test_csv_upload_endpoint():
    csv_content = (
        "teacher,course,code,hours,preferred_time,department,capacity\n"
        "Ahmad Ali,Data Structures,CS301,3,Morning,Computer Science,50\n"
        "Fatima Khan,Database Systems,CS302,4,Afternoon,Computer Science,45\n"
    )
    resp = client.post(
        "/schedule/upload-csv",
        files={"file": ("courses.csv", csv_content.encode("utf-8"), "text/csv")},
    )
    assert resp.status_code == 201
    assert len(resp.json()["schedule"]) == 2


def test_reschedule_scoping_and_unseated_slot_exclusion():
    """
    Regression test for [ISS-001]:
    Verify that rescheduling a specific run only reschedules that run's courses
    and strictly vacates the unseated slot without index shifting errors.
    """
    payload = {
        "faculty": [
            {
                "name": "Dr. Resched A",
                "department": "CS",
                "max_hours_per_day": 4,
                "max_days_per_week": 5,
                "email": "resched_a@univ.edu",
                "preferences": {"prefer_morning": True},
                "unavailable_slots": [],
            }
        ],
        "venues": [
            {"name": "Resched Hall 1", "capacity": 80, "equipment": [], "available_slots": [0, 1, 2]},
        ],
        "slots": [
            {"day_of_week": "Monday", "start_time": "09:00", "end_time": "10:00", "duration_minutes": 60},
            {"day_of_week": "Monday", "start_time": "10:00", "end_time": "11:00", "duration_minutes": 60},
            {"day_of_week": "Monday", "start_time": "11:00", "end_time": "12:00", "duration_minutes": 60},
        ],
        "courses": [
            {"name": "Systems I", "code": "SYS101", "faculty_id": 0, "capacity_required": 40, "duration_minutes": 60},
            {"name": "Systems II", "code": "SYS102", "faculty_id": 0, "capacity_required": 40, "duration_minutes": 60},
        ],
        "timeout_seconds": 5,
    }
    gen_resp = client.post("/schedule/generate", json=payload)
    assert gen_resp.status_code == 201
    initial_data = gen_resp.json()
    sched_id = initial_data["schedule_id"]
    assert len(initial_data["schedule"]) == 2

    # Unseat 0-based slot 0 (Monday 09:00)
    resched_resp = client.post(
        "/schedule/reschedule",
        json={
            "timetable_id": sched_id,
            "unseated_slot_ids": [0],
            "unavailable_venue_ids": [],
            "unavailable_faculty_slots": {},
            "timeout_seconds": 5,
        },
    )
    assert resched_resp.status_code == 200
    resched_data = resched_resp.json()
    # Must contain only the 2 courses from this schedule run, not courses from previous runs
    assert len(resched_data["schedule"]) == 2
    # Neither course may be scheduled at Monday 09:00 (slot index 0)
    for entry in resched_data["schedule"]:
        assert not (entry["day_of_week"] == "Monday" and entry["start_time"] == "09:00")


def test_exporter_xss_and_formula_injection_sanitization():
    """
    Regression test for [ISS-003]:
    Verify HTML export escapes script tags and CSV export neutralizes formula injection prefixes.
    """
    payload = {
        "faculty": [
            {
                "name": "=CMD|' /C calc'!A0",
                "department": "Security",
                "max_hours_per_day": 4,
                "max_days_per_week": 5,
                "email": "sec_audit@univ.edu",
                "preferences": {},
                "unavailable_slots": [],
            }
        ],
        "venues": [
            {"name": "Safe Room <img src=x onerror=alert(1)>", "capacity": 60, "equipment": []},
        ],
        "slots": [
            {"day_of_week": "Monday", "start_time": "09:00", "end_time": "10:00", "duration_minutes": 60},
        ],
        "courses": [
            {
                "name": "<script>alert('xss')</script>",
                "code": "SEC999",
                "faculty_id": 0,
                "capacity_required": 30,
                "duration_minutes": 60,
            },
        ],
        "timeout_seconds": 5,
    }
    gen_resp = client.post("/schedule/generate", json=payload)
    assert gen_resp.status_code == 201
    sched_id = gen_resp.json()["schedule_id"]

    html_resp = client.get(f"/export/{sched_id}?format=html&view=master")
    assert html_resp.status_code == 200
    html_text = html_resp.content.decode("utf-8")
    assert "<script>alert('xss')</script>" not in html_text
    assert "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;" in html_text

    csv_resp = client.get(f"/export/{sched_id}?format=csv&view=master")
    assert csv_resp.status_code == 200
    csv_text = csv_resp.content.decode("utf-8")
    assert "'=CMD|' /C calc'!A0" in csv_text
