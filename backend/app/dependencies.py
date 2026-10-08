from fastapi import Depends
from sqlalchemy.orm import Session
from app.database import get_db

# Common dependency injection wrappers
def get_database_session(db: Session = Depends(get_db)) -> Session:
    return db
