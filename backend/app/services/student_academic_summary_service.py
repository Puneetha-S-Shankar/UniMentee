"""Computed SGPA/CGPA trend from published marks + grade scale, with DB progress fallback."""

from __future__ import annotations

import logging
from collections import defaultdict
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.core.grade_scale_defaults import grade_scale_rows_for_computation
from app.models.academic import SubjectOffering
from app.models.marks import Assessment, StudentAcademicProgress, StudentMark
from app.models.students import StudentSubjectEnrollment
from app.schemas.students import AcademicTrendPointOut, StudentAcademicSummaryOut

logger = logging.getLogger(__name__)


def _offering_average_percentage(
    db: Session,
    offering_id: int,
    student_id: int,
    university_id: int,
) -> Optional[float]:
    assessments = (
        db.query(Assessment)
        .filter(
            Assessment.offering_id == offering_id,
            Assessment.university_id == university_id,
            Assessment.status == "PUBLISHED",
        )
        .all()
    )
    if not assessments:
        return None
    pcts: List[float] = []
    for a in assessments:
        sm = (
            db.query(StudentMark)
            .filter(
                StudentMark.assessment_id == a.assessment_id,
                StudentMark.student_id == student_id,
                StudentMark.university_id == university_id,
            )
            .first()
        )
        if not sm or sm.is_absent:
            continue
        marks_obtained = float(sm.marks_obtained) if sm.marks_obtained is not None else None
        max_m = float(a.max_marks) if a.max_marks is not None else 0.0
        if marks_obtained is not None and max_m > 0:
            pcts.append((marks_obtained / max_m) * 100.0)
    if not pcts:
        return None
    return sum(pcts) / len(pcts)


def _percentage_to_grade_point(pct: float, grade_scales: List[Any]) -> float:
    gp = 0.0
    for gs in grade_scales:
        if pct >= float(gs.min_percentage):
            gp = float(gs.grade_point)
            break
    return gp


def _summary_from_progress_table(
    db: Session, student_id: int
) -> StudentAcademicSummaryOut:
    rows = (
        db.query(StudentAcademicProgress)
        .filter(StudentAcademicProgress.student_id == student_id)
        .order_by(StudentAcademicProgress.semester_number.asc())
        .all()
    )
    trend: List[AcademicTrendPointOut] = []
    for p in rows:
        if p.sgpa is None:
            continue
        trend.append(
            AcademicTrendPointOut(
                term_id=p.term_id,
                term=f"Term {p.term_id}",
                sgpa=round(float(p.sgpa), 2),
            )
        )
    latest_sgpa = trend[-1].sgpa if trend else None
    cgpa_row = next((p for p in reversed(rows) if p.cgpa is not None), None)
    cgpa = round(float(cgpa_row.cgpa), 2) if cgpa_row else None
    if cgpa is None and trend:
        cgpa = round(sum(t.sgpa for t in trend) / len(trend), 2)
    return StudentAcademicSummaryOut(
        latest_sgpa=latest_sgpa,
        cgpa=cgpa,
        trend=trend,
    )


def build_student_academic_summary(
    db: Session,
    student_id: int,
    university_id: int,
) -> StudentAcademicSummaryOut:
    """Per term: mean grade point across enrolled subjects (from mean assessment % per subject)."""
    enrollments = (
        db.query(StudentSubjectEnrollment)
        .filter(
            StudentSubjectEnrollment.student_id == student_id,
            StudentSubjectEnrollment.university_id == university_id,
            StudentSubjectEnrollment.status == "ENROLLED",
        )
        .all()
    )
    grade_scales = grade_scale_rows_for_computation(db, university_id)
    term_points: Dict[int, List[float]] = defaultdict(list)

    for enr in enrollments:
        offering = (
            db.query(SubjectOffering)
            .filter(
                SubjectOffering.offering_id == enr.offering_id,
                SubjectOffering.university_id == university_id,
            )
            .first()
        )
        if not offering:
            continue
        avg_pct = _offering_average_percentage(
            db, offering.offering_id, student_id, university_id
        )
        if avg_pct is None:
            continue
        gp = _percentage_to_grade_point(avg_pct, grade_scales)
        term_points[offering.term_id].append(gp)

    trend: List[AcademicTrendPointOut] = []
    for term_id in sorted(term_points.keys()):
        gps = term_points[term_id]
        sgpa = round(sum(gps) / len(gps), 2)
        trend.append(
            AcademicTrendPointOut(
                term_id=term_id,
                term=f"Term {term_id}",
                sgpa=sgpa,
            )
        )

    latest_sgpa = trend[-1].sgpa if trend else None
    cgpa = round(sum(t.sgpa for t in trend) / len(trend), 2) if trend else None

    if not trend:
        fallback = _summary_from_progress_table(db, student_id)
        logger.info(
            "academic_summary marks_empty using_progress_fallback student_id=%s trend_len=%s",
            student_id,
            len(fallback.trend),
        )
        return fallback

    logger.info(
        "academic_summary from_marks student_id=%s university_id=%s terms=%s latest_sgpa=%s cgpa=%s",
        student_id,
        university_id,
        len(trend),
        latest_sgpa,
        cgpa,
    )
    return StudentAcademicSummaryOut(
        latest_sgpa=latest_sgpa,
        cgpa=cgpa,
        trend=trend,
    )
