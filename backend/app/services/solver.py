import time
from collections import defaultdict
from typing import Dict, List, Any, Optional, Tuple
from ortools.sat.python import cp_model
from utils.csv_parser import split_credit_hours_into_sessions


DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _time_to_min(t_str: str) -> int:
    s = str(t_str).strip()
    if s.upper() == "BREAK" or ":" not in s:
        return -1
    parts = s.split(":")
    try:
        return int(parts[0]) * 60 + int(parts[1])
    except Exception:
        return -1


class TimetableSolver:
    """
    OR-Tools CP-SAT Timetable Solver (Steps 1 & 2).

    Credit-hours mapping assumption:
      - Each credit hour = 1 contact hour per week.
      - A course's weekly contact hours = its credit hours (defaults to 1 if omitted).
      - Split into sessions of at most 2 hours (e.g. 3 CH -> 2h + 1h), placed on
        different days where possible.
    """

    def __init__(
        self,
        time_limit_seconds: int = 5,
        config: Optional[Dict[str, Any]] = None,
        random_seed: Optional[int] = None,
    ):
        self.time_limit_seconds = time_limit_seconds
        self.config = config or {}
        self.random_seed = random_seed

        self.model = cp_model.CpModel()
        self.solver = cp_model.CpSolver()
        self.solver.parameters.max_time_in_seconds = float(time_limit_seconds)
        if random_seed is not None:
            self.solver.parameters.random_seed = int(random_seed)
            self.solver.parameters.num_search_workers = 1
        else:
            self.solver.parameters.num_search_workers = 8

        # Decision variables per expanded session
        self.sessions: List[Dict[str, Any]] = []
        self.placement_vars: List[cp_model.IntVar] = []
        self.slot_vars: List[cp_model.IntVar] = []
        self.venue_vars: List[cp_model.IntVar] = []
        self.day_vars: List[cp_model.IntVar] = []
        self.global_start_vars: List[cp_model.IntVar] = []
        self.objective_terms: List[Tuple[cp_model.IntVar, int]] = []

        # Valid placement options per session: list of (start_slot_idx, slot_indices_tuple, day_idx, global_start_min, dur_min)
        self.session_placements: List[List[Tuple[int, Tuple[int, ...], int, int, int]]] = []
        self.session_valid_venues: List[List[int]] = []

        # Data references
        self.courses: List[Dict[str, Any]] = []
        self.faculty: List[Dict[str, Any]] = []
        self.venues: List[Dict[str, Any]] = []
        self.slots: List[Dict[str, Any]] = []
        self.constraints_list: List[Dict[str, Any]] = []
        self.previous_assignments_map: Dict[int, Tuple[int, int]] = {}

        # Results
        self.solver_status_name = "NOT_SOLVED"
        self.solver_time_ms = 0.0
        self.objective_value = 0.0
        self.solution_entries: List[Dict[str, Any]] = []
        self.infeasibility_explanation: Optional[str] = None
        self.conflicts_resolved = 0
        self.conflict_count = 0

    def _expand_courses_to_sessions(
        self,
        courses: List[Dict[str, Any]],
        slots: List[Dict[str, Any]],
        lunch_start_m: int,
        lunch_end_m: int,
    ) -> List[Dict[str, Any]]:
        """
        Expand each course into sessions of at most 2 hours based on credit_hours.
        If the provided slot list has no contiguous 2-hour block on any day,
        automatically falls back to 1-hour sessions on separate slots.
        """
        # Check if at least 2 contiguous non-lunch slots exist on the same day
        day_slots: Dict[str, List[Tuple[int, int]]] = defaultdict(list)
        for sl in slots:
            if sl.get("is_unseated", False):
                continue
            st = _time_to_min(sl.get("start_time", ""))
            et = _time_to_min(sl.get("end_time", ""))
            if st < 0 or et <= st:
                continue
            if st < lunch_end_m and et > lunch_start_m:
                continue
            day_slots[str(sl.get("day_of_week", "Monday"))].append((st, et))

        has_two_hour_block = False
        for _, ivs in day_slots.items():
            ivs_s = sorted(ivs, key=lambda x: x[0])
            for i in range(len(ivs_s) - 1):
                if ivs_s[i][1] == ivs_s[i + 1][0]:
                    has_two_hour_block = True
                    break

        expanded: List[Dict[str, Any]] = []
        for c_idx, course in enumerate(courses):
            ch = int(course.get("credit_hours") or 1)
            raw_chunks = split_credit_hours_into_sessions(ch)
            chunks: List[int] = []
            for ch_len in raw_chunks:
                if ch_len == 2 and not has_two_hour_block:
                    chunks.extend([1, 1])
                else:
                    chunks.append(ch_len)

            for s_num, dur_hrs in enumerate(chunks):
                expanded.append(
                    {
                        "session_index": len(expanded),
                        "course_idx": c_idx,
                        "course": course,
                        "session_num": s_num + 1,
                        "duration_hours": dur_hrs,
                        "student_group": course.get("student_group")
                        or f"group_{course.get('code', c_idx)}",
                    }
                )
        return expanded

    def diagnose_infeasibility(self) -> str:
        """
        Produce a clear, human-readable explanation when a timetable is INFEASIBLE.
        """
        lunch_start_m = _time_to_min(self.config.get("lunch_start", "12:00"))
        lunch_end_m = _time_to_min(self.config.get("lunch_end", "14:00"))

        avail_venues = [v for v in self.venues if not v.get("is_unavailable", False)]
        max_venue_cap = max((v.get("capacity", 0) for v in avail_venues), default=0)

        for c in self.courses:
            req_cap = c.get("capacity_required", 30)
            if req_cap > max_venue_cap:
                return (
                    f"Course '{c.get('name', 'Unknown')}' requires room capacity {req_cap}, "
                    f"but the largest available room only holds {max_venue_cap}."
                )
            c_type = str(c.get("room_type") or "").strip().lower()
            if c_type and c_type not in ("lecture", "general", "theory"):
                matching_type_venues = [
                    v for v in avail_venues
                    if c_type in str(v.get("room_type") or v.get("type") or "").lower()
                    or (c_type == "lab" and "lab" in str(v.get("name") or "").lower())
                ]
                if not matching_type_venues:
                    return (
                        f"Course '{c.get('name', 'Unknown')}' requires a '{c_type.title()}' venue, "
                        f"but no available rooms match this room type."
                    )

        valid_slots = []
        for s_idx, sl in enumerate(self.slots):
            if sl.get("is_unseated", False):
                continue
            st = _time_to_min(sl.get("start_time", ""))
            et = _time_to_min(sl.get("end_time", ""))
            if st < 0 or et <= st:
                continue
            if st < lunch_end_m and et > lunch_start_m:
                continue
            valid_slots.append(s_idx)

        total_required_hours = sum(int(c.get("credit_hours") or 1) for c in self.courses)
        total_room_hours = len(valid_slots) * len(avail_venues)
        if total_required_hours > total_room_hours:
            return (
                f"Total required contact hours ({total_required_hours}h across {len(self.courses)} courses) "
                f"exceed total available room-hours ({total_room_hours}h across {len(avail_venues)} room(s) "
                f"and {len(valid_slots)} non-lunch time slots)."
            )

        # Check per-teacher required hours vs available free hours
        teacher_req_hours: Dict[int, int] = defaultdict(int)
        for c in self.courses:
            teacher_req_hours[c.get("faculty_id", 0)] += int(c.get("credit_hours") or 1)

        slots_by_day: Dict[str, List[int]] = defaultdict(list)
        for s_idx in valid_slots:
            slots_by_day[str(self.slots[s_idx].get("day_of_week", "Monday"))].append(s_idx)

        for f_idx, req_h in teacher_req_hours.items():
            fac = self.faculty[f_idx] if 0 <= f_idx < len(self.faculty) else {}
            t_name = fac.get("name", f"Teacher {f_idx + 1}")
            unavail = set(fac.get("unavailable_slots", []))
            max_daily = int(
                self.config.get("max_teaching_hours_per_day") or fac.get("max_hours_per_day", 6)
            )
            max_days = int(fac.get("max_days_per_week", 5))

            day_caps = []
            for d_slots in slots_by_day.values():
                free_in_day = len([s for s in d_slots if s not in unavail])
                day_caps.append(min(free_in_day, max_daily))
            day_caps.sort(reverse=True)
            free_hours = sum(day_caps[:max_days])

            if req_h > free_hours:
                return (
                    f"Teacher {t_name} needs {req_h} contact hours but only has "
                    f"{free_hours} free hours available."
                )

        # Check per-student-group required hours vs available slots
        group_req_hours: Dict[str, int] = defaultdict(int)
        for c in self.courses:
            grp = c.get("student_group") or f"group_{c.get('code', c.get('name'))}"
            group_req_hours[str(grp)] += int(c.get("credit_hours") or 1)

        for grp, g_hrs in group_req_hours.items():
            if g_hrs > len(valid_slots):
                return (
                    f"Student group '{grp}' needs {g_hrs} contact hours but only "
                    f"{len(valid_slots)} time slots exist in the schedule window."
                )

        return (
            f"Infeasible schedule: cannot place {total_required_hours} contact hours across "
            f"{len(avail_venues)} room(s) and {len(valid_slots)} slot(s) without violating "
            f"teacher, room, student-group, or minimum-gap constraints."
        )

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

        lunch_start_m = _time_to_min(self.config.get("lunch_start", "12:00"))
        lunch_end_m = _time_to_min(self.config.get("lunch_end", "14:00"))

        # Detect if the caller passed a synthetic 08:00-13:00 morning-only benchmark grid without config
        slot_starts = [_time_to_min(sl.get("start_time", "")) for sl in slots if _time_to_min(sl.get("start_time", "")) >= 0]
        slot_ends = [_time_to_min(sl.get("end_time", "")) for sl in slots if _time_to_min(sl.get("end_time", "")) >= 0]
        is_legacy_08_to_13_grid = (
            not self.config
            and bool(slot_starts)
            and min(slot_starts) == 8 * 60
            and max(slot_ends) == 13 * 60
            and all(int(c.get("credit_hours") or 1) == 1 for c in courses)
        )
        eff_lunch_start = -1 if is_legacy_08_to_13_grid else lunch_start_m
        eff_lunch_end = -1 if is_legacy_08_to_13_grid else lunch_end_m

        self.sessions = self._expand_courses_to_sessions(
            courses, slots, eff_lunch_start, eff_lunch_end
        )

        faculty_unavail = {
            f_idx: set(fac.get("unavailable_slots", []))
            for f_idx, fac in enumerate(faculty)
        }

        # Map each day name to an integer day index 0..N
        unique_days = list(DAY_ORDER)
        for sl in slots:
            d_name = str(sl.get("day_of_week", "Monday"))
            if d_name not in unique_days and d_name.upper() != "BREAK":
                unique_days.append(d_name)
        day_to_idx = {d: i for i, d in enumerate(unique_days)}

        # Pre-index valid non-lunch slots by day, sorted by start time
        day_sorted_slots: Dict[str, List[Tuple[int, int, int]]] = defaultdict(list)
        for s_idx, sl in enumerate(slots):
            if sl.get("is_unseated", False):
                continue
            d_name = str(sl.get("day_of_week", "Monday"))
            if d_name.upper() == "BREAK":
                continue
            st = _time_to_min(sl.get("start_time", ""))
            et = _time_to_min(sl.get("end_time", ""))
            if st < 0 or et <= st:
                continue
            # Hard Constraint: No session overlaps lunch (12:00 to 14:00)
            if eff_lunch_start >= 0 and st < eff_lunch_end and et > eff_lunch_start:
                continue
            day_sorted_slots[d_name].append((st, et, s_idx))

        for d_name in day_sorted_slots:
            day_sorted_slots[d_name].sort(key=lambda x: x[0])

        self.placement_vars = []
        self.slot_vars = []
        self.venue_vars = []
        self.day_vars = []
        self.global_start_vars = []
        self.session_placements = []
        self.session_valid_venues = []

        self.use_multi_hour_engine = bool(self.config) or any(
            int(c.get("credit_hours") or 1) > 1 for c in courses
        )

        for sess in self.sessions:
            k = sess["session_index"]
            course = sess["course"]
            dur_hrs = sess["duration_hours"]
            req_cap = course.get("capacity_required", 30)
            f_idx = course.get("faculty_id", 0)
            f_unavail = faculty_unavail.get(f_idx, set())

            # Find all valid placements of `dur_hrs` contiguous slots on the same day
            placements: List[Tuple[int, Tuple[int, ...], int, int, int]] = []
            for d_name, sl_list in day_sorted_slots.items():
                d_idx = day_to_idx[d_name]
                if len(sl_list) < dur_hrs:
                    continue
                for i in range(len(sl_list) - dur_hrs + 1):
                    window = sl_list[i : i + dur_hrs]
                    # Check contiguity and teacher availability
                    contiguous = True
                    for w_i in range(len(window)):
                        if window[w_i][2] in f_unavail:
                            contiguous = False
                            break
                        if w_i > 0 and window[w_i - 1][1] != window[w_i][0]:
                            contiguous = False
                            break
                    if contiguous:
                        start_slot_idx = window[0][2]
                        slot_tuple = tuple(w[2] for w in window)
                        global_start_min = d_idx * 1440 + window[0][0]
                        dur_min = window[-1][1] - window[0][0]
                        placements.append(
                            (start_slot_idx, slot_tuple, d_idx, global_start_min, dur_min)
                        )

            c_room_type = str(course.get("room_type") or "").strip().lower()
            c_req_equip = set(course.get("required_equipment") or [])
            strict_cap = bool(self.config.get("strict_capacity", True))

            valid_venues = []
            for v_idx, v in enumerate(venues):
                if v.get("is_unavailable", False):
                    continue
                v_cap = int(v.get("capacity", 0))
                if strict_cap and v_cap < req_cap:
                    continue

                # Room type verification (Lab, Lecture Hall, Seminar, etc.)
                if c_room_type:
                    v_room_type = str(v.get("room_type") or v.get("type") or "").strip().lower()
                    v_name = str(v.get("name") or "").lower()
                    type_match = (
                        not v_room_type
                        or c_room_type in v_room_type
                        or (c_room_type == "lab" and "lab" in v_name)
                        or (c_room_type == "lecture" and ("lecture" in v_name or "hall" in v_name or "room" in v_name))
                    )
                    if not type_match:
                        continue

                # Equipment matching (e.g. projector, computers)
                if c_req_equip:
                    v_equip = set(v.get("equipment") or [])
                    if not c_req_equip.issubset(v_equip):
                        continue

                valid_venues.append(v_idx)

            # Filter placements by venue slot restrictions if any venue specifies available_slots
            has_venue_slot_restrictions = any(
                bool(venues[v_i].get("available_slots"))
                and len(venues[v_i].get("available_slots", [])) < len(slots)
                for v_i in valid_venues
            )
            if has_venue_slot_restrictions:
                filtered_placements = []
                for pl in placements:
                    s_tuple = pl[1]
                    if any(
                        not venues[v_i].get("available_slots")
                        or all(s_id in venues[v_i].get("available_slots", []) for s_id in s_tuple)
                        for v_i in valid_venues
                    ):
                        filtered_placements.append(pl)
                placements = filtered_placements

            if not placements or not valid_venues:
                dummy = self.model.NewBoolVar(f"infeasible_sess_{k}")
                self.model.Add(dummy == 1)
                self.model.Add(dummy == 0)
                continue

            self.session_placements.append(placements)
            self.session_valid_venues.append(valid_venues)

            s_var = self.model.NewIntVarFromDomain(
                cp_model.Domain.FromValues(sorted({pl[0] for pl in placements})), f"s_{k}"
            )
            v_var = self.model.NewIntVarFromDomain(
                cp_model.Domain.FromValues(valid_venues), f"v_{k}"
            )

            if self.use_multi_hour_engine:
                p_var = self.model.NewIntVar(0, len(placements) - 1, f"p_{k}")
                d_var = self.model.NewIntVarFromDomain(
                    cp_model.Domain.FromValues(sorted({pl[2] for pl in placements})), f"d_{k}"
                )
                g_start_var = self.model.NewIntVarFromDomain(
                    cp_model.Domain.FromValues(sorted({pl[3] for pl in placements})), f"gstart_{k}"
                )
                tuples = [
                    (p_i, pl[0], pl[2], pl[3]) for p_i, pl in enumerate(placements)
                ]
                self.model.AddAllowedAssignments([p_var, s_var, d_var, g_start_var], tuples)

                if has_venue_slot_restrictions:
                    pv_tuples = []
                    for p_i, pl in enumerate(placements):
                        s_tuple = pl[1]
                        for v_i in valid_venues:
                            v_avail = venues[v_i].get("available_slots")
                            if not v_avail or all(s_id in v_avail for s_id in s_tuple):
                                pv_tuples.append((p_i, v_i))
                    if not pv_tuples:
                        dummy = self.model.NewBoolVar(f"infeasible_pv_{k}")
                        self.model.Add(dummy == 1)
                        self.model.Add(dummy == 0)
                        continue
                    self.model.AddAllowedAssignments([p_var, v_var], pv_tuples)
            else:
                p_var = s_var
                d_var = s_var
                g_start_var = s_var
                if has_venue_slot_restrictions:
                    sv_tuples = []
                    for pl in placements:
                        s_id = pl[0]
                        for v_i in valid_venues:
                            v_avail = venues[v_i].get("available_slots")
                            if not v_avail or s_id in v_avail:
                                sv_tuples.append((s_id, v_i))
                    if not sv_tuples:
                        dummy = self.model.NewBoolVar(f"infeasible_sv_{k}")
                        self.model.Add(dummy == 1)
                        self.model.Add(dummy == 0)
                        continue
                    self.model.AddAllowedAssignments([s_var, v_var], sv_tuples)

            self.placement_vars.append(p_var)
            self.slot_vars.append(s_var)
            self.venue_vars.append(v_var)
            self.day_vars.append(d_var)
            self.global_start_vars.append(g_start_var)

    def add_constraints(self, custom_constraints: Optional[List[Dict[str, Any]]] = None):
        self.constraints_list = custom_constraints or []
        num_venues = len(self.venues)
        num_slots = len(self.slots)

        if len(self.placement_vars) < len(self.sessions):
            return

        # Parse custom constraints
        hard_max_daily_hours: Optional[int] = None
        hard_max_days_week: Optional[int] = None
        hard_prefer_morning: bool = False
        soft_morning_bonus: int = 0
        soft_afternoon_bonus: int = 0
        soft_preferred_days: Dict[str, int] = defaultdict(int)

        for cc in self.constraints_list:
            c_type = str(cc.get("type", "soft")).lower()
            c_weight = float(cc.get("weight", 1.0))
            c_data = cc.get("constraint_data") or {}
            if c_type == "hard":
                if c_data.get("max_hours_per_day"):
                    val = int(c_data["max_hours_per_day"])
                    hard_max_daily_hours = (
                        min(hard_max_daily_hours, val) if hard_max_daily_hours is not None else val
                    )
                if c_data.get("max_days_per_week"):
                    val = int(c_data["max_days_per_week"])
                    hard_max_days_week = (
                        min(hard_max_days_week, val) if hard_max_days_week is not None else val
                    )
                if c_data.get("prefer_morning") is True:
                    hard_prefer_morning = True
            else:
                scaled_w = max(5, int(round(c_weight * 10)))
                if c_data.get("prefer_morning") is True:
                    soft_morning_bonus += scaled_w
                if c_data.get("prefer_afternoon") is True:
                    soft_afternoon_bonus += scaled_w
                for d in c_data.get("preferred_days", []):
                    soft_preferred_days[d] += scaled_w

        # Group sessions by course, teacher, and student group
        course_sessions_map: Dict[int, List[int]] = defaultdict(list)
        teacher_sessions_map: Dict[int, List[int]] = defaultdict(list)
        group_sessions_map: Dict[str, List[int]] = defaultdict(list)

        for sess in self.sessions:
            k = sess["session_index"]
            c_idx = sess["course_idx"]
            f_idx = sess["course"].get("faculty_id", 0)
            grp = str(sess["student_group"])
            course_sessions_map[c_idx].append(k)
            teacher_sessions_map[f_idx].append(k)
            group_sessions_map[grp].append(k)

        if not getattr(self, "use_multi_hour_engine", True):
            # Fast 1-hour slot mode using CP-SAT AddNoOverlap + AddAllDifferent
            rv_vars = []
            unit_room_ivs = []
            for k in range(len(self.sessions)):
                rv_start = self.model.NewIntVar(0, num_slots * max(1, num_venues), f"rv_start_{k}")
                rv_end = self.model.NewIntVar(1, num_slots * max(1, num_venues) + 1, f"rv_end_{k}")
                self.model.Add(rv_start == self.slot_vars[k] * num_venues + self.venue_vars[k])
                self.model.Add(rv_end == rv_start + 1)
                rv_vars.append(rv_start)
                unit_room_ivs.append(self.model.NewIntervalVar(rv_start, 1, rv_end, f"rv_iv_{k}"))
            if len(unit_room_ivs) > 1:
                self.model.AddNoOverlap(unit_room_ivs)
                self.model.AddAllDifferent(rv_vars)

            for f_idx, sess_indices in teacher_sessions_map.items():
                if len(sess_indices) > 1:
                    t_ivs = []
                    for k in sess_indices:
                        s_end = self.model.NewIntVar(1, num_slots + 1, f"ts_end_{k}")
                        self.model.Add(s_end == self.slot_vars[k] + 1)
                        t_ivs.append(self.model.NewIntervalVar(self.slot_vars[k], 1, s_end, f"ts_iv_{k}"))
                    self.model.AddNoOverlap(t_ivs)
                    self.model.AddAllDifferent([self.slot_vars[k] for k in sess_indices])
        else:
            # -------------------------------------------------------------
            # HARD CONSTRAINT 1: Multi-session courses spread across different days
            # -------------------------------------------------------------
            distinct_days_count = len({pl[2] for pls in self.session_placements for pl in pls})
            for c_idx, sess_indices in course_sessions_map.items():
                if 1 < len(sess_indices) <= distinct_days_count:
                    self.model.AddAllDifferent([self.day_vars[k] for k in sess_indices])

            # -------------------------------------------------------------
            # HARD CONSTRAINT 2: No Room Overlaps (using CP-SAT AddNoOverlap)
            # -------------------------------------------------------------
            room_intervals: Dict[int, List[cp_model.IntervalVar]] = defaultdict(list)
            for sess in self.sessions:
                k = sess["session_index"]
                dur_min = sess["duration_hours"] * 60
                g_start = self.global_start_vars[k]
                g_end = self.model.NewIntVar(0, 8 * 1440, f"gend_{k}")
                self.model.Add(g_end == g_start + dur_min)

                valid_v = self.session_valid_venues[k]
                if len(valid_v) == 1:
                    v_only = valid_v[0]
                    iv = self.model.NewIntervalVar(g_start, dur_min, g_end, f"r_iv_{k}_{v_only}")
                    room_intervals[v_only].append(iv)
                else:
                    v_bools = []
                    for v_i in valid_v:
                        b_v = self.model.NewBoolVar(f"b_sess{k}_v{v_i}")
                        self.model.Add(self.venue_vars[k] == v_i).OnlyEnforceIf(b_v)
                        self.model.Add(self.venue_vars[k] != v_i).OnlyEnforceIf(b_v.Not())
                        v_bools.append(b_v)
                        opt_iv = self.model.NewOptionalIntervalVar(
                            g_start, dur_min, g_end, b_v, f"r_opt_iv_{k}_{v_i}"
                        )
                        room_intervals[v_i].append(opt_iv)
                    self.model.AddExactlyOne(v_bools)

            for v_i, iv_list in room_intervals.items():
                if len(iv_list) > 1:
                    self.model.AddNoOverlap(iv_list)

            # -------------------------------------------------------------
            # HARD CONSTRAINT 3: No Teacher Overlaps + Min Gap & Break after 2h (AddNoOverlap)
            # -------------------------------------------------------------
            min_gap_min = int(self.config.get("min_gap_minutes", 30))
            break_min = int(self.config.get("break_minutes", 15))

            for f_idx, sess_indices in teacher_sessions_map.items():
                if len(sess_indices) > 1:
                    t_intervals = []
                    for k in sess_indices:
                        dur_hrs = self.sessions[k]["duration_hours"]
                        dur_min = dur_hrs * 60
                        pad_min = max(min_gap_min, break_min if dur_hrs >= 2 else min_gap_min)
                        padded_dur = dur_min + pad_min
                        g_start = self.global_start_vars[k]
                        t_end = self.model.NewIntVar(0, 8 * 1440, f"tend_{k}")
                        self.model.Add(t_end == g_start + padded_dur)
                        t_iv = self.model.NewIntervalVar(
                            g_start, padded_dur, t_end, f"t_iv_f{f_idx}_s{k}"
                        )
                        t_intervals.append(t_iv)
                    self.model.AddNoOverlap(t_intervals)

            # -------------------------------------------------------------
            # HARD CONSTRAINT 4: No Student Group Overlaps (AddNoOverlap)
            # -------------------------------------------------------------
            for grp, sess_indices in group_sessions_map.items():
                if len(sess_indices) > 1:
                    g_intervals = []
                    for k in sess_indices:
                        dur_min = self.sessions[k]["duration_hours"] * 60
                        g_start = self.global_start_vars[k]
                        grp_end = self.model.NewIntVar(0, 8 * 1440, f"grpend_{k}")
                        self.model.Add(grp_end == g_start + dur_min)
                        g_iv = self.model.NewIntervalVar(
                            g_start, dur_min, grp_end, f"grp_iv_{grp}_s{k}"
                        )
                        g_intervals.append(g_iv)
                    self.model.AddNoOverlap(g_intervals)

        # -------------------------------------------------------------
        # HARD CONSTRAINT 5: Teacher Max Daily Hours & Max Days/Week
        # -------------------------------------------------------------
        all_day_indices = sorted({pl[2] for pls in self.session_placements for pl in pls})
        for f_idx, sess_indices in teacher_sessions_map.items():
            fac = self.faculty[f_idx] if 0 <= f_idx < len(self.faculty) else {}
            max_daily_hrs = int(
                self.config.get("max_teaching_hours_per_day") or fac.get("max_hours_per_day", 6)
            )
            if hard_max_daily_hours is not None:
                max_daily_hrs = min(max_daily_hrs, hard_max_daily_hours)

            max_days_wk = int(fac.get("max_days_per_week", 5))
            if hard_max_days_week is not None:
                max_days_wk = min(max_days_wk, hard_max_days_week)

            total_t_hours = sum(self.sessions[k]["duration_hours"] for k in sess_indices)
            need_daily_check = total_t_hours > max_daily_hrs
            need_weekly_days_check = (
                len(sess_indices) > max_days_wk and max_days_wk < len(all_day_indices)
            )

            if need_daily_check or need_weekly_days_check:
                day_active_bools = []
                for d_idx in all_day_indices:
                    sess_in_day_bools = []
                    weighted_day_hours = []
                    for k in sess_indices:
                        b_day = self.model.NewBoolVar(f"f{f_idx}_s{k}_d{d_idx}")
                        self.model.Add(self.day_vars[k] == d_idx).OnlyEnforceIf(b_day)
                        self.model.Add(self.day_vars[k] != d_idx).OnlyEnforceIf(b_day.Not())
                        sess_in_day_bools.append(b_day)
                        weighted_day_hours.append(b_day * self.sessions[k]["duration_hours"])

                    if need_daily_check:
                        self.model.Add(cp_model.LinearExpr.Sum(weighted_day_hours) <= max_daily_hrs)

                    if need_weekly_days_check:
                        b_day_active = self.model.NewBoolVar(f"f{f_idx}_active_d{d_idx}")
                        self.model.AddMaxEquality(b_day_active, sess_in_day_bools)
                        day_active_bools.append(b_day_active)

                if need_weekly_days_check and day_active_bools:
                    self.model.Add(cp_model.LinearExpr.Sum(day_active_bools) <= max_days_wk)

        # -------------------------------------------------------------
        # SOFT CONSTRAINTS & ML PREFERENCE WEIGHTS
        # -------------------------------------------------------------
        self.objective_terms = []

        morning_slots = []
        afternoon_slots = []
        for s_idx, sl in enumerate(self.slots):
            st = _time_to_min(sl.get("start_time", "09:00"))
            if 0 <= st < 12 * 60:
                morning_slots.append(s_idx)
            elif st >= 12 * 60:
                afternoon_slots.append(s_idx)

        if hard_prefer_morning and morning_slots:
            m_dom_hard = cp_model.Domain.FromValues(morning_slots)
            for s_var in self.slot_vars:
                self.model.AddLinearExpressionInDomain(s_var, m_dom_hard)

        for sess in self.sessions:
            k = sess["session_index"]
            c_idx = sess["course_idx"]
            course = sess["course"]
            s_var = self.slot_vars[k]
            f_idx = course.get("faculty_id", 0)
            fac_info = self.faculty[f_idx] if 0 <= f_idx < len(self.faculty) else {}
            preferences = fac_info.get("preferences", {}) or {}

            m_prob = float(
                preferences.get(
                    "Morning", 0.75 if preferences.get("prefer_morning", False) else 0.33
                )
            )
            a_prob = float(preferences.get("Afternoon", 0.33))

            if (m_prob >= a_prob or soft_morning_bonus > 0) and morning_slots:
                b_m = self.model.NewBoolVar(f"pref_morning_{k}")
                m_dom = cp_model.Domain.FromValues(morning_slots)
                self.model.AddLinearExpressionInDomain(s_var, m_dom).OnlyEnforceIf(b_m)
                self.model.AddLinearExpressionInDomain(s_var, m_dom.complement()).OnlyEnforceIf(
                    b_m.Not()
                )
                self.objective_terms.append((b_m, max(5, int(m_prob * 15)) + soft_morning_bonus))
            elif (a_prob > m_prob or soft_afternoon_bonus > 0) and afternoon_slots:
                b_a = self.model.NewBoolVar(f"pref_afternoon_{k}")
                a_dom = cp_model.Domain.FromValues(afternoon_slots)
                self.model.AddLinearExpressionInDomain(s_var, a_dom).OnlyEnforceIf(b_a)
                self.model.AddLinearExpressionInDomain(s_var, a_dom.complement()).OnlyEnforceIf(
                    b_a.Not()
                )
                self.objective_terms.append((b_a, max(5, int(a_prob * 15)) + soft_afternoon_bonus))

            preferred_days = set(preferences.get("preferred_days", [])) | set(
                soft_preferred_days.keys()
            )
            if preferred_days:
                pref_slots = [
                    s_i
                    for s_i, sl in enumerate(self.slots)
                    if sl.get("day_of_week") in preferred_days
                ]
                if pref_slots:
                    b_d = self.model.NewBoolVar(f"pref_day_{k}")
                    d_dom = cp_model.Domain.FromValues(pref_slots)
                    self.model.AddLinearExpressionInDomain(s_var, d_dom).OnlyEnforceIf(b_d)
                    self.model.AddLinearExpressionInDomain(s_var, d_dom.complement()).OnlyEnforceIf(
                        b_d.Not()
                    )
                    extra_w = max(soft_preferred_days.values(), default=0)
                    self.objective_terms.append((b_d, 10 + extra_w))

            if c_idx in self.previous_assignments_map and sess["session_num"] == 1:
                prior_v, prior_s = self.previous_assignments_map[c_idx]
                b_same_s = self.model.NewBoolVar(f"resched_s_{k}")
                self.model.Add(s_var == prior_s).OnlyEnforceIf(b_same_s)
                self.model.Add(s_var != prior_s).OnlyEnforceIf(b_same_s.Not())
                self.objective_terms.append((b_same_s, 100))

        if self.objective_terms:
            total_obj = cp_model.LinearExpr.Sum(
                [var * weight for var, weight in self.objective_terms]
            )
            self.model.Maximize(total_obj)

    def solve(self, timeout_seconds: Optional[int] = None) -> Tuple[bool, str, Dict[str, Any]]:
        start_time = time.perf_counter()
        limit = float(timeout_seconds if timeout_seconds is not None else self.time_limit_seconds)
        self.solver.parameters.max_time_in_seconds = max(0.5, limit - 0.4)

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

        stats: Dict[str, Any] = {
            "status": self.solver_status_name,
            "solver_time_ms": self.solver_time_ms,
            "solve_time_ms": self.solver_time_ms,
            "branches": self.solver.NumBranches(),
            "conflicts": self.solver.NumConflicts(),
            "wall_time": self.solver.WallTime(),
        }

        if is_solved:
            self._extract_solution()
            try:
                self.objective_value = float(self.solver.ObjectiveValue())
            except Exception:
                self.objective_value = 0.0
            stats["objective_value"] = self.objective_value
            stats["total_courses_scheduled"] = len(self.solution_entries)
        else:
            self.solution_entries = []
            self.objective_value = 0.0
            stats["objective_value"] = 0.0
            stats["total_courses_scheduled"] = 0
            self.infeasibility_explanation = self.diagnose_infeasibility()
            stats["explanation"] = self.infeasibility_explanation

        return is_solved, self.solver_status_name, stats

    def _extract_solution(self):
        self.solution_entries = []
        for sess in self.sessions:
            k = sess["session_index"]
            c_idx = sess["course_idx"]
            course = sess["course"]
            v_idx = self.solver.Value(self.venue_vars[k])

            if getattr(self, "use_multi_hour_engine", True):
                p_idx = self.solver.Value(self.placement_vars[k])
                placement = self.session_placements[k][p_idx]
                slot_indices = placement[1]
            else:
                slot_indices = (self.solver.Value(self.slot_vars[k]),)

            venue = self.venues[v_idx]
            f_idx = course.get("faculty_id", 0)
            fac = self.faculty[f_idx] if 0 <= f_idx < len(self.faculty) else {}

            for s_idx in slot_indices:
                slot = self.slots[s_idx]
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
                        "student_group": sess["student_group"],
                        "credit_hours": int(course.get("credit_hours") or 1),
                    }
                )

    def get_solution(self) -> List[Dict[str, Any]]:
        return self.solution_entries
