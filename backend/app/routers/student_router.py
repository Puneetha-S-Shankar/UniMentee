from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from app.database import get_db
from app.core.rbac import get_current_user
from app.services import student_service as svc
from app.schemas.students import StudentOut, EnrollmentIn, EnrollmentOut

router = APIRouter(prefix='/students', tags=['Students'])

@router.get('', response_model=List[StudentOut])
def list_students(
    batch_id: Optional[int] = Query(None),
    section_id: Optional[int] = Query(None),
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.list_students(db, user.university_id, batch_id, section_id)

@router.get('/{student_id}', response_model=StudentOut)
def get_student(
    student_id: int,
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    try: return svc.get_student(db, student_id, user.university_id)
    except LookupError as e: raise HTTPException(status_code=404, detail=str(e))

@router.get('/{student_id}/enrollments', response_model=List[EnrollmentOut])
def get_enrollments(
    student_id: int,
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.get_student_enrollments(db, student_id, user.university_id)

@router.post('/{student_id}/enrollments', response_model=EnrollmentOut)
def enroll(
    student_id: int, body: EnrollmentIn,
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        return svc.enroll(db, user.university_id, student_id, body.offering_id)
    except LookupError as e: raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
     raise HTTPException(status_code=409, detail=str(e))

@router.delete('/{student_id}/enrollments/{enrollment_id}')
def drop(
    student_id: int,
    enrollment_id: int,
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    try: return svc.drop(db, enrollment_id, student_id, user.university_id)
    except LookupError as e: raise HTTPException(status_code=404, detail=str(e))
