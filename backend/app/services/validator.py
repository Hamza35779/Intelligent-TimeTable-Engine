from typing import List, Dict, Any, Tuple
from app.schemas.faculty import FacultyCreate
from app.schemas.venue import VenueCreate
from app.schemas.slot import TimeSlotCreate
from app.schemas.course import CourseCreate


class ValidationError(Exception):
    def __init__(self, message: str, details: List[str] = None):
        super().__init__(message)
        self.message = message
        self.details = details or []


class ConstraintValidator:
    @staticmethod
    def validate_inputs(
        faculty: List[FacultyCreate],
        venues: List[VenueCreate],
        slots: List[TimeSlotCreate],
        courses: List[CourseCreate],
    ) -> Tuple[bool, List[str]]:
        errors = []

        if not faculty:
            errors.append("At least one faculty member is required.")
        if not venues:
            errors.append("At least one venue/room is required.")
        if not slots:
            errors.append("At least one time slot is required.")
        if not courses:
            errors.append("At least one course is required.")

        # Validate unique IDs/names/emails
        faculty_emails = set()
        faculty_indices = set()
        for idx, f in enumerate(faculty):
            faculty_indices.add(idx)
            if f.email in faculty_emails:
                errors.append(f"Duplicate faculty email detected: '{f.email}'.")
            faculty_emails.add(f.email)
            if f.max_hours_per_day <= 0:
                errors.append(f"Faculty '{f.name}' has invalid max_hours_per_day (must be > 0).")

        venue_names = set()
        for idx, v in enumerate(venues):
            if v.name in venue_names:
                errors.append(f"Duplicate venue name detected: '{v.name}'.")
            venue_names.add(v.name)
            if v.capacity <= 0:
                errors.append(f"Venue '{v.name}' capacity must be greater than 0.")

        # Validate slot times
        for idx, s in enumerate(slots):
            if s.duration_minutes <= 0:
                errors.append(f"Slot {idx} ({s.day_of_week} {s.start_time}) must have duration > 0.")
            if s.start_time >= s.end_time:
                errors.append(f"Slot {idx} start_time '{s.start_time}' must be earlier than end_time '{s.end_time}'.")

        # Validate courses
        course_codes = set()
        total_course_capacity_need = 0
        for idx, c in enumerate(courses):
            if c.code in course_codes:
                errors.append(f"Duplicate course code detected: '{c.code}'.")
            course_codes.add(c.code)

            if c.faculty_id not in faculty_indices and c.faculty_id >= len(faculty):
                errors.append(
                    f"Course '{c.code}' references non-existent faculty index {c.faculty_id} (total faculty: {len(faculty)})."
                )

            max_venue_cap = max((v.capacity for v in venues), default=0)
            if c.capacity_required > max_venue_cap:
                errors.append(
                    f"Course '{c.code}' requires capacity {c.capacity_required}, but largest venue holds only {max_venue_cap}."
                )

        # Capacity check: total course slots vs venue slots
        max_possible_slots = len(venues) * len(slots)
        if len(courses) > max_possible_slots:
            errors.append(
                f"Infeasible schedule: {len(courses)} courses cannot fit into {len(venues)} venues × {len(slots)} slots ({max_possible_slots} total available venue-slots)."
            )

        if errors:
            return False, errors
        return True, []
