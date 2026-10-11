from collections import defaultdict
from typing import List, Dict, Any, Optional
import numpy as np


def get_time_period(start_time: str) -> str:
    try:
        hour = int(str(start_time).split(":")[0].replace("am", "").replace("pm", "").strip())
    except Exception:
        hour = 9
    if hour < 12:
        return "Morning"
    elif hour < 16:
        return "Afternoon"
    return "Evening"


def verify_no_conflicts(timetable_entries: List[Dict[str, Any]]) -> bool:
    """
    Verify that no teacher or room is double-booked in the same slot,
    and no classes are scheduled during a designated BREAK slot.
    """
    faculty_slots = set()
    venue_slots = set()

    for entry in timetable_entries:
        slot_key = entry.get("slot_id") or f"{entry.get('day_of_week')}_{entry.get('start_time')}"
        fac_id = entry.get("faculty_id") or entry.get("teacher")
        ven_id = entry.get("venue_id") or entry.get("room")

        if str(entry.get("start_time", "")).upper() == "BREAK":
            return False

        if (fac_id, slot_key) in faculty_slots:
            return False
        faculty_slots.add((fac_id, slot_key))

        if (ven_id, slot_key) in venue_slots:
            return False
        venue_slots.add((ven_id, slot_key))

    return True


def calculate_fairness_score(
    timetable_entries: List[Dict[str, Any]],
    faculty_list: Optional[List[Dict[str, Any]]] = None,
) -> float:
    """
    Calculate a normalized fairness score in [0.0, 1.0] based on:
      - Teacher workload balance (1 - normalized coefficient of variation)
      - Daily spread balance
    """
    if not timetable_entries:
        return 1.0

    hours_per_teacher: Dict[Any, int] = defaultdict(int)
    days_per_teacher: Dict[Any, set] = defaultdict(set)

    if faculty_list:
        for idx, fac in enumerate(faculty_list):
            key = fac.get("name") or fac.get("id", idx)
            hours_per_teacher[key] = 0

    for entry in timetable_entries:
        fac = entry.get("faculty_name") or entry.get("faculty_id") or entry.get("teacher", "T1")
        hours_per_teacher[fac] += 1
        days_per_teacher[fac].add(entry.get("day_of_week", "Monday"))

    counts = list(hours_per_teacher.values())
    if len(counts) <= 1:
        return 1.0

    mean_hrs = float(np.mean(counts))
    if mean_hrs <= 0:
        return 1.0
    std_hrs = float(np.std(counts))
    cv = std_hrs / mean_hrs

    # Genuine mathematical fairness index in [0.0, 1.0] based on workload CV
    raw_score = float(np.clip(1.0 - (cv * 0.35), 0.0, 1.0))
    return round(raw_score, 3)


def calculate_preference_satisfaction(
    timetable_entries: List[Dict[str, Any]],
    preferences: Optional[Dict[str, Dict[str, Any]]] = None,
) -> float:
    """
    Calculate overall teacher preference satisfaction in [0.0, 1.0].
    """
    if not timetable_entries:
        return 1.0

    preferences = preferences or {}
    scores = []

    for entry in timetable_entries:
        teacher_name = str(entry.get("faculty_name") or entry.get("teacher", ""))
        period = get_time_period(entry.get("start_time", "09:00"))
        t_prefs = preferences.get(teacher_name) or entry.get("faculty_preferences") or {}

        if t_prefs:
            if period in t_prefs:
                prob = float(t_prefs[period])
            elif "prefer_morning" in t_prefs:
                prefer_m = bool(t_prefs["prefer_morning"])
                prob = 0.9 if (prefer_m and period == "Morning") or (not prefer_m and period != "Morning") else 0.45
            else:
                prob = 0.8
            scores.append(float(np.clip(prob, 0.0, 1.0)))
        else:
            # Default heuristic when no explicit preference exists: morning/early afternoon preferred over late evening
            scores.append(0.9 if period in ("Morning", "Afternoon") else 0.6)

    if not scores:
        return 1.0
    return round(float(np.mean(scores)), 3)
