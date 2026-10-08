from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.constraint import CustomConstraint
from app.schemas.constraint import ConstraintCreate, ConstraintResponse

router = APIRouter(prefix="/constraints", tags=["Constraints"])


@router.post("", response_model=ConstraintResponse, status_code=status.HTTP_201_CREATED)
def create_constraint(payload: ConstraintCreate, db: Session = Depends(get_db)):
    constraint = CustomConstraint(
        type=payload.type,
        name=payload.name,
        description=payload.description,
        weight=payload.weight,
        constraint_data=payload.constraint_data,
    )
    db.add(constraint)
    db.commit()
    db.refresh(constraint)
    return constraint


@router.get("", response_model=List[ConstraintResponse])
def list_constraints(db: Session = Depends(get_db)):
    return db.query(CustomConstraint).all()


@router.delete("/{constraint_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_constraint(constraint_id: int, db: Session = Depends(get_db)):
    constraint = db.query(CustomConstraint).filter(CustomConstraint.id == constraint_id).first()
    if not constraint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Constraint with ID {constraint_id} not found",
        )
    db.delete(constraint)
    db.commit()
    return None
