"""Assessment and marks services. Production DB is expected to be PostgreSQL."""
from datetime import date
from typing import Optional, List, Any

from sqlalchemy.orm import Session
from app.models.marks import Assessment, AssessmentType, StudentMark, StudentAcademicProgress
from app.core.grade_scale_defaults import grade_scale_rows_for_computation
from app.models.students import StudentSubjectEnrollment, Student
from app.models.academic import SubjectOffering
from app.models.users import User
from app.repositories import academic_repository as academic_repo

MARK_STATUS_TRANSITIONS = {
    'DRAFT':     'SUBMITTED',
    'SUBMITTED': 'VERIFIED',
    'VERIFIED':  'PUBLISHED',
}


def _offering_for_assessment(db: Session, offering_id: int, university_id: int) -> Optional[SubjectOffering]:
    return db.query(SubjectOffering).filter(
        SubjectOffering.offering_id == offering_id,
        SubjectOffering.university_id == university_id,
    ).first()


def _can_submit_draft(user) -> bool:
    return 'MARKS_ENTER' in getattr(user, 'permissions', [])


def _can_verify_or_send_back(user, offering: SubjectOffering) -> bool:
    if 'MARKS_VERIFY' in getattr(user, 'permissions', []):
        return True
    return bool(offering.course_lead_id and offering.course_lead_id == user.user_id)


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


def can_view_assessment_marks(db: Session, user, assessment_id: int, university_id: int) -> bool:
    a = db.query(Assessment).filter(
        Assessment.assessment_id == assessment_id,
        Assessment.university_id == university_id,
    ).first()
    if not a:
        return False
    perms = getattr(user, 'permissions', []) or []
    if 'MARKS_VIEW_ALL' in perms or 'MARKS_ENTER' in perms:
        return True
    off = _offering_for_assessment(db, a.offering_id, university_id)
    if not off:
        return False
    return _can_verify_or_send_back(user, off)


def get_marks_for_display(
    db: Session, assessment_id: int, university_id: int, *, include_students: bool
) -> List[dict]:
    """List of dicts suitable for MarkRowOut (usn/full_name only when include_students)."""
    rows = get_marks(db, assessment_id, university_id)
    meta: dict = {}
    if include_students:
        student_ids = [r.student_id for r in rows]
        if student_ids:
            q = (
                db.query(Student.student_id, Student.usn, User.full_name)
                .outerjoin(User, User.user_id == Student.user_id)
                .filter(
                    Student.student_id.in_(student_ids),
                    Student.university_id == university_id,
                )
                .all()
            )
            meta = {sid: (usn, (fn or "").strip() if fn else "") for sid, usn, fn in q}
    out: List[dict] = []
    for r in rows:
        usn = None
        full_name = None
        if include_students:
            u, fn = meta.get(r.student_id, ("", ""))
            usn = u or None
            full_name = fn or None
        out.append(
            {
                "mark_id": r.mark_id,
                "assessment_id": r.assessment_id,
                "student_id": r.student_id,
                "marks_obtained": float(r.marks_obtained) if r.marks_obtained is not None else None,
                "is_absent": bool(r.is_absent),
                "version": r.version,
                "usn": usn,
                "full_name": full_name,
            }
        )
    return out


def create_assessment(
    db: Session,
    university_id: int,
    offering_id: int,
    assessment_type_id: int,
    title: str,
    max_marks: float,
    passing_marks: Optional[float],
    conducted_on: Optional[date],
) -> Assessment:
    off = academic_repo.get_offering_by_id(db, offering_id, university_id)
    if not off:
        raise ValueError('Offering not found')
    at = db.query(AssessmentType).filter(
        AssessmentType.assessment_type_id == assessment_type_id,
        AssessmentType.university_id == university_id,
    ).first()
    if not at:
        raise ValueError('Assessment type not found')
    row = Assessment(
        university_id=university_id,
        offering_id=offering_id,
        assessment_type_id=assessment_type_id,
        title=title,
        max_marks=max_marks,
        passing_marks=passing_marks,
        conducted_on=conducted_on,
        status='DRAFT',
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


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

def update_assessment_status(
    db: Session,
    assessment_id: int,
    university_id: int,
    user,
    action: str = 'advance',
    reason: Optional[str] = None,
):
    """advance | verify | send_back — authorization enforced per transition."""
    a = db.query(Assessment).filter(
        Assessment.assessment_id == assessment_id,
        Assessment.university_id == university_id
    ).first()
    if not a:
        raise LookupError('Assessment not found')
    offering = _offering_for_assessment(db, a.offering_id, university_id)
    if not offering:
        raise LookupError('Offering not found')

    actor_id = user.user_id
    act = (action or 'advance').lower().strip()

    if act == 'send_back':
        if a.status != 'SUBMITTED':
            raise ValueError('Send back is only allowed from SUBMITTED')
        if not reason or not str(reason).strip():
            raise ValueError('Reason is required to send back')
        if not _can_verify_or_send_back(user, offering):
            raise ValueError('Not allowed to send back this assessment')
        a.status = 'DRAFT'
        a.send_back_reason = str(reason).strip()
        a.submitted_by = None
        db.commit()
        db.refresh(a)
        return a

    if act == 'verify':
        if a.status != 'SUBMITTED':
            raise ValueError('Verify applies only to SUBMITTED assessments')
        if not _can_verify_or_send_back(user, offering):
            raise ValueError('Not allowed to verify this assessment')
        a.status = 'VERIFIED'
        a.verified_by = actor_id
        a.send_back_reason = None
        db.commit()
        db.refresh(a)
        return a

    # advance (default): one step via MARK_STATUS_TRANSITIONS
    if act != 'advance':
        raise ValueError(f'Unknown action: {action}')

    cur = a.status
    next_status = MARK_STATUS_TRANSITIONS.get(cur)
    if not next_status:
        raise ValueError(f'Cannot advance from {cur}')

    if cur == 'DRAFT' and next_status == 'SUBMITTED':
        if not _can_submit_draft(user):
            raise ValueError('Not allowed to submit marks for this assessment')

    if cur == 'SUBMITTED' and next_status == 'VERIFIED':
        if not _can_verify_or_send_back(user, offering):
            raise ValueError('Not allowed to verify this assessment')

    if cur == 'VERIFIED' and next_status == 'PUBLISHED':
        if not _can_verify_or_send_back(user, offering):
            raise ValueError('Not allowed to publish this assessment')

    a.status = next_status
    if next_status == 'SUBMITTED':
        a.submitted_by = actor_id
    if next_status == 'VERIFIED':
        a.verified_by = actor_id
        a.send_back_reason = None
    if next_status == 'PUBLISHED':
        a.published_by = actor_id
        compute_sgpa_for_offering(db, a.offering_id, university_id)
    db.commit()
    db.refresh(a)
    return a


def compute_sgpa_for_offering(db: Session, offering_id: int, university_id: int):
    """Called when last assessment for offering is published. Computes SGPA."""
    offering = db.query(SubjectOffering).filter(
        SubjectOffering.university_id == university_id,
        SubjectOffering.offering_id == offering_id
    ).first()
    grade_scales = grade_scale_rows_for_computation(db, university_id)
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
    # Single transaction: caller (update_assessment_status) commits.
