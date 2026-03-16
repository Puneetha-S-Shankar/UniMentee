import statistics

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List

from app.database import get_db
from app.core.rbac import get_current_user
from app.models.academic import SubjectOffering, Subject
from app.models.students import StudentSubjectEnrollment
from app.models.attendance import AttendanceSession, AttendanceRecord
from app.models.marks import Assessment, StudentMark
from app.schemas.faculty import (
    FacultySubjectOut, WorkloadOut,
    OfferingAnalytics, AssessmentAnalytics, DistributionBucket,
    StudentAttendanceRow, AtRiskStudent,
)

router = APIRouter(prefix='/faculty', tags=['Faculty'])


# ── helpers ──────────────────────────────────────────────────────────

def _faculty_offerings(db: Session, user, *, term_id: Optional[int] = None):
    """Return (SubjectOffering, Subject|None) pairs for current faculty.

    TODO: replace the outerjoin with the proper path
          offering → curriculum_structures → subjects
          once the curriculum_structures table exists.
          Currently using curriculum_id as a proxy for subject_id.
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
    rows = _faculty_offerings(db, user)
    active = [(o, s) for o, s in rows if o.status == 'ACTIVE']

    theory = sum(float(s.theory_hours or 0) for _, s in active if s)
    lab = sum(float(s.lab_hours or 0) for _, s in active if s)

    return WorkloadOut(
        theory_hours_per_week=theory,
        lab_hours_per_week=lab,
        total_contact_hours=theory + lab,
        max_theory_hours=18,   # hardcoded until university_settings API is wired
        max_lab_hours=6,
        subjects=[_to_subject_out(o, s) for o, s in rows],
    )


# ── 3. offering analytics ───────────────────────────────────────────

@router.get('/subjects/{offering_id}/analytics', response_model=OfferingAnalytics)
def offering_analytics(
    offering_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    offering = db.query(SubjectOffering).filter(
        SubjectOffering.offering_id == offering_id,
        SubjectOffering.university_id == user.university_id,
    ).first()
    if not offering:
        raise HTTPException(status_code=404, detail="Offering not found")
    if offering.course_lead_id != user.user_id:
        raise HTTPException(status_code=403, detail="Not your offering")

    uid = user.university_id

    # enrolled students
    student_ids = [
        e.student_id
        for e in db.query(StudentSubjectEnrollment.student_id).filter(
            StudentSubjectEnrollment.offering_id == offering_id,
            StudentSubjectEnrollment.university_id == uid,
        ).all()
    ]

    # ── assessment analytics ──
    assessments = db.query(Assessment).filter(
        Assessment.offering_id == offering_id,
        Assessment.university_id == uid,
    ).all()

    student_marks_pcts: dict = {}          # student_id → [pct, …]
    assessment_results: List[AssessmentAnalytics] = []

    for a in assessments:
        max_marks = float(a.max_marks) if a.max_marks else 0

        marks = db.query(StudentMark).filter(
            StudentMark.assessment_id == a.assessment_id,
            StudentMark.university_id == uid,
        ).all()

        values = [
            float(m.marks_obtained)
            for m in marks
            if m.marks_obtained is not None and not m.is_absent
        ]

        avg_val = round(statistics.mean(values), 2) if values else None
        max_val = round(max(values), 2) if values else None
        min_val = round(min(values), 2) if values else None
        std_val = round(statistics.stdev(values), 2) if len(values) > 1 else None

        buckets = {"0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0}
        for v in values:
            pct = (v / max_marks) * 100 if max_marks else 0
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
                if m.is_absent:
                    pct = 0.0
                elif m.marks_obtained is not None:
                    pct = (float(m.marks_obtained) / max_marks) * 100
                student_marks_pcts.setdefault(m.student_id, []).append(pct)

        assessment_results.append(AssessmentAnalytics(
            assessment_id=a.assessment_id,
            title=a.title or "",
            max_marks=max_marks,
            avg=avg_val,
            max_score=max_val,
            min_score=min_val,
            std_dev=std_val,
            distribution=[DistributionBucket(range=k, count=c) for k, c in buckets.items()],
        ))

    # ── attendance analytics ──
    session_ids = [
        s[0]
        for s in db.query(AttendanceSession.session_id).filter(
            AttendanceSession.offering_id == offering_id,
            AttendanceSession.university_id == uid,
        ).all()
    ]
    total_sessions = len(session_ids)

    attendance_rows: List[StudentAttendanceRow] = []
    student_att_pcts: dict = {}

    if student_ids and session_ids:
        for sid in student_ids:
            present = db.query(func.count(AttendanceRecord.attendance_id)).filter(
                AttendanceRecord.session_id.in_(session_ids),
                AttendanceRecord.student_id == sid,
                AttendanceRecord.status.in_(['PRESENT', 'LATE']),
            ).scalar() or 0

            pct = round((present / total_sessions) * 100, 2) if total_sessions else 0.0
            student_att_pcts[sid] = pct
            attendance_rows.append(StudentAttendanceRow(
                student_id=sid,
                total_sessions=total_sessions,
                present_count=present,
                attendance_pct=pct,
            ))

    # ── at-risk students ──
    at_risk: List[AtRiskStudent] = []
    for sid in student_ids:
        att_pct = student_att_pcts.get(sid)
        mpcts = student_marks_pcts.get(sid, [])
        avg_mpct = round(statistics.mean(mpcts), 2) if mpcts else None

        low_att = att_pct is not None and att_pct < 75
        low_marks = avg_mpct is not None and avg_mpct < 40

        if low_att or low_marks:
            if low_att and low_marks:
                reason = "BOTH"
            elif low_att:
                reason = "LOW_ATTENDANCE"
            else:
                reason = "LOW_MARKS"
            at_risk.append(AtRiskStudent(
                student_id=sid,
                attendance_pct=att_pct,
                avg_marks_pct=avg_mpct,
                reason=reason,
            ))

    return OfferingAnalytics(
        offering_id=offering_id,
        assessments=assessment_results,
        attendance=attendance_rows,
        at_risk_students=at_risk,
    )
