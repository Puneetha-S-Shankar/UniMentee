from sqlalchemy.orm import Session
from app.repositories import academic_repository as repo
from app.models.academic import Batch

VALID_TRANSITIONS = {
    'DRAFT': ['PLANNED'],
    'PLANNED': ['ACTIVE'],
    'ACTIVE': ['COMPLETED', 'LOCKED'],
    'LOCKED': ['ACTIVE'],
    'COMPLETED': ['ARCHIVED'],
}

def list_programs(db: Session, university_id: int):
    return repo.get_programs(db, university_id)

def list_batches(db: Session, university_id: int, program_id: int = None):
    return repo.get_batches(db, university_id, program_id)


def list_sections(db: Session, university_id: int, batch_id: int, active_only: bool = True):
    return repo.get_sections(db, university_id, batch_id, active_only)


def list_subjects(db: Session, university_id: int, active_only: bool = True):
    return repo.get_subjects(db, university_id, active_only)

def list_offerings(db: Session, university_id: int, term_id=None,
                   batch_id=None, section_id=None):
    return repo.get_offerings(db, university_id, term_id, batch_id, section_id)

def change_offering_status(db: Session, offering_id: int,
                           university_id: int, new_status: str, version: int):
    offering = repo.get_offering_by_id(db, offering_id, university_id)
    if not offering:
        raise LookupError('Offering not found')
    allowed = VALID_TRANSITIONS.get(offering.status, [])
    if new_status not in allowed:
        raise ValueError(f'Cannot move from {offering.status} to {new_status}')
    return repo.update_offering_status(db, offering, new_status, version)


def create_program(db: Session, university_id: int, data: dict):
    if not 1 <= data.get('total_semesters', 0) <= 12:
        raise ValueError('total_semesters must be between 1 and 12')
    if data.get('total_credits') is None:
        data = {**data, 'total_credits': 0}
    return repo.create_program(db, university_id, data)
    
def create_batch(db: Session, university_id: int, data: dict):
    if data.get('end_year', 0) <= data.get('start_year', 0):
        raise ValueError('end_year must be after start_year')
    return repo.create_batch(db, university_id, data)
    
def create_subject(db: Session, university_id: int, data: dict):
    valid_types = {'THEORY', 'LAB', 'THEORY_LAB'}
    if data.get('subject_type', 'THEORY') not in valid_types:
        raise ValueError(f'subject_type must be one of {valid_types}')
    return repo.create_subject(db, university_id, data)
    
def create_offering(db: Session, university_id: int, data: dict):
    return repo.create_offering(db, university_id, data)


def create_section(db: Session, university_id: int, data: dict):
    b = (
        db.query(Batch)
        .filter(Batch.batch_id == data['batch_id'], Batch.university_id == university_id)
        .first()
    )
    if not b:
        raise ValueError('Batch not found')
    return repo.create_section(db, university_id, data)


def patch_program_status(db: Session, program_id: int, university_id: int, status: str):
    p = repo.get_program_by_id(db, program_id, university_id)
    if not p:
        raise LookupError('Program not found')
    return repo.update_program_status(db, p, status)

