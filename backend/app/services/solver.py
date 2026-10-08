import time
from collections import defaultdict
from typing import Dict, List, Any, Optional, Tuple
from ortools.sat.python import cp_model


class TimetableSolver:
    def __init__(self, time_limit_seconds: int = 5):
        self.time_limit_seconds = time_limit_seconds
        self.model = cp_model.CpModel()
        self.solver = cp_model.CpSolver()
        self.solver.parameters.max_time_in_seconds = float(time_limit_seconds)
        self.solver.parameters.num_search_workers = 8

        # Course decision variables
        self.slot_vars: List[cp_model.IntVar] = []
        self.venue_vars: List[cp_model.IntVar] = []
        self.grid_vars: List[cp_model.IntVar] = []
        self.objective_terms: List[Tuple[cp_model.IntVar, int]] = []

        # Data references
        self.courses: List[Dict[str, Any]] = []
        self.faculty: List[Dict[str, Any]] = []
        self.venues: List[Dict[str, Any]] = []
        self.slots: List[Dict[str, Any]] = []
        self.constraints_list: List[Dict[str, Any]] = []

        # Reschedule prior assignments: mapping course_idx -> (prior_v_idx, prior_s_idx)
        self.previous_assignments_map: Dict[int, Tuple[int, int]] = {}

        # Results
        self.solver_status_name = "NOT_SOLVED"
        self.solver_time_ms = 0.0
        self.solution_entries: List[Dict[str, Any]] = []
        self.conflicts_resolved = 0
        self.conflict_count = 0

    def add_variables(
        self,
        courses: List[Dict[str, Any]],
        faculty: List[Dict[str, Any]],
        venues: List[Dict[str, Any]],
        slots: List[Dict[str, Any]],
        previous_assignments: Optional[List[Tuple[int, int, int]]] = None,
    ):
        self.courses = courses
        self.faculty = faculty
        self.venues = venues
        self.slots = slots

        if previous_assignments:
            for c_idx, v_idx, s_idx in previous_assignments:
                self.previous_assignments_map[c_idx] = (v_idx, s_idx)

        num_slots = len(slots)
        num_venues = len(venues)

        # Faculty unavailable slots lookup
        faculty_unavail = {
            f_idx: set(fac.get("unavailable_slots", []))
            for f_idx, fac in enumerate(faculty)
        }

        # Venue available slots lookup
        venue_avail = {
            v_idx: (set(v.get("available_slots")) if v.get("available_slots") else None)
            for v_idx, v in enumerate(venues)
        }

        self.slot_vars = []
        self.venue_vars = []
        self.grid_vars = []

        for c_idx, course in enumerate(courses):
            req_cap = course.get("capacity_required", 30)
            f_idx = course.get("faculty_id", 0)
            f_unavail = faculty_unavail.get(f_idx, set())

            # Valid slots for this course
            valid_slots = [s for s in range(num_slots) if s not in f_unavail]

            # Valid venues for this course
            valid_venues = [
                v_idx
                for v_idx, v in enumerate(venues)
                if v.get("capacity", 0) >= req_cap
            ]

            if not valid_slots or not valid_venues:
                # Impossible to schedule this course
                dummy = self.model.NewBoolVar(f"infeasible_course_{c_idx}")
                self.model.Add(dummy == 1)
                self.model.Add(dummy == 0)
                continue

            s_var = self.model.NewIntVarFromDomain(
                cp_model.Domain.FromValues(valid_slots), f"s_{c_idx}"
            )
            v_var = self.model.NewIntVarFromDomain(
                cp_model.Domain.FromValues(valid_venues), f"v_{c_idx}"
            )

            # Combined spatio-temporal coordinate
            # grid = slot * num_venues + venue
            g_var = self.model.NewIntVar(0, num_slots * num_venues - 1, f"g_{c_idx}")
            self.model.Add(g_var == s_var * num_venues + v_var)

            self.slot_vars.append(s_var)
            self.venue_vars.append(v_var)
            self.grid_vars.append(g_var)

    def add_constraints(self, custom_constraints: Optional[List[Dict[str, Any]]] = None):
        self.constraints_list = custom_constraints or []
        num_slots = len(self.slots)
        num_venues = len(self.venues)

        if len(self.grid_vars) < len(self.courses):
            # Already marked infeasible in add_variables
            return

        # -------------------------------------------------------------
        # HARD CONSTRAINT 1: No Venue Double-Booking
        # All assigned (venue, slot) pairs must be unique
        # -------------------------------------------------------------
        self.model.AddAllDifferent(self.grid_vars)

        # -------------------------------------------------------------
        # HARD CONSTRAINT 2: No Faculty Double-Booking
        # All courses taught by the same faculty must have different slots
        # -------------------------------------------------------------
        faculty_course_map = defaultdict(list)
        for c_idx, course in enumerate(self.courses):
            faculty_course_map[course.get("faculty_id", 0)].append(c_idx)

        for f_idx, c_indices in faculty_course_map.items():
            if len(c_indices) > 1:
                self.model.AddAllDifferent([self.slot_vars[ci] for ci in c_indices])

        # -------------------------------------------------------------
        # HARD CONSTRAINT 3: Faculty Daily Maximum Hours Limit
        # -------------------------------------------------------------
        slots_by_day = defaultdict(list)
        for s_idx, slot in enumerate(self.slots):
            slots_by_day[slot.get("day_of_week", "Unknown")].append(s_idx)

        for f_idx, c_indices in faculty_course_map.items():
            fac = self.faculty[f_idx] if 0 <= f_idx < len(self.faculty) else {}
            max_daily_hrs = fac.get("max_hours_per_day", 6)

            if len(c_indices) > max_daily_hrs:
                for day, day_slot_indices in slots_by_day.items():
                    day_domain = cp_model.Domain.FromValues(day_slot_indices)
                    course_in_day_bools = []
                    for ci in c_indices:
                        b_day = self.model.NewBoolVar(f"f{f_idx}_c{ci}_{day}")
                        self.model.AddLinearExpressionInDomain(
                            self.slot_vars[ci], day_domain
                        ).OnlyEnforceIf(b_day)
                        self.model.AddLinearExpressionInDomain(
                            self.slot_vars[ci], day_domain.complement()
                        ).OnlyEnforceIf(b_day.Not())
                        course_in_day_bools.append(b_day)

                    self.model.Add(
                        cp_model.LinearExpr.Sum(course_in_day_bools) <= max_daily_hrs
                    )

        # -------------------------------------------------------------
        # SOFT CONSTRAINTS (Objective Function Terms)
        # -------------------------------------------------------------
        self.objective_terms = []

        for c_idx, course in enumerate(self.courses):
            s_var = self.slot_vars[c_idx]
            g_var = self.grid_vars[c_idx]
            f_idx = course.get("faculty_id", 0)
            fac_info = self.faculty[f_idx] if 0 <= f_idx < len(self.faculty) else {}
            preferences = fac_info.get("preferences", {})

            # 1. Morning preference bonus
            if preferences.get("prefer_morning", False):
                morning_slots = [
                    s
                    for s, sl in enumerate(self.slots)
                    if int(sl.get("start_time", "12:00").split(":")[0]) < 12
                ]
                if morning_slots:
                    b_m = self.model.NewBoolVar(f"pref_morning_{c_idx}")
                    m_dom = cp_model.Domain.FromValues(morning_slots)
                    self.model.AddLinearExpressionInDomain(s_var, m_dom).OnlyEnforceIf(b_m)
                    self.model.AddLinearExpressionInDomain(s_var, m_dom.complement()).OnlyEnforceIf(b_m.Not())
                    self.objective_terms.append((b_m, 20))

            # 2. Preferred days bonus
            preferred_days = preferences.get("preferred_days", [])
            if preferred_days:
                pref_slots = [
                    s
                    for s, sl in enumerate(self.slots)
                    if sl.get("day_of_week") in preferred_days
                ]
                if pref_slots:
                    b_d = self.model.NewBoolVar(f"pref_day_{c_idx}")
                    d_dom = cp_model.Domain.FromValues(pref_slots)
                    self.model.AddLinearExpressionInDomain(s_var, d_dom).OnlyEnforceIf(b_d)
                    self.model.AddLinearExpressionInDomain(s_var, d_dom.complement()).OnlyEnforceIf(b_d.Not())
                    self.objective_terms.append((b_d, 15))

            # 3. Delta rescheduling stability bonus
            if c_idx in self.previous_assignments_map:
                prior_v, prior_s = self.previous_assignments_map[c_idx]
                prior_grid = prior_s * num_venues + prior_v
                b_same = self.model.NewBoolVar(f"resched_keep_{c_idx}")
                self.model.Add(g_var == prior_grid).OnlyEnforceIf(b_same)
                self.model.Add(g_var != prior_grid).OnlyEnforceIf(b_same.Not())
                self.objective_terms.append((b_same, 100))

        if self.objective_terms:
            total_obj = cp_model.LinearExpr.Sum(
                [var * weight for var, weight in self.objective_terms]
            )
            self.model.Maximize(total_obj)

    def solve(self, timeout_seconds: Optional[int] = None) -> Tuple[bool, str, Dict[str, Any]]:
        start_time = time.perf_counter()
        if timeout_seconds:
            self.solver.parameters.max_time_in_seconds = float(timeout_seconds)

        status = self.solver.Solve(self.model)
        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        self.solver_time_ms = round(elapsed_ms, 2)

        status_mapping = {
            cp_model.OPTIMAL: "OPTIMAL",
            cp_model.FEASIBLE: "FEASIBLE",
            cp_model.INFEASIBLE: "INFEASIBLE",
            cp_model.MODEL_INVALID: "MODEL_INVALID",
            cp_model.UNKNOWN: "TIMEOUT",
        }
        self.solver_status_name = status_mapping.get(status, "UNKNOWN")
        is_solved = status in (cp_model.OPTIMAL, cp_model.FEASIBLE)

        stats = {
            "status": self.solver_status_name,
            "solver_time_ms": self.solver_time_ms,
            "branches": self.solver.NumBranches(),
            "conflicts": self.solver.NumConflicts(),
            "wall_time": self.solver.WallTime(),
        }

        if is_solved:
            self._extract_solution()
            try:
                stats["objective_value"] = self.solver.ObjectiveValue()
            except Exception:
                stats["objective_value"] = 0
            stats["total_courses_scheduled"] = len(self.solution_entries)
        else:
            self.solution_entries = []
            stats["total_courses_scheduled"] = 0

        return is_solved, self.solver_status_name, stats

    def _extract_solution(self):
        self.solution_entries = []
        for c_idx, course in enumerate(self.courses):
            s_idx = self.solver.Value(self.slot_vars[c_idx])
            v_idx = self.solver.Value(self.venue_vars[c_idx])

            venue = self.venues[v_idx]
            slot = self.slots[s_idx]
            f_idx = course.get("faculty_id", 0)
            fac = self.faculty[f_idx] if 0 <= f_idx < len(self.faculty) else {}

            self.solution_entries.append(
                {
                    "course_id": course.get("id", c_idx + 1),
                    "course_name": course.get("name", f"Course {c_idx}"),
                    "course_code": course.get("code", f"C{c_idx}"),
                    "faculty_id": fac.get("id", f_idx + 1),
                    "faculty_name": fac.get("name", f"Faculty {f_idx}"),
                    "venue_id": venue.get("id", v_idx + 1),
                    "venue_name": venue.get("name", f"Venue {v_idx}"),
                    "slot_id": slot.get("id", s_idx + 1),
                    "day_of_week": slot.get("day_of_week", "Monday"),
                    "start_time": slot.get("start_time", "09:00"),
                    "end_time": slot.get("end_time", "10:00"),
                }
            )

    def get_solution(self) -> List[Dict[str, Any]]:
        return self.solution_entries
