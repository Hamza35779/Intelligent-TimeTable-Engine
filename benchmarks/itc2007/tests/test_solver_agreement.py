"""
Tests Proving Agreement Between Solver Output and Independent Checker.
"""

from pathlib import Path
import pytest

from benchmarks.itc2007.adapter import solve_itc_instance
from benchmarks.itc2007.checker import check_solution
from benchmarks.itc2007.parser import parse_instance

INSTANCES_DIR = Path(__file__).resolve().parent.parent / "instances"


def test_solver_checker_agreement_on_comp01():
    comp01_path = INSTANCES_DIR / "comp01.ctt"
    assert comp01_path.exists()

    instance = parse_instance(comp01_path)
    sol, stats = solve_itc_instance(instance, time_limit_seconds=15, random_seed=42)

    assert sol is not None, f"Solver should find a solution for comp01 within 15s (got {stats.get('status')})"
    assert len(sol.assignments) == 160, "comp01 requires exactly 160 lecture assignments"

    # Evaluate strictly via independent checker
    report = check_solution(instance, sol)

    # Prove complete agreement: 0 hard violations across all 4 categories
    assert report.is_feasible, f"Solution must be feasible: {report.violation_details}"
    assert report.total_hard_violations == 0
    assert report.lectures_violations == 0
    assert report.conflicts_violations == 0
    assert report.availability_violations == 0
    assert report.room_occupation_violations == 0
    assert report.total_lectures_scheduled == 160

    # Soft constraints verification: costs must be non-negative integers
    assert report.room_capacity_cost >= 0
    assert report.min_working_days_cost >= 0
    assert report.total_soft_cost >= 0
