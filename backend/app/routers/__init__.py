from app.routers.health import router as health_router
from app.routers.constraints import router as constraints_router
from app.routers.timetable import router as timetable_router
from app.routers.schedule import router as schedule_router

__all__ = ["health_router", "constraints_router", "timetable_router", "schedule_router"]
