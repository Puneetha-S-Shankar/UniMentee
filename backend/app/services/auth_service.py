from sqlalchemy.orm import Session
from app.repositories.user_repository import get_user_by_email
from app.core.security import verify_password, create_access_token
def authenticate_user(db: Session, email: str, password: str):
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user
def login_user(db: Session, email: str, password: str):
    user = authenticate_user(db, email, password)
    if not user:
        return None
    token = create_access_token({"sub": str(user.user_id), "university_id": user.university_id})
    return token