from collections import defaultdict
from typing import List, Dict, Any, Tuple


BASE_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
STANDARD_SLOTS: List[Tuple[str, str]] = [
    ("09:00", "9-10am"),
    ("10:00", "10-11am"),
    ("11:00", "11-12pm"),
    ("BREAK", "BREAK (12-2pm)"),
    ("14:00", "2-3pm"),
    ("15:00", "3-4pm"),
    ("16:00", "4-5pm"),
]


def _normalize_hour_key(start_time: str) -> str:
    s = str(start_time).strip()
    if s.upper().startswith("BREAK"):
        return "BREAK"
    parts = s.split(":")
    try:
        h = int(parts[0])
        return f"{h:02d}:00"
    except Exception:
        return s


def _format_hour_label(norm_key: str) -> str:
    if norm_key == "BREAK":
        return "BREAK (12-2pm)"
    try:
        h = int(norm_key.split(":")[0])
        next_h = h + 1
        suffix = "am" if next_h < 12 else "pm"
        disp_h = h if h <= 12 else h - 12
        disp_next = next_h if next_h <= 12 else next_h - 12
        return f"{disp_h}-{disp_next}{suffix}"
    except Exception:
        return norm_key


def _resolve_days_and_slots(entries: List[Dict[str, Any]]) -> Tuple[List[str], List[Tuple[str, str]]]:
    days = list(BASE_DAYS)
    for e in entries:
        d = e.get("day_of_week")
        if d and d not in days:
            days.append(d)

    slot_dict = {k: label for k, label in STANDARD_SLOTS}
    for e in entries:
        norm_t = _normalize_hour_key(e.get("start_time", "09:00"))
        if norm_t not in slot_dict:
            slot_dict[norm_t] = _format_hour_label(norm_t)

    def _slot_sort_key(item: Tuple[str, str]) -> int:
        k = item[0]
        if k == "BREAK":
            return 1250
        try:
            return int(k.split(":")[0]) * 100
        except Exception:
            return 9999

    sorted_slots = sorted(slot_dict.items(), key=_slot_sort_key)
    return days, sorted_slots


def build_table_rows(
    entries: List[Dict[str, Any]],
    view_type: str = "master",
) -> List[List[str]]:
    """
    Convert schedule entries into universal tabular format:
      Header: ["Time Slot", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", ...]
      Rows: one row per time slot, including a dedicated BREAK row and any custom slots.
    Customizes cell content based on `view_type`:
      - master: Course Code, Course Name, Faculty, Venue
      - teacher: Faculty Name -> Course & Room
      - student: Course Name (Code) @ Venue
      - staff: Booked Venues & Transition Load
      - canteen: Active Population & Dining Demand Forecast
    """
    cell_map: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for e in entries:
        day = e.get("day_of_week", "Monday")
        norm_t = _normalize_hour_key(e.get("start_time", "09:00"))
        cell_map[f"{day}_{norm_t}"].append(e)

    days, active_slots = _resolve_days_and_slots(entries)
    headers = ["Time Slot"] + days
    rows: List[List[str]] = [headers]

    for slot_key, slot_label in active_slots:
        if slot_key == "BREAK":
            if view_type == "canteen":
                rows.append(
                    [slot_label]
                    + ["PEAK LUNCH RUSH\nEst. 350+ Diners\nAll Counters Open"] * len(days)
                )
            elif view_type == "staff":
                rows.append(
                    [slot_label]
                    + ["Room Sanitization &\nAV Check Window"] * len(days)
                )
            else:
                rows.append([slot_label] + ["Lunch Break"] * len(days))
            continue

        row = [slot_label]
        for day in days:
            slot_entries = cell_map.get(f"{day}_{slot_key}", [])
            if not slot_entries:
                if view_type == "canteen":
                    row.append("Low Footfall (~40)\nBeverage & Snacks")
                elif view_type == "staff":
                    row.append("All Rooms Idle\nMaintenance OK")
                else:
                    row.append("")
                continue

            if view_type == "teacher":
                lines = [
                    f"{item.get('faculty_name', 'Faculty')}\n{item.get('course_name', '')} ({item.get('venue_name', '')})"
                    for item in slot_entries
                ]
                row.append("\n---\n".join(lines))
            elif view_type == "student":
                lines = [
                    f"{item.get('course_code', '')}: {item.get('course_name', '')}\nRoom: {item.get('venue_name', '')}"
                    for item in slot_entries
                ]
                row.append("\n---\n".join(lines))
            elif view_type == "staff":
                venues_used = [item.get("venue_name", "") for item in slot_entries]
                row.append(
                    f"Active Rooms ({len(venues_used)}):\n"
                    + ", ".join(venues_used)
                    + "\nSupport: On-Call"
                )
            elif view_type == "canteen":
                active_classes = len(slot_entries)
                est_students_in_class = active_classes * 45
                row.append(
                    f"{active_classes} Classes Active\n~{est_students_in_class} in Lecture\nPre-Break Prep"
                )
            else:
                # Master view
                lines = [
                    f"{item.get('faculty_name', '')}\n{item.get('course_name', '')}\n{item.get('venue_name', '')}"
                    for item in slot_entries
                ]
                row.append("\n---\n".join(lines))

        rows.append(row)

    return rows


def generate_multi_views(
    entries: List[Dict[str, Any]],
    metadata: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Generate structured multi-view perspectives from the same schedule:
      - master
      - teacher
      - student
      - staff
      - canteen
    """
    days, _ = _resolve_days_and_slots(entries)
    views = {}
    for v_type in ("master", "teacher", "student", "staff", "canteen"):
        table_rows = build_table_rows(entries, view_type=v_type)
        views[v_type] = {
            "view_type": v_type,
            "headers": table_rows[0] if table_rows else ["Time Slot"] + days,
            "rows": table_rows[1:] if len(table_rows) > 1 else [],
            "metadata": metadata,
        }
    return views
