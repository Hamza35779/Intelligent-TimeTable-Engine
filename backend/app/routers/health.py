import time
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from ortools import __version__ as ortools_version
from app.database import get_db

router = APIRouter(tags=["Health"])

START_TIME = time.time()


@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    db_status = "healthy"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    uptime_seconds = round(time.time() - START_TIME, 2)

    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "solver": {
            "engine": "Google OR-Tools CP-SAT",
            "version": ortools_version,
            "ready": True,
        },
        "database": {
            "status": db_status,
        },
        "uptime_seconds": uptime_seconds,
    }
