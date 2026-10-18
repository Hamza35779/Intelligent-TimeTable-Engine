"""
Tests Proving Solver Internal Claims Are Never Trusted.

Demonstrates that even if a solver claims "OPTIMAL" or "FEASIBLE", the independent
checker will catch any corrupted or invalid assignments and report true violation counts.
"""

from pathlib import Path
import pytest

from benchmarks.itc2007.adapter import solve_itc_instance
from benchmarks.itc2007.checker import check_solution
from benchmarks.itc2007.parser import LectureAssignment, Solution, parse_instance

INSTANCES_DIR = Path(__file__).resolve().parent.parent / "instances"


def test_independent_checker_detects_corrupted_solution():
    comp01_path = INSTANCES_DIR / "comp01.ctt"
    instance = parse_instance(comp01_path)

    # Solve comp01 to obtain a valid solution
    sol, stats = solve_itc_instance(instance, time_limit_seconds=15, random_seed=42)
    assert sol is not None
    assert stats["status"] in ("OPTIMAL", "FEASIBLE")

    # Baseline: genuine solution passes
    baseline_report = check_solution(instance, sol)
    assert baseline_report.is_feasible
    assert baseline_report.total_hard_violations == 0

    # Tamper 1: Inject an availability violation
    # Course c0001 is unavailable on Day 4, Period 0
    tampered_assignments_1 = list(sol.assignments)
    for idx, a in enumerate(tampered_assignments_1):
        if a.course_id == "c0001":
            tampered_assignments_1[idx] = LectureAssignment(
                course_id="c0001",
                room_id=a.room_id,
                day=4,
                period=0,  # UNAVAILABLE for c0001!
            )
            break

    tampered_sol_1 = Solution(assignments=tampered_assignments_1)
    report_1 = check_solution(instance, tampered_sol_1)
    # Regardless of any solver claim, checker must catch the availability violation
    assert not report_1.is_feasible
    assert report_1.availability_violations >= 1
    assert report_1.total_hard_violations >= 1

    # Tamper 2: Drop one lecture (missing lecture violation)
    tampered_assignments_2 = sol.assignments[:-1]
    tampered_sol_2 = Solution(assignments=tampered_assignments_2)
    report_2 = check_solution(instance, tampered_sol_2)
    assert not report_2.is_feasible
    assert report_2.lectures_violations == 1
    assert report_2.total_lectures_scheduled == 159
    assert report_2.total_lectures_required == 160

    # Tamper 3: Force a room collision
    # Reassign second lecture to match the room and time of first lecture
    tampered_assignments_3 = list(sol.assignments)
    first = tampered_assignments_3[0]
    tampered_assignments_3[1] = LectureAssignment(
        course_id=tampered_assignments_3[1].course_id,
        room_id=first.room_id,
        day=first.day,
        period=first.period,
    )
    tampered_sol_3 = Solution(assignments=tampered_assignments_3)
    report_3 = check_solution(instance, tampered_sol_3)
    assert not report_3.is_feasible
    assert report_3.room_occupation_violations >= 1
