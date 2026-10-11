from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session, joinedload
from app.database import get_db
from app.models.timetable import ScheduleRun, TimetableEntry
from solver.fairness import calculate_fairness_score, calculate_preference_satisfaction
from utils.exporter import TimetableExporter

router = APIRouter(prefix="/export", tags=["Export"])


@router.get("/{schedule_id}")
def export_schedule(
    schedule_id: int,
    format: str = Query(default="xlsx", description="Export format: csv, xlsx, pdf, png, jpg, json, html"),
    view: str = Query(default="master", description="Audience view: master, teacher, student, staff, canteen"),
    db: Session = Depends(get_db),
):
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
    prefs_map = dict((run.metrics or {}).get("ml_predicted_preferences") or {})
    for e in run.entries:
        f_name = e.faculty.name if e.faculty else f"Faculty {e.faculty_id}"
        teacher_set.add(f_name)
        if e.faculty and e.faculty.preferences and f_name not in prefs_map:
            prefs_map[f_name] = e.faculty.preferences
        entries.append(
            {
                "id": e.id,
                "course_id": e.course_id,
                "course_name": e.course.name if e.course else f"Course {e.course_id}",
                "course_code": e.course.code if e.course else f"C{e.course_id}",
                "faculty_id": e.faculty_id,
                "faculty_name": f_name,
                "venue_id": e.venue_id,
                "venue_name": e.venue.name if e.venue else f"Venue {e.venue_id}",
                "slot_id": e.slot_id,
                "day_of_week": e.slot.day_of_week if e.slot else "Monday",
                "start_time": e.slot.start_time if e.slot else "09:00",
                "end_time": e.slot.end_time if e.slot else "10:00",
            }
        )

    stored_metrics = run.metrics or {}
    fairness = stored_metrics.get("fairness_score") or calculate_fairness_score(entries)
    pref_sat = stored_metrics.get("preference_satisfaction") or calculate_preference_satisfaction(
        entries, prefs_map
    )
    metadata = {
        "schedule_id": run.id,
        "fairness_score": fairness,
        "preference_satisfaction": pref_sat,
        "total_courses": len(entries),
        "total_teachers": len(teacher_set) or 1,
    }

    try:
        exporter = TimetableExporter(entries=entries, metadata=metadata, view_type=view.lower())
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
