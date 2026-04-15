"""Default grading scale when ``grade_scales`` has no rows for a university."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any, List

from sqlalchemy.orm import Session

from app.models.marks import GradeScale
from app.schemas.academic import GradeScaleOut

# Ordered high → low by min_percentage (matches list_grade_scales ordering).
DEFAULT_GRADE_SCALE_DATA: List[dict] = [
    {"grade": "A+", "grade_point": 10.0, "min_percentage": 90.0, "max_percentage": 100.0, "is_passing": True},
    {"grade": "A", "grade_point": 9.0, "min_percentage": 80.0, "max_percentage": 89.0, "is_passing": True},
    {"grade": "B+", "grade_point": 8.0, "min_percentage": 70.0, "max_percentage": 79.0, "is_passing": True},
    {"grade": "B", "grade_point": 7.0, "min_percentage": 60.0, "max_percentage": 69.0, "is_passing": True},
    {"grade": "C", "grade_point": 6.0, "min_percentage": 50.0, "max_percentage": 59.0, "is_passing": True},
    {"grade": "D", "grade_point": 5.0, "min_percentage": 40.0, "max_percentage": 49.0, "is_passing": True},
    {"grade": "F", "grade_point": 0.0, "min_percentage": 0.0, "max_percentage": 39.0, "is_passing": False},
]


def default_grade_scale_out_list() -> List[GradeScaleOut]:
    return [GradeScaleOut(**row) for row in DEFAULT_GRADE_SCALE_DATA]


def grade_scale_rows_for_computation(db: Session, university_id: int) -> List[Any]:
    """ORM ``GradeScale`` rows if any; otherwise namespace objects with ``min_percentage`` and ``grade_point``."""
    scales = (
        db.query(GradeScale)
        .filter(GradeScale.university_id == university_id)
        .order_by(GradeScale.min_percentage.desc())
        .all()
    )
    if scales:
        return scales
    return [
        SimpleNamespace(min_percentage=d["min_percentage"], grade_point=d["grade_point"])
        for d in DEFAULT_GRADE_SCALE_DATA
    ]
