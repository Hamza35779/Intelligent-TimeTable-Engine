from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base, SessionLocal
from app.fixtures import seed_demo_fixtures
import app.models  # Ensure all models are registered with Base
from app.routers import (
    health_router,
    constraints_router,
    timetable_router,
    schedule_router,
    demo_router,
    feedback_router,
    ml_router,
    export_router,
    chat_router,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_demo_fixtures(db, force=False)
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "Intelligent Conversational Timetable Optimization Engine combining "
        "Google OR-Tools CP-SAT, Random Forest ML Preference Learning, "
        "Multi-View Audience Perspectives, and Multi-Format Exports."
    ),
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(constraints_router)
app.include_router(timetable_router)
app.include_router(schedule_router)
app.include_router(demo_router)
app.include_router(feedback_router)
app.include_router(ml_router)
app.include_router(export_router)
app.include_router(chat_router)


@app.get("/")
def root():
    return {
        "engine": settings.PROJECT_NAME,
        "version": "2.0.0",
        "features": [
            "OR-Tools CP-SAT Multi-Objective Solver",
            "Random Forest ML Preference Learning",
            "Conversational AI Chatbot",
            "5-View Audience Perspectives (Master, Teacher, Student, Staff, Canteen)",
            "7-Format Exporter (CSV, XLSX, PDF, PNG, JPG, JSON, HTML)",
        ],
        "docs": "/docs",
        "health": "/health",
    }
