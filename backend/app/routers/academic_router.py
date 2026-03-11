from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from app.database import get_db
from app.core.rbac import get_current_user
from app.services import academic_service as svc
from app.schemas.academic import ProgramOut, BatchOut, SubjectOut, OfferingOut, OfferingStatusUpdate

router = APIRouter(prefix='/academic', tags=['Academic'])

@router.get('/programs', response_model=List[ProgramOut])
def list_programs(user=Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.list_programs(db, user.university_id)

@router.get('/batches', response_model=List[BatchOut])
def list_batches(
    program_id: Optional[int] = Query(None),
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.list_batches(db, user.university_id, program_id)

@router.get('/subjects', response_model=List[SubjectOut])
def list_subjects(user=Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.list_subjects(db, user.university_id)

@router.get('/offerings', response_model=List[OfferingOut])
def list_offerings(
    term_id: Optional[int] = Query(None),
    batch_id: Optional[int] = Query(None),
    section_id: Optional[int] = Query(None),
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.list_offerings(db, user.university_id, term_id, batch_id, section_id)

@router.patch('/offerings/{offering_id}/status', response_model=OfferingOut)
def change_status(
    offering_id: int, body: OfferingStatusUpdate,
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        return svc.change_offering_status(
            db, offering_id, user.university_id, body.status, body.version)
    except LookupError as e: raise HTTPException(404, str(e))
    except ValueError as e:
     raise HTTPException(status_code=409, detail=str(e))

# Add these imports at the top of academic_router.py
from app.schemas.academic import (ProgramOut, BatchOut, SubjectOut, OfferingOut,
                                  OfferingStatusUpdate, ProgramIn, BatchIn,
                                  SubjectIn, OfferingIn)
    
    
# ── POST /academic/programs ──────────────────────────────────────
@router.post('/programs', response_model=ProgramOut, status_code=201)
def create_program(
    body: ProgramIn,
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        return svc.create_program(db, user.university_id, body.model_dump())
    except ValueError as e: raise HTTPException(status_code=422, detail=str(e))
    # 409 from IntegrityError is caught inside the service layer
    
    
# ── POST /academic/batches ───────────────────────────────────────
@router.post('/batches', response_model=BatchOut, status_code=201)
def create_batch(
    body: BatchIn,
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        return svc.create_batch(db, user.university_id, body.model_dump())
    except ValueError as e: raise HTTPException(status_code=422, detail=str(e))
    
    
# ── POST /academic/subjects ──────────────────────────────────────
@router.post('/subjects', response_model=SubjectOut, status_code=201)
def create_subject(
    body: SubjectIn,
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        return svc.create_subject(db, user.university_id, body.model_dump())
    except ValueError as e: raise HTTPException(status_code=422, detail=str(e))
    
    
# ── POST /academic/offerings ─────────────────────────────────────
# Starts in DRAFT — use PATCH /offerings/{id}/status to move to PLANNED → ACTIVE
@router.post('/offerings', response_model=OfferingOut, status_code=201)
def create_offering(
    body: OfferingIn,
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        return svc.create_offering(db, user.university_id, body.model_dump())
    except ValueError as e: raise HTTPException(status_code=422, detail=str(e))



