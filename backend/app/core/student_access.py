"""Authorization helpers for student-scoped routes (staff, self-service, assigned mentor)."""
from __future__ import annotations

from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.students import Student
from app.models.mentorship import MentorAssignment

_STAFF_STUDENT_READ_PERMS = frozenset(
    {"STUDENT_VIEW", "USER_MANAGE", "ACADEMIC_MANAGE", "MARKS_VIEW_ALL"}
)


def _staff_can_read_directory(user) -> bool:
    perms = getattr(user, "permissions", []) or []
    return any(p in _STAFF_STUDENT_READ_PERMS for p in perms)


def student_id_for_user(db: Session, user_id: int, university_id: int) -> Optional[int]:
    row = (
        db.query(Student.student_id)
        .filter(Student.user_id == user_id, Student.university_id == university_id)
        .first()
    )
    return row[0] if row else None


def assert_can_read_student(
    db: Session, user, student_id: int, university_id: int
) -> None:
    """Allow: own profile, staff with student-directory perms, or active mentor assignment."""
    if student_id_for_user(db, user.user_id, university_id) == student_id:
        return
    if _staff_can_read_directory(user):
        return
    ma = (
        db.query(MentorAssignment)
        .filter(
            MentorAssignment.mentor_user_id == user.user_id,
            MentorAssignment.student_id == student_id,
            MentorAssignment.university_id == university_id,
            MentorAssignment.status == "ACTIVE",
        )
        .first()
    )
    if ma:
        return
    raise HTTPException(status_code=403, detail="Not allowed to access this student")


def assert_can_mutate_enrollment(
    db: Session, user, student_id: int, university_id: int
) -> None:
    """Enroll/drop — academic or user admin, or the student acting on their own record."""
    perms = getattr(user, "permissions", []) or []
    if "ACADEMIC_MANAGE" in perms or "USER_MANAGE" in perms:
        return
    if student_id_for_user(db, user.user_id, university_id) == student_id:
        return
    raise HTTPException(
        status_code=403,
        detail="Enrollment changes require ACADEMIC_MANAGE or USER_MANAGE, or must be your own record",
    )
