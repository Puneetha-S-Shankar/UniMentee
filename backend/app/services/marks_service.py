from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert
from app.models.marks import Assessment, StudentMark, StudentAcademicProgress, GradeScale
from app.models.students import StudentSubjectEnrollment, Student
from app.models.academic import SubjectOffering
from app.repositories import academic_repository as academic_repo
from app.services import audit_service

MARK_STATUS_TRANSITIONS = {
    'DRAFT':     'SUBMITTED',
    'SUBMITTED': 'VERIFIED',
    'VERIFIED':  'PUBLISHED',
}

def get_assessments(db: Session, offering_id: int, university_id: int):
    return db.query(Assessment).filter(
        Assessment.offering_id == offering_id,
        Assessment.university_id == university_id
    ).all()

def get_marks(db: Session, assessment_id: int, university_id: int):
    return db.query(StudentMark).filter(
        StudentMark.assessment_id == assessment_id,
        StudentMark.university_id == university_id
    ).all()

def upsert_mark(db: Session, university_id: int, assessment_id: int,
               student_id: int, marks_obtained, is_absent: bool,
               entered_by: int, current_version: int):
    """Upsert a single mark. The DB trigger validates marks <= max_marks."""
    existing = db.query(StudentMark).filter(
    StudentMark.assessment_id == assessment_id,
    StudentMark.student_id == student_id,
    StudentMark.university_id == university_id
).first()
    if existing:
        if existing.version != current_version:
            raise ValueError('Version conflict — reload and retry')
        existing.marks_obtained = marks_obtained
        existing.is_absent = is_absent
        existing.entered_by = entered_by
        existing.version += 1
    else:
        existing = StudentMark(
            university_id=university_id,
            assessment_id=assessment_id,
            student_id=student_id,
            marks_obtained=marks_obtained,
            is_absent=is_absent,
            entered_by=entered_by
        )
        db.add(existing)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise  # DB trigger raises if marks > max_marks
    db.refresh(existing)
    return existing

def advance_assessment_status(db: Session, assessment_id: int,
                              university_id: int, actor_id: int):
    a = db.query(Assessment).filter(
        Assessment.assessment_id == assessment_id,
        Assessment.university_id == university_id
    ).first()
    if not a: raise LookupError('Assessment not found')
    next_status = MARK_STATUS_TRANSITIONS.get(a.status)
    if not next_status: raise ValueError(f'Cannot advance from {a.status}')
    a.status = next_status
    if next_status == 'SUBMITTED': a.submitted_by = actor_id
    if next_status == 'VERIFIED':  a.verified_by  = actor_id
    if next_status == 'PUBLISHED':
        a.published_by = actor_id
        compute_sgpa_for_offering(db, a.offering_id, university_id)
    db.commit()
    return a

def compute_sgpa_for_offering(db: Session, offering_id: int, university_id: int):
    """Called when last assessment for offering is published. Computes SGPA."""
    offering = db.query(SubjectOffering).filter(
        SubjectOffering.university_id == university_id,
        SubjectOffering.offering_id == offering_id
    ).first()
    grade_scales = db.query(GradeScale).filter(
        GradeScale.university_id == university_id
    ).order_by(GradeScale.min_percentage.desc()).all()
    enrollments = db.query(StudentSubjectEnrollment).filter(
        StudentSubjectEnrollment.offering_id == offering_id,
        StudentSubjectEnrollment.status == 'ENROLLED'
    ).all()
    for enrollment in enrollments:
        marks = db.query(StudentMark).filter(
            StudentMark.assessment_id.in_(
                db.query(Assessment.assessment_id).filter(
                    Assessment.offering_id == offering_id,
                    Assessment.status == 'PUBLISHED'
                ).subquery()
            ),
            StudentMark.student_id == enrollment.student_id
        ).all()
        if not marks: continue
        # Compute weighted % from IA1, IA2, SEE etc
        total = sum(float(m.marks_obtained or 0) for m in marks)
        assessment_max = {
             a.assessment_id: float(a.max_marks)
           for a in db.query(Assessment).filter(
            Assessment.offering_id == offering_id
            ).all()
}
        max_total = sum(
    assessment_max.get(m.assessment_id, 0)
    for m in marks
)
        pct = (total / max_total * 100) if max_total > 0 else 0
        # Map pct to grade point
        grade_point = 0.0
        for gs in grade_scales:
            if pct >= float(gs.min_percentage):
                grade_point = float(gs.grade_point)
                break
        # Simple SGPA = average grade point across enrolled subjects
        # (Full SGPA uses credits — simplified here for clarity)
        student = db.query(Student).filter(
            Student.student_id == enrollment.student_id).first()
        if student:
            # Update or insert academic progress
            prog = db.query(StudentAcademicProgress).filter(
                StudentAcademicProgress.student_id == enrollment.student_id,
                StudentAcademicProgress.term_id == offering.term_id
            ).first()
            if not prog:
                prog = StudentAcademicProgress(
                    student_id=enrollment.student_id,
                    academic_year_id=offering.academic_year_id,
                    term_id=offering.term_id,
                    semester_number=student.current_semester_number or 1
                )
                db.add(prog)
            prog.sgpa = grade_point
            prog.sgpa_status = 'COMPUTED'

            db.commit()
    
def advance_assessment_status(db, assessment_id, university_id, actor_id):
    a = db.query(Assessment).filter(
        Assessment.assessment_id == assessment_id,
        Assessment.university_id == university_id
    ).first()

    if not a:
        raise LookupError("Assessment not found")  # existing code to get assessment
    old_status = a.status
    # ... transition logic ...
    audit_service.log_action(
        db, university_id, actor_id,
        action='UPDATE',
        entity_type='assessments',
        entity_id=assessment_id,
        old_value={'status': old_status},
        new_value={'status': a.status}
    )
    db.commit()
    return a

