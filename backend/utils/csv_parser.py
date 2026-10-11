import csv
import io
from typing import Dict, Any, List


def parse_schedule_csv(csv_content: str) -> Dict[str, Any]:
    """
    Parse an uploaded CSV containing course/teacher rows into a complete
    GenerateScheduleRequest dictionary (faculty, venues, slots, courses).
    Supported columns (case-insensitive):
      teacher / faculty, course / course_name, code, hours, preferred_time, department, capacity, room
    """
    cleaned = csv_content.lstrip("\ufeff").strip()
    if not cleaned:
        raise ValueError("Uploaded CSV is empty.")

    reader = csv.DictReader(io.StringIO(cleaned))
    rows = list(reader)
    if not rows:
        raise ValueError("Uploaded CSV is empty or missing rows.")

    faculty_map: Dict[str, int] = {}
    faculty_list: List[Dict[str, Any]] = []
    courses_list: List[Dict[str, Any]] = []
    venue_names: set = set()
    used_codes: set = set()

    for idx, raw_row in enumerate(rows):
        row = {k.strip().lower(): (v.strip() if v else "") for k, v in raw_row.items() if k}
        if not any(row.values()):
            continue

        teacher_name = (
            row.get("teacher")
            or row.get("teacher_name")
            or row.get("faculty")
            or row.get("instructor")
            or f"Instructor {idx + 1}"
        )
        course_name = (
            row.get("course")
            or row.get("course_name")
            or row.get("subject")
            or f"Course {idx + 1}"
        )
        base_code = row.get("code") or row.get("course_code") or f"CS{101 + idx}"
        course_code = base_code
        suffix = 2
        while course_code in used_codes:
            course_code = f"{base_code}-{suffix}"
            suffix += 1
        used_codes.add(course_code)

        dept = row.get("department") or "Computer Science"
        pref_time = row.get("preferred_time") or "Morning"
        room_hint = row.get("room") or row.get("venue")
        if room_hint:
            venue_names.add(room_hint)

        try:
            capacity = max(1, int(row.get("capacity") or row.get("capacity_required") or 40))
        except ValueError:
            capacity = 40

        try:
            hours = max(1, min(8, int(row.get("hours") or row.get("max_hours_per_day") or 4)))
        except ValueError:
            hours = 4

        if teacher_name not in faculty_map:
            f_idx = len(faculty_list)
            faculty_map[teacher_name] = f_idx
            email_slug = "".join(c for c in teacher_name.lower() if c.isalnum()) or f"faculty{f_idx}"
            faculty_list.append(
                {
                    "name": teacher_name,
                    "department": dept,
                    "max_hours_per_day": max(hours, 4),
                    "max_days_per_week": 5,
                    "email": f"{email_slug}@university.edu",
                    "preferences": {
                        "prefer_morning": pref_time.lower() == "morning",
                        "preferred_time": pref_time.capitalize(),
                        "preferred_days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                    },
                    "unavailable_slots": [],
                }
            )
        else:
            existing_fac = faculty_list[faculty_map[teacher_name]]
            existing_fac["max_hours_per_day"] = max(existing_fac["max_hours_per_day"], hours)

        courses_list.append(
            {
                "name": course_name,
                "code": course_code,
                "faculty_id": faculty_map[teacher_name],
                "capacity_required": capacity,
                "duration_minutes": 60,
            }
        )

    if not courses_list:
        raise ValueError("Uploaded CSV contains no valid course rows.")

    max_course_cap = max((c["capacity_required"] for c in courses_list), default=60)
    default_venues = [
        {"name": "Room 101", "capacity": max(120, max_course_cap), "equipment": ["projector", "mic"]},
        {"name": "Room 102", "capacity": 80, "equipment": ["projector"]},
        {"name": "Room 103", "capacity": 60, "equipment": ["workstations"]},
        {"name": "Lab 201", "capacity": 50, "equipment": ["computers"]},
    ]
    for v_name in sorted(venue_names):
        if not any(v["name"].lower() == v_name.lower() for v in default_venues):
            default_venues.append(
                {"name": v_name, "capacity": max(80, max_course_cap), "equipment": ["projector"]}
            )

    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    slot_hours = [
        ("09:00", "10:00"),
        ("10:00", "11:00"),
        ("11:00", "12:00"),
        ("14:00", "15:00"),
        ("15:00", "16:00"),
    ]
    slots_list = []
    for day in days:
        for start_t, end_t in slot_hours:
            slots_list.append(
                {
                    "day_of_week": day,
                    "start_time": start_t,
                    "end_time": end_t,
                    "duration_minutes": 60,
                }
            )

    return {
        "faculty": faculty_list,
        "venues": default_venues,
        "slots": slots_list,
        "courses": courses_list,
        "timeout_seconds": 5,
    }
