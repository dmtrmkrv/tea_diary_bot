from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.api.deps import get_db
from app.api.auth import get_current_user_id
from app.db.models import User

router = APIRouter(prefix="/users", tags=["users"])

class UserOut(BaseModel):
    id: int
    username: Optional[str]
    tz_offset_min: int
    class Config:
        from_attributes = True

@router.get("/me", response_model=UserOut)
def get_me(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Не найдено")
    return user
