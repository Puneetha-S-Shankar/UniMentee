from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.database import get_db
from app.core.rbac import get_current_user
from app.repositories import attendance_repository as repo
from app.schemas.attendance import SessionIn, SessionOut, BulkAttendanceIn
from typing import List

router = APIRouter(prefix='/attendance', tags=['Attendance'])

@router.post('/offerings/{offering_id}/sessions', response_model=SessionOut)
def create_session(
    offering_id: int, body: SessionIn,
    user=Depends(get_current_user), db=Depends(get_db)):
    try:
        return repo.create_session(
            db, user.university_id, offering_id,
            user.user_id, body.model_dump(exclude_none=True))
    except IntegrityError:
        raise HTTPException(409, 'Session already exists for this time slot')

@router.get('/offerings/{offering_id}/sessions', response_model=List[SessionOut])
def list_sessions(
    offering_id: int,
    user=Depends(get_current_user), db=Depends(get_db)):
    return repo.get_sessions(db, offering_id, user.university_id)   

@router.put('/sessions/{session_id}/attendance')
def bulk_mark(
    session_id: int, body: BulkAttendanceIn,
    user=Depends(get_current_user), db=Depends(get_db)):
    session = repo.get_session(db, session_id, user.university_id)
    if not session: raise HTTPException(status_code=404, detail='Session not found')
    if session.is_locked: raise HTTPException(403, 'Session is locked')
    repo.bulk_upsert_records(
        db, session_id, user.university_id,
        [r.model_dump() for r in body.records])
    return {'message': 'Attendance saved'}

@router.patch('/sessions/{session_id}/lock')
def lock(
    session_id: int,
    user=Depends(get_current_user), db=Depends(get_db)):
    session = repo.get_session(db, session_id, user.university_id)
    if not session: raise HTTPException(status_code=404, detail='Not found')
    return repo.lock_session(db, session)
