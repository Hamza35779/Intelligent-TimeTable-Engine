import pytest
from app.services.solver import TimetableSolver


def generate_mock_data(num_faculty=5, num_venues=3, num_slots=10, num_courses=8):
    faculty = [
        {
            "id": i,
            "name": f"Faculty {i}",
            "department": "Engineering",
            "max_hours_per_day": 4,
            "max_days_per_week": 5,
            "email": f"fac{i}@example.edu",
            "preferences": {"prefer_morning": i % 2 == 0, "preferred_days": ["Monday", "Wednesday"]},
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
        slots.append({
            "id": i,
            "day_of_week": day,
            "start_time": f"{hour:02d}:00",
            "end_time": f"{hour+1:02d}:00",
            "duration_minutes": 60,
        })

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


def test_solver_small_problem():
    faculty, venues, slots, courses = generate_mock_data(
        num_faculty=5, num_venues=3, num_slots=10, num_courses=6
    )

    solver = TimetableSolver(time_limit_seconds=5)
    solver.add_variables(courses, faculty, venues, slots)
    solver.add_constraints()

    is_solved, status, stats = solver.solve()
    assert is_solved is True
    assert status in ("OPTIMAL", "FEASIBLE")

    solution = solver.get_solution()
    assert len(solution) == 6

    # Verify Hard Constraint: No faculty double booking
    faculty_slot_pairs = [(item["faculty_id"], item["slot_id"]) for item in solution]
    assert len(faculty_slot_pairs) == len(set(faculty_slot_pairs)), "Faculty double booked in same slot!"

    # Verify Hard Constraint: No venue double booking
    venue_slot_pairs = [(item["venue_id"], item["slot_id"]) for item in solution]
    assert len(venue_slot_pairs) == len(set(venue_slot_pairs)), "Venue double booked in same slot!"

    # Verify Hard Constraint: Unavailable slot respected for faculty 0 (slot 1 unavailable)
    fac_0_slots = [item["slot_id"] for item in solution if item["faculty_id"] == 0]
    assert 1 not in fac_0_slots, "Faculty assigned to unavailable slot 1!"


def test_solver_medium_problem():
    # 50 faculty, 20 rooms, 100 courses, 25 slots
    faculty, venues, slots, courses = generate_mock_data(
        num_faculty=50, num_venues=20, num_slots=25, num_courses=100
    )

    solver = TimetableSolver(time_limit_seconds=5)
    solver.add_variables(courses, faculty, venues, slots)
    solver.add_constraints()

    is_solved, status, stats = solver.solve()
    assert is_solved is True
    assert stats["solver_time_ms"] < 5000, f"Solver took too long: {stats['solver_time_ms']}ms"

    solution = solver.get_solution()
    assert len(solution) == 100


def test_solver_infeasible_problem():
    # 1 venue, 2 slots, but 5 courses -> physically impossible
    faculty, venues, slots, courses = generate_mock_data(
        num_faculty=2, num_venues=1, num_slots=2, num_courses=5
    )

    solver = TimetableSolver(time_limit_seconds=3)
    solver.add_variables(courses, faculty, venues, slots)
    solver.add_constraints()

    is_solved, status, stats = solver.solve()
    assert is_solved is False
    assert status == "INFEASIBLE"
