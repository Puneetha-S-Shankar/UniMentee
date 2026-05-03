from typing import Optional

from sqlalchemy.orm import Session
from app.models.academic import Program, Batch, Section, Subject, SubjectOffering
from sqlalchemy.exc import IntegrityError

def get_programs(db: Session, university_id: int):
    return (
        db.query(Program)
        .filter(Program.university_id == university_id)
        .order_by(Program.code.asc())
        .all()
    )

def get_batches(db: Session, university_id: int, program_id: int = None):
    q = db.query(Batch).filter(Batch.university_id == university_id)
    if program_id is not None:
        q = q.filter(Batch.program_id == program_id)
    return q.all()


def get_sections(db: Session, university_id: int, batch_id: int, active_only: bool = True):
    q = db.query(Section).filter(
        Section.university_id == university_id,
        Section.batch_id == batch_id,
    )
    if active_only:
        q = q.filter(Section.status == 'ACTIVE')
    return q.order_by(Section.name.asc()).all()


def get_subjects(db: Session, university_id: int, active_only: bool = True):
    q = db.query(Subject).filter(Subject.university_id == university_id)
    if active_only:
        q = q.filter(Subject.is_active == True)
    return q.order_by(Subject.subject_code.asc()).all()

def get_offerings(db: Session, university_id: int, term_id: int = None,
                  batch_id: int = None, section_id: int = None):
    q = db.query(SubjectOffering).filter(
        SubjectOffering.university_id == university_id
    )
    if term_id is not None:    q = q.filter(SubjectOffering.term_id == term_id)
    if batch_id is not None:   q = q.filter(SubjectOffering.batch_id == batch_id)
    if section_id is not None: q = q.filter(SubjectOffering.section_id == section_id)
    return q.all()

def get_offering_by_id(db: Session, offering_id: int, university_id: int):
    return db.query(SubjectOffering).filter(
        SubjectOffering.offering_id == offering_id,
        SubjectOffering.university_id == university_id
    ).first()


def get_subject_name_for_curriculum(
    db: Session,
    curriculum_id: int,
    university_id: int,
) -> Optional[str]:
    """Resolve subject title from ``subject_offerings.curriculum_id``.

    Matches the faculty dashboard shortcut: ``curriculum_id`` is treated as
    ``subjects.subject_id`` until a dedicated ``curriculum_structures`` join exists.
    """
    row = (
        db.query(Subject.subject_name)
        .filter(
            Subject.subject_id == curriculum_id,
            Subject.university_id == university_id,
        )
        .first()
    )
    return row[0] if row else None


def update_offering_status(db: Session, offering: SubjectOffering,
                           new_status: str, expected_version: int):
    if offering.version != expected_version:
        raise ValueError('Version conflict — reload and retry')
    offering.status = new_status
    # version auto-incremented by DB trigger
    db.commit()
    db.refresh(offering)
    return offering

from app.models.academic import Program, Batch, Subject, SubjectOffering
from sqlalchemy.exc import IntegrityError
    
# def create_program(db: Session, university_id: int, data: dict):
#     program = Program(university_id=university_id, status='ACTIVE', **data)
#     db.add(program)
#     try:
#         db.commit()
#     except IntegrityError:
#         db.rollback()
#         raise ValueError('Program code already exists for this university')
#     db.refresh(program)
#     return program

from sqlalchemy.exc import IntegrityError

def create_program(db: Session, university_id: int, data: dict):
    program = Program(university_id=university_id, status='ACTIVE', **data)
    db.add(program)
    try:
        db.commit()
        db.refresh(program)
        return program
    except IntegrityError as e:
        db.rollback()
        raise ValueError("Program code already exists for this university")
    
    
    
def create_batch(db: Session, university_id: int, data: dict):
    batch = Batch(university_id=university_id, status='ACTIVE', **data)
    db.add(batch)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ValueError('Batch year already exists for this program')
    db.refresh(batch)
    return batch


def create_section(db: Session, university_id: int, data: dict):
    sec = Section(
        university_id=university_id,
        batch_id=data['batch_id'],
        name=data['name'],
        capacity=int(data.get('capacity', 60)),
        current_strength=0,
        status='ACTIVE',
    )
    db.add(sec)
    try:
        db.commit()
        db.refresh(sec)
        return sec
    except IntegrityError:
        db.rollback()
        raise ValueError('Section name already exists for this batch')


def get_program_by_id(db: Session, program_id: int, university_id: int):
    return (
        db.query(Program)
        .filter(Program.program_id == program_id, Program.university_id == university_id)
        .first()
    )


def update_program_status(db: Session, program: Program, status: str):
    program.status = status
    db.commit()
    db.refresh(program)
    return program


def create_subject(db: Session, university_id: int, data: dict):
    subject = Subject(university_id=university_id, is_active=True, **data)
    db.add(subject)
    try:
        db.commit()
        db.refresh(subject)
        return subject
    except IntegrityError:
        db.rollback()
        raise ValueError('Subject code already exists for this university')


def create_offering(db: Session, university_id: int, data: dict):
    offering = SubjectOffering(university_id=university_id, status='DRAFT',
                              current_enrollment=0, **data)
    db.add(offering)
    try:
        db.commit()
        db.refresh(offering)
        return offering
    except IntegrityError as e:
        db.rollback()
        raise ValueError(str(e.orig))
    db.refresh(offering)
    return offering


