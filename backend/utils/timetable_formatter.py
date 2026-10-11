from collections import defaultdict
from typing import List, Dict, Any, Tuple


BASE_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

# 9 standard university 50-minute slots matching the official sheet layout
UNIVERSITY_9_SLOTS: List[Tuple[str, str, str]] = [
    ("08:30", "Slot 1", "0830-9020"),
    ("09:20", "Slot 2", "0920-1010"),
    ("10:10", "Slot 3", "1010-1100"),
    ("11:00", "Slot 4", "1100-1150"),
    ("11:50", "Slot 5", "1150-1240"),
    ("12:40", "Slot 6", "1240-1330"),
    ("13:30", "Slot 7", "1330-1420"),
    ("14:20", "Slot 8", "1420-1510"),
    ("15:10", "Slot 9", "1510-1600"),
]

# Map legacy hourly start_time values (08:00..16:00) into the 9 university slots
HOUR_TO_SLOT_INDEX = {
    "08:00": 0,
    "08:30": 0,
    "0830": 0,
    "09:00": 0,
    "09:20": 1,
    "0920": 1,
    "10:00": 1,
    "10:10": 2,
    "1010": 2,
    "11:00": 3,
    "1100": 3,
    "11:50": 4,
    "1150": 4,
    "12:00": 4,
    "12:40": 5,
    "1240": 5,
    "13:00": 5,
    "13:30": 6,
    "1330": 6,
    "14:00": 6,
    "14:20": 7,
    "1420": 7,
    "15:00": 7,
    "15:10": 8,
    "1510": 8,
    "16:00": 8,
}


def map_time_to_slot_index(start_time: str, slot_id: int = 0) -> int:
    s = str(start_time or "").strip()
    if s in HOUR_TO_SLOT_INDEX:
        return HOUR_TO_SLOT_INDEX[s]
    prefix = s[:5]
    if prefix in HOUR_TO_SLOT_INDEX:
        return HOUR_TO_SLOT_INDEX[prefix]
    try:
        hour = int(s.split(":")[0])
        if hour <= 8:
            return 0
        if hour >= 16:
            return 8
        return min(8, max(0, hour - 8))
    except Exception:
        return (slot_id - 1) % 9 if slot_id > 0 else 0


def build_course_legend_rows(entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Build the lower 8-column Course & Faculty Legend table:
      Serial | Course Code | Course Titles | CHs | Name of Faculty | Elective / Compulsory | Venues | Remarks
    """
    grouped: Dict[str, Dict[str, Any]] = {}
    for e in entries:
        code = str(e.get("course_code") or "CS100").strip()
        title = str(e.get("course_name") or "Course").strip()
        key = f"{code}::{title}"
        venue = str(e.get("venue_name") or "AC-702 (A)").strip()
        faculty = str(e.get("faculty_name") or "Faculty").strip()
        is_lab = "lab" in title.lower() or "cl-" in venue.lower() or "nlsp" in venue.lower()

        if key not in grouped:
            remarks = e.get("remarks", "")
            if not remarks and "nlsp" in venue.lower():
                remarks = "VDI-1(301)"
            grouped[key] = {
                "course_code": code,
                "course_title": title,
                "credit_hours": e.get("credit_hours") or (1 if is_lab else 3),
                "faculty_name": faculty,
                "elective_compulsory": e.get("elective_compulsory", ""),
                "venues": [venue] if venue else [],
                "remarks": remarks,
            }
        else:
            if venue and venue not in grouped[key]["venues"]:
                grouped[key]["venues"].append(venue)

    legend_rows = []
    for idx, item in enumerate(grouped.values(), start=1):
        legend_rows.append(
            {
                "serial": idx,
                "course_code": item["course_code"],
                "course_title": item["course_title"],
                "credit_hours": item["credit_hours"],
                "faculty_name": item["faculty_name"],
                "elective_compulsory": item["elective_compulsory"],
                "venues": ", ".join(item["venues"]),
                "remarks": item["remarks"],
            }
        )
    return legend_rows


def build_university_sheet_data(
    entries: List[Dict[str, Any]],
    view_type: str = "master",
    section_title: str = "AI 2024 - Section A",
) -> Dict[str, Any]:
    """
    Build the complete university schedule structure matching the reference images:
      - section_title (e.g. "AI 2023", "AI 2024 - Section A")
      - slot_headers: ["Slot 1", ..., "Slot 9"]
      - time_headers: ["0830-9020", ..., "1510-1600"]
      - day_rows: dict mapping day -> list of 9 slot strings
      - merged_day_rows: dict mapping day -> list of { text, colSpan, startSlot }
      - course_legend: list of 8-column course legend dictionaries
    """
    days = list(BASE_DAYS)
    for e in entries:
        d = e.get("day_of_week")
        if d and d not in days and str(d).upper() != "BREAK":
            days.append(d)

    # day -> slot_idx (0..8) -> list of entries
    grid: Dict[str, Dict[int, List[Dict[str, Any]]]] = {
        d: defaultdict(list) for d in days
    }

    for e in entries:
        day = e.get("day_of_week", "Monday")
        if str(day).upper() == "BREAK" or str(e.get("start_time", "")).upper() == "BREAK":
            continue
        s_idx = e.get("slot_index")
        if s_idx is None:
            s_idx = map_time_to_slot_index(e.get("start_time", "08:30"), int(e.get("slot_id", 0) or 0))
        s_idx = max(0, min(8, int(s_idx)))

        span = int(e.get("span_slots", 0) or 0)
        if span <= 0:
            is_lab = "lab" in str(e.get("course_name", "")).lower()
            span = 3 if is_lab else 1

        for offset in range(span):
            target_slot = s_idx + offset
            if target_slot < 9:
                grid[day][target_slot].append(e)

    day_cells: Dict[str, List[str]] = {}
    merged_day_cells: Dict[str, List[Dict[str, Any]]] = {}

    for day in days:
        raw_row: List[str] = []
        for s_idx in range(9):
            slot_entries = grid[day].get(s_idx, [])
            if not slot_entries:
                if view_type == "canteen" and s_idx in (4, 5):
                    raw_row.append("PEAK LUNCH RUSH\n(350+ Diners)")
                elif view_type == "staff" and s_idx in (4, 5):
                    raw_row.append("Room Sanitization &\nAV Check")
                else:
                    raw_row.append("")
                continue

            if view_type == "teacher":
                cell_txt = "\n".join(
                    f"{i.get('course_name', '')}\n({i.get('faculty_name', '')} - {i.get('venue_name', '')})"
                    for i in slot_entries
                )
            elif view_type == "staff":
                rooms = ", ".join(dict.fromkeys(i.get("venue_name", "") for i in slot_entries))
                cell_txt = f"Active: {rooms}\n({len(slot_entries)} Classes)"
            elif view_type == "canteen":
                cell_txt = f"{len(slot_entries)} Classes Active\n(~{len(slot_entries) * 45} Students)"
            else:
                # Standard University Sheet cell format (Course Title + optional Venue)
                parts = []
                for i in slot_entries:
                    c_name = i.get("course_name", "")
                    v_name = i.get("venue_name", "")
                    if v_name and v_name not in c_name and view_type == "master":
                        parts.append(f"{c_name}")
                    else:
                        parts.append(c_name)
                cell_txt = "\n".join(dict.fromkeys(parts))
            raw_row.append(cell_txt)

        day_cells[day] = raw_row

        # Build merged consecutive spans (e.g., 3-slot Labs or 2-slot lectures)
        spans: List[Dict[str, Any]] = []
        idx = 0
        while idx < 9:
            val = raw_row[idx]
            span_len = 1
            if val:
                while idx + span_len < 9 and raw_row[idx + span_len] == val:
                    span_len += 1
            spans.append(
                {
                    "text": val,
                    "colSpan": span_len,
                    "startSlot": idx,
                }
            )
            idx += span_len
        merged_day_cells[day] = spans

    return {
        "section_title": section_title,
        "slot_headers": [s[1] for s in UNIVERSITY_9_SLOTS],
        "time_headers": [s[2] for s in UNIVERSITY_9_SLOTS],
        "days": days,
        "day_cells": day_cells,
        "merged_day_cells": merged_day_cells,
        "course_legend": build_course_legend_rows(entries),
    }


def build_table_rows(
    entries: List[Dict[str, Any]],
    view_type: str = "master",
    section_title: str = "AI 2024 - Section A",
) -> List[List[str]]:
    """
    Build tabular rows matching the University 9-Slot horizontal sheet layout:
      Row 0 (Header): ["Day/Time", "Slot 1 (0830-9020)", ..., "Slot 9 (1510-1600)"]
      Rows 1..5: ["Monday", cell1..cell9] ... ["Friday", cell1..cell9]
    """
    sheet = build_university_sheet_data(entries, view_type=view_type, section_title=section_title)
    headers = ["Day/Time"] + [
        f"{slot_lbl}\n{time_lbl}"
        for slot_lbl, time_lbl in zip(sheet["slot_headers"], sheet["time_headers"])
    ]
    rows: List[List[str]] = [headers]

    for day in sheet["days"]:
        rows.append([day] + sheet["day_cells"][day])

    # Also include BREAK indicator row for backward compatibility with tabular checks
    if view_type in ("canteen", "staff"):
        break_msg = (
            "PEAK LUNCH RUSH (350+ Diners)"
            if view_type == "canteen"
            else "Midday Maintenance & AV Check Window"
        )
        rows.append(["BREAK (1240-1330)"] + [break_msg] * 9)

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
    section_title = metadata.get("section_title", "AI 2024 - Section A")
    views = {}
    for v_type in ("master", "teacher", "student", "staff", "canteen"):
        sheet = build_university_sheet_data(entries, view_type=v_type, section_title=section_title)
        table_rows = build_table_rows(entries, view_type=v_type, section_title=section_title)
        views[v_type] = {
            "view_type": v_type,
            "section_title": section_title,
            "headers": table_rows[0],
            "rows": table_rows[1:],
            "sheet": sheet,
            "metadata": metadata,
        }
    return views
