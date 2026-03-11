# routers/portfolio_router.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date
from app.database import get_db
from app.core.rbac import get_current_user
from app.services.storage_service import generate_upload_url
from app.models.portfolio import PortfolioItem
import uuid
from app.models.students import Student

router = APIRouter(prefix='/portfolio', tags=['Portfolio'])

class UploadRequest(BaseModel):
    filename: str
    content_type: str = 'application/pdf'

class PortfolioItemIn(BaseModel):
    item_type: str
    title: str
    issuing_org: Optional[str]
    issue_date: date
    description: Optional[str]
    file_key: str  # from the upload URL response
    file_url: str



@router.post('/upload-url')
def get_upload_url(
    body: UploadRequest,
    user=Depends(get_current_user)):
    file_key = f'portfolios/student_{user.user_id}/{uuid.uuid4()}_{body.filename}'
    return generate_upload_url(file_key, body.content_type)

@router.post('/items')
def create_item(
    body: PortfolioItemIn,
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    from app.models.students import Student
    from app.services import audit_service

    student = db.query(Student).filter(
        Student.user_id == user.user_id,
        Student.university_id == user.university_id
    ).first()

    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

     # SECURITY CHECK: ensure uploaded file belongs to this user
    if not body.file_key.startswith(f"portfolios/student_{user.user_id}/"):
        raise HTTPException(
            status_code=403,
            detail="Invalid file key"
        )

    item = PortfolioItem(
        university_id=user.university_id,
        student_id=student.student_id,
        uploaded_by=user.user_id,
        verification_code=str(uuid.uuid4()),
        **body.model_dump()
    )

    db.add(item)
    db.commit()
    db.refresh(item)

    audit_service.log_action(
        db,
        university_id=user.university_id,
        actor_user_id=user.user_id,
        action='CREATE',
        entity_type='portfolio_items',
        entity_id=item.item_id
    )

    return {
        'item_id': item.item_id,
        'verification_code': item.verification_code
    }
@router.get('/items')
def list_items(user=Depends(get_current_user), db=Depends(get_db)):

    student = db.query(Student).filter(
        Student.user_id == user.user_id,
        Student.university_id == user.university_id
    ).first()

    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    return db.query(PortfolioItem).filter(
        PortfolioItem.student_id == student.student_id,
        PortfolioItem.university_id == user.university_id
    ).all()
