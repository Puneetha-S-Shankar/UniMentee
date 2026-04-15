from typing import List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.students import Student, StudentSubjectEnrollment
from app.models.users import User
from app.models.academic import SubjectOffering

def get_students(
    db: Session,
    university_id: int,
    batch_id=None,
    section_id=None,
    program_id=None,
    status=None,
    search=None,
) -> List[Tuple[Student, str, str]]:
    """Join users to return (Student, full_name, email) per row."""
    q = (
        db.query(Student, User.full_name, User.email)
        .join(User, Student.user_id == User.user_id)
        .filter(Student.university_id == university_id)
    )
    if batch_id is not None:
        q = q.filter(Student.batch_id == batch_id)
    if section_id is not None:
        q = q.filter(Student.section_id == section_id)
    if program_id is not None:
        q = q.filter(Student.program_id == program_id)
    if status:
        q = q.filter(Student.status == status)
    if search and search.strip():
        term = f"%{search.strip()}%"
        q = q.filter(
            or_(Student.usn.ilike(term), User.full_name.ilike(term), User.email.ilike(term))
        )
    return q.order_by(Student.usn.asc()).all()

def get_student_by_id(db, student_id, university_id):
    return db.query(Student).filter(
        Student.student_id == student_id,
        Student.university_id == university_id).first()

def get_student_enrollments(db: Session, student_id: int):
    return db.query(StudentSubjectEnrollment).filter(
        StudentSubjectEnrollment.student_id == student_id,
        StudentSubjectEnrollment.status == 'ENROLLED'
    ).all()

def enroll_student_in_offering(
    db: Session, university_id: int, student_id: int, offering_id: int):
    # SELECT FOR UPDATE prevents race condition on capacity
    offering = db.query(SubjectOffering).with_for_update().filter(
        SubjectOffering.offering_id == offering_id,
        SubjectOffering.university_id == university_id
    ).first()
    if not offering:
        raise LookupError('Offering not found')
    if offering.status != 'ACTIVE':
        raise ValueError('Offering is not active')
    if offering.max_enrollment is not None and offering.current_enrollment >= offering.max_enrollment:
        raise ValueError('Offering is at full capacity')
    # Check existing enrollment
    existing = db.query(StudentSubjectEnrollment).filter(
        StudentSubjectEnrollment.student_id == student_id,
        StudentSubjectEnrollment.offering_id == offering_id,
        StudentSubjectEnrollment.university_id == university_id
    ).first()
    if existing:
        raise ValueError('Student already enrolled')
    enrollment = StudentSubjectEnrollment(
        university_id=university_id,
        student_id=student_id,
        offering_id=offering_id,
        enrollment_type='REGULAR',
        status='ENROLLED'
    )
    db.add(enrollment)
    # DB trigger trg_sync_enrollment_count handles current_enrollment update
    db.commit()
    db.refresh(enrollment)
    return enrollment

def drop_enrollment(db: Session, enrollment_id: int, student_id: int, university_id: int):
    e = db.query(StudentSubjectEnrollment).filter(
        StudentSubjectEnrollment.enrollment_id == enrollment_id,
        StudentSubjectEnrollment.student_id == student_id,
        StudentSubjectEnrollment.university_id == university_id
    ).first()
    if not e: raise LookupError('Enrollment not found')
    e.status = 'DROPPED'
    db.commit()
    return e
