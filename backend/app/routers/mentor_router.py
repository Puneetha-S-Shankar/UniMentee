from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.rbac import get_current_user
from app.repositories import mentor_repository as repo
from app.schemas.mentorship import AssignmentOut, SessionIn, SessionOut
from typing import List
from app.models.students import Student

router = APIRouter(prefix='/mentor', tags=['Mentor'])

@router.get('/assignments', response_model=List[AssignmentOut])
def my_assignments(user=Depends(get_current_user), db=Depends(get_db)):
    return repo.get_assignments_for_mentor(db, user.user_id, user.university_id)

@router.get('/assignments/{assignment_id}/sessions', response_model=List[SessionOut])
def get_sessions(assignment_id: int, user=Depends(get_current_user), db=Depends(get_db)):

    assignment = repo.get_assignment_by_id(
        db, assignment_id, user.university_id
    )

    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if assignment.mentor_user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return repo.get_sessions(db, assignment_id, user.university_id)

@router.post('/assignments/{assignment_id}/sessions', response_model=SessionOut)
def create_session(
    assignment_id: int, body: SessionIn,
    user=Depends(get_current_user), db=Depends(get_db)):
    assignment = repo.get_assignment_by_id(
        db, assignment_id, user.university_id
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if assignment.mentor_user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return repo.create_session(
        db,
        assignment_id,
        user.university_id,
        user.user_id,
        body.model_dump(exclude_none=True)
    )

# Student: view own mentor sessions


@router.get('/my-sessions', response_model=List[SessionOut])
def my_sessions(user=Depends(get_current_user), db=Depends(get_db)):
    student = db.query(Student).filter(
    Student.user_id == user.user_id,
    Student.university_id == user.university_id
    ).first()

    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    assignment = repo.get_assignment_for_student(
        db, student.student_id, user.university_id
    )
    if not assignment: raise HTTPException(status_code=404, detail='No active mentor assignment')
    return repo.get_sessions(db, assignment.assignment_id, user.university_id)
