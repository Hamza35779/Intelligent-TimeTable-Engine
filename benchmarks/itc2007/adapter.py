"""
ITC-2007 Solver Adapter and Model Engine.

Provides:
1. Direct high-performance CP-SAT solver for ITC-2007 Track 3 instances
   with exact soft constraints (Room Capacity and Min Working Days).
2. Adapter utilities to convert between generic product solver outputs and benchmark Solution types.
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Tuple

from ortools.sat.python import cp_model

from .checker import check_solution
from .parser import Instance, LectureAssignment, Solution


def solve_itc_instance(
    instance: Instance,
    time_limit_seconds: int = 15,
    random_seed: Optional[int] = 42,
) -> Tuple[Optional[Solution], Dict[str, Any]]:
    """
    Solve an ITC-2007 Track 3 instance using OR-Tools CP-SAT.
    
    Hard constraints:
      - All lectures scheduled
      - At most one lecture per course per period
      - Room occupation: at most one lecture per room per period
      - Teacher non-conflict: at most one lecture per teacher per period
      - Curriculum non-conflict: at most one lecture per curriculum per period
      - Unavailability constraints
    
    Soft constraints modeled in objective:
      - Room Capacity penalty (weight = 1 per student exceeding capacity)
      - Minimum Working Days penalty (weight = 5 per day deficit)
    
    Returns (solution, stats). Note: solver stats are informational;
    all verified violation counts must come from the independent checker.
    """
    start_time = time.perf_counter()
    model = cp_model.CpModel()

    ppd = instance.periods_per_day
    days = instance.days
    total_periods = instance.total_periods
    rooms = list(instance.rooms.values())

    # Decision variables: x[c_id, p, r_idx] in {0, 1}
    x: Dict[Tuple[str, int, int], cp_model.IntVar] = {}

    for c_id, course in instance.courses.items():
        unavail_p = {instance.period_index(d, pr) for d, pr in course.unavailable_periods}
        for p in range(total_periods):
            if p in unavail_p:
                continue
            for r_idx in range(len(rooms)):
                x[(c_id, p, r_idx)] = model.NewBoolVar(f"x_{c_id}_{p}_{r_idx}")

    # 1. Total lectures scheduled per course
    for c_id, course in instance.courses.items():
        c_vars = [
            x[(c_id, p, r_idx)]
            for p in range(total_periods)
            for r_idx in range(len(rooms))
            if (c_id, p, r_idx) in x
        ]
        model.Add(cp_model.LinearExpr.Sum(c_vars) == course.lectures)

    # 2. At most 1 lecture per course in the same period
    for c_id, course in instance.courses.items():
        for p in range(total_periods):
            p_vars = [
                x[(c_id, p, r_idx)]
                for r_idx in range(len(rooms))
                if (c_id, p, r_idx) in x
            ]
            if p_vars:
                model.Add(cp_model.LinearExpr.Sum(p_vars) <= 1)

    # 3. Room occupation: at most 1 lecture per room in the same period
    for p in range(total_periods):
        for r_idx in range(len(rooms)):
            r_vars = [
                x[(c_id, p, r_idx)]
                for c_id in instance.courses
                if (c_id, p, r_idx) in x
            ]
            if len(r_vars) > 1:
                model.Add(cp_model.LinearExpr.Sum(r_vars) <= 1)

    # 4. Teacher conflicts: at most 1 lecture per teacher per period
    teacher_courses: Dict[str, List[str]] = {}
    for c_id, course in instance.courses.items():
        teacher_courses.setdefault(course.teacher, []).append(c_id)

    for t_id, c_ids in teacher_courses.items():
        for p in range(total_periods):
            t_vars = [
                x[(c_id, p, r_idx)]
                for c_id in c_ids
                for r_idx in range(len(rooms))
                if (c_id, p, r_idx) in x
            ]
            if len(t_vars) > 1:
                model.Add(cp_model.LinearExpr.Sum(t_vars) <= 1)

    # 5. Curriculum conflicts: at most 1 lecture per curriculum per period
    for curr_id, curr in instance.curricula.items():
        for p in range(total_periods):
            curr_vars = [
                x[(c_id, p, r_idx)]
                for c_id in curr.course_ids
                for r_idx in range(len(rooms))
                if (c_id, p, r_idx) in x
            ]
            if len(curr_vars) > 1:
                model.Add(cp_model.LinearExpr.Sum(curr_vars) <= 1)

    # Soft 1: Room capacity (weight = 1 per student over capacity)
    penalties = []
    for (c_id, p, r_idx), var in x.items():
        course = instance.courses[c_id]
        r = rooms[r_idx]
        if r.capacity < course.students:
            excess = course.students - r.capacity
            penalties.append(var * (excess * 1))

    # Soft 2: Minimum working days (weight = 5 per deficit day)
    for c_id, course in instance.courses.items():
        if course.min_working_days > 1:
            y_days = []
            for d in range(days):
                y_cd = model.NewBoolVar(f"y_{c_id}_{d}")
                d_vars = [
                    x[(c_id, p, r_idx)]
                    for pr in range(ppd)
                    for r_idx in range(len(rooms))
                    for p in [instance.period_index(d, pr)]
                    if (c_id, p, r_idx) in x
                ]
                if d_vars:
                    for v in d_vars:
                        model.Add(y_cd >= v)
                    model.Add(y_cd <= cp_model.LinearExpr.Sum(d_vars))
                    y_days.append(y_cd)

            if y_days:
                deficit = model.NewIntVar(0, course.min_working_days, f"def_{c_id}")
                model.Add(deficit >= course.min_working_days - cp_model.LinearExpr.Sum(y_days))
                penalties.append(deficit * 5)

    if penalties:
        model.Minimize(cp_model.LinearExpr.Sum(penalties))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = float(time_limit_seconds)
    if random_seed is not None:
        solver.parameters.random_seed = int(random_seed)
        solver.parameters.num_search_workers = 8
    else:
        solver.parameters.num_search_workers = 8

    res = solver.Solve(model)
    elapsed = time.perf_counter() - start_time
    status_name = solver.StatusName(res)

    stats = {
        "status": status_name,
        "solve_time_seconds": round(elapsed, 3),
        "objective_value": solver.ObjectiveValue() if res in (cp_model.OPTIMAL, cp_model.FEASIBLE) else None,
        "wall_time": solver.WallTime(),
    }

    if res not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return None, stats

    assignments: List[LectureAssignment] = []
    for (c_id, p, r_idx), var in x.items():
        if solver.Value(var) == 1:
            d_val, pr_val = instance.period_to_day_slot(p)
            assignments.append(
                LectureAssignment(
                    course_id=c_id,
                    room_id=rooms[r_idx].id,
                    day=d_val,
                    period=pr_val,
                )
            )

    solution = Solution(assignments=assignments)
    return solution, stats


def convert_product_schedule_to_solution(schedule: List[Dict[str, Any]]) -> Solution:
    """
    Adapter that converts product timetable entries to an ITC Solution dataclass.
    Expected entry fields: course_code or course_name, venue_name or room, day_index or day_of_week, slot_index or period.
    """
    day_map = {
        "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
        "Friday": 4, "Saturday": 5, "Sunday": 6
    }
    assignments: List[LectureAssignment] = []
    for item in schedule:
        c_id = str(item.get("course_code") or item.get("course_id") or item.get("course_name") or "")
        r_id = str(item.get("venue_name") or item.get("room_id") or item.get("room") or "")
        
        raw_day = item.get("day") if item.get("day") is not None else item.get("day_of_week")
        if isinstance(raw_day, int):
            day = raw_day
        else:
            day = day_map.get(str(raw_day), 0)

        raw_period = item.get("period") if item.get("period") is not None else item.get("slot_index", 0)
        period = int(raw_period)

        assignments.append(LectureAssignment(course_id=c_id, room_id=r_id, day=day, period=period))

    return Solution(assignments=assignments)
