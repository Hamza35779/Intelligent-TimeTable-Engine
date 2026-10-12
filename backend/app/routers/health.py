import os
import time
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.config import settings
from app.database import get_db

router = APIRouter(tags=["Health"])

START_TIME = time.time()


def _check_ortools():
    try:
        from ortools import __version__ as ortools_version
        from ortools.sat.python import cp_model  # noqa: F401
        return {
            "engine": "Google OR-Tools CP-SAT",
            "importable": True,
            "ready": True,
            "version": ortools_version,
        }
    except Exception as exc:
        return {
            "engine": "Google OR-Tools CP-SAT",
            "importable": False,
            "ready": False,
            "version": "unavailable",
            "error": str(exc),
        }


def _check_ml_model_present() -> bool:
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    model_path = os.path.join(base_dir, "ml", "models", "preference_model.pkl")
    scaler_path = os.path.join(base_dir, "ml", "models", "scaler.pkl")
    return os.path.exists(model_path) and os.path.exists(scaler_path)


def _check_gemini_configured() -> bool:
    api_key = (settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")).strip()
    return bool(api_key)


def _check_redis() -> str:
    redis_url = (settings.REDIS_URL or os.getenv("REDIS_URL", "")).strip()
    if not redis_url:
        return "not_configured"
    try:
        import redis
        client = redis.Redis.from_url(redis_url, socket_connect_timeout=0.3, socket_timeout=0.3)
        if client.ping():
            return "reachable"
        return "not_configured"
    except Exception:
        return "not_configured"


@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    db_reachable = False
    db_status = "healthy"
    try:
        db.execute(text("SELECT 1"))
        db_reachable = True
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    ortools_info = _check_ortools()
    ml_present = _check_ml_model_present()
    gemini_configured = _check_gemini_configured()
    redis_status = _check_redis()
    uptime_seconds = round(time.time() - START_TIME, 2)

    return {
        "status": "healthy" if (db_reachable and ortools_info["ready"]) else "degraded",
        "database": {
            "reachable": db_reachable,
            "status": db_status,
        },
        "ortools": ortools_info,
        "solver": ortools_info,
        "ml_model_present": ml_present,
        "gemini_configured": gemini_configured,
        "redis": redis_status,
        "uptime_seconds": uptime_seconds,
    }
