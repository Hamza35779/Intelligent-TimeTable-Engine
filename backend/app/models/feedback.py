from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, JSON
from app.database import Base


class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("schedule_runs.id"), nullable=False, index=True)
    teacher_id = Column(Integer, nullable=False, default=1, index=True)
    teacher_name = Column(String(120), nullable=True)
    satisfaction_score = Column(Integer, nullable=False)  # 1-5 scale
    preferred_time = Column(String(50), nullable=False, default="Morning")  # Morning / Afternoon / Evening
    avoid_time = Column(String(50), nullable=True)
    workload_satisfaction = Column(Integer, nullable=False, default=4)  # 1-5 scale
    teaching_hours = Column(Integer, default=4)
    num_gaps = Column(Integer, default=1)
    department = Column(String(100), default="Computer Science")
    experience_years = Column(Integer, default=5)
    comments = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class MLModelMetadata(Base):
    __tablename__ = "ml_model_metadata"

    id = Column(Integer, primary_key=True, index=True)
    model_version = Column(Integer, nullable=False, default=1)
    trained_on = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    training_samples = Column(Integer, nullable=False, default=0)
    train_accuracy = Column(Float, nullable=False, default=0.0)
    test_accuracy = Column(Float, nullable=False, default=0.0)
    last_retrain = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    next_retrain = Column(DateTime, nullable=True)


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String(64), primary_key=True, index=True)
    schedule_id = Column(Integer, nullable=True, index=True)
    detected_views = Column(JSON, default=list)
    detected_formats = Column(JSON, default=list)
    preferences = Column(JSON, default=dict)
    messages = Column(JSON, default=list)
    status = Column(String(50), default="active")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
