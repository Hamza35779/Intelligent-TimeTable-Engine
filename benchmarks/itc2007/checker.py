"""
Independent Solution Checker for ITC-2007 Track 3 (Curriculum-Based Course Timetabling).

CRITICAL ARCHITECTURE RULE:
This module MUST NOT import any solver code. It verifies a Solution against an
Instance strictly from the output representation alone, ensuring no solver self-reporting
bias or false claims can contaminate results.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Set, Tuple

# Only import from parser data models, never from backend/solver
from .parser import Instance, Solution


@dataclass
class CheckReport:
    instance_name: str
    total_lectures_required: int
    total_lectures_scheduled: int
    is_feasible: bool

    # Hard violations (must be 0 for a feasible timetable)
    lectures_violations: int
    conflicts_violations: int
    availability_violations: int
    room_occupation_violations: int
    total_hard_violations: int

    # Soft constraint penalty costs (using official ITC-2007 weights)
    room_capacity_cost: int          # weight = 1 per student over capacity
    min_working_days_cost: int       # weight = 5 per day short
    curriculum_compactness_cost: int # weight = 2 per isolated lecture
    room_stability_cost: int         # weight = 1 per additional room used
    total_soft_cost: int

    violation_details: List[str] = field(default_factory=list)

    def summary_table(self) -> str:
        status_str = "FEASIBLE" if self.is_feasible else f"INFEASIBLE ({self.total_hard_violations} violations)"
        return (
            f"============================================================\n"
            f"ITC-2007 Benchmark Verification: {self.instance_name}\n"
            f"Status: {status_str}\n"
            f"------------------------------------------------------------\n"
            f"Hard Constraints (Target: 0):\n"
            f"  Lectures Scheduled:        {self.lectures_violations}\n"
            f"  Teacher/Curriculum Clashes:{self.conflicts_violations}\n"
            f"  Availability Violations:   {self.availability_violations}\n"
            f"  Room Overbookings:         {self.room_occupation_violations}\n"
            f"  Total Hard Violations:     {self.total_hard_violations}\n"
            f"------------------------------------------------------------\n"
            f"Soft Constraint Costs (Official ITC-2007 Weights):\n"
            f"  Room Capacity (w=1):       {self.room_capacity_cost}\n"
            f"  Min Working Days (w=5):    {self.min_working_days_cost}\n"
            f"  Curriculum Compactness(w=2):{self.curriculum_compactness_cost}\n"
            f"  Room Stability (w=1):      {self.room_stability_cost}\n"
            f"  Total Soft Cost:           {self.total_soft_cost}\n"
            f"============================================================"
        )


def check_solution(instance: Instance, solution: Solution) -> CheckReport:
    """
    Independently inspects an instance and solution, recounting every hard violation
    and computing official soft penalty costs without trusting any solver claims.
    """
    details: List[str] = []

    # Map periods: (day, period) -> period index in [0, total_periods - 1]
    ppd = instance.periods_per_day
    total_periods = instance.total_periods

    # Group assignments by course
    course_assignments: Dict[str, List[Tuple[int, int, str]]] = {c_id: [] for c_id in instance.courses}
    
    # Track room occupancy: (room_id, p_index) -> list of course_ids
    room_occupation: Dict[Tuple[str, int], List[str]] = {}
    
    # Track teacher occupation: (teacher_id, p_index) -> list of course_ids
    teacher_occupation: Dict[Tuple[str, int], List[str]] = {}
    
    # Track curriculum occupation: (curriculum_id, p_index) -> list of course_ids
    curriculum_occupation: Dict[Tuple[str, int], List[str]] = {
        (curr_id, p): [] for curr_id in instance.curricula for p in range(total_periods)
    }

    # Track lectures scheduled
    total_lectures_scheduled = 0
    lectures_violations = 0

    for a in solution.assignments:
        total_lectures_scheduled += 1

        if a.course_id not in instance.courses:
            lectures_violations += 1
            details.append(f"Unknown course '{a.course_id}' scheduled in solution")
            continue

        if a.room_id not in instance.rooms:
            lectures_violations += 1
            details.append(f"Unknown room '{a.room_id}' used for course '{a.course_id}'")
            continue

        if not (0 <= a.day < instance.days and 0 <= a.period < ppd):
            lectures_violations += 1
            details.append(f"Out of bounds period (day={a.day}, period={a.period}) for course '{a.course_id}'")
            continue

        p_idx = instance.period_index(a.day, a.period)
        course = instance.courses[a.course_id]

        course_assignments[a.course_id].append((a.day, a.period, a.room_id))
        room_occupation.setdefault((a.room_id, p_idx), []).append(a.course_id)
        teacher_occupation.setdefault((course.teacher, p_idx), []).append(a.course_id)

    # 1. Hard: Lectures count per course
    total_lectures_required = sum(c.lectures for c in instance.courses.values())
    for c_id, course in instance.courses.items():
        actual = len(course_assignments[c_id])
        if actual != course.lectures:
            diff = abs(actual - course.lectures)
            lectures_violations += diff
            details.append(f"Course '{c_id}' requires {course.lectures} lectures but has {actual}")

    # 2. Hard: Room occupation (at most 1 lecture per room per period)
    room_occupation_violations = 0
    for (r_id, p_idx), clist in room_occupation.items():
        if len(clist) > 1:
            excess = len(clist) - 1
            room_occupation_violations += excess
            d, pr = instance.period_to_day_slot(p_idx)
            details.append(f"Room '{r_id}' double-booked by {len(clist)} courses at Day {d}, Period {pr}")

    # 3. Hard: Teacher and Curriculum Conflicts
    # In official ITC-2007:
    # A conflict occurs if two distinct courses taught by the same teacher or in the same curriculum
    # are scheduled in the exact same period.
    # Also, a course itself cannot have multiple lectures in the same period.
    conflicts_violations = 0

    # Build period -> set of scheduled courses
    period_to_courses: Dict[int, List[str]] = {p: [] for p in range(total_periods)}
    for c_id, assign_list in course_assignments.items():
        for d, pr, _ in assign_list:
            period_to_courses[instance.period_index(d, pr)].append(c_id)

    # Precompute curriculum pairs that conflict
    curriculum_pairs: Set[Tuple[str, str]] = set()
    for curr in instance.curricula.values():
        c_list = curr.course_ids
        for i in range(len(c_list)):
            for j in range(i + 1, len(c_list)):
                c1, c2 = min(c_list[i], c_list[j]), max(c_list[i], c_list[j])
                curriculum_pairs.add((c1, c2))

    # Precompute teacher pairs that conflict
    teacher_to_courses: Dict[str, List[str]] = {}
    for c_id, course in instance.courses.items():
        teacher_to_courses.setdefault(course.teacher, []).append(c_id)

    teacher_pairs: Set[Tuple[str, str]] = set()
    for t_id, c_list in teacher_to_courses.items():
        for i in range(len(c_list)):
            for j in range(i + 1, len(c_list)):
                c1, c2 = min(c_list[i], c_list[j]), max(c_list[i], c_list[j])
                teacher_pairs.add((c1, c2))

    all_conflicting_pairs = curriculum_pairs | teacher_pairs

    # Check for conflicts at each period
    for p_idx, scheduled in period_to_courses.items():
        if len(scheduled) <= 1:
            continue
        # Check course self-overlap (same course scheduled twice in same period)
        counts: Dict[str, int] = {}
        for c in scheduled:
            counts[c] = counts.get(c, 0) + 1
        for c, cnt in counts.items():
            if cnt > 1:
                conflicts_violations += (cnt - 1)
                d, pr = instance.period_to_day_slot(p_idx)
                details.append(f"Course '{c}' scheduled {cnt} times in same period Day {d}, Period {pr}")

        # Check distinct course pairs conflicting in this period
        unique_courses = list(counts.keys())
        for i in range(len(unique_courses)):
            for j in range(i + 1, len(unique_courses)):
                pair = (min(unique_courses[i], unique_courses[j]), max(unique_courses[i], unique_courses[j]))
                if pair in all_conflicting_pairs:
                    conflicts_violations += 1
                    d, pr = instance.period_to_day_slot(p_idx)
                    details.append(f"Conflict between '{pair[0]}' and '{pair[1]}' at Day {d}, Period {pr}")

    # 4. Hard: Availability
    availability_violations = 0
    for c_id, assign_list in course_assignments.items():
        course = instance.courses[c_id]
        for d, pr, _ in assign_list:
            if (d, pr) in course.unavailable_periods:
                availability_violations += 1
                details.append(f"Course '{c_id}' scheduled in unavailable period Day {d}, Period {pr}")

    total_hard_violations = (
        lectures_violations + conflicts_violations + availability_violations + room_occupation_violations
    )
    is_feasible = (total_hard_violations == 0)

    # ---------------------------------------------------------
    # Soft Constraints (using official weights)
    # ---------------------------------------------------------

    # 1. RoomCapacity (Weight = 1)
    room_capacity_raw = 0
    for c_id, assign_list in course_assignments.items():
        course = instance.courses[c_id]
        for _, _, r_id in assign_list:
            if r_id in instance.rooms:
                cap = instance.rooms[r_id].capacity
                if cap < course.students:
                    room_capacity_raw += (course.students - cap)
    room_capacity_cost = room_capacity_raw * 1

    # 2. MinWorkingDays (Weight = 5)
    min_working_days_raw = 0
    for c_id, assign_list in course_assignments.items():
        course = instance.courses[c_id]
        distinct_days = len(set(d for d, _, _ in assign_list))
        if distinct_days < course.min_working_days:
            min_working_days_raw += (course.min_working_days - distinct_days)
    min_working_days_cost = min_working_days_raw * 5

    # 3. CurriculumCompactness (Weight = 2)
    # An isolated lecture is one where no lecture of the same curriculum is scheduled
    # in the previous or next period of the same day.
    curriculum_compactness_raw = 0
    for curr_id, curr in instance.curricula.items():
        # Count lectures per period for this curriculum
        curr_course_set = set(curr.course_ids)
        curr_lectures_by_p: List[int] = [0] * total_periods
        for c in curr.course_ids:
            if c in course_assignments:
                for d, pr, _ in course_assignments[c]:
                    p = instance.period_index(d, pr)
                    curr_lectures_by_p[p] += 1

        for d in range(instance.days):
            day_offset = d * ppd
            for pr in range(ppd):
                p = day_offset + pr
                lectures_in_p = curr_lectures_by_p[p]
                if lectures_in_p == 0:
                    continue

                prev_has = curr_lectures_by_p[p - 1] > 0 if pr > 0 else False
                next_has = curr_lectures_by_p[p + 1] > 0 if pr < ppd - 1 else False

                if not prev_has and not next_has:
                    # Isolated lecture: count equals the number of lectures in this slot
                    curriculum_compactness_raw += lectures_in_p

    curriculum_compactness_cost = curriculum_compactness_raw * 2

    # 4. RoomStability (Weight = 1)
    # Penalty of 1 for each distinct room used beyond the first
    room_stability_raw = 0
    for c_id, assign_list in course_assignments.items():
        distinct_rooms = len(set(r_id for _, _, r_id in assign_list))
        if distinct_rooms > 1:
            room_stability_raw += (distinct_rooms - 1)
    room_stability_cost = room_stability_raw * 1

    total_soft_cost = (
        room_capacity_cost + min_working_days_cost + curriculum_compactness_cost + room_stability_cost
    )

    return CheckReport(
        instance_name=instance.name,
        total_lectures_required=total_lectures_required,
        total_lectures_scheduled=total_lectures_scheduled,
        is_feasible=is_feasible,
        lectures_violations=lectures_violations,
        conflicts_violations=conflicts_violations,
        availability_violations=availability_violations,
        room_occupation_violations=room_occupation_violations,
        total_hard_violations=total_hard_violations,
        room_capacity_cost=room_capacity_cost,
        min_working_days_cost=min_working_days_cost,
        curriculum_compactness_cost=curriculum_compactness_cost,
        room_stability_cost=room_stability_cost,
        total_soft_cost=total_soft_cost,
        violation_details=details,
    )
