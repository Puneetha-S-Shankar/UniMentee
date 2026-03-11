from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.users import User
from app.config import JWT_SECRET, JWT_ALGORITHM
from app.models.user_roles import UserRole
from app.models.roles import Role
from app.models.role_permissions import RolePermission
from app.models.permissions import Permission

security = HTTPBearer()

def get_current_user(
    token=Depends(security),
    db: Session = Depends(get_db)
):
    try:
        payload = jwt.decode(
            token.credentials,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM]
        )

        user_id = int(payload.get("sub"))
        university_id = payload.get("university_id")

    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(
        User.user_id == user_id,
        User.university_id == university_id,
        User.status == "ACTIVE"
    ).first()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # 🔥 Load permissions
    roles = db.query(Role).join(
        UserRole, Role.role_id == UserRole.role_id
    ).filter(
        UserRole.user_id == user.user_id
    ).all()

    role_ids = [r.role_id for r in roles]

    permissions = db.query(Permission).join(
        RolePermission,
        Permission.permission_id == RolePermission.permission_id
    ).filter(
        RolePermission.role_id.in_(role_ids)
    ).all()

    user.permissions = [p.key for p in permissions]

    return user

def require_permission(permission_key: str):
    def dependency(current_user=Depends(get_current_user)):
        if permission_key not in current_user.permissions:
            raise HTTPException(
                status_code=403,
                detail="Permission denied"
            )
        return current_user
    return dependency