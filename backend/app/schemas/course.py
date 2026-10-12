from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class CourseBase(BaseModel):
    name: str = Field(..., json_schema_extra={"example": "Algorithms and Data Structures"})
    code: str = Field(..., json_schema_extra={"example": "CS101"})
    faculty_id: int = Field(..., json_schema_extra={"example": 1})
    capacity_required: int = Field(default=30, gt=0, json_schema_extra={"example": 40})
    duration_minutes: int = Field(default=60, gt=0, json_schema_extra={"example": 60})
    credit_hours: Optional[int] = Field(default=None, ge=1, json_schema_extra={"example": 3})
    student_group: Optional[str] = Field(default=None, json_schema_extra={"example": "BSCS-A"})
    room_type: Optional[str] = Field(default=None, json_schema_extra={"example": "Lecture"})


class CourseCreate(CourseBase):
    pass


class CourseResponse(CourseBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
