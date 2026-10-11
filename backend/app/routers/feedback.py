from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, BackgroundTasks, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.feedback import Feedback
from tasks.ml_training import execute_retraining_job

router = APIRouter(prefix="/feedback", tags=["Feedback & ML Learning"])


class FeedbackCreateRequest(BaseModel):
    teacher_id: int = Field(default=1, ge=1)
    teacher_name: Optional[str] = Field(default="Faculty Member")
    satisfaction_score: int = Field(..., ge=1, le=5)
    preferred_time: str = Field(default="Morning")
    avoid_time: Optional[str] = Field(default="Evening")
    workload_satisfaction: int = Field(default=4, ge=1, le=5)
    teaching_hours: int = Field(default=4, ge=1, le=10)
    num_gaps: int = Field(default=1, ge=0, le=6)
    department: str = Field(default="Computer Science")
    experience_years: int = Field(default=5, ge=1, le=40)
    comments: Optional[str] = None


@router.post("/{schedule_id}", status_code=status.HTTP_201_CREATED)
def submit_feedback(
    schedule_id: int,
    payload: FeedbackCreateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    fb = Feedback(
        schedule_id=schedule_id,
        teacher_id=payload.teacher_id,
        teacher_name=payload.teacher_name,
        satisfaction_score=payload.satisfaction_score,
        preferred_time=payload.preferred_time,
        avoid_time=payload.avoid_time,
        workload_satisfaction=payload.workload_satisfaction,
        teaching_hours=payload.teaching_hours,
        num_gaps=payload.num_gaps,
        department=payload.department,
        experience_years=payload.experience_years,
        comments=payload.comments,
    )
    db.add(fb)
    db.commit()
    db.refresh(fb)

    # Trigger non-blocking ML retraining in background
    background_tasks.add_task(execute_retraining_job)

    return {
        "feedback_id": f"fb_{fb.id}",
        "id": fb.id,
        "received": True,
        "ml_model_status": "Will retrain in background",
    }


@router.get("/{schedule_id}", response_model=List[Dict[str, Any]])
def list_schedule_feedback(schedule_id: int, db: Session = Depends(get_db)):
    rows = (
        db.query(Feedback)
        .filter(Feedback.schedule_id == schedule_id)
        .order_by(Feedback.id.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "schedule_id": r.schedule_id,
            "teacher_id": r.teacher_id,
            "teacher_name": r.teacher_name,
            "satisfaction_score": r.satisfaction_score,
            "preferred_time": r.preferred_time,
            "workload_satisfaction": r.workload_satisfaction,
            "comments": r.comments,
            "timestamp": r.timestamp,
        }
        for r in rows
    ]
