import time
from app.services.solver import TimetableSolver
from solver.constraint_solver import solve_schedule
from solver.fairness import (
    verify_no_conflicts,
    calculate_fairness_score,
    calculate_preference_satisfaction,
)
from utils.timetable_formatter import build_table_rows


def generate_mock_data(num_faculty=5, num_venues=3, num_slots=10, num_courses=8):
    faculty = [
        {
            "id": i,
            "name": f"Faculty {i}",
            "department": "Engineering",
            "max_hours_per_day": 4,
            "max_days_per_week": 5,
            "email": f"fac{i}@example.edu",
            "preferences": {
                "prefer_morning": i % 2 == 0,
                "Morning": 0.85 if i % 2 == 0 else 0.4,
                "Afternoon": 0.85 if i % 2 != 0 else 0.5,
                "Evening": 0.2,
                "preferred_days": ["Monday", "Wednesday"],
            },
            "unavailable_slots": [1] if i == 0 else [],
        }
        for i in range(num_faculty)
    ]

    venues = [
        {
            "id": i,
            "name": f"Room {100 + i}",
            "capacity": 50 + (i * 20),
            "equipment": ["projector"],
            "available_slots": list(range(num_slots)),
        }
        for i in range(num_venues)
    ]

    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    slots = []
    for i in range(num_slots):
        day = days[(i // 5) % len(days)]
        hour = 8 + (i % 5)
        slots.append(
            {
                "id": i,
                "day_of_week": day,
                "start_time": f"{hour:02d}:00",
                "end_time": f"{hour+1:02d}:00",
                "duration_minutes": 60,
            }
        )

    courses = [
        {
            "id": i,
            "name": f"Course {101 + i}",
            "code": f"CS{101 + i}",
            "faculty_id": i % num_faculty,
            "capacity_required": 40,
            "duration_minutes": 60,
        }
        for i in range(num_courses)
    ]

    return faculty, venues, slots, courses


def test_no_conflicts():
    """Verify no teacher or room conflicts occur."""
    faculty, venues, slots, courses = generate_mock_data(5, 3, 10, 6)
    timetable = solve_schedule(courses, slots, venues, faculty=faculty)
    assert len(timetable) == 6
    assert verify_no_conflicts(timetable) is True


def test_preference_respect():
    """Verify teacher time preferences are respected (>75% satisfaction)."""
    faculty, venues, slots, courses = generate_mock_data(5, 3, 10, 6)
    prefs = {f["name"]: f["preferences"] for f in faculty}
    timetable = solve_schedule(courses, slots, venues, faculty=faculty, preferences=prefs)
    satisfaction = calculate_preference_satisfaction(timetable, prefs)
    assert satisfaction > 0.75


def test_fairness():
    """Verify fair workload distribution (>80% fairness)."""
    faculty, venues, slots, courses = generate_mock_data(5, 3, 15, 10)
    timetable = solve_schedule(courses, slots, venues, faculty=faculty)
    fairness = calculate_fairness_score(timetable, faculty)
    assert fairness > 0.80


def test_performance():
    """Verify solver runs in <5 seconds."""
    faculty, venues, slots, courses = generate_mock_data(20, 10, 20, 40)
    start = time.perf_counter()
    timetable = solve_schedule(courses, slots, venues, faculty=faculty)
    elapsed = time.perf_counter() - start
    assert len(timetable) == 40
    assert elapsed < 5.0


def test_solver_small_problem():
    faculty, venues, slots, courses = generate_mock_data(
        num_faculty=5, num_venues=3, num_slots=10, num_courses=6
    )

    solver = TimetableSolver(time_limit_seconds=5)
    solver.add_variables(courses, faculty, venues, slots)
    solver.add_constraints()

    is_solved, status, _ = solver.solve()
    assert is_solved is True
    assert status in ("OPTIMAL", "FEASIBLE")

    solution = solver.get_solution()
    assert len(solution) == 6
    assert verify_no_conflicts(solution) is True


def test_solver_medium_problem():
    faculty, venues, slots, courses = generate_mock_data(
        num_faculty=50, num_venues=20, num_slots=25, num_courses=100
    )

    solver = TimetableSolver(time_limit_seconds=5)
    solver.add_variables(courses, faculty, venues, slots)
    solver.add_constraints()

    is_solved, _, stats = solver.solve()
    assert is_solved is True
    assert stats["solver_time_ms"] < 5000

    solution = solver.get_solution()
    assert len(solution) == 100


def test_solver_infeasible_problem():
    faculty, venues, slots, courses = generate_mock_data(
        num_faculty=2, num_venues=1, num_slots=2, num_courses=5
    )

    solver = TimetableSolver(time_limit_seconds=3)
    solver.add_variables(courses, faculty, venues, slots)
    solver.add_constraints()

    is_solved, status, _ = solver.solve()
    assert is_solved is False
    assert status == "INFEASIBLE"


def test_custom_hard_constraint_enforced():
    """
    Regression test for [ISS-002]:
    Verify custom hard constraint `prefer_morning: True` restricts courses strictly to morning slots (<12:00).
    """
    faculty = [{"id": 1, "name": "Prof X", "department": "CS", "max_hours_per_day": 4, "max_days_per_week": 5}]
    venues = [{"id": 1, "name": "Room 101", "capacity": 50}]
    slots = [
        {"id": 1, "day_of_week": "Monday", "start_time": "09:00", "end_time": "10:00"},
        {"id": 2, "day_of_week": "Monday", "start_time": "14:00", "end_time": "15:00"},
        {"id": 3, "day_of_week": "Tuesday", "start_time": "10:00", "end_time": "11:00"},
        {"id": 4, "day_of_week": "Tuesday", "start_time": "15:00", "end_time": "16:00"},
    ]
    courses = [
        {"id": 1, "name": "C1", "code": "CS1", "faculty_id": 0, "capacity_required": 30},
        {"id": 2, "name": "C2", "code": "CS2", "faculty_id": 0, "capacity_required": 30},
    ]

    solver = TimetableSolver(time_limit_seconds=5)
    solver.add_variables(courses, faculty, venues, slots)
    solver.add_constraints([{"type": "hard", "name": "Morning Only", "constraint_data": {"prefer_morning": True}}])
    is_solved, _, _ = solver.solve()
    assert is_solved is True
    for entry in solver.get_solution():
        hour = int(entry["start_time"].split(":")[0])
        assert hour < 12


def test_formatter_preserves_non_standard_slots():
    """
    Regression test for [ISS-005]:
    Verify classes scheduled at 08:00 or on Saturday are preserved in build_table_rows.
    """
    entries = [
        {
            "course_name": "Early Bird Algorithms",
            "course_code": "CS080",
            "faculty_name": "Dr. Early",
            "venue_name": "Hall A",
            "day_of_week": "Saturday",
            "start_time": "08:00",
            "end_time": "09:00",
        }
    ]
    rows = build_table_rows(entries, view_type="master")
    flat_text = "\n".join("\t".join(r) for r in rows)
    assert "Saturday" in flat_text
    assert "Early Bird Algorithms" in flat_text


def test_demo_dataset_solves_under_5s_and_passes_independent_checker():
    """
    Step 9 Solver Test 1 & 2:
    - Solvable demo dataset (data/demo_courses.csv) finishes in < 5 seconds and returns OPTIMAL or FEASIBLE.
    - Independent plain-Python checker verifies:
      * zero teacher overlaps
      * zero room overlaps
      * zero student group overlaps
      * zero sessions in lunch (12:00-14:00)
      * every course has its exact credit hours.
    """
    import os
    from utils.csv_parser import parse_schedule_csv
    from solver.validator import verify_solved_timetable

    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    demo_csv_path = os.path.join(repo_root, "data", "demo_courses.csv")
    with open(demo_csv_path, "r", encoding="utf-8") as f:
        csv_text = f.read()

    parsed = parse_schedule_csv(csv_text)
    solver = TimetableSolver(time_limit_seconds=5, random_seed=42, config=parsed["config"])
    solver.add_variables(
        courses=parsed["courses"],
        faculty=parsed["faculty"],
        venues=parsed["venues"],
        slots=parsed["slots"],
    )
    solver.add_constraints([])

    start_t = time.perf_counter()
    is_solved, status, stats = solver.solve(timeout_seconds=5)
    elapsed_s = time.perf_counter() - start_t

    assert is_solved is True
    assert status in ("OPTIMAL", "FEASIBLE")
    assert elapsed_s < 5.0
    assert stats["solve_time_ms"] < 5000.0

    entries = solver.get_solution()
    is_valid, violations = verify_solved_timetable(
        entries=entries,
        courses=parsed["courses"],
        config=parsed["config"],
    )
    assert is_valid is True, f"Independent checker found violations: {violations}"
    assert violations == []


def test_impossible_50h_teacher_returns_infeasible_with_reason():
    """
    Step 9 Solver Test 3:
    Impossible dataset (1 teacher assigned 50 credit hours in a 40-hour week)
    returns INFEASIBLE with a human-readable reason string.
    """
    from utils.csv_parser import parse_schedule_csv

    csv_text = (
        "teacher_name,course_name,credit_hours\n"
        + "\n".join(f"Dr. Overloaded,Course {i},5" for i in range(1, 11))
    )
    parsed = parse_schedule_csv(csv_text)
    solver = TimetableSolver(time_limit_seconds=3, config=parsed["config"])
    solver.add_variables(
        courses=parsed["courses"],
        faculty=parsed["faculty"],
        venues=parsed["venues"],
        slots=parsed["slots"],
    )
    solver.add_constraints([])
    is_solved, status, stats = solver.solve(timeout_seconds=3)

    assert is_solved is False
    assert status == "INFEASIBLE"
    assert solver.infeasibility_explanation is not None
    assert "Dr. Overloaded" in solver.infeasibility_explanation
    assert "50" in solver.infeasibility_explanation

