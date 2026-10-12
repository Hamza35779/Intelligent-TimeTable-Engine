from typing import List, Dict, Any, Optional
from app.services.solver import TimetableSolver
from ml.predictor import PreferencePredictor


def solve_schedule(
    courses: List[Dict[str, Any]],
    slots: List[Dict[str, Any]],
    rooms: List[Dict[str, Any]],
    faculty: Optional[List[Dict[str, Any]]] = None,
    preferences: Optional[Dict[str, Dict[str, float]]] = None,
    time_limit_seconds: int = 5,
    config: Optional[Dict[str, Any]] = None,
    random_seed: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """
    High-level entry point combining ML preference prediction and OR-Tools CP-SAT solving.
    """
    if faculty is None:
        unique_teachers = {}
        for idx, c in enumerate(courses):
            t_name = (
                c.get("teacher_name")
                or c.get("teacher")
                or f"Faculty {c.get('faculty_id', idx)}"
            )
            if t_name not in unique_teachers:
                unique_teachers[t_name] = len(unique_teachers)
            if "faculty_id" not in c:
                c["faculty_id"] = unique_teachers[t_name]

        predictor = PreferencePredictor()
        faculty = []
        for t_name, tid in unique_teachers.items():
            t_prefs = (preferences or {}).get(t_name)
            if not t_prefs:
                t_prefs = predictor.predict_for_teacher({"name": t_name})
            faculty.append(
                {
                    "id": tid + 1,
                    "name": t_name,
                    "department": "General",
                    "max_hours_per_day": int((config or {}).get("max_teaching_hours_per_day", 6)),
                    "preferences": t_prefs,
                    "unavailable_slots": [],
                }
            )

    solver = TimetableSolver(
        time_limit_seconds=time_limit_seconds,
        config=config,
        random_seed=random_seed,
    )
    solver.add_variables(courses=courses, faculty=faculty, venues=rooms, slots=slots)
    solver.add_constraints()
    is_solved, _, _ = solver.solve(timeout_seconds=time_limit_seconds)
    if not is_solved:
        return []
    return solver.get_solution()
