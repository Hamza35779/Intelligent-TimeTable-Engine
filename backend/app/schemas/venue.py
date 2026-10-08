from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class VenueBase(BaseModel):
    name: str = Field(..., json_schema_extra={"example": "Hall A"})
    capacity: int = Field(..., gt=0, json_schema_extra={"example": 60})
    equipment: List[str] = Field(default_factory=list, json_schema_extra={"example": ["projector", "mic", "computers"]})
    available_slots: List[int] = Field(default_factory=list, json_schema_extra={"example": [1, 2, 3, 4, 5, 6]})


class VenueCreate(VenueBase):
    pass


class VenueResponse(VenueBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
