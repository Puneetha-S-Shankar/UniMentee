from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import date, timedelta
from app.database import get_db
from app.core.rbac import get_current_user
from app.repositories import mentor_repository as repo
from app.schemas.mentorship import (
    AssignmentOut, SessionIn, SessionOut,
    MenteeOut, MenteeStudentInfo, AtRiskFlags,
    DashboardStats, RecentSessionOut, UpcomingFollowupOut,
)
from app.schemas.students import (
    AttendanceSummary, AttendanceRecordDetail,
    OfferingMarks, AssessmentMarkDetail,
)
from app.models.students import Student, StudentSubjectEnrollment
from app.models.users import User
from app.models.mentorship import MentorAssignment, MentoringSession
from app.models.attendance import AttendanceSession, AttendanceRecord
from app.models.marks import Assessment, StudentMark

router = APIRouter(prefix='/mentor', tags=['Mentor'])

# ── helpers ──────────────────────────────────────────────────────────

def _check_at_risk(db: Session, student: Student, university_id: int) -> AtRiskFlags:
    academic = student.cgpa is not None and float(student.cgpa) < 5.5

    attendance = False
    enrollments = db.query(StudentSubjectEnrollment).filter(
        StudentSubjectEnrollment.student_id == student.student_id,
        StudentSubjectEnrollment.university_id == university_id,
    ).all()

    for enrollment in enrollments:
        session_ids = [
            s[0] for s in db.query(AttendanceSession.session_id).filter(
                AttendanceSession.offering_id == enrollment.offering_id,
                AttendanceSession.university_id == university_id,
            ).all()
        ]
        if not session_ids:
            continue

        present_or_late = db.query(func.count(AttendanceRecord.attendance_id)).filter(
            AttendanceRecord.session_id.in_(session_ids),
            AttendanceRecord.student_id == student.student_id,
            AttendanceRecord.status.in_(['PRESENT', 'LATE']),
        ).scalar() or 0

        if (present_or_late / len(session_ids)) * 100 < 75:
            attendance = True
            break

    return AtRiskFlags(attendance=attendance, academic=academic)


def _verify_mentor_assignment(
    db: Session, mentor_user_id: int, student_id: int, university_id: int,
) -> MentorAssignment:
    assignment = db.query(MentorAssignment).filter(
        MentorAssignment.mentor_user_id == mentor_user_id,
        MentorAssignment.student_id == student_id,
        MentorAssignment.university_id == university_id,
        MentorAssignment.status == 'ACTIVE',
    ).first()
    if not assignment:
        raise HTTPException(
            status_code=403,
            detail="No active mentor assignment for this student",
        )
    return assignment


def _build_attendance_summary(
    db: Session, student_id: int, university_id: int,
) -> List[AttendanceSummary]:
    enrollments = db.query(StudentSubjectEnrollment).filter(
        StudentSubjectEnrollment.student_id == student_id,
        StudentSubjectEnrollment.university_id == university_id,
    ).all()

    summaries = []
    for enrollment in enrollments:
        offering_id = enrollment.offering_id
        session_ids = [
            s[0] for s in db.query(AttendanceSession.session_id).filter(
                AttendanceSession.offering_id == offering_id,
                AttendanceSession.university_id == university_id,
            ).all()
        ]
        if not session_ids:
            continue

        records = db.query(AttendanceRecord).filter(
            AttendanceRecord.session_id.in_(session_ids),
            AttendanceRecord.student_id == student_id,
            AttendanceRecord.university_id == university_id,
        ).all()

        total_sessions = len(session_ids)
        present_count = sum(1 for r in records if r.status == 'PRESENT')
        absent_count = sum(1 for r in records if r.status == 'ABSENT')
        late_count = sum(1 for r in records if r.status == 'LATE')
        percentage = ((present_count + late_count) / total_sessions) * 100 if total_sessions else 0.0

        session_details = [
            AttendanceRecordDetail(
                attendance_id=r.attendance_id,
                session_id=r.session_id,
                status=r.status,
                marked_at=r.marked_at,
                note=r.note,
            )
            for r in records
        ]

        summaries.append(AttendanceSummary(
            offering_id=offering_id,
            total_sessions=total_sessions,
            present_count=present_count,
            absent_count=absent_count,
            late_count=late_count,
            percentage=round(percentage, 2),
            sessions=session_details,
        ))

    return summaries


def _build_student_marks(
    db: Session, student_id: int, university_id: int, *, published_only: bool = True,
) -> List[OfferingMarks]:
    enrollments = db.query(StudentSubjectEnrollment).filter(
        StudentSubjectEnrollment.student_id == student_id,
        StudentSubjectEnrollment.university_id == university_id,
    ).all()

    result = []
    for enrollment in enrollments:
        query = db.query(Assessment).filter(
            Assessment.offering_id == enrollment.offering_id,
            Assessment.university_id == university_id,
        )
        if published_only:
            query = query.filter(Assessment.status == 'PUBLISHED')

        assessments = query.all()
        if not assessments:
            continue

        details = []
        for assessment in assessments:
            mark = db.query(StudentMark).filter(
                StudentMark.assessment_id == assessment.assessment_id,
                StudentMark.student_id == student_id,
                StudentMark.university_id == university_id,
            ).first()

            marks_obtained = None
            is_absent = False
            percentage = None
            if mark:
                marks_obtained = float(mark.marks_obtained) if mark.marks_obtained else None
                is_absent = mark.is_absent
                if marks_obtained is not None and assessment.max_marks:
                    percentage = (marks_obtained / float(assessment.max_marks)) * 100

            details.append(AssessmentMarkDetail(
                assessment_id=assessment.assessment_id,
                title=assessment.title or "",
                max_marks=float(assessment.max_marks),
                marks_obtained=marks_obtained,
                is_absent=is_absent,
                status=assessment.status,
                percentage=round(percentage, 2) if percentage is not None else None,
            ))

        if details:
            result.append(OfferingMarks(
                offering_id=enrollment.offering_id,
                assessments=details,
            ))

    return result


# ── existing endpoints ───────────────────────────────────────────────

@router.get('/assignments', response_model=List[AssignmentOut])
def my_assignments(user=Depends(get_current_user), db=Depends(get_db)):
    return repo.get_assignments_for_mentor(db, user.user_id, user.university_id)

@router.get('/assignments/{assignment_id}/sessions', response_model=List[SessionOut])
def get_sessions(assignment_id: int, user=Depends(get_current_user), db=Depends(get_db)):

    assignment = repo.get_assignment_by_id(
        db, assignment_id, user.university_id
    )

    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    if assignment.mentor_user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return repo.get_sessions(db, assignment_id, user.university_id)

@router.post('/assignments/{assignment_id}/sessions', response_model=SessionOut)
def create_session(
    assignment_id: int, body: SessionIn,
    user=Depends(get_current_user), db=Depends(get_db)):
    assignment = repo.get_assignment_by_id(
        db, assignment_id, user.university_id
    )
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if assignment.mentor_user_id != user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return repo.create_session(
        db,
        assignment_id,
        user.university_id,
        user.user_id,
        body.model_dump(exclude_none=True)
    )

# ── mentor: mentees & dashboard ──────────────────────────────────────

@router.get('/mentees', response_model=List[MenteeOut])
def list_mentees(user=Depends(get_current_user), db: Session = Depends(get_db)):
    assignments = db.query(MentorAssignment).filter(
        MentorAssignment.mentor_user_id == user.user_id,
        MentorAssignment.university_id == user.university_id,
        MentorAssignment.status == 'ACTIVE',
    ).all()

    mentees = []
    for a in assignments:
        student = db.query(Student).filter(Student.student_id == a.student_id).first()
        if not student:
            continue
        user_obj = db.query(User).filter(User.user_id == student.user_id).first()
        if not user_obj:
            continue

        mentees.append(MenteeOut(
            assignment_id=a.assignment_id,
            student=MenteeStudentInfo(
                student_id=student.student_id,
                usn=student.usn,
                full_name=user_obj.full_name,
                email=user_obj.email,
                cgpa=float(student.cgpa) if student.cgpa else None,
                batch_id=student.batch_id,
                section_id=student.section_id,
                status=student.status,
            ),
            at_risk=_check_at_risk(db, student, user.university_id),
        ))

    return mentees


@router.get('/dashboard-stats', response_model=DashboardStats)
def dashboard_stats(user=Depends(get_current_user), db: Session = Depends(get_db)):
    today = date.today()
    university_id = user.university_id

    assignments = db.query(MentorAssignment).filter(
        MentorAssignment.mentor_user_id == user.user_id,
        MentorAssignment.university_id == university_id,
        MentorAssignment.status == 'ACTIVE',
    ).all()
    assignment_ids = [a.assignment_id for a in assignments]
    total_mentees = len(assignments)

    # assignment_id → student full_name
    name_lookup: dict = {}
    for a in assignments:
        student = db.query(Student).filter(Student.student_id == a.student_id).first()
        if student:
            u = db.query(User).filter(User.user_id == student.user_id).first()
            name_lookup[a.assignment_id] = u.full_name if u else "Unknown"
        else:
            name_lookup[a.assignment_id] = "Unknown"

    # ── pending follow-ups (overdue & unresolved) ──
    pending_followups = 0
    if assignment_ids:
        overdue = db.query(MentoringSession).filter(
            MentoringSession.assignment_id.in_(assignment_ids),
            MentoringSession.follow_up_required == True,
            MentoringSession.follow_up_date < today,
            MentoringSession.university_id == university_id,
        ).all()
        for s in overdue:
            newer = db.query(MentoringSession.session_id).filter(
                MentoringSession.assignment_id == s.assignment_id,
                MentoringSession.session_date >= s.follow_up_date,
                MentoringSession.session_id != s.session_id,
                MentoringSession.university_id == university_id,
            ).first()
            if not newer:
                pending_followups += 1

    # ── sessions this month ──
    first_of_month = today.replace(day=1)
    if assignment_ids:
        sessions_this_month = db.query(func.count(MentoringSession.session_id)).filter(
            MentoringSession.assignment_id.in_(assignment_ids),
            MentoringSession.session_date >= first_of_month,
            MentoringSession.university_id == university_id,
        ).scalar() or 0
    else:
        sessions_this_month = 0

    # ── uncontacted > 30 days ──
    thirty_days_ago = today - timedelta(days=30)
    uncontacted = 0
    for a in assignments:
        latest = db.query(func.max(MentoringSession.session_date)).filter(
            MentoringSession.assignment_id == a.assignment_id,
            MentoringSession.university_id == university_id,
        ).scalar()
        if latest is None or latest < thirty_days_ago:
            uncontacted += 1

    # ── at-risk count ──
    at_risk_count = 0
    for a in assignments:
        student = db.query(Student).filter(Student.student_id == a.student_id).first()
        if not student:
            continue
        risk = _check_at_risk(db, student, university_id)
        if risk.attendance or risk.academic:
            at_risk_count += 1

    # ── recent sessions (last 5) ──
    if assignment_ids:
        recent = db.query(MentoringSession).filter(
            MentoringSession.assignment_id.in_(assignment_ids),
            MentoringSession.university_id == university_id,
        ).order_by(MentoringSession.session_date.desc()).limit(5).all()
    else:
        recent = []

    recent_sessions = [
        RecentSessionOut(
            session_id=s.session_id,
            assignment_id=s.assignment_id,
            session_date=s.session_date,
            student_name=name_lookup.get(s.assignment_id, "Unknown"),
            topics_discussed=s.topics_discussed,
        )
        for s in recent
    ]

    # ── upcoming follow-ups (next 7 days) ──
    next_week = today + timedelta(days=7)
    if assignment_ids:
        upcoming = db.query(MentoringSession).filter(
            MentoringSession.assignment_id.in_(assignment_ids),
            MentoringSession.follow_up_required == True,
            MentoringSession.follow_up_date >= today,
            MentoringSession.follow_up_date <= next_week,
            MentoringSession.university_id == university_id,
        ).all()
    else:
        upcoming = []

    upcoming_followups = [
        UpcomingFollowupOut(
            session_id=s.session_id,
            assignment_id=s.assignment_id,
            student_name=name_lookup.get(s.assignment_id, "Unknown"),
            follow_up_date=s.follow_up_date,
            action_items=s.action_items,
        )
        for s in upcoming
    ]

    return DashboardStats(
        total_mentees=total_mentees,
        pending_followups=pending_followups,
        sessions_this_month=sessions_this_month,
        uncontacted_30days=uncontacted,
        at_risk_count=at_risk_count,
        recent_sessions=recent_sessions,
        upcoming_followups=upcoming_followups,
    )


# ── mentor: per-mentee drill-down ────────────────────────────────────

@router.get('/mentees/{student_id}/attendance', response_model=List[AttendanceSummary])
def get_mentee_attendance(
    student_id: int,
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    _verify_mentor_assignment(db, user.user_id, student_id, user.university_id)
    return _build_attendance_summary(db, student_id, user.university_id)


@router.get('/mentees/{student_id}/marks', response_model=List[OfferingMarks])
def get_mentee_marks(
    student_id: int,
    term_id: Optional[int] = Query(None),
    user=Depends(get_current_user), db: Session = Depends(get_db)):
    _verify_mentor_assignment(db, user.user_id, student_id, user.university_id)
    return _build_student_marks(db, student_id, user.university_id, published_only=False)


# ── student-facing ───────────────────────────────────────────────────

@router.get('/my-sessions', response_model=List[SessionOut])
def my_sessions(user=Depends(get_current_user), db=Depends(get_db)):
    student = db.query(Student).filter(
    Student.user_id == user.user_id,
    Student.university_id == user.university_id
    ).first()

    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    assignment = repo.get_assignment_for_student(
        db, student.student_id, user.university_id
    )
    if not assignment: raise HTTPException(status_code=404, detail='No active mentor assignment')
    return repo.get_sessions(db, assignment.assignment_id, user.university_id)
