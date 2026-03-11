from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from app.database import get_db
from app.core.rbac import get_current_user
from app.services import marks_service as svc



router = APIRouter(prefix='/marks', tags=['Marks'])

class MarkIn(BaseModel):
    student_id: int
    marks_obtained: Optional[float]
    is_absent: bool = False
    version: int = 1

class MarkOut(BaseModel):
    mark_id: int
    assessment_id: int
    student_id: int
    marks_obtained: Optional[float]
    is_absent: bool
    version: int
    class Config: from_attributes = True

@router.get('/offerings/{offering_id}/assessments')
def list_assessments(
    offering_id: int,
    user=Depends(get_current_user), db=Depends(get_db)):
    return svc.get_assessments(db, offering_id, user.university_id)

@router.get('/assessments/{assessment_id}/marks', response_model=List[MarkOut])
def list_marks(
    assessment_id: int,
    user=Depends(get_current_user), db=Depends(get_db)):
    return svc.get_marks(db, assessment_id , user.university_id)

@router.put('/assessments/{assessment_id}/marks/{student_id}', response_model=MarkOut)
def upsert_mark(
    assessment_id: int, student_id: int, body: MarkIn,
    user=Depends(get_current_user), db=Depends(get_db)):
    try:
        return svc.upsert_mark(
            db, user.university_id, assessment_id,
            student_id, body.marks_obtained, body.is_absent,
            user.user_id, body.version)
    except ValueError as e: raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:   raise HTTPException(status_code=400, detail=str(e))

@router.patch(
    '/assessments/{assessment_id}/status'
)
def advance_status(
    assessment_id: int,
    user=Depends(get_current_user),
    db=Depends(get_db)
):
    try:
        return svc.advance_assessment_status(
            db, assessment_id, user.university_id, user.user_id
        )
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
