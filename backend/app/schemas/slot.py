from pydantic import BaseModel, Field, ConfigDict


class TimeSlotBase(BaseModel):
    day_of_week: str = Field(..., json_schema_extra={"example": "Monday"})
    start_time: str = Field(..., json_schema_extra={"example": "09:00"})
    end_time: str = Field(..., json_schema_extra={"example": "10:00"})
    duration_minutes: int = Field(default=60, gt=0, json_schema_extra={"example": 60})


class TimeSlotCreate(TimeSlotBase):
    pass


class TimeSlotResponse(TimeSlotBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
