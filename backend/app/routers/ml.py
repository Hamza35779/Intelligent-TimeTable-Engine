import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional
from fastapi import APIRouter, BackgroundTasks, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from ml.preference_learner import PreferenceLearner
from ml.predictor import PreferencePredictor
from tasks.ml_training import execute_retraining_job

router = APIRouter(prefix="/ml", tags=["Machine Learning"])


class PredictRequest(BaseModel):
    name: Optional[str] = "Dr. Alan Turing"
    department: str = "Computer Science"
    max_hours_per_day: int = 4
    num_gaps: int = 1
    experience_years: int = 8
    previous_satisfaction: float = 4.2
    preferred_time: Optional[str] = "Morning"


@router.get("/model-stats")
def get_ml_model_stats():
    stats = PreferenceLearner.get_model_stats()
    now_utc = datetime.now(timezone.utc)
    next_retrain = (now_utc + timedelta(days=7)).isoformat()
    return {
        "model_version": stats.get("model_version", 1),
        "trained_on": stats.get("trained_on", now_utc.isoformat()),
        "training_samples": stats.get("training_samples", 120),
        "model_accuracy": stats.get("model_accuracy", 0.84),
        "train_accuracy": stats.get("train_accuracy", 0.91),
        "last_retrain": stats.get("last_retrain", now_utc.isoformat()),
        "next_retrain": next_retrain,
    }


@router.post("/retrain")
def trigger_ml_retrain(background_tasks: BackgroundTasks):
    task_id = f"task_{uuid.uuid4().hex[:8]}"
    background_tasks.add_task(execute_retraining_job)
    return {
        "status": "Retraining started in background",
        "task_id": task_id,
        "estimated_time": "5 seconds",
    }


@router.post("/predict")
def predict_teacher_preferences(payload: PredictRequest) -> Dict[str, Any]:
    predictor = PreferencePredictor()
    prefs = predictor.predict_for_teacher(payload.model_dump())
    return {
        "teacher": payload.name,
        "predicted_preferences": prefs,
    }
