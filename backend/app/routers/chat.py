import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.feedback import ChatSession
from app.models.timetable import ScheduleRun
from app.schemas.timetable import GenerateScheduleRequest
from app.routers.schedule import generate_schedule
from utils.csv_parser import parse_schedule_csv

router = APIRouter(prefix="/chat", tags=["AI Conversational Assistant"])

DEFAULT_SEED_CSV = """teacher,course,code,hours,preferred_time,department,capacity
Ahmad Ali,Data Structures & Algorithms,CS301,3,Morning,Computer Science,60
Fatima Khan,Database Management Systems,CS302,4,Afternoon,Computer Science,50
Hassan Raza,Operating Systems,SE205,3,Morning,Software Engineering,45
Dr. Alan Turing,Theory of Computation,CS401,3,Morning,Computer Science,75
Dr. Ada Lovelace,Compiler Construction,CS405,3,Afternoon,Computer Science,40
Dr. Claude Shannon,Information Theory,IT202,3,Morning,Information Theory,55"""


class StartChatRequest(BaseModel):
    schedule_id: Optional[int] = None


class ChatMessageRequest(BaseModel):
    message: str


class ChatGenerateRequest(BaseModel):
    views: Optional[List[str]] = None
    formats: Optional[List[str]] = None


VIEW_KEYWORDS = {
    "master": ["master", "university", "overall", "all", "complete", "full", "department"],
    "teacher": ["teacher", "teachers", "faculty", "instructor", "professor", "lecturer"],
    "student": ["student", "students", "cohort", "class", "classes", "undergrad"],
    "staff": ["staff", "support", "admin", "maintenance", "janitor", "facilities"],
    "canteen": ["canteen", "cafeteria", "lunch", "dining", "food", "kitchen"],
}

FORMAT_KEYWORDS = {
    "pdf": ["pdf", "document", "print"],
    "xlsx": ["xlsx", "excel", "workbook", "spreadsheet", "sheet"],
    "csv": ["csv"],
    "png": ["png", "image", "picture", "photo"],
    "jpg": ["jpg", "jpeg"],
    "json": ["json", "api", "data"],
    "html": ["html", "web"],
}


def _detect_intent(text: str, existing_views: List[str], existing_formats: List[str]):
    lower = text.lower()
    views = list(existing_views)
    formats = list(existing_formats)

    if any(w in lower for w in ["all", "everything", "every", "both", "yes"]):
        if not views:
            views = ["master", "teacher", "student", "staff", "canteen"]
        elif "yes" in lower or "both" in lower:
            for v in ("master", "canteen", "staff"):
                if v not in views:
                    views.append(v)

    for view_key, kw_list in VIEW_KEYWORDS.items():
        if any(kw in lower for kw in kw_list) and view_key not in views:
            views.append(view_key)

    for fmt_key, kw_list in FORMAT_KEYWORDS.items():
        if any(kw in lower for kw in kw_list) and fmt_key not in formats:
            formats.append(fmt_key)

    time_pref = None
    if "morning" in lower:
        time_pref = "Morning"
    elif "afternoon" in lower:
        time_pref = "Afternoon"
    elif "evening" in lower:
        time_pref = "Evening"

    return views, formats, time_pref


@router.post("/start")
def start_chat(payload: StartChatRequest, db: Session = Depends(get_db)):
    conv_id = f"conv_{uuid.uuid4().hex[:10]}"
    schedule_id = payload.schedule_id

    if not schedule_id:
        latest_run = (
            db.query(ScheduleRun)
            .filter(ScheduleRun.status == "completed")
            .order_by(ScheduleRun.id.desc())
            .first()
        )
        if latest_run:
            schedule_id = latest_run.id

    initial_msg = {
        "id": 1,
        "sender": "bot",
        "text": (
            "Hi! I'm your AI Scheduling Assistant. Tell me which schedules you need "
            "(e.g., Teacher schedules, Student schedules, Support Staff, or Canteen Staff) "
            "and your preferred export formats (PDF, Excel, PNG, CSV)."
        ),
    }

    session = ChatSession(
        id=conv_id,
        schedule_id=schedule_id,
        detected_views=[],
        detected_formats=[],
        preferences={},
        messages=[initial_msg],
        status="active",
        created_at=datetime.now(timezone.utc),
    )
    db.add(session)
    db.commit()

    return {
        "conversation_id": conv_id,
        "schedule_id": schedule_id,
        "message": initial_msg["text"],
    }


@router.post("/{conversation_id}/message")
def send_chat_message(
    conversation_id: str,
    payload: ChatMessageRequest,
    db: Session = Depends(get_db),
):
    session = db.query(ChatSession).filter(ChatSession.id == conversation_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation '{conversation_id}' not found",
        )

    views, formats, time_pref = _detect_intent(
        payload.message,
        session.detected_views or [],
        session.detected_formats or [],
    )

    prefs = dict(session.preferences or {})
    if time_pref:
        prefs["preferred_time"] = time_pref

    if not views and (
        formats or "generate" in payload.message.lower() or "schedule" in payload.message.lower()
    ):
        views = ["master", "teacher", "student", "staff", "canteen"]

    if not formats and len(views) > 0 and any(
        w in payload.message.lower() for w in ["generate", "yes", "ready", "ok", "all"]
    ):
        formats = ["pdf", "xlsx", "png"]

    session.detected_views = views
    session.detected_formats = formats
    session.preferences = prefs

    if views and not formats:
        view_names = ", ".join(v.capitalize() for v in views)
        reply = (
            f"Great! I've queued the {view_names} view(s). "
            f"Which export formats would you like (PDF, Excel/XLSX, PNG, CSV)? "
            f"And should I also include the Canteen & Support Staff schedules for lunch coordination?"
        )
        chat_status = "ready_to_generate"
    elif views and formats:
        view_bullets = "\n".join(f"• {v.capitalize()} Schedule" for v in views)
        fmt_list = ", ".join(f.upper() for f in formats)
        reply = (
            f"Excellent! I'm ready to generate {len(views)} customized schedule perspectives in {fmt_list}:\n"
            f"{view_bullets}\n\nClick 'Generate All Schedules Simultaneously' below to build and download all views."
        )
        chat_status = "ready_to_generate"
    else:
        reply = (
            "I can generate customized views for Master University, Teachers, Students, Support Staff, "
            "and Canteen Staff. Should we prioritize Morning or Afternoon slots, and which views do you need?"
        )
        chat_status = "collecting_info"

    history = list(session.messages or [])
    history.append({"id": len(history) + 1, "sender": "user", "text": payload.message})
    history.append(
        {
            "id": len(history) + 1,
            "sender": "bot",
            "text": reply,
            "detected_views": views,
            "detected_formats": formats,
            "status": chat_status,
        }
    )
    session.messages = history
    session.status = chat_status
    db.commit()

    return {
        "conversation_id": conversation_id,
        "reply": reply,
        "detected_views": views,
        "detected_formats": formats or ["pdf", "xlsx", "png"],
        "preferences": prefs,
        "status": chat_status,
    }


@router.post("/{conversation_id}/generate")
def generate_multi_view_from_chat(
    conversation_id: str,
    payload: ChatGenerateRequest,
    db: Session = Depends(get_db),
):
    session = db.query(ChatSession).filter(ChatSession.id == conversation_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation '{conversation_id}' not found",
        )

    schedule_id = session.schedule_id
    existing_run = (
        db.query(ScheduleRun).filter(ScheduleRun.id == schedule_id, ScheduleRun.status == "completed").first()
        if schedule_id
        else None
    )

    if not existing_run:
        latest = (
            db.query(ScheduleRun)
            .filter(ScheduleRun.status == "completed")
            .order_by(ScheduleRun.id.desc())
            .first()
        )
        if latest:
            existing_run = latest
            schedule_id = latest.id
        else:
            # Automatically solve and persist a real schedule so download links always resolve
            parsed = parse_schedule_csv(DEFAULT_SEED_CSV)
            chat_pref_time = (session.preferences or {}).get("preferred_time")
            if chat_pref_time:
                for fac in parsed["faculty"]:
                    fac["preferences"]["prefer_morning"] = chat_pref_time.lower() == "morning"
                    fac["preferences"]["preferred_time"] = chat_pref_time
            gen_res = generate_schedule(payload=GenerateScheduleRequest(**parsed), db=db)
            schedule_id = gen_res.schedule_id

    session.schedule_id = schedule_id
    views = payload.views or session.detected_views or ["master", "teacher", "student", "staff", "canteen"]
    formats = payload.formats or session.detected_formats or ["pdf", "xlsx", "png", "csv"]

    view_urls: Dict[str, Dict[str, str]] = {}
    for v in views:
        view_urls[v] = {}
        for fmt in formats:
            view_urls[v][fmt] = f"/export/{schedule_id}?format={fmt}&view={v}"

    session.status = "completed"
    db.commit()

    return {
        "conversation_id": conversation_id,
        "schedule_id": schedule_id,
        "schedules_generated": len(views),
        "formats_generated": formats,
        "views": view_urls,
    }
