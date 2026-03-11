from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.auth import LoginRequest, TokenResponse
from app.services.auth_service import login_user
from app.core.rbac import get_current_user
from app.models.roles import Role
from app.models.user_roles import UserRole

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    token = login_user(db, data.email, data.password)
    if not token:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"access_token": token}


@router.get("/me")
def get_me(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    roles = [
        r.name
        for r in db.query(Role)
        .join(UserRole, Role.role_id == UserRole.role_id)
        .filter(UserRole.user_id == current_user.user_id)
        .all()
    ]

    return {
        "user_id": current_user.user_id,
        "university_id": current_user.university_id,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "permissions": current_user.permissions,
        "roles": roles
    }