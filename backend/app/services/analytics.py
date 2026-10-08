from typing import List, Dict, Any


class TimetableAnalytics:
    @staticmethod
    def compute_metrics(
        schedule_entries: List[Dict[str, Any]],
        faculty_list: List[Dict[str, Any]],
        venue_list: List[Dict[str, Any]],
        slot_list: List[Dict[str, Any]],
        solver_time_ms: float = 0.0,
    ) -> Dict[str, Any]:
        # 1. Faculty Workload calculation
        faculty_workload: Dict[str, Dict[str, Any]] = {}
        faculty_id_to_name = {
            f.get("id", idx): f.get("name", f"Faculty {idx}")
            for idx, f in enumerate(faculty_list)
        }
        for fid, name in faculty_id_to_name.items():
            faculty_workload[str(fid)] = {
                "name": name,
                "total_hours": 0,
                "days_assigned": set(),
                "hours_per_day": {},
            }

        # 2. Room utilization calculation
        venue_utilization: Dict[str, Dict[str, Any]] = {}
        venue_id_to_name = {
            v.get("id", idx): v.get("name", f"Venue {idx}")
            for idx, v in enumerate(venue_list)
        }
        for vid, name in venue_id_to_name.items():
            venue_utilization[str(vid)] = {
                "name": name,
                "total_slots_booked": 0,
                "total_available_slots": len(slot_list),
                "utilization_percentage": 0.0,
            }

        # 3. Preference Satisfaction metrics
        faculty_lookup = {f.get("id", idx): f for idx, f in enumerate(faculty_list)}
        total_preferences_checked = 0
        preferences_satisfied = 0

        for entry in schedule_entries:
            # Faculty workload tracking
            fid_str = str(entry["faculty_id"])
            if fid_str in faculty_workload:
                faculty_workload[fid_str]["total_hours"] += 1
                day = entry.get("day_of_week", "Unknown")
                faculty_workload[fid_str]["days_assigned"].add(day)
                hpd = faculty_workload[fid_str]["hours_per_day"]
                hpd[day] = hpd.get(day, 0) + 1

            # Venue utilization tracking
            vid_str = str(entry["venue_id"])
            if vid_str in venue_utilization:
                venue_utilization[vid_str]["total_slots_booked"] += 1

            # Preference tracking
            fac_data = faculty_lookup.get(entry["faculty_id"])
            if fac_data and "preferences" in fac_data:
                prefs = fac_data["preferences"]
                if "prefer_morning" in prefs:
                    total_preferences_checked += 1
                    start_h = int(entry.get("start_time", "12:00").split(":")[0])
                    if (start_h < 12 and prefs["prefer_morning"]) or (start_h >= 12 and not prefs["prefer_morning"]):
                        preferences_satisfied += 1

                if "preferred_days" in prefs and prefs["preferred_days"]:
                    total_preferences_checked += 1
                    if entry.get("day_of_week") in prefs["preferred_days"]:
                        preferences_satisfied += 1

        # Format sets to lengths for JSON serialization
        for fid_str, fac_data in faculty_workload.items():
            fac_data["days_count"] = len(fac_data["days_assigned"])
            fac_data["days_assigned"] = list(fac_data["days_assigned"])

        # Finalize venue percentages
        total_slots_booked_all = 0
        for vid_str, ven_data in venue_utilization.items():
            total_slots_booked_all += ven_data["total_slots_booked"]
            if ven_data["total_available_slots"] > 0:
                ven_data["utilization_percentage"] = round(
                    (ven_data["total_slots_booked"] / ven_data["total_available_slots"]) * 100.0, 2
                )

        pref_satisfaction_pct = 100.0
        if total_preferences_checked > 0:
            pref_satisfaction_pct = round(
                (preferences_satisfied / total_preferences_checked) * 100.0, 2
            )

        total_grid_capacity = max(1, len(venue_list) * len(slot_list))
        fill_rate = round((len(schedule_entries) / total_grid_capacity) * 100.0, 2)

        return {
            "faculty_workload": faculty_workload,
            "venue_utilization": venue_utilization,
            "preference_satisfaction_percentage": pref_satisfaction_pct,
            "time_slot_fill_rate_percentage": fill_rate,
            "conflicts_resolved_count": len(schedule_entries),
            "solver_efficiency": {
                "solver_time_ms": solver_time_ms,
                "courses_scheduled_per_second": (
                    round((len(schedule_entries) / (solver_time_ms / 1000.0)), 1)
                    if solver_time_ms > 0
                    else len(schedule_entries)
                ),
            },
        }
