"""
ITC-2007 Track 3 (Curriculum-Based Course Timetabling) Benchmark Suite.
"""

from .parser import (
    Instance,
    Course,
    Room,
    Curriculum,
    Solution,
    LectureAssignment,
    BenchmarkParseError,
    parse_instance,
    parse_solution,
)
from .checker import check_solution, CheckReport
from .adapter import solve_itc_instance, convert_product_schedule_to_solution

__all__ = [
    "Instance",
    "Course",
    "Room",
    "Curriculum",
    "Solution",
    "LectureAssignment",
    "BenchmarkParseError",
    "parse_instance",
    "parse_solution",
    "check_solution",
    "CheckReport",
    "solve_itc_instance",
    "convert_product_schedule_to_solution",
]
