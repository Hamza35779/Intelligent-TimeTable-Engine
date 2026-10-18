"""
Tests for Independent ITC-2007 Solution Checker.
Ensures every hard and soft violation is correctly recounted without importing any solver.
"""

import pytest
from benchmarks.itc2007.parser import Course, Curriculum, Instance, LectureAssignment, Room, Solution
from benchmarks.itc2007.checker import check_solution


@pytest.fixture
def sample_instance() -> Instance:
    """A small synthetic instance for focused boundary and violation testing."""
    courses = {
        "c1": Course(id="c1", teacher="t1", lectures=2, min_working_days=2, students=40, unavailable_periods={(0, 0)}),
        "c2": Course(id="c2", teacher="t1", lectures=2, min_working_days=2, students=20),
        "c3": Course(id="c3", teacher="t2", lectures=1, min_working_days=1, students=50),
    }
    rooms = {
        "r1": Room(id="r1", capacity=30),  # c1 (40) will exceed by 10
        "r2": Room(id="r2", capacity=50),
    }
    curricula = {
        "q1": Curriculum(id="q1", course_ids=["c2", "c3"]),  # c2 and c3 cannot clash
    }
    return Instance(
        name="SyntheticTest",
        days=3,
        periods_per_day=3,
        rooms=rooms,
        courses=courses,
        curricula=curricula,
    )


def test_empty_solution_reports_missing_lectures(sample_instance):
    sol = Solution(assignments=[])
    report = check_solution(sample_instance, sol)

    assert not report.is_feasible
    assert report.total_lectures_required == 5
    assert report.total_lectures_scheduled == 0
    assert report.lectures_violations == 5


def test_checker_detects_room_double_booking(sample_instance):
    # Place c1 and c3 in the exact same room at the same period
    assignments = [
        LectureAssignment(course_id="c1", room_id="r1", day=1, period=0),
        LectureAssignment(course_id="c1", room_id="r1", day=2, period=0),
        LectureAssignment(course_id="c2", room_id="r1", day=1, period=1),
        LectureAssignment(course_id="c2", room_id="r1", day=2, period=1),
        LectureAssignment(course_id="c3", room_id="r1", day=1, period=0),  # Clashes with c1 in r1 at (1, 0)
    ]
    sol = Solution(assignments=assignments)
    report = check_solution(sample_instance, sol)

    assert not report.is_feasible
    assert report.room_occupation_violations == 1
    assert any("Room 'r1' double-booked" in d for d in report.violation_details)


def test_checker_detects_teacher_conflict(sample_instance):
    # c1 and c2 share teacher t1. Place them at the same time in different rooms.
    assignments = [
        LectureAssignment(course_id="c1", room_id="r1", day=1, period=0),  # t1 at (1, 0)
        LectureAssignment(course_id="c1", room_id="r1", day=2, period=0),
        LectureAssignment(course_id="c2", room_id="r2", day=1, period=0),  # t1 at (1, 0) -> CLASH!
        LectureAssignment(course_id="c2", room_id="r2", day=2, period=1),
        LectureAssignment(course_id="c3", room_id="r2", day=0, period=1),
    ]
    sol = Solution(assignments=assignments)
    report = check_solution(sample_instance, sol)

    assert not report.is_feasible
    assert report.conflicts_violations == 1
    assert any("Conflict between 'c1' and 'c2'" in d for d in report.violation_details)


def test_checker_detects_curriculum_conflict(sample_instance):
    # c2 and c3 share curriculum q1. Place them at the same time.
    assignments = [
        LectureAssignment(course_id="c1", room_id="r1", day=1, period=0),
        LectureAssignment(course_id="c1", room_id="r1", day=2, period=0),
        LectureAssignment(course_id="c2", room_id="r1", day=1, period=1),  # q1 at (1, 1)
        LectureAssignment(course_id="c2", room_id="r1", day=2, period=1),
        LectureAssignment(course_id="c3", room_id="r2", day=1, period=1),  # q1 at (1, 1) -> CLASH!
    ]
    sol = Solution(assignments=assignments)
    report = check_solution(sample_instance, sol)

    assert not report.is_feasible
    assert report.conflicts_violations == 1
    assert any("Conflict between 'c2' and 'c3'" in d for d in report.violation_details)


def test_checker_detects_availability_violation(sample_instance):
    # c1 is unavailable at day 0, period 0.
    assignments = [
        LectureAssignment(course_id="c1", room_id="r1", day=0, period=0),  # UNAVAILABLE!
        LectureAssignment(course_id="c1", room_id="r1", day=1, period=0),
        LectureAssignment(course_id="c2", room_id="r1", day=0, period=1),
        LectureAssignment(course_id="c2", room_id="r1", day=1, period=1),
        LectureAssignment(course_id="c3", room_id="r2", day=2, period=0),
    ]
    sol = Solution(assignments=assignments)
    report = check_solution(sample_instance, sol)

    assert not report.is_feasible
    assert report.availability_violations == 1
    assert any("unavailable period Day 0, Period 0" in d for d in report.violation_details)


def test_checker_calculates_soft_penalties(sample_instance):
    # Feasible timetable, but with intentional soft penalties:
    # 1. c1 (40 students) in r1 (capacity 30) twice: penalty = 2 * (40 - 30) * 1 = 20
    # 2. c2 (min_working_days 2) placed both on day 1: distinct_days = 1 (deficit 1) -> 1 * 5 = 5
    # 3. Room stability: c1 uses r1 twice (1 room), c2 uses r1 twice (1 room), c3 uses r2 (1 room) -> 0
    assignments = [
        LectureAssignment(course_id="c1", room_id="r1", day=1, period=0),  # cap viol 10
        LectureAssignment(course_id="c1", room_id="r1", day=2, period=0),  # cap viol 10
        LectureAssignment(course_id="c2", room_id="r1", day=1, period=1),  # day 1
        LectureAssignment(course_id="c2", room_id="r1", day=1, period=2),  # day 1 -> deficit 1
        LectureAssignment(course_id="c3", room_id="r2", day=0, period=1),
    ]
    sol = Solution(assignments=assignments)
    report = check_solution(sample_instance, sol)

    assert report.is_feasible
    assert report.total_hard_violations == 0
    assert report.room_capacity_cost == 20
    assert report.min_working_days_cost == 5
