"""
Tests for ITC-2007 Track 3 Instance and Solution Parser.
"""

from pathlib import Path
import pytest

from benchmarks.itc2007.parser import (
    BenchmarkParseError,
    Instance,
    LectureAssignment,
    Solution,
    parse_instance,
    parse_solution,
)

INSTANCES_DIR = Path(__file__).resolve().parent.parent / "instances"


def test_parse_official_comp01():
    comp01_path = INSTANCES_DIR / "comp01.ctt"
    assert comp01_path.exists(), "Official comp01.ctt must exist"

    inst = parse_instance(comp01_path)
    assert inst.name == "Fis0506-1"
    assert inst.days == 5
    assert inst.periods_per_day == 6
    assert inst.total_periods == 30
    assert len(inst.courses) == 30
    assert len(inst.rooms) == 6
    assert len(inst.curricula) == 14

    # Spot-check known courses from comp01
    c1 = inst.courses["c0001"]
    assert c1.teacher == "t000"
    assert c1.lectures == 6
    assert c1.min_working_days == 4
    assert c1.students == 130
    assert (4, 0) in c1.unavailable_periods
    assert (4, 5) in c1.unavailable_periods

    # Spot-check known room
    assert inst.rooms["B"].capacity == 200


def test_parser_raises_on_invalid_header():
    malformed = """Courses: 1
Rooms: 1
Days: 5
Periods_per_day: 6
Curricula: 1
Constraints: 0
"""
    # Missing 'Name:'
    with pytest.raises(BenchmarkParseError) as exc_info:
        parse_instance(malformed)
    assert "Missing required header 'Name:'" in str(exc_info.value)


def test_parser_raises_on_malformed_course_line():
    malformed = """Name: Test
Courses: 1
Rooms: 1
Days: 5
Periods_per_day: 6
Curricula: 1
Constraints: 0

COURSES:
c1 t1 not_an_int 4 30

ROOMS:
r1 100

CURRICULA:
q1 1 c1

END.
"""
    with pytest.raises(BenchmarkParseError) as exc_info:
        parse_instance(malformed)
    assert "must be integers" in str(exc_info.value)
    assert exc_info.value.line_num == 10


def test_solution_parser_roundtrip():
    sol_text = """c0001 B 0 0
c0001 B 1 0
c0002 C 0 1
"""
    sol = parse_solution(sol_text)
    assert len(sol.assignments) == 3
    assert sol.assignments[0] == LectureAssignment(course_id="c0001", room_id="B", day=0, period=0)
    assert sol.assignments[2] == LectureAssignment(course_id="c0002", room_id="C", day=0, period=1)

    # Check to_string roundtrip
    rendered = sol.to_string()
    sol2 = parse_solution(rendered)
    assert sol2.assignments == sol.assignments


def test_solution_parser_raises_on_malformed_tokens():
    bad_sol = "c0001 B 0"
    with pytest.raises(BenchmarkParseError) as exc_info:
        parse_solution(bad_sol)
    assert "Solution line must contain: <CourseID> <RoomID> <Day> <DayPeriod>" in str(exc_info.value)
    assert exc_info.value.line_num == 1
