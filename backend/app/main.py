from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base
import app.models  # Ensure all models are registered with Base
from app.routers import health_router, constraints_router, timetable_router, schedule_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables automatically if they do not exist
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Production-ready constraint-based timetable optimization engine using Google OR-Tools CP-SAT.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for development & local Next.js
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routers
app.include_router(health_router)
app.include_router(constraints_router)
app.include_router(timetable_router)
app.include_router(schedule_router)


@app.get("/")
def root():
    return {
        "engine": settings.PROJECT_NAME,
        "docs": "/docs",
        "health": "/health",
    }
