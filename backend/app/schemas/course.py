from pydantic import BaseModel, Field, ConfigDict


class CourseBase(BaseModel):
    name: str = Field(..., json_schema_extra={"example": "Algorithms and Data Structures"})
    code: str = Field(..., json_schema_extra={"example": "CS101"})
    faculty_id: int = Field(..., json_schema_extra={"example": 1})
    capacity_required: int = Field(default=30, gt=0, json_schema_extra={"example": 40})
    duration_minutes: int = Field(default=60, gt=0, json_schema_extra={"example": 60})


class CourseCreate(CourseBase):
    pass


class CourseResponse(CourseBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
