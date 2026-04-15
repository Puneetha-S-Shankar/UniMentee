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
    user.roles = [r.name for r in roles]

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


def require_any_permission(*permission_keys: str):
    """User must have at least one of the given permissions."""

    def dependency(current_user=Depends(get_current_user)):
        if not any(k in current_user.permissions for k in permission_keys):
            raise HTTPException(status_code=403, detail="Permission denied")
        return current_user

    return dependency


def require_all_permissions(*permission_keys: str):
    """User must have every listed permission."""

    def dependency(current_user=Depends(get_current_user)):
        missing = [k for k in permission_keys if k not in current_user.permissions]
        if missing:
            raise HTTPException(status_code=403, detail="Permission denied")
        return current_user

    return dependency


def require_analytics_summary_access():
    """ORG_VIEW / USER_VIEW / DEPT_VIEW, or HOD role (until department scopes exist)."""

    def dependency(current_user=Depends(get_current_user)):
        allowed = ("ORG_VIEW", "USER_VIEW", "DEPT_VIEW")
        if any(k in current_user.permissions for k in allowed):
            return current_user
        roles = getattr(current_user, "roles", []) or []
        if "HOD" in roles:
            return current_user
        raise HTTPException(status_code=403, detail="Permission denied")

    return dependency


def require_faculty_directory_access():
    """USER_MANAGE / DEPT_VIEW, or HOD (faculty list only — enforced in handler)."""

    def dependency(current_user=Depends(get_current_user)):
        if any(k in current_user.permissions for k in ("USER_MANAGE", "DEPT_VIEW")):
            return current_user
        roles = getattr(current_user, "roles", []) or []
        if "HOD" in roles:
            return current_user
        raise HTTPException(status_code=403, detail="Permission denied")

    return dependency