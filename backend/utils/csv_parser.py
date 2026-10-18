import csv
import io
from typing import Dict, Any, List, Optional


def _time_to_minutes(t_str: str) -> int:
    parts = str(t_str).strip().split(":")
    return int(parts[0]) * 60 + (int(parts[1]) if len(parts) > 1 else 0)


def _minutes_to_time(mins: int) -> str:
    return f"{mins // 60:02d}:{mins % 60:02d}"


def build_slots_from_config(config: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """
    Build weekly time slots from the supervisor's Global Schedule Config:
      - days: Monday to Friday (default)
      - day_start: 09:00 (default)
      - day_end: 17:00 (default)
      - slot_minutes: 60 (default)
      - lunch_start: 12:00, lunch_end: 14:00 (protected, no classes)
    """
    cfg = config or {}
    days = cfg.get("days") or ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    day_start_m = _time_to_minutes(cfg.get("day_start", "09:00"))
    day_end_m = _time_to_minutes(cfg.get("day_end", "17:00"))
    slot_mins = int(cfg.get("slot_minutes", 60))
    lunch_start_m = _time_to_minutes(cfg.get("lunch_start", "12:00"))
    lunch_end_m = _time_to_minutes(cfg.get("lunch_end", "14:00"))

    slots_list: List[Dict[str, Any]] = []
    for day in days:
        cur = day_start_m
        while cur + slot_mins <= day_end_m:
            nxt = cur + slot_mins
            # Protect lunch window [lunch_start, lunch_end): no slot may overlap lunch
            overlaps_lunch = cur < lunch_end_m and nxt > lunch_start_m
            if not overlaps_lunch:
                slots_list.append(
                    {
                        "day_of_week": day,
                        "start_time": _minutes_to_time(cur),
                        "end_time": _minutes_to_time(nxt),
                        "duration_minutes": slot_mins,
                    }
                )
            cur = nxt
    return slots_list


def split_credit_hours_into_sessions(credit_hours: int) -> List[int]:
    """
    Credit-hours mapping assumption:
      - Each credit hour = 1 contact hour per week.
      - A course's weekly contact hours = its credit hours.
      - Split into sessions of at most 2 hours, placed on different days where possible.
      - Example: a 3-credit course becomes 2 sessions (2h + 1h) on different days;
        a 4-credit course becomes 2 sessions (2h + 2h) on different days.
    """
    remaining = max(1, int(credit_hours))
    sessions: List[int] = []
    while remaining > 0:
        chunk = 2 if remaining >= 2 else 1
        sessions.append(chunk)
        remaining -= chunk
    return sessions


def parse_schedule_csv(
    csv_content: str,
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Parse an uploaded CSV into a complete GenerateScheduleRequest dictionary.
    Supervisor's Required Columns:
      - teacher_name (or alias: teacher / faculty / instructor)
      - course_name (or alias: course / subject)
      - credit_hours (or alias: hours)
    Optional Columns:
      - student_group
      - room_type
      - code, preferred_time, department, capacity, room
    """
    cleaned = csv_content.lstrip("\ufeff").strip()
    if not cleaned:
        raise ValueError("Uploaded CSV is empty.")

    reader = csv.DictReader(io.StringIO(cleaned))
    rows = list(reader)
    if not rows:
        raise ValueError("Uploaded CSV is empty or missing rows.")

    cfg = dict(config or {})
    max_daily_hrs = int(cfg.get("max_teaching_hours_per_day", 6))
    default_rooms = cfg.get("rooms") or ["Room 1", "Room 2", "Room 3", "Room 4", "Room 5"]
    days = cfg.get("days") or ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

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
            row.get("teacher_name")
            or row.get("teacher")
            or row.get("faculty")
            or row.get("instructor")
            or f"Instructor {idx + 1}"
        )
        course_name = (
            row.get("course_name")
            or row.get("course")
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
        student_group = row.get("student_group") or f"Group-{course_code}"
        room_type = row.get("room_type") or "Lecture"
        room_hint = row.get("room") or row.get("venue")
        if room_hint:
            venue_names.add(room_hint)

        try:
            capacity = max(1, int(row.get("capacity") or row.get("capacity_required") or 40))
        except ValueError:
            capacity = 40

        raw_ch = row.get("credit_hours") or row.get("hours") or "3"
        try:
            credit_hours = max(1, min(6, int(float(raw_ch))))
        except ValueError:
            credit_hours = 3

        if teacher_name not in faculty_map:
            f_idx = len(faculty_list)
            faculty_map[teacher_name] = f_idx
            email_slug = "".join(c for c in teacher_name.lower() if c.isalnum()) or f"faculty{f_idx}"
            faculty_list.append(
                {
                    "name": teacher_name,
                    "department": dept,
                    "max_hours_per_day": max_daily_hrs,
                    "max_days_per_week": len(days),
                    "email": f"{email_slug}@university.edu",
                    "preferences": {
                        "prefer_morning": pref_time.lower() == "morning",
                        "preferred_time": pref_time.capitalize(),
                        "preferred_days": list(days),
                    },
                    "unavailable_slots": [],
                }
            )

        courses_list.append(
            {
                "name": course_name,
                "code": course_code,
                "faculty_id": faculty_map[teacher_name],
                "capacity_required": capacity,
                "duration_minutes": 60,
                "credit_hours": credit_hours,
                "student_group": student_group,
                "room_type": room_type,
            }
        )

    if not courses_list:
        raise ValueError("Uploaded CSV contains no valid course rows.")

    max_course_cap = max((c["capacity_required"] for c in courses_list), default=60)
    default_venues = [
        {"name": r_name, "capacity": max(100, max_course_cap), "equipment": ["projector"]}
        for r_name in default_rooms
    ]
    for v_name in sorted(venue_names):
        if not any(v["name"].lower() == v_name.lower() for v in default_venues):
            default_venues.append(
                {"name": v_name, "capacity": max(100, max_course_cap), "equipment": ["projector"]}
            )

    slots_list = build_slots_from_config(cfg)

    return {
        "faculty": faculty_list,
        "venues": default_venues,
        "slots": slots_list,
        "courses": courses_list,
        "config": {
            "days": days,
            "day_start": cfg.get("day_start", "09:00"),
            "day_end": cfg.get("day_end", "17:00"),
            "slot_minutes": int(cfg.get("slot_minutes", 60)),
            "lunch_start": cfg.get("lunch_start", "12:00"),
            "lunch_end": cfg.get("lunch_end", "14:00"),
            "break_minutes": int(cfg.get("break_minutes", 15)),
            "min_gap_minutes": int(cfg.get("min_gap_minutes", 30)),
            "max_teaching_hours_per_day": max_daily_hrs,
            "rooms": default_rooms,
        },
        "timeout_seconds": int(cfg.get("timeout_seconds", 5)),
    }


def table_rows_to_csv(rows: List[Dict[str, Any]]) -> str:
    """Convert tabular input rows to standard CSV text."""
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["teacher_name", "course_name", "credit_hours", "student_group", "preferred_time"])
    for r in rows:
        t_name = str(r.get("teacher_name") or "").strip()
        c_name = str(r.get("course_name") or "").strip()
        ch = r.get("credit_hours", 3)
        sg = str(r.get("student_group") or "").strip()
        pref = str(r.get("preferred_time") or "").strip()
        writer.writerow([t_name, c_name, ch, sg, pref])
    return output.getvalue()


def validate_table_rows(
    rows: List[Dict[str, Any]],
    config: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Validate tabular input against Section 6 rules:
      - 'Teacher name is missing'
      - 'Course name is missing'
      - 'Credit hours must be 1 to 4'
      - 'Duplicate: this teacher already teaches this course'
      - 'Teacher X needs N hours but only M are free'
    """
    errors: List[Dict[str, Any]] = []
    seen_teacher_course: Dict[tuple, int] = {}
    teacher_hours: Dict[str, int] = {}

    cfg = config or {}
    days = cfg.get("days") or ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    slots = build_slots_from_config(cfg)
    slots_per_day = len([s for s in slots if s.get("day_of_week") == (days[0] if days else "Monday")])
    max_daily_hrs = int(cfg.get("max_teaching_hours_per_day", 6))
    max_weekly_hours_per_teacher = len(days) * min(slots_per_day, max_daily_hrs) if days else 30

    for idx, r in enumerate(rows):
        t_name = str(r.get("teacher_name") or "").strip()
        c_name = str(r.get("course_name") or "").strip()
        raw_ch = r.get("credit_hours")

        if not t_name:
            errors.append({
                "row_index": idx,
                "field": "teacher_name",
                "message": "Teacher name is missing",
            })

        if not c_name:
            errors.append({
                "row_index": idx,
                "field": "course_name",
                "message": "Course name is missing",
            })

        # Credit hours check
        ch_int = None
        try:
            ch_int = int(raw_ch) if raw_ch is not None else 3
            if ch_int < 1 or ch_int > 4:
                errors.append({
                    "row_index": idx,
                    "field": "credit_hours",
                    "message": "Credit hours must be 1 to 4",
                })
        except (ValueError, TypeError):
            errors.append({
                "row_index": idx,
                "field": "credit_hours",
                "message": "Credit hours must be 1 to 4",
            })

        # Duplicate check
        if t_name and c_name:
            pair = (t_name.lower(), c_name.lower())
            if pair in seen_teacher_course:
                errors.append({
                    "row_index": idx,
                    "field": "course_name",
                    "message": "Duplicate: this teacher already teaches this course",
                })
            else:
                seen_teacher_course[pair] = idx

            # Accumulate teacher load
            valid_ch = ch_int if (ch_int and 1 <= ch_int <= 4) else 3
            teacher_hours[t_name] = teacher_hours.get(t_name, 0) + valid_ch

    # Workload capacity check
    for t_name, total_hrs in teacher_hours.items():
        if total_hrs > max_weekly_hours_per_teacher:
            # find first row with this teacher
            first_idx = next((i for i, r in enumerate(rows) if str(r.get("teacher_name") or "").strip().lower() == t_name.lower()), 0)
            errors.append({
                "row_index": first_idx,
                "field": "teacher_name",
                "message": f"Teacher {t_name} needs {total_hrs} hours but only {max_weekly_hours_per_teacher} are free",
            })

    return errors


def parse_schedule_table(
    rows: List[Dict[str, Any]],
    config: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Parse table rows into GenerateScheduleRequest dictionary via equivalent CSV conversion."""
    csv_text = table_rows_to_csv(rows)
    return parse_schedule_csv(csv_text, config=config)

