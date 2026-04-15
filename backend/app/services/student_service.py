from sqlalchemy.orm import Session
from app.repositories import student_repository as repo
from app.repositories.academic_repository import get_offering_by_id

def list_students(
    db,
    university_id,
    batch_id=None,
    section_id=None,
    program_id=None,
    status=None,
    search=None,
):
    return repo.get_students(
        db, university_id, batch_id, section_id, program_id, status, search
    )

def get_student(db, student_id, university_id):
    s = repo.get_student_by_id(db, student_id, university_id)
    if not s: raise LookupError('Student not found')
    return s

def get_student_enrollments(db, student_id, university_id):
    get_student(db, student_id, university_id)  # verify access
    return repo.get_student_enrollments(db, student_id)

def enroll(db, university_id, student_id, offering_id):
    student = get_student(db, student_id, university_id)  # raises LookupError if not found
    offering = get_offering_by_id(db, offering_id, university_id)
    if not offering: raise LookupError('Offering not found')
    # Prevent cross-batch enrollment
    if student.batch_id != offering.batch_id:
        raise ValueError('Student batch does not match offering batch')
    try:
        return repo.enroll_student_in_offering(db, university_id, student_id, offering_id)
    except Exception:
        db.rollback()
        raise

def drop(db, enrollment_id, student_id, university_id):
    return repo.drop_enrollment(db, enrollment_id, student_id, university_id)
