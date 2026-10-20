from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models.timetable import ScheduleRun, TimetableEntry
from solver.fairness import calculate_fairness_score, calculate_preference_satisfaction
from utils.exporter import TimetableExporter, ALLOWED_EXPORT_VIEWS

router = APIRouter(prefix="/export", tags=["Export"])


@router.get("/{schedule_id}")
def export_schedule(
    schedule_id: int,
    format: str = Query(
        default="xlsx",
        description="Export format: csv, xlsx, pdf, png, jpg, json, html",
    ),
    view: str = Query(
        default="master",
        description="Audience view: master, teacher, student, staff, canteen",
    ),
    db: Session = Depends(get_db),
):
    view_clean = (view or "master").strip().lower()
    if view_clean not in ALLOWED_EXPORT_VIEWS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid view '{view}'. Allowed views: {list(ALLOWED_EXPORT_VIEWS)}",
        )

    run = (
        db.query(ScheduleRun)
        .options(
            joinedload(ScheduleRun.entries).joinedload(TimetableEntry.course),
            joinedload(ScheduleRun.entries).joinedload(TimetableEntry.faculty),
            joinedload(ScheduleRun.entries).joinedload(TimetableEntry.venue),
            joinedload(ScheduleRun.entries).joinedload(TimetableEntry.slot),
        )
        .filter(ScheduleRun.id == schedule_id)
        .first()
    )

    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Schedule with ID {schedule_id} not found",
        )

    entries = []
    teacher_set = set()
    stored_metrics = run.metrics or {}
    prefs_map = dict(stored_metrics.get("ml_predicted_preferences") or {})
    course_meta_map = dict(stored_metrics.get("course_metadata") or {})

    for e in run.entries:
        f_name = e.faculty.name if e.faculty else f"Faculty {e.faculty_id}"
        teacher_set.add(f_name)
        if e.faculty and e.faculty.preferences and f_name not in prefs_map:
            prefs_map[f_name] = e.faculty.preferences
        c_code = e.course.code if e.course else f"C{e.course_id}"
        c_meta = course_meta_map.get(c_code, {})
        entries.append(
            {
                "id": e.id,
                "course_id": e.course_id,
                "course_name": e.course.name if e.course else f"Course {e.course_id}",
                "course_code": c_code,
                "faculty_id": e.faculty_id,
                "faculty_name": f_name,
                "venue_id": e.venue_id,
                "venue_name": e.venue.name if e.venue else f"Venue {e.venue_id}",
                "slot_id": e.slot_id,
                "day_of_week": e.slot.day_of_week if e.slot else "Monday",
                "start_time": e.slot.start_time if e.slot else "09:00",
                "end_time": e.slot.end_time if e.slot else "10:00",
                "credit_hours": c_meta.get("credit_hours", 3),
                "student_group": c_meta.get("student_group", f"Group-{c_code}"),
            }
        )

    fairness = stored_metrics.get("fairness_score") or calculate_fairness_score(entries)
    pref_sat = stored_metrics.get("preference_satisfaction") or calculate_preference_satisfaction(
        entries, prefs_map
    )
    metadata = {
        "schedule_id": run.id,
        "generated_at": run.generated_at.isoformat() if run.generated_at else None,
        "section_title": stored_metrics.get("section_title", "AI 2024 - Section A"),
        "fairness_score": fairness,
        "preference_satisfaction": pref_sat,
        "total_courses": len(entries),
        "total_teachers": len(teacher_set) or 1,
    }

    try:
        exporter = TimetableExporter(entries=entries, metadata=metadata, view_type=view_clean)
        data_bytes, media_type, filename = exporter.export(format)
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(err))

    return Response(
        content=data_bytes,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.get("/{schedule_id}/calendar.ics")
def export_calendar_ics(
    schedule_id: int,
    view: str = Query(default="master"),
    db: Session = Depends(get_db),
):
    return export_schedule(schedule_id=schedule_id, format="ics", view=view, db=db)


@router.get("/{schedule_id}/calendar/feed")
def get_calendar_feed_links(
    schedule_id: int,
    view: str = Query(default="master"),
):
    ics_path = f"/export/{schedule_id}/calendar.ics?view={view}"
    return {
        "schedule_id": schedule_id,
        "view": view,
        "ics_download_url": ics_path,
        "webcal_url": f"webcal://localhost:8000{ics_path}",
        "google_calendar_url": f"https://calendar.google.com/calendar/render?cid=webcal://localhost:8000{ics_path}",
        "outlook_calendar_url": f"https://outlook.live.com/calendar/0/addcalendar?url=webcal://localhost:8000{ics_path}",
    }
