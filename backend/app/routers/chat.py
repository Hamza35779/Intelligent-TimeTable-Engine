import json
import os
import urllib.request
import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any, Tuple
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

ALLOWED_VIEWS = {"master", "teacher", "student", "staff", "canteen"}
ALLOWED_FORMATS = {"csv", "xlsx", "pdf", "png", "jpg", "jpeg", "json", "html"}

DEFAULT_SEED_CSV = """teacher_name,course_name,credit_hours
Dr. Tariq Mehmood,Artificial Intelligence,3
Dr. Tariq Mehmood,Machine Learning Fundamentals,4
Lec. Faria Sajjad,Computer Vision,3
Lec. Faria Sajjad,Digital Image Processing,2
Dr. Ayesha Siddiqui,Operating Systems,4
Dr. Ayesha Siddiqui,System Programming,2
Lec. Hassan Raza,Natural Language Processing,3
Lec. Hassan Raza,Information Retrieval,2
Dr. Salman Ahmed,Database Systems,4
Dr. Salman Ahmed,Data Warehousing,3
Lec. Zainab Tariq,Software Engineering,3
Lec. Zainab Tariq,Technical & Business Writing,2"""


class StartChatRequest(BaseModel):
    schedule_id: Optional[int] = None


class ChatMessageRequest(BaseModel):
    message: str
    views: Optional[List[str]] = None
    formats: Optional[List[str]] = None


class ChatGenerateRequest(BaseModel):
    views: Optional[List[str]] = None
    formats: Optional[List[str]] = None


VIEW_KEYWORDS = {
    "master": ["master", "university", "overall", "complete", "full", "department"],
    "teacher": ["teacher", "teachers", "faculty", "instructor", "professor", "lecturer"],
    "student": ["student", "students", "cohort", "class", "classes", "undergrad"],
    "staff": ["staff", "support", "admin", "maintenance", "janitor", "facilities", "security"],
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


def validate_views_and_formats(
    views: Optional[List[str]],
    formats: Optional[List[str]],
) -> Tuple[List[str], List[str]]:
    """
    Validate requested views and formats against the strict allowed lists (Step 5).
    Rejects any invalid view or format name with 400 Bad Request.
    """
    clean_views: List[str] = []
    if views:
        for v in views:
            v_norm = str(v).strip().lower()
            if v_norm not in ALLOWED_VIEWS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid view '{v}'. Allowed views: {sorted(ALLOWED_VIEWS)}",
                )
            if v_norm not in clean_views:
                clean_views.append(v_norm)

    clean_formats: List[str] = []
    if formats:
        for fmt in formats:
            f_norm = str(fmt).strip().lower()
            if f_norm not in ALLOWED_FORMATS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid format '{fmt}'. Allowed formats: {sorted(ALLOWED_FORMATS)}",
                )
            if f_norm == "jpeg":
                f_norm = "jpg"
            if f_norm not in clean_formats:
                clean_formats.append(f_norm)

    return clean_views, clean_formats


def _call_gemini_structured_extractor(message: str) -> Optional[Dict[str, Any]]:
    """
    If GEMINI_API_KEY is configured, call Gemini (model read from GEMINI_MODEL env var)
    with a system prompt and JSON schema to extract {views, formats, view_filters}.
    The LLM NEVER generates timetable content; it only extracts structured intent.
    """
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None

    model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip() or "gemini-2.5-flash"
    endpoint = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
        f"?key={api_key}"
    )

    system_prompt = (
        "You are an intent extractor for a university timetable export system. "
        "Do NOT generate any schedule content. Only extract the requested audience views "
        "(allowed: master, teacher, student, staff, canteen), export formats "
        "(allowed: csv, xlsx, pdf, png, jpg, json, html), and optional view_filters "
        "(e.g., preferred_time) as strict JSON."
    )
    payload = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"role": "user", "parts": [{"text": message}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "OBJECT",
                "properties": {
                    "views": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "formats": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "view_filters": {
                        "type": "OBJECT",
                        "properties": {
                            "preferred_time": {"type": "STRING"},
                        },
                    },
                },
                "required": ["views", "formats"],
            },
        },
    }

    try:
        req = urllib.request.Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=3.5) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            text_part = (
                body.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "")
            )
            parsed = json.loads(text_part)
            return {
                "views": [
                    str(v).lower()
                    for v in (parsed.get("views") or [])
                    if str(v).lower() in ALLOWED_VIEWS
                ],
                "formats": [
                    str(f).lower()
                    for f in (parsed.get("formats") or [])
                    if str(f).lower() in ALLOWED_FORMATS
                ],
                "view_filters": parsed.get("view_filters") or {},
            }
    except Exception:
        return None


import re

UNSUPPORTED_VIEW_ROLES = {
    "dean", "rector", "chancellor", "parent", "parents", "visitor", "visitors",
    "alumni", "driver", "drivers", "library", "librarian", "hostel", "warden",
}
UNSUPPORTED_FORMAT_NAMES = {
    "docx", "doc", "pptx", "ppt", "xml", "yaml", "yml", "txt", "markdown", "md", "rtf",
}


def _check_unrecognized_view_or_format_in_text(text: str):
    lower = text.lower()
    words = set(re.findall(r"[a-z0-9]+", lower))
    bad_views = words & UNSUPPORTED_VIEW_ROLES
    if bad_views:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": f"Unsupported audience view requested: {sorted(bad_views)}. Allowed views: {sorted(ALLOWED_VIEWS)}",
                "mode": "keyword_fallback",
            },
        )
    bad_formats = words & UNSUPPORTED_FORMAT_NAMES
    if bad_formats:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": f"Unsupported export format requested: {sorted(bad_formats)}. Allowed formats: {sorted(ALLOWED_FORMATS)}",
                "mode": "keyword_fallback",
            },
        )


def _detect_intent_keyword_fallback(
    text: str,
    existing_views: List[str],
    existing_formats: List[str],
) -> Tuple[List[str], List[str], Dict[str, Any]]:
    _check_unrecognized_view_or_format_in_text(text)
    lower = text.lower()
    views = list(existing_views)
    formats = list(existing_formats)

    if any(w in lower for w in ["all views", "all 5", "all schedules", "every view", "everything"]):
        views = ["master", "teacher", "student", "staff", "canteen"]
    elif "yes" in lower and views:
        for v in ("master", "canteen", "staff"):
            if v not in views:
                views.append(v)

    for view_key, kw_list in VIEW_KEYWORDS.items():
        if any(kw in lower for kw in kw_list) and view_key not in views:
            views.append(view_key)

    for fmt_key, kw_list in FORMAT_KEYWORDS.items():
        if any(kw in lower for kw in kw_list) and fmt_key not in formats:
            formats.append(fmt_key)

    view_filters: Dict[str, Any] = {}
    if "morning" in lower:
        view_filters["preferred_time"] = "Morning"
    elif "afternoon" in lower:
        view_filters["preferred_time"] = "Afternoon"
    elif "evening" in lower:
        view_filters["preferred_time"] = "Evening"

    return views, formats, view_filters


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

    gemini_ready = bool(os.getenv("GEMINI_API_KEY", "").strip())
    mode = "gemini" if gemini_ready else "keyword_fallback"

    initial_msg = {
        "id": 1,
        "sender": "bot",
        "text": (
            "Hi! Tell me which schedule views you need "
            "(master, teacher, student, staff, canteen) and your export formats "
            "(PDF, XLSX, PNG, CSV, JPG, JSON, HTML)."
        ),
        "mode": mode,
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
        "mode": mode,
    }


@router.post("/message")
def send_stateless_chat_message(
    payload: ChatMessageRequest,
    db: Session = Depends(get_db),
):
    started = start_chat(StartChatRequest(schedule_id=None), db=db)
    return send_chat_message(
        conversation_id=started["conversation_id"],
        payload=payload,
        db=db,
    )


@router.post("/generate-schedules")
def generate_stateless_from_chat(
    payload: ChatGenerateRequest,
    db: Session = Depends(get_db),
):
    started = start_chat(StartChatRequest(schedule_id=None), db=db)
    return generate_multi_view_from_chat(
        conversation_id=started["conversation_id"],
        payload=payload,
        db=db,
    )


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

    # Validate any explicitly passed views/formats and free-text unrecognized view/format tokens
    explicit_views, explicit_formats = validate_views_and_formats(payload.views, payload.formats)
    _check_unrecognized_view_or_format_in_text(payload.message)

    # Try Gemini structured extractor first if GEMINI_API_KEY is set
    gemini_result = _call_gemini_structured_extractor(payload.message)
    if gemini_result is not None:
        mode = "gemini"
        views = list(dict.fromkeys((session.detected_views or []) + explicit_views + gemini_result["views"]))
        formats = list(
            dict.fromkeys((session.detected_formats or []) + explicit_formats + gemini_result["formats"])
        )
        view_filters = gemini_result.get("view_filters") or {}
    else:
        mode = "keyword_fallback"
        views, formats, view_filters = _detect_intent_keyword_fallback(
            payload.message,
            list(dict.fromkeys((session.detected_views or []) + explicit_views)),
            list(dict.fromkeys((session.detected_formats or []) + explicit_formats)),
        )

    prefs = dict(session.preferences or {})
    prefs.update(view_filters)

    session.detected_views = views
    session.detected_formats = formats
    session.preferences = prefs

    # Step 5: Ask clarifying questions when request is ambiguous (e.g., "make schedules" with no views named)
    if not views:
        reply = (
            "Your request is ambiguous — which audience views would you like me to prepare? "
            "Please specify one or more of: Master, Teacher, Student, Support Staff, or Canteen Staff "
            "(and your preferred export format such as PDF, Excel/XLSX, CSV, or PNG)."
        )
        chat_status = "clarification_needed"
    elif views and not formats:
        view_names = ", ".join(v.capitalize() for v in views)
        reply = (
            f"I've selected the {view_names} view(s). "
            f"Which export format(s) would you like (PDF, XLSX, CSV, PNG, JPG, JSON, HTML)? "
            f"Or click generate below to use the default formats (PDF, XLSX, PNG)."
        )
        chat_status = "ready_to_generate"
    else:
        view_bullets = "\n".join(f"• {v.capitalize()} View" for v in views)
        fmt_list = ", ".join(f.upper() for f in formats)
        reply = (
            f"Ready to export {len(views)} view(s) in {fmt_list} (mode: {mode}):\n"
            f"{view_bullets}\n\nClick 'Generate All Schedules Simultaneously' below."
        )
        chat_status = "ready_to_generate"

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
            "mode": mode,
        }
    )
    session.messages = history
    session.status = chat_status
    db.commit()

    return {
        "conversation_id": conversation_id,
        "reply": reply,
        "bot_response": reply,
        "mode": mode,
        "detected_views": views,
        "detected_formats": formats,
        "view_filters": prefs,
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

    # Validate requested views and formats against allowed list; reject anything outside it
    validated_views, validated_formats = validate_views_and_formats(payload.views, payload.formats)

    views = validated_views or session.detected_views or ["master", "teacher", "student", "staff", "canteen"]
    formats = validated_formats or session.detected_formats or ["pdf", "xlsx", "png", "csv"]

    # Re-validate merged lists
    views, formats = validate_views_and_formats(views, formats)

    schedule_id = session.schedule_id
    existing_run = (
        db.query(ScheduleRun)
        .filter(ScheduleRun.id == schedule_id, ScheduleRun.status == "completed")
        .first()
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
            parsed = parse_schedule_csv(DEFAULT_SEED_CSV)
            chat_pref_time = (session.preferences or {}).get("preferred_time")
            if chat_pref_time:
                for fac in parsed["faculty"]:
                    fac["preferences"]["prefer_morning"] = chat_pref_time.lower() == "morning"
                    fac["preferences"]["preferred_time"] = chat_pref_time
            gen_res = generate_schedule(payload=GenerateScheduleRequest(**parsed), db=db)
            schedule_id = gen_res.schedule_id

    session.schedule_id = schedule_id
    view_urls: Dict[str, Dict[str, str]] = {}
    for v in views:
        view_urls[v] = {}
        for fmt in formats:
            view_urls[v][fmt] = f"/export/{schedule_id}?format={fmt}&view={v}"

    session.status = "completed"
    db.commit()

    gemini_ready = bool(os.getenv("GEMINI_API_KEY", "").strip())
    mode = "gemini" if gemini_ready else "keyword_fallback"

    return {
        "conversation_id": conversation_id,
        "schedule_id": schedule_id,
        "mode": mode,
        "schedules_generated": len(views),
        "formats_generated": formats,
        "views": view_urls,
    }
