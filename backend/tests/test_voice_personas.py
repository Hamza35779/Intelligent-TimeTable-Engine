import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db, Base
from app.models.timetable import ScheduleRun, TimetableEntry
from app.models.course import Course
from app.models.faculty import Faculty
from app.models.venue import Venue
from app.models.slot import TimeSlot


@pytest.fixture
def seeded_schedule(client: TestClient, db_session):
    uid = uuid.uuid4().hex[:6]
    fac1 = Faculty(name=f"Dr. Tariq {uid}", department="CS", email=f"tariq_{uid}@test.edu", preferences={})
    fac2 = Faculty(name=f"Lec. Faria {uid}", department="CS", email=f"faria_{uid}@test.edu", preferences={})
    c1 = Course(name="Artificial Intelligence", code=f"CS-401-{uid}", faculty=fac1, capacity_required=30, duration_minutes=60)
    c2 = Course(name="Computer Vision", code=f"CS-402-{uid}", faculty=fac2, capacity_required=25, duration_minutes=60)
    v1 = Venue(name=f"Room A-101-{uid}", capacity=40, equipment=["Projector"])
    v2 = Venue(name=f"Room B-201-{uid}", capacity=35, equipment=["Whiteboard"])
    slot1 = TimeSlot(day_of_week="Monday", start_time="09:00", end_time="10:00", duration_minutes=60)
    slot2 = TimeSlot(day_of_week="Monday", start_time="10:00", end_time="11:00", duration_minutes=60)
    slot3 = TimeSlot(day_of_week="Tuesday", start_time="09:00", end_time="10:00", duration_minutes=60)

    db_session.add_all([fac1, fac2, c1, c2, v1, v2, slot1, slot2, slot3])
    db_session.flush()

    run = ScheduleRun(
        status="completed",
        solver_status="OPTIMAL",
        total_courses_scheduled=2,
        academic_term="Fall 2026",
    )
    db_session.add(run)
    db_session.flush()

    e1 = TimetableEntry(schedule_run_id=run.id, course_id=c1.id, faculty_id=fac1.id, venue_id=v1.id, slot_id=slot1.id)
    e2 = TimetableEntry(schedule_run_id=run.id, course_id=c2.id, faculty_id=fac2.id, venue_id=v2.id, slot_id=slot2.id)
    db_session.add_all([e1, e2])
    db_session.commit()

    return {
        "schedule_id": run.id,
        "fac1": fac1,
        "fac2": fac2,
        "c1": c1,
        "c2": c2,
        "v1": v1,
        "v2": v2,
        "slot1": slot1,
        "slot2": slot2,
    }


def test_admin_voice_move_room_success(client: TestClient, seeded_schedule):
    sched_id = seeded_schedule["schedule_id"]
    target_room = seeded_schedule["v2"].name
    res = client.post(
        "/chat/message",
        json={"message": f"Move Artificial Intelligence to {target_room}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["mode"] == "voice_persona"
    assert data["intent"]["action"] == "move_room"
    assert data["intent"]["status"] == "success"
    assert target_room in data["reply"]
    assert "speech_text" in data
    assert f"moved to {target_room}" in data["speech_text"]


def test_admin_voice_move_room_clash(client: TestClient, seeded_schedule, db_session):
    sched_id = seeded_schedule["schedule_id"]
    uid = uuid.uuid4().hex[:6]
    v2 = seeded_schedule["v2"]
    slot1 = seeded_schedule["slot1"]
    fac2 = seeded_schedule["fac2"]
    c3 = Course(name="Algorithms", code=f"CS-301-{uid}", faculty=fac2, capacity_required=30, duration_minutes=60)
    db_session.add(c3)
    db_session.flush()
    clash_e = TimetableEntry(
        schedule_run_id=sched_id,
        course_id=c3.id,
        faculty_id=fac2.id,
        venue_id=v2.id,
        slot_id=slot1.id,
    )
    db_session.add(clash_e)
    db_session.commit()

    res = client.post(
        "/chat/message",
        json={"message": f"Move Artificial Intelligence to {v2.name}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["mode"] == "voice_persona"
    assert data["intent"]["status"] == "clash"
    assert "Clash detected" in data["reply"]
    assert "clashes with" in data["speech_text"]


def test_faculty_voice_availability_busy(client: TestClient, seeded_schedule):
    fac_name = seeded_schedule["fac1"].name
    res = client.post(
        "/chat/message",
        json={"message": f"Am I free on Monday at 09:00 am?", "user_name": fac_name},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["mode"] == "voice_persona"
    assert data["intent"]["status"] == "busy"
    assert "NOT free" in data["reply"]
    assert "Artificial Intelligence" in data["reply"]


def test_faculty_voice_availability_free(client: TestClient, seeded_schedule):
    fac_name = seeded_schedule["fac1"].name
    res = client.post(
        "/chat/message",
        json={"message": f"Am I free on Monday at 2:00 pm?", "user_name": fac_name},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["mode"] == "voice_persona"
    assert data["intent"]["status"] == "free"
    assert "free" in data["reply"].lower()


def test_student_voice_next_class(client: TestClient, seeded_schedule):
    res = client.post(
        "/chat/message",
        json={"message": "What is my next class?"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["mode"] == "voice_persona"
    assert data["intent"]["action"] == "next_class"
    assert "Your next class is" in data["reply"]
    assert "speech_text" in data
