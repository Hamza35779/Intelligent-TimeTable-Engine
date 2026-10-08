from typing import List, Dict, Any, Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class FacultyBase(BaseModel):
    name: str = Field(..., json_schema_extra={"example": "Dr. Alan Turing"})
    department: str = Field(..., json_schema_extra={"example": "Computer Science"})
    max_hours_per_day: int = Field(default=6, ge=1, le=12)
    max_days_per_week: int = Field(default=5, ge=1, le=7)
    email: EmailStr = Field(..., json_schema_extra={"example": "turing@university.edu"})
    preferences: Dict[str, Any] = Field(
        default_factory=dict,
        json_schema_extra={"example": {"prefer_morning": True, "preferred_days": ["Monday", "Wednesday"]}},
    )
    unavailable_slots: List[int] = Field(default_factory=list, json_schema_extra={"example": [1, 4]})


class FacultyCreate(FacultyBase):
    pass


class FacultyResponse(FacultyBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
