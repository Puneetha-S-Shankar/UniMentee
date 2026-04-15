from pydantic import BaseModel
from typing import Optional
from datetime import date


class MarkRowOut(BaseModel):
    """Student marks row with optional identity fields for verification UI."""

    mark_id: int
    assessment_id: int
    student_id: int
    marks_obtained: Optional[float]
    is_absent: bool
    version: int
    usn: Optional[str] = None
    full_name: Optional[str] = None

    class Config:
        from_attributes = True


class AssessmentIn(BaseModel):
    assessment_type_id: int
    title: str
    max_marks: float
    passing_marks: Optional[float] = None
    conducted_on: Optional[date] = None


class AssessmentOut(BaseModel):
    assessment_id: int
    university_id: int
    offering_id: int
    assessment_type_id: int
    title: Optional[str]
    max_marks: float
    passing_marks: Optional[float]
    conducted_on: Optional[date]
    status: str
    submitted_by: Optional[int] = None
    verified_by: Optional[int] = None
    send_back_reason: Optional[str] = None
    version: int

    class Config:
        from_attributes = True


class AssessmentStatusBody(BaseModel):
    """advance: follow DRAFT→SUBMITTED→VERIFIED→PUBLISHED. verify: SUBMITTED→VERIFIED. send_back: SUBMITTED→DRAFT."""

    action: str = "advance"
    reason: Optional[str] = None
