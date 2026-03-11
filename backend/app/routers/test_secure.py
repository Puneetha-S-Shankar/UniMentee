from fastapi import APIRouter, Depends
from app.core.rbac import require_permission

router = APIRouter(prefix="/secure", tags=["Secure Test"])

@router.get("/protected")
def protected_route(
    current_user = Depends(require_permission("ATTENDANCE_MARK"))
):
    return {
        "message": "You have permission",
        "user": current_user.full_name
    }