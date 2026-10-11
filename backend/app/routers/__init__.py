from app.routers.health import router as health_router
from app.routers.constraints import router as constraints_router
from app.routers.timetable import router as timetable_router
from app.routers.schedule import router as schedule_router
from app.routers.feedback import router as feedback_router
from app.routers.ml import router as ml_router
from app.routers.export import router as export_router
from app.routers.chat import router as chat_router

__all__ = [
    "health_router",
    "constraints_router",
    "timetable_router",
    "schedule_router",
    "feedback_router",
    "ml_router",
    "export_router",
    "chat_router",
]
