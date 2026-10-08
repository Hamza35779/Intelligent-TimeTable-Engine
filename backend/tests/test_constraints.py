import pytest
from app.services.validator import ConstraintValidator
from app.schemas.faculty import FacultyCreate
from app.schemas.venue import VenueCreate
from app.schemas.slot import TimeSlotCreate
from app.schemas.course import CourseCreate


def test_validator_detects_empty_inputs():
    is_valid, errors = ConstraintValidator.validate_inputs([], [], [], [])
    assert is_valid is False
    assert len(errors) >= 4


def test_validator_detects_duplicate_emails():
    faculty = [
        FacultyCreate(name="Prof A", department="CS", email="prof@test.com"),
        FacultyCreate(name="Prof B", department="CS", email="prof@test.com"),
    ]
    venues = [VenueCreate(name="Room 101", capacity=40)]
    slots = [TimeSlotCreate(day_of_week="Monday", start_time="09:00", end_time="10:00")]
    courses = [CourseCreate(name="Math", code="MATH101", faculty_id=0, capacity_required=30)]

    is_valid, errors = ConstraintValidator.validate_inputs(faculty, venues, slots, courses)
    assert is_valid is False
    assert any("Duplicate faculty email" in err for err in errors)


def test_validator_detects_course_capacity_exceeding_all_venues():
    faculty = [FacultyCreate(name="Prof A", department="CS", email="prof@test.com")]
    venues = [VenueCreate(name="Small Room", capacity=30)]
    slots = [TimeSlotCreate(day_of_week="Monday", start_time="09:00", end_time="10:00")]
    courses = [CourseCreate(name="Large Lecture", code="CS100", faculty_id=0, capacity_required=100)]

    is_valid, errors = ConstraintValidator.validate_inputs(faculty, venues, slots, courses)
    assert is_valid is False
    assert any("requires capacity 100" in err for err in errors)


def test_validator_detects_invalid_slot_time_order():
    faculty = [FacultyCreate(name="Prof A", department="CS", email="prof@test.com")]
    venues = [VenueCreate(name="Room 101", capacity=50)]
    slots = [TimeSlotCreate(day_of_week="Monday", start_time="11:00", end_time="09:00")]
    courses = [CourseCreate(name="Math", code="MATH101", faculty_id=0, capacity_required=30)]

    is_valid, errors = ConstraintValidator.validate_inputs(faculty, venues, slots, courses)
    assert is_valid is False
    assert any("earlier than end_time" in err for err in errors)
