from sqlalchemy.orm import Session
from app.models.academic import Program, Batch, Section, Subject, SubjectOffering
from sqlalchemy.exc import IntegrityError

def get_programs(db: Session, university_id: int):
    return db.query(Program).filter(
        Program.university_id == university_id,
        Program.status == 'ACTIVE'
    ).all()

def get_batches(db: Session, university_id: int, program_id: int = None):
    q = db.query(Batch).filter(Batch.university_id == university_id)
    if program_id is not None:
        q = q.filter(Batch.program_id == program_id)
    return q.all()

def get_subjects(db: Session, university_id: int):
    return db.query(Subject).filter(
        Subject.university_id == university_id,
        Subject.is_active == True
    ).all()

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
        print("REAL ERROR:", e) 
        raise ValueError("Program code already exists for this university")  # 👈 add this
        # raise ValueError('Program code already exists for this university')
    
    
    
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
    db.refresh(subject)
    return subject
    
def create_offering(db: Session, university_id: int, data: dict):
    offering = SubjectOffering(university_id=university_id, status='DRAFT',
                              current_enrollment=0, **data)
    db.add(offering)
    try:
        db.commit()
        db.refresh(offering)
        return offering
    except IntegrityError:
        db.rollback()
        print("REAL DB ERROR:", e) 
        raise ValueError(str(e.orig))
    db.refresh(offering)
    return offering


