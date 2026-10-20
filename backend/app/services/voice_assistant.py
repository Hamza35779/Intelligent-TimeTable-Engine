import re
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Tuple
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models.timetable import ScheduleRun, TimetableEntry
from app.models.course import Course
from app.models.faculty import Faculty
from app.models.venue import Venue
from app.models.slot import TimeSlot

ADMIN_MOVE_REGEX = re.compile(
    r"(?:move|shift|assign|put|reschedule)\s+(?:the\s+)?(.+?)\s+(?:class|course|lecture)?\s*to\s+(?:room\s+|venue\s+|hall\s+|lab\s+)?(.+)",
    re.IGNORECASE,
)

FACULTY_QUERY_REGEX = re.compile(
    r"(?:am i free|is\s+([a-zA-Z\s\.\-]+?)\s+free|my schedule|what is my schedule|what do i teach)\b",
    re.IGNORECASE,
)

STUDENT_NEXT_CLASS_REGEX = re.compile(
    r"(?:what(?:'s| is) my next class|next class|upcoming class|where is my next class|what do i have next)\b",
    re.IGNORECASE,
)

WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def parse_time_string(time_str: str) -> Optional[int]:
    """Parse time string like '10:00', '10 am', '2:30 pm', '14:00' into minutes from midnight."""
    clean = time_str.strip().lower()
    # Check for am/pm
    is_pm = "pm" in clean
    is_am = "am" in clean
    clean = clean.replace("am", "").replace("pm", "").strip()

    parts = clean.split(":")
    try:
        hour = int(parts[0].strip())
        minute = int(parts[1].strip()) if len(parts) > 1 else 0
        if is_pm and hour < 12:
            hour += 12
        elif is_am and hour == 12:
            hour = 0
        return hour * 60 + minute
    except (ValueError, IndexError):
        return None


def _get_active_schedule_run(db: Session, schedule_id: Optional[int] = None) -> Optional[ScheduleRun]:
    if schedule_id:
        run = db.query(ScheduleRun).filter(ScheduleRun.id == schedule_id).first()
        if run:
            return run
    return (
        db.query(ScheduleRun)
        .filter(ScheduleRun.status == "completed")
        .order_by(ScheduleRun.id.desc())
        .first()
    )


def handle_admin_move_room(
    message: str,
    db: Session,
    schedule_id: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    match = ADMIN_MOVE_REGEX.search(message)
    if not match:
        return None

    course_query = match.group(1).strip()
    venue_query = match.group(2).strip().rstrip(".!? ")

    run = _get_active_schedule_run(db, schedule_id)
    if not run:
        return {
            "matched": True,
            "role": "admin",
            "action": "move_room",
            "status": "error",
            "reply": "No generated timetable was found to modify. Please generate a timetable first.",
            "speech_text": "No generated timetable found. Please generate a schedule first.",
            "details": {},
        }

    # Find the target entry by course name or code
    entry = None
    for e in run.entries:
        if (
            course_query.lower() in e.course.name.lower()
            or course_query.lower() in e.course.code.lower()
        ):
            entry = e
            break

    if not entry:
        return {
            "matched": True,
            "role": "admin",
            "action": "move_room",
            "status": "not_found",
            "reply": f"Could not find any scheduled class matching '{course_query}' in Schedule #{run.id}.",
            "speech_text": f"Could not find course {course_query} in the active schedule.",
            "details": {"course_query": course_query},
        }

    # Find target venue in database
    target_venue = (
        db.query(Venue)
        .filter(func.lower(Venue.name) == venue_query.lower())
        .first()
    )
    if not target_venue:
        # Search by substring
        target_venue = (
            db.query(Venue)
            .filter(Venue.name.ilike(f"%{venue_query}%"))
            .first()
        )
    if not target_venue:
        # Create venue if it's a valid room designation
        target_venue = Venue(
            name=venue_query.upper(),
            capacity=40,
            equipment=["Whiteboard", "Projector"],
            available_slots=[],
        )
        db.add(target_venue)
        db.flush()

    # Conflict check: Is this room already booked during the exact same time slot?
    clashing_entry = (
        db.query(TimetableEntry)
        .filter(
            TimetableEntry.schedule_run_id == run.id,
            TimetableEntry.venue_id == target_venue.id,
            TimetableEntry.slot_id == entry.slot_id,
            TimetableEntry.id != entry.id,
        )
        .first()
    )

    if clashing_entry:
        reply = (
            f"Clash detected! Room {target_venue.name} is already booked on "
            f"{entry.slot.day_of_week} at {entry.slot.start_time} for "
            f"{clashing_entry.course.name}. Reassignment was rejected to protect conflict-free integrity."
        )
        speech = (
            f"Cannot move {entry.course.name} to {target_venue.name} because it clashes with "
            f"{clashing_entry.course.name} on {entry.slot.day_of_week} at {entry.slot.start_time}."
        )
        return {
            "matched": True,
            "role": "admin",
            "action": "move_room",
            "status": "clash",
            "reply": reply,
            "speech_text": speech,
            "details": {
                "course": entry.course.name,
                "target_venue": target_venue.name,
                "clash_with": clashing_entry.course.name,
                "day": entry.slot.day_of_week,
                "time": entry.slot.start_time,
            },
        }

    # No clash: Reassign room
    old_venue_name = entry.venue.name
    entry.venue_id = target_venue.id
    db.commit()

    reply = (
        f"Verified zero conflicts! Successfully moved {entry.course.name} from {old_venue_name} "
        f"to {target_venue.name} on {entry.slot.day_of_week} ({entry.slot.start_time} - {entry.slot.end_time})."
    )
    speech = f"{entry.course.name} has been moved to {target_venue.name} without any conflicts."
    return {
        "matched": True,
        "role": "admin",
        "action": "move_room",
        "status": "success",
        "reply": reply,
        "speech_text": speech,
        "details": {
            "course": entry.course.name,
            "from_venue": old_venue_name,
            "to_venue": target_venue.name,
            "day": entry.slot.day_of_week,
            "time": entry.slot.start_time,
        },
    }


def handle_faculty_availability(
    message: str,
    db: Session,
    schedule_id: Optional[int] = None,
    user_name: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    match = FACULTY_QUERY_REGEX.search(message)
    if not match:
        return None

    run = _get_active_schedule_run(db, schedule_id)
    if not run:
        return {
            "matched": True,
            "role": "faculty",
            "action": "availability_check",
            "status": "error",
            "reply": "No active timetable schedule found. Please generate a timetable first.",
            "speech_text": "No active timetable found.",
            "details": {},
        }

    # Extract target faculty name
    extracted_name = match.group(1).strip() if match.group(1) else None
    faculty_target_name = extracted_name or user_name

    faculty = None
    if faculty_target_name:
        faculty = (
            db.query(Faculty)
            .filter(Faculty.name.ilike(f"%{faculty_target_name}%"))
            .first()
        )
    if not faculty and run.entries:
        faculty = run.entries[0].faculty

    if not faculty:
        return {
            "matched": True,
            "role": "faculty",
            "action": "availability_check",
            "status": "not_found",
            "reply": "Could not identify the faculty member in the schedule.",
            "speech_text": "Could not identify the faculty member.",
            "details": {},
        }

    # Extract Day
    lower_msg = message.lower()
    target_day = None
    for d in WEEKDAYS:
        if d in lower_msg:
            target_day = d.capitalize()
            break

    # Extract Time
    time_regex = re.search(r"\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b", lower_msg)
    target_time_mins = None
    time_display = ""
    if time_regex:
        # Ensure it's not a day number or credit hours
        candidate = time_regex.group(1).strip()
        parsed_mins = parse_time_string(candidate)
        if parsed_mins is not None and (":" in candidate or "am" in candidate or "pm" in candidate or parsed_mins >= 480):
            target_time_mins = parsed_mins
            time_display = candidate

    # Get entries for faculty
    faculty_entries = [e for e in run.entries if e.faculty_id == faculty.id]
    if target_day:
        faculty_entries = [e for e in faculty_entries if e.slot.day_of_week.lower() == target_day.lower()]

    if target_time_mins is not None:
        # Check if any entry covers this exact time
        clash_entry = None
        for e in faculty_entries:
            start_m = parse_time_string(e.slot.start_time) or 0
            end_m = parse_time_string(e.slot.end_time) or (start_m + 60)
            if start_m <= target_time_mins < end_m:
                clash_entry = e
                break

        day_label = target_day or "the requested day"
        if clash_entry:
            reply = (
                f"No, {faculty.name} is NOT free on {day_label} at {time_display}. "
                f"Teaching {clash_entry.course.name} in Room {clash_entry.venue.name} "
                f"({clash_entry.slot.start_time} - {clash_entry.slot.end_time})."
            )
            speech = (
                f"No, you have {clash_entry.course.name} in Room {clash_entry.venue.name} "
                f"on {clash_entry.slot.day_of_week} from {clash_entry.slot.start_time} to {clash_entry.slot.end_time}."
            )
            return {
                "matched": True,
                "role": "faculty",
                "action": "availability_check",
                "status": "busy",
                "reply": reply,
                "speech_text": speech,
                "details": {
                    "faculty": faculty.name,
                    "busy": True,
                    "course": clash_entry.course.name,
                    "room": clash_entry.venue.name,
                    "time": f"{clash_entry.slot.start_time} - {clash_entry.slot.end_time}",
                },
            }
        else:
            reply = f"Yes {faculty.name}, you are completely free on {day_label} at {time_display}."
            speech = f"Yes {faculty.name}, you are free on {day_label} at {time_display}."
            return {
                "matched": True,
                "role": "faculty",
                "action": "availability_check",
                "status": "free",
                "reply": reply,
                "speech_text": speech,
                "details": {"faculty": faculty.name, "free": True, "day": day_label, "time": time_display},
            }

    # If only day is queried (or general schedule)
    if target_day:
        if not faculty_entries:
            reply = f"{faculty.name} has no scheduled classes on {target_day}."
            speech = f"You have no classes scheduled on {target_day}."
        else:
            classes_summary = ", ".join(
                f"{e.course.name} ({e.slot.start_time} in {e.venue.name})" for e in faculty_entries
            )
            reply = f"{faculty.name} has {len(faculty_entries)} classes on {target_day}: {classes_summary}."
            speech = f"On {target_day}, you have {len(faculty_entries)} classes: {classes_summary}."
        return {
            "matched": True,
            "role": "faculty",
            "action": "schedule_check",
            "status": "info",
            "reply": reply,
            "speech_text": speech,
            "details": {"faculty": faculty.name, "day": target_day, "count": len(faculty_entries)},
        }

    # General overview
    reply = f"{faculty.name} is assigned {len(faculty_entries)} total lectures in Schedule #{run.id}."
    speech = f"You have {len(faculty_entries)} total lectures scheduled this week."
    return {
        "matched": True,
        "role": "faculty",
        "action": "schedule_check",
        "status": "info",
        "reply": reply,
        "speech_text": speech,
        "details": {"faculty": faculty.name, "total_classes": len(faculty_entries)},
    }


def handle_student_next_class(
    message: str,
    db: Session,
    schedule_id: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    if not STUDENT_NEXT_CLASS_REGEX.search(message):
        return None

    run = _get_active_schedule_run(db, schedule_id)
    if not run or not run.entries:
        return {
            "matched": True,
            "role": "student",
            "action": "next_class",
            "status": "error",
            "reply": "No scheduled classes found in the active timetable.",
            "speech_text": "No classes are currently scheduled.",
            "details": {},
        }

    # Order weekdays
    day_order = {day: idx for idx, day in enumerate(WEEKDAYS)}
    sorted_entries = sorted(
        run.entries,
        key=lambda e: (
            day_order.get(e.slot.day_of_week.lower(), 99),
            parse_time_string(e.slot.start_time) or 0,
        ),
    )

    next_entry = sorted_entries[0]
    reply = (
        f"Your next class is {next_entry.course.name} ({next_entry.course.code}) "
        f"with {next_entry.faculty.name} in Room {next_entry.venue.name} on "
        f"{next_entry.slot.day_of_week} at {next_entry.slot.start_time} - {next_entry.slot.end_time}."
    )
    speech = (
        f"Your next class is {next_entry.course.name} with {next_entry.faculty.name} "
        f"in Room {next_entry.venue.name} on {next_entry.slot.day_of_week} at {next_entry.slot.start_time}."
    )

    return {
        "matched": True,
        "role": "student",
        "action": "next_class",
        "status": "success",
        "reply": reply,
        "speech_text": speech,
        "details": {
            "course": next_entry.course.name,
            "code": next_entry.course.code,
            "faculty": next_entry.faculty.name,
            "room": next_entry.venue.name,
            "day": next_entry.slot.day_of_week,
            "time": f"{next_entry.slot.start_time} - {next_entry.slot.end_time}",
        },
    }


def handle_voice_intent(
    message: str,
    db: Session,
    schedule_id: Optional[int] = None,
    persona: Optional[str] = None,
    user_name: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Evaluates message against Slide 11 Voice Personas:
    - Admin: Move course to room (conflict checked)
    - Faculty: Am I free on Day at Time?
    - Student: What is my next class?
    """
    clean = message.strip()
    if not clean:
        return None

    # Try explicit persona first or detect from patterns
    if persona == "admin" or ADMIN_MOVE_REGEX.search(clean):
        res = handle_admin_move_room(clean, db=db, schedule_id=schedule_id)
        if res:
            return res

    if persona == "faculty" or FACULTY_QUERY_REGEX.search(clean):
        res = handle_faculty_availability(clean, db=db, schedule_id=schedule_id, user_name=user_name)
        if res:
            return res

    if persona == "student" or STUDENT_NEXT_CLASS_REGEX.search(clean):
        res = handle_student_next_class(clean, db=db, schedule_id=schedule_id)
        if res:
            return res

    return None
