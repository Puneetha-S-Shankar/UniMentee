from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from app.database import get_db
from app.core.rbac import get_current_user, require_permission
from app.services import academic_service as svc
from app.schemas.academic import (
    ProgramOut, BatchOut, SectionOut, SubjectOut, OfferingOut, OfferingStatusUpdate,
    ProgramIn, ProgramStatusUpdate, BatchIn, SubjectIn, OfferingIn, SectionIn, TermOut, GradeScaleOut,
    AssessmentTypeOut,
)
from app.models.academic import SubjectOffering
from app.models.marks import GradeScale, AssessmentType
from app.core.grade_scale_defaults import default_grade_scale_out_list
from app.repositories import academic_repository as academic_repo

router = APIRouter(prefix='/academic', tags=['Academic'])

@router.get('/programs', response_model=List[ProgramOut])
def list_programs(user=Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.list_programs(db, user.university_id)

@router.get('/batches', response_model=List[BatchOut])
def list_batches(
    program_id: Optional[int] = Query(None),
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.list_batches(db, user.university_id, program_id)


@router.get('/sections', response_model=List[SectionOut])
def list_sections(
    batch_id: int = Query(..., description="Batch to list sections for"),
    include_inactive: bool = Query(False, description="Include non-ACTIVE sections (admin)"),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return svc.list_sections(db, user.university_id, batch_id, active_only=not include_inactive)


@router.get('/subjects', response_model=List[SubjectOut])
def list_subjects(
    include_inactive: bool = Query(False, description="Include inactive subjects (admin)"),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return svc.list_subjects(db, user.university_id, active_only=not include_inactive)

@router.get('/offerings', response_model=List[OfferingOut])
def list_offerings(
    term_id: Optional[int] = Query(None),
    batch_id: Optional[int] = Query(None),
    section_id: Optional[int] = Query(None),
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    return svc.list_offerings(db, user.university_id, term_id, batch_id, section_id)


@router.get('/offerings/{offering_id}', response_model=OfferingOut)
def get_offering(
    offering_id: int,
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    o = academic_repo.get_offering_by_id(db, offering_id, user.university_id)
    if not o:
        raise HTTPException(status_code=404, detail='Offering not found')
    return o

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


@router.get('/terms', response_model=List[TermOut])
def list_terms(
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(SubjectOffering.term_id, SubjectOffering.academic_year_id)
        .filter(SubjectOffering.university_id == user.university_id)
        .distinct()
        .all()
    )
    if not rows:
        return []
    ordered = sorted({(r.term_id, r.academic_year_id) for r in rows}, key=lambda x: x[0])
    max_tid = max(t for t, _ in ordered)
    return [
        TermOut(
            term_id=tid,
            name=f"Term {tid}",
            academic_year_id=ayid,
            is_current=(tid == max_tid),
        )
        for tid, ayid in ordered
    ]


@router.get('/assessment-types', response_model=List[AssessmentTypeOut])
def list_assessment_types(
    user=Depends(get_current_user), db: Session = Depends(get_db),
):
    return (
        db.query(AssessmentType)
        .filter(AssessmentType.university_id == user.university_id)
        .order_by(AssessmentType.code)
        .all()
    )


@router.get('/grade-scales', response_model=List[GradeScaleOut])
def list_grade_scales(
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    scales = (
        db.query(GradeScale)
        .filter(GradeScale.university_id == user.university_id)
        .order_by(GradeScale.min_percentage.desc())
        .all()
    )
    if not scales:
        return default_grade_scale_out_list()
    return [
        GradeScaleOut(
            grade=gs.grade_letter,
            grade_point=float(gs.grade_point),
            min_percentage=float(gs.min_percentage),
            max_percentage=float(gs.max_percentage),
            is_passing=bool(gs.is_passing),
        )
        for gs in scales
    ]


# ── POST /academic/programs ──────────────────────────────────────
@router.post('/programs', response_model=ProgramOut, status_code=201)
def create_program(
    body: ProgramIn,
    user=Depends(require_permission('ACADEMIC_MANAGE')),
    db: Session = Depends(get_db),
):
    try:
        return svc.create_program(db, user.university_id, body.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.patch('/programs/{program_id}', response_model=ProgramOut)
def patch_program_status(
    program_id: int,
    body: ProgramStatusUpdate,
    user=Depends(require_permission('ACADEMIC_MANAGE')),
    db: Session = Depends(get_db),
):
    try:
        return svc.patch_program_status(db, program_id, user.university_id, body.status)
    except LookupError:
        raise HTTPException(status_code=404, detail="Program not found")


# ── POST /academic/batches ───────────────────────────────────────
@router.post('/batches', response_model=BatchOut, status_code=201)
def create_batch(
    body: BatchIn,
    user=Depends(require_permission('ACADEMIC_MANAGE')),
    db: Session = Depends(get_db),
):
    try:
        return svc.create_batch(db, user.university_id, body.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


# ── POST /academic/subjects ──────────────────────────────────────
@router.post('/subjects', response_model=SubjectOut, status_code=201)
def create_subject(
    body: SubjectIn,
    user=Depends(require_permission('ACADEMIC_MANAGE')),
    db: Session = Depends(get_db),
):
    try:
        return svc.create_subject(db, user.university_id, body.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


# ── POST /academic/sections ─────────────────────────────────────
@router.post('/sections', response_model=SectionOut, status_code=201)
def create_section(
    body: SectionIn,
    user=Depends(require_permission('ACADEMIC_MANAGE')),
    db: Session = Depends(get_db),
):
    try:
        return svc.create_section(db, user.university_id, body.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    
    
# ── POST /academic/offerings ─────────────────────────────────────
# Starts in DRAFT — use PATCH /offerings/{id}/status to move to PLANNED → ACTIVE
@router.post('/offerings', response_model=OfferingOut, status_code=201)
def create_offering(
    body: OfferingIn,
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        return svc.create_offering(db, user.university_id, body.model_dump())
    except ValueError as e: raise HTTPException(status_code=422, detail=str(e))



