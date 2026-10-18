"""
ITC-2007 Track 3 (Curriculum-Based Course Timetabling) Parser.

Provides strict parsing and dataclass representations for:
- Competition instance files (.ctt)
- Solution files (.sol)
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Set, Tuple, Union


class BenchmarkParseError(Exception):
    """Raised when an instance or solution file contains malformed data."""
    def __init__(self, message: str, line_num: int, line_content: str = ""):
        super().__init__(f"Line {line_num}: {message} -> '{line_content}'")
        self.line_num = line_num
        self.line_content = line_content


@dataclass(frozen=True)
class Room:
    id: str
    capacity: int


@dataclass
class Course:
    id: str
    teacher: str
    lectures: int
    min_working_days: int
    students: int
    unavailable_periods: Set[Tuple[int, int]] = field(default_factory=set)


@dataclass(frozen=True)
class Curriculum:
    id: str
    course_ids: List[str]


@dataclass
class Instance:
    name: str
    days: int
    periods_per_day: int
    rooms: Dict[str, Room]
    courses: Dict[str, Course]
    curricula: Dict[str, Curriculum]
    declared_courses_count: int = 0
    declared_rooms_count: int = 0
    declared_curricula_count: int = 0
    declared_constraints_count: int = 0

    @property
    def total_periods(self) -> int:
        return self.days * self.periods_per_day

    def period_index(self, day: int, period: int) -> int:
        return day * self.periods_per_day + period

    def period_to_day_slot(self, p: int) -> Tuple[int, int]:
        return (p // self.periods_per_day, p % self.periods_per_day)


@dataclass(frozen=True)
class LectureAssignment:
    course_id: str
    room_id: str
    day: int
    period: int

    def to_line(self) -> str:
        return f"{self.course_id} {self.room_id} {self.day} {self.period}"


@dataclass
class Solution:
    assignments: List[LectureAssignment] = field(default_factory=list)

    @property
    def by_course(self) -> Dict[str, List[LectureAssignment]]:
        grouped: Dict[str, List[LectureAssignment]] = {}
        for a in self.assignments:
            grouped.setdefault(a.course_id, []).append(a)
        return grouped

    def to_string(self) -> str:
        return "\n".join(a.to_line() for a in self.assignments) + "\n"


def parse_instance(source: Union[str, Path]) -> Instance:
    """
    Parse an ITC-2007 .ctt instance file or text string into an Instance dataclass.
    Raises BenchmarkParseError with line number on syntax or semantic structure errors.
    """
    if isinstance(source, Path) or (isinstance(source, str) and os.path.exists(source) and "\n" not in source):
        with open(source, "r", encoding="utf-8") as f:
            lines = f.readlines()
    else:
        lines = str(source).splitlines(keepends=True)

    header_data: Dict[str, str] = {}
    courses: Dict[str, Course] = {}
    rooms: Dict[str, Room] = {}
    curricula: Dict[str, Curriculum] = {}
    current_section = "HEADER"

    for idx, raw_line in enumerate(lines, start=1):
        line = raw_line.strip()
        if not line:
            continue

        # Check section headers
        if line == "COURSES:":
            current_section = "COURSES"
            continue
        elif line == "ROOMS:":
            current_section = "ROOMS"
            continue
        elif line == "CURRICULA:":
            current_section = "CURRICULA"
            continue
        elif line == "UNAVAILABILITY_CONSTRAINTS:":
            current_section = "UNAVAILABILITY"
            continue
        elif line in ("END.", "END"):
            current_section = "END"
            break

        if current_section == "HEADER":
            if ":" not in line:
                raise BenchmarkParseError("Expected header line 'Key: Value'", idx, line)
            parts = line.split(":", 1)
            header_data[parts[0].strip()] = parts[1].strip()

        elif current_section == "COURSES":
            parts = line.split()
            if len(parts) != 5:
                raise BenchmarkParseError("Course line must have 5 tokens: <CourseID> <TeacherID> <Lectures> <MinDays> <Students>", idx, line)
            c_id, teacher, s_lectures, s_mindays, s_students = parts
            try:
                lectures = int(s_lectures)
                min_days = int(s_mindays)
                students = int(s_students)
            except ValueError:
                raise BenchmarkParseError("Course lectures, min days, and students must be integers", idx, line)
            courses[c_id] = Course(
                id=c_id,
                teacher=teacher,
                lectures=lectures,
                min_working_days=min_days,
                students=students,
            )

        elif current_section == "ROOMS":
            parts = line.split()
            if len(parts) != 2:
                raise BenchmarkParseError("Room line must have 2 tokens: <RoomID> <Capacity>", idx, line)
            r_id, s_cap = parts
            try:
                cap = int(s_cap)
            except ValueError:
                raise BenchmarkParseError("Room capacity must be an integer", idx, line)
            rooms[r_id] = Room(id=r_id, capacity=cap)

        elif current_section == "CURRICULA":
            parts = line.split()
            if len(parts) < 2:
                raise BenchmarkParseError("Curriculum line must have at least: <CurriculumID> <Count> ...", idx, line)
            curr_id = parts[0]
            try:
                count = int(parts[1])
            except ValueError:
                raise BenchmarkParseError("Curriculum course count must be an integer", idx, line)
            curr_courses = parts[2:]
            if len(curr_courses) != count:
                raise BenchmarkParseError(f"Curriculum {curr_id} specified {count} courses but listed {len(curr_courses)}", idx, line)
            curricula[curr_id] = Curriculum(id=curr_id, course_ids=curr_courses)

        elif current_section == "UNAVAILABILITY":
            parts = line.split()
            if len(parts) != 3:
                raise BenchmarkParseError("Unavailability line must have 3 tokens: <CourseID> <Day> <Period>", idx, line)
            c_id, s_day, s_period = parts
            if c_id not in courses:
                raise BenchmarkParseError(f"Referenced unknown course '{c_id}' in unavailability constraints", idx, line)
            try:
                day = int(s_day)
                period = int(s_period)
            except ValueError:
                raise BenchmarkParseError("Day and Period in unavailability constraint must be integers", idx, line)
            courses[c_id].unavailable_periods.add((day, period))

    required_headers = ["Name", "Courses", "Rooms", "Days", "Periods_per_day", "Curricula", "Constraints"]
    for rh in required_headers:
        if rh not in header_data:
            raise BenchmarkParseError(f"Missing required header '{rh}:'", 1, "")

    try:
        days = int(header_data["Days"])
        periods_per_day = int(header_data["Periods_per_day"])
        decl_courses = int(header_data["Courses"])
        decl_rooms = int(header_data["Rooms"])
        decl_curricula = int(header_data["Curricula"])
        decl_constraints = int(header_data["Constraints"])
    except ValueError as e:
        raise BenchmarkParseError(f"Header values must be valid integers: {e}", 1, "")

    return Instance(
        name=header_data["Name"],
        days=days,
        periods_per_day=periods_per_day,
        rooms=rooms,
        courses=courses,
        curricula=curricula,
        declared_courses_count=decl_courses,
        declared_rooms_count=decl_rooms,
        declared_curricula_count=decl_curricula,
        declared_constraints_count=decl_constraints,
    )


def parse_solution(source: Union[str, Path]) -> Solution:
    """
    Parse an ITC-2007 .sol solution file or text string into a Solution dataclass.
    Format per line: <CourseID> <RoomID> <Day> <DayPeriod>
    """
    if isinstance(source, Path) or (isinstance(source, str) and os.path.exists(source) and "\n" not in source):
        with open(source, "r", encoding="utf-8") as f:
            lines = f.readlines()
    else:
        lines = str(source).splitlines(keepends=True)

    assignments: List[LectureAssignment] = []
    for idx, raw_line in enumerate(lines, start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) != 4:
            raise BenchmarkParseError("Solution line must contain: <CourseID> <RoomID> <Day> <DayPeriod>", idx, line)
        c_id, r_id, s_day, s_period = parts
        try:
            day = int(s_day)
            period = int(s_period)
        except ValueError:
            raise BenchmarkParseError("Solution Day and DayPeriod must be integers", idx, line)
        assignments.append(LectureAssignment(course_id=c_id, room_id=r_id, day=day, period=period))

    return Solution(assignments=assignments)
