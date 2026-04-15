import statistics

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List

from app.database import get_db
from app.core.rbac import get_current_user
from app.models.academic import SubjectOffering, Subject
from app.models.students import Student, StudentSubjectEnrollment
from app.models.users import User
from app.models.attendance import AttendanceSession, AttendanceRecord
from app.models.marks import StudentMark
from app.services import marks_service as marks_svc
from app.schemas.faculty import (
    FacultySubjectOut,
    WorkloadOut,
    SubjectAnalyticsOut,
    OfferingInfoAnalytics,
    MarksAnalysisItem,
    DistributionBucket,
    AttendanceOverviewRow,
    AtRiskAnalyticsRow,
)

router = APIRouter(prefix='/faculty', tags=['Faculty'])


# ── helpers ──────────────────────────────────────────────────────────

def _faculty_offerings(db: Session, user, *, term_id: Optional[int] = None, active_only: bool = False):
    """Return (SubjectOffering, Subject|None) pairs where this user is course lead.

    Offerings do not link to ``subjects`` directly; the real path is
    ``curriculum_id → curriculum_structures → subject_id``.
    Until ``curriculum_structures`` exists we use a temporary shortcut:
    ``JOIN subjects ON subjects.subject_id = subject_offerings.curriculum_id``
    (treating ``curriculum_id`` as the subject primary key for lookup).

    Do **not** join subjects only on ``university_id`` — that would incorrectly
    pair every subject with every offering.

    TODO: replace with curriculum_structures join when available.
    """
    query = (
        db.query(SubjectOffering, Subject)
        .outerjoin(Subject, Subject.subject_id == SubjectOffering.curriculum_id)
        .filter(
            SubjectOffering.course_lead_id == user.user_id,
            SubjectOffering.university_id == user.university_id,
        )
    )
    if term_id is not None:
        query = query.filter(SubjectOffering.term_id == term_id)
    if active_only:
        query = query.filter(SubjectOffering.status == 'ACTIVE')
    return query.all()


def _to_subject_out(offering: SubjectOffering, subject: Optional[Subject]) -> FacultySubjectOut:
    return FacultySubjectOut(
        offering_id=offering.offering_id,
        batch_id=offering.batch_id,
        section_id=offering.section_id,
        term_id=offering.term_id,
        status=offering.status,
        current_enrollment=offering.current_enrollment or 0,
        max_enrollment=offering.max_enrollment,
        subject_code=subject.subject_code if subject else None,
        subject_name=subject.subject_name if subject else None,
        credits=float(subject.credits) if subject and subject.credits else None,
        subject_type=subject.subject_type if subject else None,
    )


# ── 1. list my subjects ─────────────────────────────────────────────

@router.get('/subjects', response_model=List[FacultySubjectOut])
def list_my_subjects(
    term_id: Optional[int] = Query(None),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = _faculty_offerings(db, user, term_id=term_id)
    return [_to_subject_out(o, s) for o, s in rows]


# ── 2. workload summary ─────────────────────────────────────────────

@router.get('/workload', response_model=WorkloadOut)
def workload(
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    active_rows = _faculty_offerings(db, user, active_only=True)

    theory = sum(float(s.theory_hours or 0) for _, s in active_rows if s)
    lab = sum(float(s.lab_hours or 0) for _, s in active_rows if s)

    return WorkloadOut(
        theory_hours_per_week=theory,
        lab_hours_per_week=lab,
        total_contact_hours=theory + lab,
        max_theory_hours=18,   # hardcoded until university_settings API is wired
        max_lab_hours=6,
        subjects=[_to_subject_out(o, s) for o, s in active_rows],
    )


# ── 3. subject analytics (marks + attendance + at-risk) ─────────────

def _student_display(db: Session, university_id: int, student_ids: List[int]) -> dict:
    """student_id → (usn, full_name)"""
    if not student_ids:
        return {}
    rows = (
        db.query(Student, User.full_name)
        .outerjoin(User, User.user_id == Student.user_id)
        .filter(
            Student.student_id.in_(student_ids),
            Student.university_id == university_id,
        )
        .all()
    )
    return {s.student_id: (s.usn, (fn or "").strip() if fn else "") for s, fn in rows}


@router.get('/subjects/{offering_id}/analytics', response_model=SubjectAnalyticsOut)
def subject_analytics(
    offering_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    offering = (
        db.query(SubjectOffering, Subject)
        .outerjoin(Subject, Subject.subject_id == SubjectOffering.curriculum_id)
        .filter(
            SubjectOffering.offering_id == offering_id,
            SubjectOffering.university_id == user.university_id,
        )
        .first()
    )
    if not offering:
        raise HTTPException(status_code=404, detail="Offering not found")
    off, subj = offering
    if off.course_lead_id != user.user_id:
        raise HTTPException(status_code=403, detail="Not your offering")

    uid = user.university_id

    student_ids = [
        e.student_id
        for e in db.query(StudentSubjectEnrollment.student_id).filter(
            StudentSubjectEnrollment.offering_id == offering_id,
            StudentSubjectEnrollment.university_id == uid,
            StudentSubjectEnrollment.status == "ENROLLED",
        ).all()
    ]

    display = _student_display(db, uid, student_ids)

    # ── marks analysis (per assessment) ────────────────────────────
    assessments = marks_svc.get_assessments(db, offering_id, uid)

    student_marks_pcts: dict = {}
    marks_analysis: List[MarksAnalysisItem] = []

    for a in assessments:
        max_marks = float(a.max_marks) if a.max_marks else 0.0

        marks = (
            db.query(StudentMark)
            .filter(
                StudentMark.assessment_id == a.assessment_id,
                StudentMark.university_id == uid,
            )
            .all()
        )

        values = [
            float(m.marks_obtained)
            for m in marks
            if m.marks_obtained is not None and not m.is_absent
        ]

        class_avg = round(statistics.mean(values), 2) if values else None
        highest = round(max(values), 2) if values else None
        lowest = round(min(values), 2) if values else None
        std_dev = round(statistics.stdev(values), 2) if len(values) > 1 else None

        buckets = {"0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0}
        for v in values:
            pct = (v / max_marks) * 100 if max_marks else 0.0
            if pct <= 20:
                buckets["0-20"] += 1
            elif pct <= 40:
                buckets["21-40"] += 1
            elif pct <= 60:
                buckets["41-60"] += 1
            elif pct <= 80:
                buckets["61-80"] += 1
            else:
                buckets["81-100"] += 1

        for m in marks:
            if max_marks > 0:
                pct = 0.0
                if not m.is_absent and m.marks_obtained is not None:
                    pct = (float(m.marks_obtained) / max_marks) * 100
                student_marks_pcts.setdefault(m.student_id, []).append(pct)

        marks_analysis.append(
            MarksAnalysisItem(
                assessment_id=a.assessment_id,
                title=a.title or "",
                max_marks=max_marks,
                class_avg=class_avg,
                highest=highest,
                lowest=lowest,
                std_dev=std_dev,
                distribution=[DistributionBucket(range=k, count=c) for k, c in buckets.items()],
            )
        )

    # ── attendance overview ─────────────────────────────────────────
    session_ids = [
        s[0]
        for s in db.query(AttendanceSession.session_id).filter(
            AttendanceSession.offering_id == offering_id,
            AttendanceSession.university_id == uid,
        ).all()
    ]
    total_sessions = len(session_ids)

    attendance_overview: List[AttendanceOverviewRow] = []
    student_att_pcts: dict = {}

    for sid in student_ids:
        present = 0
        if session_ids:
            present = (
                db.query(func.count(AttendanceRecord.attendance_id))
                .filter(
                    AttendanceRecord.session_id.in_(session_ids),
                    AttendanceRecord.student_id == sid,
                    AttendanceRecord.status.in_(["PRESENT", "LATE"]),
                )
                .scalar()
                or 0
            )
        absent = max(0, total_sessions - present)
        pct = round((present / total_sessions) * 100, 2) if total_sessions else 0.0
        student_att_pcts[sid] = pct
        usn, fname = display.get(sid, ("", ""))
        attendance_overview.append(
            AttendanceOverviewRow(
                student_id=sid,
                usn=usn,
                full_name=fname,
                attendance_pct=pct,
                present=int(present),
                absent=int(absent),
                total=total_sessions,
            )
        )

    attendance_overview.sort(key=lambda r: r.attendance_pct)

    # ── at-risk ─────────────────────────────────────────────────────
    at_risk: List[AtRiskAnalyticsRow] = []
    for sid in student_ids:
        att_pct = student_att_pcts.get(sid)
        mpcts = student_marks_pcts.get(sid, [])
        avg_mpct = round(statistics.mean(mpcts), 2) if mpcts else None

        low_att = att_pct is not None and att_pct < 75
        low_marks = avg_mpct is not None and avg_mpct < 40

        if low_att or low_marks:
            if low_att and low_marks:
                rt = "both"
            elif low_att:
                rt = "attendance"
            else:
                rt = "marks"
            usn, fname = display.get(sid, ("", ""))
            at_risk.append(
                AtRiskAnalyticsRow(
                    student_id=sid,
                    usn=usn,
                    full_name=fname,
                    risk_type=rt,
                    attendance_pct=att_pct,
                    avg_marks_pct=avg_mpct,
                )
            )

    offering_info = OfferingInfoAnalytics(
        subject_name=subj.subject_name if subj else None,
        subject_code=subj.subject_code if subj else None,
        section_id=off.section_id,
        batch_id=off.batch_id,
    )

    return SubjectAnalyticsOut(
        offering_info=offering_info,
        marks_analysis=marks_analysis,
        attendance_overview=attendance_overview,
        at_risk=at_risk,
    )
