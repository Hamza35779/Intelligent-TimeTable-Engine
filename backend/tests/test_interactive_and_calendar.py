import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db, SessionLocal
from app.models.timetable import ScheduleRun, TimetableEntry
from app.models.faculty import Faculty
from app.models.course import Course
from app.models.venue import Venue
from app.models.slot import TimeSlot


@pytest.fixture
def interactive_schedule(client: TestClient):
    db = SessionLocal()
    uid = uuid.uuid4().hex[:6]
    try:
        fac1 = Faculty(name=f"Prof. Smith {uid}", department="CS", email=f"smith_{uid}@test.edu", preferences={})
        fac2 = Faculty(name=f"Prof. Jones {uid}", department="CS", email=f"jones_{uid}@test.edu", preferences={})
        c1 = Course(name="Algorithms", code=f"CS-201-{uid}", faculty=fac1, capacity_required=30, duration_minutes=60)
        c2 = Course(name="Databases", code=f"CS-202-{uid}", faculty=fac2, capacity_required=30, duration_minutes=60)
        v1 = Venue(name=f"Room 101-{uid}", capacity=40, equipment=["Projector"])
        v2 = Venue(name=f"Room 102-{uid}", capacity=40, equipment=["Whiteboard"])
        slot1 = TimeSlot(day_of_week="Monday", start_time="09:00", end_time="10:00", duration_minutes=60)
        slot2 = TimeSlot(day_of_week="Monday", start_time="10:00", end_time="11:00", duration_minutes=60)
        slot3 = TimeSlot(day_of_week="Tuesday", start_time="09:00", end_time="10:00", duration_minutes=60)

        db.add_all([fac1, fac2, c1, c2, v1, v2, slot1, slot2, slot3])
        db.flush()

        run = ScheduleRun(
            status="completed",
            solver_status="OPTIMAL",
            total_courses_scheduled=2,
            academic_term="Spring 2026",
        )
        db.add(run)
        db.flush()

        # e1: Algorithms on Monday 09:00 in Room 101
        e1 = TimetableEntry(schedule_run_id=run.id, course_id=c1.id, faculty_id=fac1.id, venue_id=v1.id, slot_id=slot1.id)
        # e2: Databases on Monday 10:00 in Room 101
        e2 = TimetableEntry(schedule_run_id=run.id, course_id=c2.id, faculty_id=fac2.id, venue_id=v1.id, slot_id=slot2.id)
        db.add_all([e1, e2])
        db.commit()

        return {
            "schedule_id": run.id,
            "e1_id": e1.id,
            "e2_id": e2.id,
            "v1_name": v1.name,
            "v2_name": v2.name,
            "slot1_id": slot1.id,
            "slot2_id": slot2.id,
            "slot3_id": slot3.id,
        }
    finally:
        db.close()


def test_calendar_ics_and_feed_generation(client: TestClient, interactive_schedule):
    sched_id = interactive_schedule["schedule_id"]

    # 1. Direct ICS export
    res_ics = client.get(f"/export/{sched_id}?format=ics")
    assert res_ics.status_code == 200
    assert res_ics.headers["content-type"].startswith("text/calendar")
    ics_text = res_ics.content.decode("utf-8")
    assert "BEGIN:VCALENDAR" in ics_text
    assert "BEGIN:VEVENT" in ics_text
    assert "SUMMARY:Algorithms" in ics_text
    assert "RRULE:FREQ=WEEKLY" in ics_text
    assert "END:VCALENDAR" in ics_text

    # 2. Feed endpoint
    res_feed = client.get(f"/export/{sched_id}/calendar/feed")
    assert res_feed.status_code == 200
    feed_data = res_feed.json()
    assert "webcal_url" in feed_data
    assert "google_calendar_url" in feed_data
    assert "outlook_calendar_url" in feed_data
    assert "ics_download_url" in feed_data


def test_what_if_simulator_clash_free_direct_move(client: TestClient, interactive_schedule):
    sched_id = interactive_schedule["schedule_id"]
    e1_id = interactive_schedule["e1_id"]

    # Move e1 to Tuesday 09:00 (which is completely free)
    payload = {
        "entry_id": e1_id,
        "target_day": "Tuesday",
        "target_start_time": "09:00",
    }
    res = client.post(f"/schedule/{sched_id}/simulate-move", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["has_clash"] is False
    assert data["halo"] == "green"
    assert data["can_direct_move"] is True
    assert "Direct move verified" in data["message"]


def test_what_if_simulator_clash_detection_and_ripple_resolution(client: TestClient, interactive_schedule):
    sched_id = interactive_schedule["schedule_id"]
    e1_id = interactive_schedule["e1_id"]
    v1_name = interactive_schedule["v1_name"]

    # Try to move e1 to Monday 10:00 (where Databases is already booked in Room 101)
    payload = {
        "entry_id": e1_id,
        "target_day": "Monday",
        "target_start_time": "10:00",
        "target_venue_name": v1_name,
    }
    res = client.post(f"/schedule/{sched_id}/simulate-move", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["has_clash"] is True
    assert data["halo"] == "red"
    assert data["can_direct_move"] is False
    assert "Databases" in data["clash_with"]

    # Check Ripple Resolution
    ripple = data["suggested_ripple"]
    assert ripple is not None
    assert ripple["type"] == "swap"
    assert len(ripple["moves"]) == 2

    # Execute the suggested ripple swap
    apply_res = client.post(f"/schedule/{sched_id}/apply-move", json={"moves": ripple["moves"]})
    assert apply_res.status_code == 200
    assert apply_res.json()["moves_applied"] == 2
