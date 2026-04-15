"""Build per-offering attendance summaries for a student.

subject_offerings.curriculum_id is resolved via subjects.subject_id (same shortcut as faculty_router).
If curriculum_id later references a curriculum table, replace this join.
"""
from typing import List, Dict
from sqlalchemy.orm import Session

from app.models.students import StudentSubjectEnrollment
from app.models.attendance import AttendanceSession, AttendanceRecord
from app.models.academic import SubjectOffering, Subject
from app.schemas.students import AttendanceSummary, AttendanceSessionDetail


def build_attendance_summaries(
    db: Session, student_id: int, university_id: int,
) -> List[AttendanceSummary]:
    enrollments = (
        db.query(StudentSubjectEnrollment)
        .filter(
            StudentSubjectEnrollment.student_id == student_id,
            StudentSubjectEnrollment.university_id == university_id,
        )
        .all()
    )

    out: List[AttendanceSummary] = []

    for enrollment in enrollments:
        offering_id = enrollment.offering_id

        offering = (
            db.query(SubjectOffering)
            .filter(
                SubjectOffering.offering_id == offering_id,
                SubjectOffering.university_id == university_id,
            )
            .first()
        )
        subject = None
        if offering:
            subject = (
                db.query(Subject)
                .filter(
                    Subject.subject_id == offering.curriculum_id,
                    Subject.university_id == university_id,
                )
                .first()
            )
        subject_name = subject.subject_name if subject else "Unknown"
        subject_code = subject.subject_code if subject else ""

        sessions = (
            db.query(AttendanceSession)
            .filter(
                AttendanceSession.offering_id == offering_id,
                AttendanceSession.university_id == university_id,
            )
            .order_by(AttendanceSession.session_date, AttendanceSession.start_time)
            .all()
        )
        if not sessions:
            continue

        records = (
            db.query(AttendanceRecord)
            .filter(
                AttendanceRecord.student_id == student_id,
                AttendanceRecord.university_id == university_id,
            )
            .all()
        )
        by_session: Dict[int, AttendanceRecord] = {r.session_id: r for r in records}

        present = absent = late = 0
        session_rows: List[AttendanceSessionDetail] = []

        for sess in sessions:
            rec = by_session.get(sess.session_id)
            status = rec.status if rec else "ABSENT"
            if status == "PRESENT":
                present += 1
            elif status == "LATE":
                late += 1
            else:
                absent += 1

            session_rows.append(
                AttendanceSessionDetail(
                    session_id=sess.session_id,
                    session_date=sess.session_date,
                    session_type=sess.session_type or "THEORY",
                    status=status,
                    remark=rec.note if rec else None,
                )
            )

        total = len(sessions)
        pct = ((present + late) / total) * 100 if total else 0.0

        out.append(
            AttendanceSummary(
                offering_id=offering_id,
                subject_code=subject_code,
                subject_name=subject_name,
                total_sessions=total,
                present=present,
                absent=absent,
                late=late,
                percentage=round(pct, 2),
                sessions=session_rows,
            )
        )

    return out
