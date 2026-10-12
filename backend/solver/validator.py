from collections import defaultdict
from typing import List, Dict, Any, Optional, Tuple
from app.services.validator import ConstraintValidator, ValidationError


def _to_min(t_str: str) -> int:
    parts = str(t_str).strip().split(":")
    return int(parts[0]) * 60 + (int(parts[1]) if len(parts) > 1 else 0)


def verify_solved_timetable(
    entries: List[Dict[str, Any]],
    courses: Optional[List[Dict[str, Any]]] = None,
    lunch_start: str = "12:00",
    lunch_end: str = "14:00",
    day_start: str = "08:00",
    day_end: str = "18:00",
    max_hours_per_day: int = 6,
    config: Optional[Dict[str, Any]] = None,
) -> Tuple[bool, List[str]]:
    """
    Independent schedule verifier (Step 9):
    Verifies a solved timetable without relying on the solver's internal variables.
    Checks:
      1. Zero teacher overlaps on the same day.
      2. Zero room overlaps on the same day.
      3. Zero student_group overlaps on the same day.
      4. No session overlaps lunch [lunch_start, lunch_end).
      5. All sessions lie within [day_start, day_end].
      6. Every course receives its exact required weekly contact hours (credit_hours).
      7. No teacher exceeds max_hours_per_day.
    """
    if config:
        lunch_start = config.get("lunch_start", lunch_start)
        lunch_end = config.get("lunch_end", lunch_end)
        day_start = config.get("day_start", day_start)
        day_end = config.get("day_end", day_end)
        max_hours_per_day = int(config.get("max_teaching_hours_per_day", max_hours_per_day))
    violations: List[str] = []
    lunch_s = _to_min(lunch_start)
    lunch_e = _to_min(lunch_end)
    win_s = _to_min(day_start)
    win_e = _to_min(day_end)

    teacher_intervals: Dict[Tuple[str, str], List[Tuple[int, int, str]]] = defaultdict(list)
    room_intervals: Dict[Tuple[str, str], List[Tuple[int, int, str]]] = defaultdict(list)
    group_intervals: Dict[Tuple[str, str], List[Tuple[int, int, str]]] = defaultdict(list)
    course_hours: Dict[str, float] = defaultdict(float)
    teacher_daily_hours: Dict[Tuple[str, str], float] = defaultdict(float)

    for e in entries:
        day = str(e.get("day_of_week", "Monday"))
        st = _to_min(e.get("start_time", "09:00"))
        et = _to_min(e.get("end_time", "10:00"))
        dur_h = max(0.0, (et - st) / 60.0)

        c_name = str(e.get("course_name") or e.get("course_code") or e.get("course_id"))
        t_name = str(e.get("faculty_name") or e.get("faculty_id"))
        r_name = str(e.get("venue_name") or e.get("venue_id"))
        g_name = str(e.get("student_group") or f"group_{c_name}")

        # Check lunch overlap
        if st < lunch_e and et > lunch_s:
            violations.append(
                f"Lunch violation: {c_name} ({day} {e.get('start_time')}-{e.get('end_time')}) overlaps lunch {lunch_start}-{lunch_end}"
            )

        # Check day window
        if st < win_s or et > win_e:
            violations.append(
                f"Window violation: {c_name} ({day} {e.get('start_time')}-{e.get('end_time')}) outside {day_start}-{day_end}"
            )

        teacher_intervals[(t_name, day)].append((st, et, c_name))
        room_intervals[(r_name, day)].append((st, et, c_name))
        group_intervals[(g_name, day)].append((st, et, c_name))
        course_hours[c_name] += dur_h
        teacher_daily_hours[(t_name, day)] += dur_h

    # Check interval overlaps
    for (t_name, day), ivs in teacher_intervals.items():
        ivs_sorted = sorted(ivs, key=lambda x: x[0])
        for i in range(len(ivs_sorted) - 1):
            if ivs_sorted[i][1] > ivs_sorted[i + 1][0]:
                violations.append(
                    f"Teacher overlap: {t_name} on {day} between {ivs_sorted[i][2]} and {ivs_sorted[i+1][2]}"
                )

    for (r_name, day), ivs in room_intervals.items():
        ivs_sorted = sorted(ivs, key=lambda x: x[0])
        for i in range(len(ivs_sorted) - 1):
            if ivs_sorted[i][1] > ivs_sorted[i + 1][0]:
                violations.append(
                    f"Room overlap: {r_name} on {day} between {ivs_sorted[i][2]} and {ivs_sorted[i+1][2]}"
                )

    for (g_name, day), ivs in group_intervals.items():
        ivs_sorted = sorted(ivs, key=lambda x: x[0])
        for i in range(len(ivs_sorted) - 1):
            if ivs_sorted[i][1] > ivs_sorted[i + 1][0]:
                violations.append(
                    f"Student group overlap: {g_name} on {day} between {ivs_sorted[i][2]} and {ivs_sorted[i+1][2]}"
                )

    # Check teacher daily hours
    for (t_name, day), hrs in teacher_daily_hours.items():
        if hrs > max_hours_per_day + 1e-6:
            violations.append(
                f"Daily load exceeded: {t_name} on {day} has {hrs}h > max {max_hours_per_day}h"
            )

    # Check course weekly contact hours
    if courses:
        for c in courses:
            c_name = str(c.get("name") or c.get("course_name") or c.get("code") or c.get("id"))
            expected_ch = float(c.get("credit_hours") or 1.0)
            actual_ch = course_hours.get(c_name, 0.0)
            if abs(actual_ch - expected_ch) > 1e-5:
                violations.append(
                    f"Credit-hour mismatch for '{c_name}': expected {expected_ch}h, got {actual_ch}h"
                )

    return len(violations) == 0, violations


__all__ = ["ConstraintValidator", "ValidationError", "verify_solved_timetable"]
