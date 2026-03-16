from pydantic import BaseModel
from typing import Optional, List


class FacultySubjectOut(BaseModel):
    offering_id: int
    batch_id: int
    section_id: Optional[int]
    term_id: int
    status: str
    current_enrollment: int
    max_enrollment: Optional[int]
    subject_code: Optional[str]
    subject_name: Optional[str]
    credits: Optional[float]
    subject_type: Optional[str]
    class Config: from_attributes = True


class WorkloadOut(BaseModel):
    theory_hours_per_week: float
    lab_hours_per_week: float
    total_contact_hours: float
    max_theory_hours: float
    max_lab_hours: float
    subjects: List[FacultySubjectOut]


# ── offering analytics ───────────────────────────────────────────────

class DistributionBucket(BaseModel):
    range: str
    count: int

class AssessmentAnalytics(BaseModel):
    assessment_id: int
    title: str
    max_marks: float
    avg: Optional[float]
    max_score: Optional[float]
    min_score: Optional[float]
    std_dev: Optional[float]
    distribution: List[DistributionBucket]

class StudentAttendanceRow(BaseModel):
    student_id: int
    total_sessions: int
    present_count: int
    attendance_pct: float

class AtRiskStudent(BaseModel):
    student_id: int
    attendance_pct: Optional[float]
    avg_marks_pct: Optional[float]
    reason: str

class OfferingAnalytics(BaseModel):
    offering_id: int
    assessments: List[AssessmentAnalytics]
    attendance: List[StudentAttendanceRow]
    at_risk_students: List[AtRiskStudent]
