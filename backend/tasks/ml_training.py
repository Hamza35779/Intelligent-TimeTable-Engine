import os
from datetime import datetime, timedelta, timezone
from typing import Dict, Any
from celery import Celery
from app.database import SessionLocal
from app.models.feedback import Feedback, MLModelMetadata
from ml.preference_learner import PreferenceLearner

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "timetable_tasks",
    broker=REDIS_URL,
    backend=REDIS_URL,
)


def execute_retraining_job() -> Dict[str, Any]:
    """
    Fetch all feedback records from the database, retrain the Random Forest
    preference learner, and record updated model metrics.
    """
    db = SessionLocal()
    try:
        rows = db.query(Feedback).all()
        feedback_dicts = [
            {
                "teacher_id": r.teacher_id,
                "teaching_hours": r.teaching_hours or 4,
                "preferred_time": r.preferred_time or "Morning",
                "num_gaps": r.num_gaps or 1,
                "department": r.department or "Computer Science",
                "experience_years": r.experience_years or 5,
                "satisfaction_score": r.satisfaction_score or 4,
            }
            for r in rows
        ]

        learner = PreferenceLearner()
        meta = learner.retrain(new_feedback_data=feedback_dicts)

        now_utc = datetime.now(timezone.utc)
        db_meta = MLModelMetadata(
            model_version=meta["model_version"],
            trained_on=now_utc,
            training_samples=meta["training_samples"],
            train_accuracy=meta["train_accuracy"],
            test_accuracy=meta["model_accuracy"],
            last_retrain=now_utc,
            next_retrain=now_utc + timedelta(days=7),
        )
        db.add(db_meta)
        db.commit()
        return meta
    finally:
        db.close()


@celery_app.task(name="tasks.retrain_preference_model")
def retrain_preference_model_task() -> Dict[str, Any]:
    return execute_retraining_job()
