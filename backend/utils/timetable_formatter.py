from collections import defaultdict
from datetime import datetime, timezone
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

STANDARD_HOURLY_SLOTS: List[Tuple[str, str]] = [
    ("09:00", "09:00 - 10:00"),
    ("10:00", "10:00 - 11:00"),
    ("11:00", "11:00 - 12:00"),
    ("LUNCH", "12:00 - 14:00 (LUNCH BREAK)"),
    ("14:00", "14:00 - 15:00"),
    ("15:00", "15:00 - 16:00"),
    ("16:00", "16:00 - 17:00"),
]

VIEW_TITLES = {
    "master": "Master University Timetable",
    "teacher": "Teacher Schedule View (Per-Teacher Sessions, Total Hours & Days Taught)",
    "student": "Student Group Schedule View (With Explicit Break Rows)",
    "staff": "Support, Maintenance & Security Staff View (Hourly Active Rooms & Load)",
    "canteen": "Canteen & Dining Demand View (Hourly Estimated Diners & Rush Windows)",
}

VALID_VIEWS = set(VIEW_TITLES.keys())

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
    grouped: Dict[str, Dict[str, Any]] = {}
    for e in entries:
        code = str(e.get("course_code") or "CS100").strip()
        title = str(e.get("course_name") or "Course").strip()
        key = f"{code}::{title}"
        venue = str(e.get("venue_name") or "Room 1").strip()
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
                "elective_compulsory": e.get("elective_compulsory", "Compulsory"),
                "venues": [venue] if venue else [],
                "remarks": remarks,
                "count": 1,
            }
        else:
            grouped[key]["count"] += 1
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
    days = list(BASE_DAYS)
    for e in entries:
        d = e.get("day_of_week")
        if d and d not in days and str(d).upper() != "BREAK":
            days.append(d)

    grid: Dict[str, Dict[int, List[Dict[str, Any]]]] = {
        d: defaultdict(list) for d in days
    }

    for e in entries:
        day = e.get("day_of_week", "Monday")
        if str(day).upper() == "BREAK" or str(e.get("start_time", "")).upper() == "BREAK":
            continue
        s_idx = e.get("slot_index")
        if s_idx is None:
            s_idx = map_time_to_slot_index(
                e.get("start_time", "08:30"), int(e.get("slot_id", 0) or 0)
            )
        s_idx = max(0, min(8, int(s_idx)))
        grid[day][s_idx].append(e)

    day_cells: Dict[str, List[str]] = {}
    merged_day_cells: Dict[str, List[Dict[str, Any]]] = {}

    for day in days:
        raw_row: List[str] = []
        for s_idx in range(9):
            slot_entries = grid[day].get(s_idx, [])
            if not slot_entries:
                if view_type == "canteen" and s_idx in (4, 5):
                    raw_row.append("PEAK LUNCH RUSH\n(Est. 240+ Diners)")
                elif view_type == "staff" and s_idx in (4, 5):
                    raw_row.append("0 Active Rooms\n[Quiet - Lunch Window]")
                else:
                    raw_row.append("")
                continue

            if view_type == "teacher":
                cell_txt = "\n".join(
                    f"{i.get('faculty_name', '')}\n{i.get('course_name', '')} ({i.get('venue_name', '')})"
                    for i in slot_entries
                )
            elif view_type == "student":
                cell_txt = "\n".join(
                    f"{i.get('course_code', '')}: {i.get('course_name', '')}\n{i.get('venue_name', '')} ({i.get('faculty_name', '')})"
                    for i in slot_entries
                )
            elif view_type == "staff":
                rooms = list(dict.fromkeys(i.get("venue_name", "") for i in slot_entries))
                n_r = len(rooms)
                label = "Busy" if n_r >= 3 else ("Moderate" if n_r >= 1 else "Quiet")
                cell_txt = f"{n_r} Active Room(s) [{label}]\n" + ", ".join(rooms)
            elif view_type == "canteen":
                est_students = len(slot_entries) * 40
                cell_txt = f"Est. {est_students} Students in Class\n({len(slot_entries)} Groups Active - Estimate)"
            else:
                parts = []
                for i in slot_entries:
                    c_name = i.get("course_name", "")
                    t_name = i.get("faculty_name", "")
                    v_name = i.get("venue_name", "")
                    parts.append(f"{c_name}\n{t_name} | {v_name}")
                cell_txt = "\n---\n".join(dict.fromkeys(parts))
            raw_row.append(cell_txt)

        day_cells[day] = raw_row

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
                    "startSlot": idx + 1,
                }
            )
            idx += span_len
        merged_day_cells[day] = spans

    return {
        "section_title": section_title,
        "slot_headers": [""] + [s[1] for s in UNIVERSITY_9_SLOTS],
        "time_headers": ["Day/Time"] + [s[2] for s in UNIVERSITY_9_SLOTS],
        "days": days,
        "day_cells": day_cells,
        "merged_day_cells": merged_day_cells,
        "course_legend": build_course_legend_rows(entries),
    }


def _build_master_grid_rows(entries: List[Dict[str, Any]], days: List[str]) -> List[List[str]]:
    """
    Step 3 Master view:
    Full grid, rows = time slots, columns = days, cells = course, teacher, room.
    """
    headers = ["Time Slot"] + days
    rows: List[List[str]] = [headers]

    # Collect all distinct start times and merge with standard hourly slots
    slot_map: Dict[Tuple[str, str], List[Dict[str, Any]]] = defaultdict(list)
    extra_hours = set()
    std_keys = {k for k, _ in STANDARD_HOURLY_SLOTS if k != "LUNCH"}

    for e in entries:
        d = str(e.get("day_of_week", "Monday"))
        st = str(e.get("start_time", "09:00"))
        hour_key = f"{st.split(':')[0].zfill(2)}:00" if ":" in st else "09:00"
        if hour_key not in std_keys:
            extra_hours.add(hour_key)
        slot_map[(d, hour_key)].append(e)

    ordered_slots = (
        [(h, f"{h} - {int(h[:2])+1:02d}:00") for h in sorted(extra_hours) if h < "09:00"]
        + STANDARD_HOURLY_SLOTS
        + [(h, f"{h} - {int(h[:2])+1:02d}:00") for h in sorted(extra_hours) if h > "16:00"]
    )

    for slot_key, slot_label in ordered_slots:
        if slot_key == "LUNCH":
            rows.append([slot_label] + ["LUNCH BREAK (No Classes)"] * len(days))
            continue
        row = [slot_label]
        for d in days:
            cell_items = slot_map.get((d, slot_key), [])
            if not cell_items:
                row.append("")
            else:
                cell_str = "\n---\n".join(
                    f"{i.get('course_name', '')} ({i.get('course_code', '')})\n"
                    f"Teacher: {i.get('faculty_name', '')}\n"
                    f"Room: {i.get('venue_name', '')}"
                    for i in cell_items
                )
                row.append(cell_str)
        rows.append(row)
    return rows


def build_teacher_tables(entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Step 3 Teacher view:
    One table per teacher showing their own sessions, total hours, and days taught.
    """
    by_teacher: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for e in entries:
        t_name = str(e.get("faculty_name") or f"Teacher {e.get('faculty_id', 1)}")
        by_teacher[t_name].append(e)

    teacher_tables: List[Dict[str, Any]] = []
    for t_name in sorted(by_teacher.keys()):
        t_entries = sorted(
            by_teacher[t_name],
            key=lambda x: (
                BASE_DAYS.index(x.get("day_of_week", "Monday"))
                if x.get("day_of_week") in BASE_DAYS
                else 99,
                str(x.get("start_time", "09:00")),
            ),
        )
        days_taught = sorted(
            {str(x.get("day_of_week", "Monday")) for x in t_entries},
            key=lambda d: BASE_DAYS.index(d) if d in BASE_DAYS else 99,
        )
        total_hours = len(t_entries)
        session_rows = [
            [
                str(x.get("day_of_week", "")),
                f"{x.get('start_time', '')} - {x.get('end_time', '')}",
                f"{x.get('course_name', '')} ({x.get('course_code', '')})",
                str(x.get("venue_name", "")),
                str(x.get("student_group") or f"Group-{x.get('course_code', '')}"),
            ]
            for x in t_entries
        ]
        teacher_tables.append(
            {
                "teacher_name": t_name,
                "total_hours": total_hours,
                "days_taught": days_taught,
                "days_taught_count": len(days_taught),
                "headers": ["Day", "Time", "Course", "Room", "Student Group"],
                "rows": session_rows,
            }
        )
    return teacher_tables


def build_student_group_tables(entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Step 3 Student view:
    One table per student group showing their classes, times, rooms, and teachers,
    plus breaks shown as explicit rows.
    """
    by_group: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for e in entries:
        grp = str(e.get("student_group") or f"Group-{e.get('course_code', e.get('course_name', '1'))}")
        by_group[grp].append(e)

    group_tables: List[Dict[str, Any]] = []
    for grp in sorted(by_group.keys()):
        g_entries = sorted(
            by_group[grp],
            key=lambda x: (
                BASE_DAYS.index(x.get("day_of_week", "Monday"))
                if x.get("day_of_week") in BASE_DAYS
                else 99,
                str(x.get("start_time", "09:00")),
            ),
        )
        rows = []
        consecutive_count = 0
        last_day = None
        lunch_inserted_for_day = set()

        for x in g_entries:
            day = str(x.get("day_of_week", "Monday"))
            st = str(x.get("start_time", "09:00"))
            if day != last_day:
                consecutive_count = 0
                last_day = day

            if st >= "14:00" and day not in lunch_inserted_for_day:
                rows.append([day, "12:00 - 14:00", "LUNCH BREAK (Explicit Break Row)", "—", "—"])
                lunch_inserted_for_day.add(day)
                consecutive_count = 0

            rows.append(
                [
                    day,
                    f"{st} - {x.get('end_time', '')}",
                    f"{x.get('course_name', '')} ({x.get('course_code', '')})",
                    str(x.get("venue_name", "")),
                    str(x.get("faculty_name", "")),
                ]
            )
            consecutive_count += 1
            if consecutive_count == 2:
                rows.append(
                    [
                        day,
                        f"After {x.get('end_time', '11:00')} (15 min)",
                        "MANDATORY 15-MIN BREAK (After 2 Consecutive Hours)",
                        "—",
                        "—",
                    ]
                )
                consecutive_count = 0

        if not lunch_inserted_for_day:
            rows.append(["Monday–Friday", "12:00 - 14:00", "LUNCH BREAK (Explicit Break Row)", "—", "—"])

        group_tables.append(
            {
                "student_group": grp,
                "total_weekly_hours": len(g_entries),
                "headers": ["Day", "Time", "Course / Break", "Room", "Teacher"],
                "rows": rows,
            }
        )
    return group_tables


def build_staff_hourly_rows(entries: List[Dict[str, Any]]) -> List[List[str]]:
    """
    Step 3 Staff view (support/maintenance/security):
    Per hour, number of rooms active and a busy / moderate / quiet label.
    """
    headers = ["Day", "Hour Window", "Active Rooms Count", "Activity Level", "Rooms Active"]
    rows: List[List[str]] = [headers]

    by_day_hour: Dict[Tuple[str, str], List[Dict[str, Any]]] = defaultdict(list)
    days = list(BASE_DAYS)
    for e in entries:
        d = str(e.get("day_of_week", "Monday"))
        if d not in days:
            days.append(d)
        st = str(e.get("start_time", "09:00"))
        h_key = f"{st.split(':')[0].zfill(2)}:00" if ":" in st else "09:00"
        by_day_hour[(d, h_key)].append(e)

    for d in days:
        for slot_key, slot_label in STANDARD_HOURLY_SLOTS:
            if slot_key == "LUNCH":
                rows.append(
                    [
                        d,
                        "12:00 - 14:00",
                        "0",
                        "Quiet (Lunch / Room Maintenance Window)",
                        "None (All rooms open for cleaning/AV check)",
                    ]
                )
                continue
            active = by_day_hour.get((d, slot_key), [])
            rooms = sorted({str(x.get("venue_name", "")) for x in active if x.get("venue_name")})
            n_rooms = len(rooms)
            if n_rooms >= 3:
                level = "Busy"
            elif n_rooms >= 1:
                level = "Moderate"
            else:
                level = "Quiet"
            rows.append(
                [
                    d,
                    slot_label,
                    str(n_rooms),
                    level,
                    ", ".join(rooms) if rooms else "None",
                ]
            )
    return rows


def build_canteen_hourly_rows(entries: List[Dict[str, Any]]) -> List[List[str]]:
    """
    Step 3 Canteen view:
    Per hour, expected diners = sum of students in groups with a class in that hour
    (estimated, labeled as an estimate), plus the rush windows.
    """
    headers = [
        "Day",
        "Hour Window",
        "Classes in Session",
        "Expected Diners (Estimate)",
        "Demand Window Status",
    ]
    rows: List[List[str]] = [headers]

    by_day_hour: Dict[Tuple[str, str], List[Dict[str, Any]]] = defaultdict(list)
    days = list(BASE_DAYS)
    for e in entries:
        d = str(e.get("day_of_week", "Monday"))
        if d not in days:
            days.append(d)
        st = str(e.get("start_time", "09:00"))
        h_key = f"{st.split(':')[0].zfill(2)}:00" if ":" in st else "09:00"
        by_day_hour[(d, h_key)].append(e)

    for d in days:
        # Count total students active on this day to estimate lunch rush
        day_groups = {
            str(e.get("student_group") or e.get("course_code"))
            for (ed, _), elist in by_day_hour.items()
            if ed == d
            for e in elist
        }
        est_day_students = max(40, len(day_groups) * 35)

        for slot_key, slot_label in STANDARD_HOURLY_SLOTS:
            if slot_key == "LUNCH":
                rows.append(
                    [
                        d,
                        "12:00 - 14:00 (LUNCH BREAK)",
                        "0 (Protected Lunch Window)",
                        f"~{est_day_students} diners (Estimate)",
                        "PEAK RUSH WINDOW — All Counters Open",
                    ]
                )
                continue
            active = by_day_hour.get((d, slot_key), [])
            # Estimate students in class (35 students per group) and ~30% pre/post class canteen visitors
            in_class_students = len(active) * 35
            est_diners = int(round(in_class_students * 0.35)) if in_class_students > 0 else 15
            rush_status = (
                "Pre-Lunch Prep Rush"
                if slot_key == "11:00"
                else ("Moderate Beverage/Snack Demand" if active else "Low / Quiet Window")
            )
            rows.append(
                [
                    d,
                    slot_label,
                    f"{len(active)} group(s) ({in_class_students} students in class, Estimate)",
                    f"~{est_diners} diners (Estimate)",
                    rush_status,
                ]
            )
    return rows


def build_table_rows(
    entries: List[Dict[str, Any]],
    view_type: str = "master",
    section_title: str = "AI 2024 - Section A",
) -> List[List[str]]:
    """
    Pure function of the solved timetable producing tabular rows for the requested view:
      - master: rows = time slots, columns = days, cells = course, teacher, room
      - teacher: per-teacher sessions, total hours, and days taught
      - student: per-student-group classes, times, rooms, teachers, and explicit break rows
      - staff: per-hour active room count and Busy / Moderate / Quiet label
      - canteen: per-hour expected diners (labeled as Estimate) and rush windows
    """
    v = (view_type or "master").strip().lower()
    days = list(BASE_DAYS)
    for e in entries:
        d = e.get("day_of_week")
        if d and d not in days and str(d).upper() != "BREAK":
            days.append(d)

    if v == "teacher":
        t_tables = build_teacher_tables(entries)
        rows: List[List[str]] = [
            ["Teacher", "Total Weekly Hours", "Days Taught", "Day", "Time", "Course", "Room"]
        ]
        for tbl in t_tables:
            t_name = tbl["teacher_name"]
            tot_h = f"{tbl['total_hours']}h"
            days_str = ", ".join(tbl["days_taught"])
            for r in tbl["rows"]:
                rows.append([t_name, tot_h, days_str, r[0], r[1], r[2], r[3]])
        return rows

    if v == "student":
        g_tables = build_student_group_tables(entries)
        rows = [["Student Group", "Day", "Time", "Course / Break", "Room", "Teacher"]]
        for tbl in g_tables:
            grp = tbl["student_group"]
            for r in tbl["rows"]:
                rows.append([grp, r[0], r[1], r[2], r[3], r[4]])
        return rows

    if v == "staff":
        return build_staff_hourly_rows(entries)

    if v == "canteen":
        return build_canteen_hourly_rows(entries)

    return _build_master_grid_rows(entries, days)


def generate_multi_views(
    entries: List[Dict[str, Any]],
    metadata: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Step 3: All 5 views driven from ONE solved timetable as pure functions.
    Each view includes title, generated_at timestamp, and schedule_id.
    """
    meta = dict(metadata or {})
    schedule_id = meta.get("schedule_id", 1)
    generated_at = meta.get("generated_at") or datetime.now(timezone.utc).isoformat()
    section_title = meta.get("section_title", "AI 2024 - Section A")

    teacher_tables = build_teacher_tables(entries)
    student_tables = build_student_group_tables(entries)

    views = {}
    for v_type in ("master", "teacher", "student", "staff", "canteen"):
        sheet = build_university_sheet_data(entries, view_type=v_type, section_title=section_title)
        table_rows = build_table_rows(entries, view_type=v_type, section_title=section_title)
        view_obj: Dict[str, Any] = {
            "view_type": v_type,
            "title": VIEW_TITLES.get(v_type, "Timetable View"),
            "schedule_id": schedule_id,
            "generated_at": generated_at,
            "section_title": section_title,
            "headers": table_rows[0] if table_rows else [],
            "rows": table_rows[1:] if len(table_rows) > 1 else [],
            "sheet": sheet,
            "metadata": meta,
        }
        if v_type == "teacher":
            view_obj["teacher_tables"] = teacher_tables
        elif v_type == "student":
            view_obj["student_group_tables"] = student_tables
        views[v_type] = view_obj

    return views
