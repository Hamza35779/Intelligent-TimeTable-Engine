from typing import Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict


class ConstraintBase(BaseModel):
    type: str = Field(..., pattern="^(hard|soft)$", json_schema_extra={"example": "hard"})
    name: str = Field(..., json_schema_extra={"example": "No Double Booking"})
    description: Optional[str] = Field(None, json_schema_extra={"example": "Prevent same faculty or venue conflict"})
    weight: float = Field(default=1.0, ge=0.0, json_schema_extra={"example": 1.0})
    constraint_data: Dict[str, Any] = Field(default_factory=dict)


class ConstraintCreate(ConstraintBase):
    pass


class ConstraintResponse(ConstraintBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
