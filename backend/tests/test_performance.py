import time
import pytest
from app.services.solver import TimetableSolver
from tests.test_solver import generate_mock_data


def test_performance_benchmark_50_faculty_100_courses():
    """
    Core Benchmark:
    50 faculty, 20 rooms, 100 courses, 25 slots
    Target: < 5 seconds
    """
    faculty, venues, slots, courses = generate_mock_data(
        num_faculty=50, num_venues=20, num_slots=25, num_courses=100
    )

    solver = TimetableSolver(time_limit_seconds=5)
    solver.add_variables(courses, faculty, venues, slots)
    solver.add_constraints()

    start_t = time.perf_counter()
    is_solved, status, stats = solver.solve()
    duration = time.perf_counter() - start_t

    assert is_solved is True, "Solver failed to find solution for benchmark problem"
    assert duration < 5.0, f"Benchmark failed: took {duration:.2f}s, expected < 5s"
    assert stats["solver_time_ms"] < 5000


def test_performance_scale_up():
    """
    Larger scale benchmark:
    75 faculty, 30 rooms, 150 courses, 30 slots
    Target: solved within timeout
    """
    faculty, venues, slots, courses = generate_mock_data(
        num_faculty=75, num_venues=30, num_slots=30, num_courses=150
    )

    solver = TimetableSolver(time_limit_seconds=10)
    solver.add_variables(courses, faculty, venues, slots)
    solver.add_constraints()

    is_solved, status, stats = solver.solve()
    assert is_solved is True
    assert status in ("OPTIMAL", "FEASIBLE")
